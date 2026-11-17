// services/sharedAlbums.js
// Albums partagés (côté propriétaire pour l'instant) : créer le partage, lire le code, les membres, changer le code.
// Tout passe par Supabase (tables shared_*, voir supabase/sql/albums_partages.sql). Aucune photo ne voyage ici.
// Les fonctions renvoient { ok: true, ... } ou { ok: false, message } (message en français), comme services/auth.js.
import { supabase } from "./supabase";

// Lien pour télécharger Pellicule, glissé dans le message d'invitation.
// ⚠️ À REMPLIR le jour où l'app est sur les stores (page ou lien App Store / Play Store). Vide = la ligne « Télécharge » est omise.
export const STORE_LINK = "";

// ── Prénom (affiché aux invités / au propriétaire) : gardé dans le compte, user_metadata.first_name ──
export const accountFirstName = (session) => (session?.user?.user_metadata?.first_name ?? "").trim() || null;

export async function rememberFirstName(name) {
  try {
    const { error } = await supabase.auth.updateUser({ data: { first_name: name.trim() } });
    return !error;
  } catch (e) { return false; }
}

// Traduit les erreurs serveur (messages levés par les fonctions SQL) en phrases claires.
function sharedError(error) {
  const msg = (error?.message || "").toLowerCase();
  if (msg.includes("not_signed_in")) return "Connecte-toi pour partager un album.";
  if (msg.includes("not_owner")) return "Seul le propriétaire de l'album peut faire ça.";
  if (msg.includes("network") || msg.includes("fetch")) return "Pas de connexion internet. Réessaie.";
  return "Oups, quelque chose s'est mal passé. Réessaie.";
}

// Partage un album du téléphone (ou retrouve son partage s'il existe déjà). Renvoie { ok, album: { id, name, code, ... } }.
export async function shareAlbum({ localAlbumId, name, ownerName }) {
  try {
    const { data, error } = await supabase.rpc("create_shared_album", {
      p_local_album_id: String(localAlbumId), p_name: name, p_owner_name: ownerName,
    });
    if (error) return { ok: false, message: sharedError(error) };
    return { ok: true, album: data };
  } catch (e) { return { ok: false, message: sharedError(e) }; }
}

// Le partage de cet album du téléphone, s'il existe (et le nombre d'invités). null = pas partagé.
export async function fetchSharedSummary(localAlbumId, userId) {
  try {
    const { data, error } = await supabase.from("shared_albums").select("*")
      .eq("owner_id", userId).eq("local_album_id", String(localAlbumId)).maybeSingle();
    if (error || !data) return null;
    const { count } = await supabase.from("shared_album_members")
      .select("user_id", { count: "exact", head: true }).eq("album_id", data.id);
    return { album: data, members: count ?? 0 };
  } catch (e) { return null; }
}

// Les invités de l'album avec le nombre de photos que chacun a envoyées. [{ userId, name, joinedAt, sent }]
export async function fetchMembers(albumId) {
  try {
    const [m, p] = await Promise.all([
      supabase.from("shared_album_members").select("user_id, display_name, joined_at").eq("album_id", albumId).order("joined_at"),
      supabase.from("shared_photos").select("sender_id").eq("album_id", albumId),
    ]);
    if (m.error) return [];
    const sent = {};
    for (const r of p.data ?? []) sent[r.sender_id] = (sent[r.sender_id] ?? 0) + 1;
    return (m.data ?? []).map((r) => ({ userId: r.user_id, name: r.display_name, joinedAt: r.joined_at, sent: sent[r.user_id] ?? 0 }));
  } catch (e) { return []; }
}

// « Changer le code » : l'ancien ne marche plus, les membres déjà entrés restent.
export async function regenerateCode(albumId) {
  try {
    const { data, error } = await supabase.rpc("regenerate_shared_album_code", { p_album: albumId });
    if (error) return { ok: false, message: sharedError(error) };
    return { ok: true, code: data };
  } catch (e) { return { ok: false, message: sharedError(e) }; }
}

// Quand le propriétaire renomme son album sur le téléphone. Silencieux en cas d'échec.
export async function renameSharedAlbum(albumId, name) {
  try { await supabase.rpc("rename_shared_album", { p_album: albumId, p_name: name }); } catch (e) {}
}

// Retire un invité de l'album (ses envois déjà reçus restent).
export async function removeMember(albumId, userId) {
  try {
    const { error } = await supabase.from("shared_album_members").delete().eq("album_id", albumId).eq("user_id", userId);
    if (error) return { ok: false, message: sharedError(error) };
    return { ok: true };
  } catch (e) { return { ok: false, message: sharedError(e) }; }
}

// ── Côté invité ───────────────────────────────────────────────────────────────

// Garde seulement lettres et chiffres, en majuscules (« k7p-2qx » → « K7P2QX »), 6 caractères au plus.
export const cleanCode = (s) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
export const CODE_LENGTH = 6;

// Rejoint un album avec son code. Renvoie { ok, album: { id, name, ownerName, members } } ou { ok: false, message }.
export async function joinAlbum(code, name) {
  try {
    const { data, error } = await supabase.rpc("join_shared_album", { p_code: cleanCode(code), p_name: name.trim() });
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("too_many_attempts")) return { ok: false, message: "Trop d'essais. Réessaie dans une heure." };
      if (msg.includes("expired")) return { ok: false, message: "Ce code n'est plus valable. Demande-en un nouveau à ton proche." };
      if (msg.includes("own_album")) return { ok: false, message: "C'est ton propre album : tu n'as pas besoin de le rejoindre." };
      if (msg.includes("full")) return { ok: false, message: "Cet album a atteint son nombre maximum de personnes." };
      return { ok: false, message: sharedError(error) };
    }
    if (data?.error === "unknown_code") return { ok: false, message: "Ce code ne correspond à aucun album. Vérifie-le avec ton proche." };
    return { ok: true, album: { id: data.album_id, name: data.name, ownerName: data.owner_name, members: data.members } };
  } catch (e) { return { ok: false, message: sharedError(e) }; }
}

// Les albums que j'ai rejoints (je n'en vois pas le contenu). [{ id, name, ownerName }], les plus récents d'abord.
export async function fetchJoinedAlbums(userId) {
  try {
    const { data, error } = await supabase.from("shared_album_members")
      .select("joined_at, shared_albums ( id, name, owner_name )")
      .eq("user_id", userId).order("joined_at", { ascending: false });
    if (error) return [];
    return (data ?? []).filter((r) => r.shared_albums)
      .map((r) => ({ id: r.shared_albums.id, name: r.shared_albums.name, ownerName: r.shared_albums.owner_name }));
  } catch (e) { return []; }
}

// Le message prêt à envoyer (WhatsApp, SMS…). L'invité le modifie avant l'envoi s'il veut.
export function inviteMessage(albumName, code) {
  const steps = [];
  if (STORE_LINK) steps.push(`Télécharge Pellicule : ${STORE_LINK}`);
  steps.push("Réglages → Rejoindre un album");
  steps.push(`Code : ${code}`);
  return `Je prépare un album « ${albumName} » sur Pellicule 📸 Envoie-moi tes plus belles photos !\n\n`
    + steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
}
