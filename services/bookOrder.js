// services/bookOrder.js
// Commande d'un livre photo : de la ligne `orders` jusqu'à la transmission à l'imprimeur.
//
// Les étapes (chacune peut être rejouée sans rien casser — c'est ce qui permet « Réessayer ») :
//   1. createBookOrder  → ligne `orders` en « draft » (adresse RECOPIÉE, accord de l'utilisateur daté)
//   2. (l'écran fabrique le PDF avec useBookPdf)
//   3. uploadBookPdf    → PDF déposé dans le dossier privé `print-files`, ligne en « file_ready »
//   4. submitBookOrder  → fonction serveur `imprimeur-order` : prix recalculé, commande chez imprimeur.fr
// Aucune clé imprimeur.fr dans l'app. Pas de paiement ici (Stripe viendra s'insérer entre le clic « Payer » et l'étape 1).
// SQL : supabase/sql/orders_et_adresses.sql · fonction : supabase/functions/imprimeur-order.

import * as FileSystem from "expo-file-system/legacy";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase";
import { addressSnapshot } from "./addresses";
import { bookSpec } from "./bookProducts";

const BUCKET = "print-files";
export const NOT_SIGNED_IN = "NOT_SIGNED_IN";

// Erreur typée : kind = "network" · "server" (refus / config) · "supplier" (imprimeur.fr a refusé) · "auth".
export function fail(kind, message, code) {
  const e = new Error(message);
  e.kind = kind;
  if (code) e.code = code;
  return e;
}
export const isNetworkError = (e) => /network request failed|failed to fetch|timed out|offline|internet/i.test(String(e?.message ?? e));

export async function session() {
  const { data } = await supabase.auth.getSession();
  const s = data?.session;
  if (!s) throw fail("auth", "Connexion requise.", NOT_SIGNED_IN);
  return s;
}

// Textes d'étapes (affichage) selon l'état d'une commande.
export const ORDER_STATUS = {
  draft:       { label: "Non envoyée",        tone: "warn" },
  file_ready:  { label: "À transmettre",      tone: "warn" },
  failed:      { label: "À reprendre",        tone: "warn" },
  received:    { label: "Reçue",              tone: "ok" },   // poster : enregistré chez Pellicule, pas (encore) transmis à l'imprimeur
  transmitted: { label: "En préparation",     tone: "ok" },
  printed:     { label: "Imprimée",           tone: "ok" },
  mailed:      { label: "Expédiée",           tone: "ok" },
  delivered:   { label: "Livrée",             tone: "done" },
  cancelled:   { label: "Annulée",            tone: "warn" },
};
// Les 4 temps du suivi (bloc « En route » du Labo + écran de suivi). `transmitted` = 1re étape, `delivered` = dernière.
export const ORDER_STEPS = [
  { key: "transmitted", label: "Transmise à l'imprimeur" },
  { key: "printed",     label: "Imprimée" },
  { key: "mailed",      label: "Expédiée" },
  { key: "delivered",   label: "Livrée" },
];
export const orderStepIndex = (o) => Math.max(0, ORDER_STEPS.findIndex((s) => s.key === o?.status));
// Type de commande : livre photo · poster · tirages (table `orders`, colonne kind). Textes et écran de reprise selon le type.
export const orderKindOf = (o) => (o?.kind === "poster" ? "poster" : o?.kind === "print" ? "print" : "book");
export const ORDER_KIND_LABEL = { book: "Livre photo", poster: "Poster", print: "Tirages photo" };
export const ORDER_RESUME_ROUTE = { book: "BookOrderProgress", poster: "PosterOrderProgress", print: "PrintOrderProgress" };
const BOOK_SIZE = { a4: "21 × 29,7 cm", paysage: "21 × 15 cm" };
const POSTER_SIZE = { a4: "A4 · 21 × 29,7 cm", a3: "A3 · 29,7 × 42 cm", a2: "A2 · 42 × 59,4 cm", a1: "A1 · 59 × 84 cm" };
// « 24 pages · 21 × 29,7 cm » · « Poster A3 · 29,7 × 42 cm × 2 » · « 40 tirages 10 × 15 cm »
export function orderProductLine(o) {
  const k = orderKindOf(o);
  if (k === "poster") return `Poster ${POSTER_SIZE[o.product] ?? ""}${o.quantity > 1 ? ` × ${o.quantity}` : ""}`;
  if (k === "print") return `${o.quantity} tirages ${String(o.product).replace("x", " × ")} cm`;
  return `${o.pages} pages · ${BOOK_SIZE[o.product] ?? ""}`;
}
export const isIncomplete = (o) => ["draft", "file_ready", "failed"].includes(o?.status);
// Commande reçue par Pellicule mais gardée ici : pas transmise à l'imprimeur (posters pour l'instant).
export const isHeld = (o) => o?.status === "received";
export const isFinal = (o) => ["delivered", "cancelled"].includes(o?.status);

