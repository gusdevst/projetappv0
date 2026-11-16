// services/addresses.js
// Adresses de livraison enregistrées dans le compte (table `addresses`, voir supabase/sql/orders_et_adresses.sql).
// Une seule adresse est « par défaut » : elle est reprise toute seule au moment d'une commande.
// Les adresses vivent sur le serveur : on les retrouve sur un nouveau téléphone.
//
// Forme côté app :
//   { id, label, name, street, complement, postalCode, city, phone, isDefault }
// La saisie se fait en UNE ligne (« 12 Rue de Lille 59100 Roubaix », avec les suggestions de AddressInput) :
// `parseAddressLine` la découpe en rue / code postal / ville, que l'imprimeur exige séparés.

import { supabase } from "./supabase";
import { accountPhone, rememberAccountPhone } from "./auth";

export const NOT_SIGNED_IN = "NOT_SIGNED_IN";

// ── Fonctions pures ─────────────────────────────────────────────────────────

// « 12 Rue de Lille 59100 Roubaix » → { street: "12 Rue de Lille", postalCode: "59100", city: "Roubaix" } ; null si illisible.
export function parseAddressLine(line) {
  const m = String(line ?? "").trim().replace(/\s+/g, " ").match(/^(.+?)[\s,]+(\d{5})\s+(.+)$/);
  if (!m) return null;
  const street = m[1].replace(/[,\s]+$/, "");
  const city = m[3].trim();
  if (!street || !city) return null;
  return { street, postalCode: m[2], city };
}

// Ligne d'affichage d'une adresse enregistrée (ce que le formulaire remet dans le champ).
export const addressLine = (a) => (a ? [a.street, [a.postalCode, a.city].filter(Boolean).join(" ")].filter(Boolean).join(" ") : "");

// Téléphone français : 10 chiffres (06…) ou +33 / 0033 suivi de 9 chiffres. Renvoie le numéro nettoyé ou null.
export function cleanPhone(raw) {
  const digits = String(raw ?? "").replace(/[\s.\-()]/g, "");
  if (/^0\d{9}$/.test(digits)) return digits;
  const m = digits.match(/^(?:\+33|0033)(\d{9})$/);
  return m ? `0${m[1]}` : null;
}

// Vérifie un formulaire d'adresse. Renvoie { error } (texte pour l'utilisateur) ou { value } (adresse propre).
// `form` = { label, name, line, complement, phone }
export function validateAddressForm(form, { needLabel = false } = {}) {
  const name = String(form.name ?? "").trim();
  if (name.length < 2) return { error: "Indique le nom du destinataire." };
  const parsed = parseAddressLine(form.line);
  if (!parsed) return { error: "Choisis une adresse dans les suggestions, ou écris-la sous la forme : numéro et rue, code postal, ville." };
  const phone = cleanPhone(form.phone);
  if (!phone) return { error: "Indique un numéro de téléphone français (10 chiffres) : le livreur en a besoin." };
  const label = String(form.label ?? "").trim();
  if (needLabel && !label) return { error: "Donne un nom à cette adresse (ex. « Chez Maman »)." };
  return {
    value: {
      label: label || "Chez moi",
      name,
      street: parsed.street,
      postalCode: parsed.postalCode,
      city: parsed.city,
      complement: String(form.complement ?? "").trim(),
      phone,
    },
  };
}

// ── Conversion table ↔ app ──────────────────────────────────────────────────

const fromRow = (r) => ({
  id: r.id, label: r.label, name: r.name, street: r.street, complement: r.complement ?? "",
  postalCode: r.postal_code, city: r.city, phone: r.phone, isDefault: !!r.is_default,
});
const toRow = (a) => ({
  label: a.label, name: a.name, street: a.street, complement: a.complement || null,
  postal_code: a.postalCode, city: a.city, country: "FR", phone: a.phone,
});

// Copie figée de l'adresse, écrite dans la commande (modifier l'adresse plus tard ne change pas la commande).
export const addressSnapshot = (a) => ({
  name: a.name, street: a.street, complement: a.complement || null,
  postal_code: a.postalCode, city: a.city, country: "FR", phone: a.phone,
});
export const addressFromSnapshot = (s) => ({
  id: null, label: "", name: s.name, street: s.street, complement: s.complement ?? "",
  postalCode: s.postal_code, city: s.city, phone: s.phone, isDefault: false,
});

// ── Accès serveur ───────────────────────────────────────────────────────────

async function userId() {
  const { data } = await supabase.auth.getSession();
  const id = data?.session?.user?.id;
  if (!id) throw new Error(NOT_SIGNED_IN);
  return id;
}

// Mes adresses : celle par défaut en premier, puis les plus récentes.
export async function listAddresses() {
  await userId();
  const { data, error } = await supabase.from("addresses").select("*")
    .order("is_default", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

// Crée (sans `id`) ou modifie (avec `id`) une adresse. `makeDefault` = true la rend « par défaut ».
// La toute première adresse du compte devient toujours celle par défaut.
export async function saveAddress(address, { makeDefault = false } = {}) {
  const uid = await userId();
  let asDefault = makeDefault;
  if (!address.id && !asDefault) {
    const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true });
    asDefault = (count ?? 0) === 0;
  }
  if (asDefault) {
    // On libère d'abord l'ancienne adresse par défaut (une seule par compte).
    const q = supabase.from("addresses").update({ is_default: false }).eq("user_id", uid).eq("is_default", true);
    const { error } = address.id ? await q.neq("id", address.id) : await q;
    if (error) throw error;
  }
  const row = { ...toRow(address), updated_at: new Date().toISOString() };
  if (asDefault) row.is_default = true;
  const res = address.id
    ? await supabase.from("addresses").update(row).eq("id", address.id).select("*").single()
    : await supabase.from("addresses").insert({ ...row, is_default: asDefault }).select("*").single();
  if (res.error) throw res.error;
  // Adresse par défaut = la mienne : si le compte n'a pas encore de téléphone, on le retient pour pré-remplir la suite.
  if (asDefault) {
    const { data } = await supabase.auth.getSession();
    if (!accountPhone(data?.session)) await rememberAccountPhone(address.phone);
  }
  return fromRow(res.data);
}

export async function setDefaultAddress(id) {
  const uid = await userId();
  const a = await supabase.from("addresses").update({ is_default: false }).eq("user_id", uid).eq("is_default", true).neq("id", id);
  if (a.error) throw a.error;
  const b = await supabase.from("addresses").update({ is_default: true }).eq("id", id);
  if (b.error) throw b.error;
}

// Supprime une adresse ; si c'était celle par défaut, la plus récente restante la remplace.
export async function deleteAddress(id) {
  await userId();
  const { data: row } = await supabase.from("addresses").select("is_default").eq("id", id).maybeSingle();
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) throw error;
  if (row?.is_default) {
    const { data: next } = await supabase.from("addresses").select("id").order("created_at", { ascending: false }).limit(1);
    if (next?.[0]) await setDefaultAddress(next[0].id);
  }
}