// 1. Crée la commande (brouillon). `address` = adresse de l'app (voir services/addresses.js).
export async function createBookOrder({ albumId, book, albumName, address }) {
  const s = await session();
  const spec = bookSpec(book);
  const { data, error } = await supabase.from("orders").insert({
    user_id: s.user.id,
    kind: "book",
    album_id: albumId,
    title: book.cover?.title || albumName || "",
    product: spec.key,
    pages: book.format,
    address: addressSnapshot(address),
  }).select("*").single();
  if (error) throw fail(isNetworkError(error) ? "network" : "server", `Commande refusée (${error.code ?? "?"}) : ${error.message}`);
  return data;
}

export async function getOrder(id) {
  const { data, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw fail(isNetworkError(error) ? "network" : "server", error.message);
  return data;
}

// Mes commandes, les plus récentes d'abord.
export async function listOrders() {
  await session();
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw fail(isNetworkError(error) ? "network" : "server", error.message);
  return data ?? [];
}

// Abandonner une commande JAMAIS transmise à l'imprimeur (brouillon, « à transmettre », « à reprendre ») :
// on supprime le PDF déposé puis la ligne. Renvoie true si la ligne a bien disparu, false sinon (déjà transmise, ou règle de
// sécurité du serveur pas à jour : voir supabase/sql/orders_annulation.sql). Une commande transmise ne s'annule jamais d'ici.
export async function discardOrder(order) {
  if (!order?.id || !isIncomplete(order) || order.supplier_ref) return false;
  try {
    if (order.file_path) {
      // Livre / poster : un seul fichier. Tirages : un DOSSIER de photos (on les supprime toutes).
      let paths = [order.file_path];
      if (order.kind === "print") {
        const { data: list } = await supabase.storage.from(BUCKET).list(order.file_path, { limit: 1000 });
        paths = (list ?? []).map((f) => `${order.file_path}/${f.name}`);
      }
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths).catch(() => {}); // fichier orphelin = sans gravité
    }
    const { data, error } = await supabase.from("orders").delete().eq("id", order.id).select("id");
    return !error && (data?.length ?? 0) > 0;
  } catch (e) {
    return false;
  }
}

// 3. Dépose le PDF dans le dossier privé puis passe la commande en « file_ready ».
export async function uploadBookPdf(order, pdfUri) {
  const s = await session();
  const path = `${s.user.id}/${order.id}.pdf`;
  let res;
  try {
    res = await FileSystem.uploadAsync(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, pdfUri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, // le fichier part tel quel, sans le charger en mémoire
      headers: {
        Authorization: `Bearer ${s.access_token}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/pdf",
        "x-upsert": "true", // un 2e essai remplace le fichier déjà déposé
      },
    });
  } catch (e) {
    throw fail(isNetworkError(e) ? "network" : "server", `Envoi du livre : ${e?.message ?? e}`);
  }
  if (res.status < 200 || res.status >= 300) throw fail("server", `Livre refusé (${res.status}) : ${res.body?.slice?.(0, 160)}`);

  const { data, error } = await supabase.from("orders")
    .update({ file_path: path, status: "file_ready", error: null, updated_at: new Date().toISOString() })
    .eq("id", order.id).select("*").single();
  if (error) throw fail(isNetworkError(error) ? "network" : "server", `Commande non mise à jour : ${error.message}`);
  return data;
}

// Réponse de la fonction serveur → commande, ou erreur typée.
export async function callOrderFunction(action, orderId) {
  await session();
  const { data, error } = await supabase.functions.invoke("imprimeur-order", { body: { action, orderId } });
  if (error) {
    // Le corps de l'erreur (JSON de la fonction) est dans error.context quand le serveur a répondu.
    let body = null;
    try { body = await error.context?.json?.(); } catch (e) { /* pas de corps lisible */ }
    if (body?.error) throw fail(body.code === "siret_required" || body.code === "payment_method_required" ? "supplier" : "server", body.error, body.code);
    throw fail(isNetworkError(error) ? "network" : "server", error.message ?? String(error));
  }
  if (!data?.ok) throw fail("server", data?.error ?? "Réponse inattendue du serveur.", data?.code);
  return data.order;
}

// 4. Transmet la commande à l'imprimeur (le serveur recalcule le prix et applique le garde-fou clé live).
export const submitBookOrder = (orderId) => callOrderFunction("submit", orderId);

// Relit le statut + le numéro de suivi chez l'imprimeur. Silencieux en cas d'échec : on garde ce qu'on sait.
export async function refreshBookOrder(order) {
  try { return await callOrderFunction("refresh", order.id); } catch (e) { return order; }
}

// Message pour l'utilisateur selon l'erreur (jamais de jargon technique ; le détail reste dans `e.message`).
export function orderErrorText(e) {
  if (e?.code === "siret_required" || e?.code === "payment_method_required" || e?.code === "orders_disabled") {
    return "Les commandes ne sont pas encore ouvertes. Ta commande est bien enregistrée : tu pourras la relancer dès que ce sera le cas.";
  }
  if (e?.kind === "network") return "Ta connexion a sans doute coupé. Ta commande est enregistrée : on reprend là où on s'est arrêté.";
  if (e?.kind === "auth") return "Tu n'es plus connecté. Reconnecte-toi puis réessaie.";
  return "Quelque chose s'est mal passé de notre côté. Ta commande est enregistrée : tu peux réessayer.";
}
