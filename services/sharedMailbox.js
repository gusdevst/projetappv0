// services/sharedMailbox.js
// Album partagé, côté PROPRIÉTAIRE : la « boîte aux lettres » = les photos que les invités ont envoyées et que je n'ai pas encore triées.
//   · fetchMailbox()                 → par album, combien de photos en attente et de quel invité (accueil + écran « Boîte aux lettres »)
//   · fetchMailboxPhotos(...)        → les photos à swiper (adresses temporaires de 1 h pour les afficher)
//   · keepMailboxPhoto / refuse…     → la décision du swipe
// Garder  = la photo est enregistrée dans la photothèque du téléphone (dossier « Pellicule/<album> ») ET ajoutée à l'album ;
//           c'est ensuite une photo comme les autres (livre, poster, recherche…). Le fichier du serveur est effacé.
// Refuser = le fichier du serveur est effacé. La ligne reste (sans fichier) : elle sert de compteur à l'invité et évite de renvoyer la photo.
// Ordre voulu : d'abord l'enregistrement sur le téléphone, ensuite le statut sur le serveur. Une coupure réseau entre les deux
// donne au pire un DOUBLON à la prochaine ouverture, jamais une photo perdue.

import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { supabase } from "./supabase";
import { addPhotoToPelliculeAlbum } from "./photoLibrary";
import { usePhotoStore } from "../store/usePhotoStore";

const BUCKET = "shared-photos";
const ONE_YEAR_MS = 365 * 24 * 3600 * 1000;

const isNetworkError = (e) => /network|fetch|timed out|offline|internet/i.test(String(e?.message ?? e ?? ""));

async function myId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

// Résumé de la boîte : [{ albumId, albumName, localAlbumId, total, senders: [{ senderId, name, count }] }], plus gros en premier. [] si rien / hors ligne.
export async function fetchMailbox() {
  const uid = await myId();
  if (!uid) return [];
  try {
    const { data, error } = await supabase.from("shared_photos")
      .select("album_id, sender_id, shared_albums!inner ( id, name, local_album_id, owner_id )")
      .eq("status", "pending").not("path", "is", null)
      .eq("shared_albums.owner_id", uid)
      .limit(5000);
    if (error || !data?.length) return [];
    const albumIds = [...new Set(data.map((r) => r.album_id))];
    const { data: members } = await supabase.from("shared_album_members").select("album_id, user_id, display_name").in("album_id", albumIds);
    const nameOf = new Map((members ?? []).map((m) => [`${m.album_id}|${m.user_id}`, m.display_name]));

    const byAlbum = new Map();
    for (const r of data) {
      const a = r.shared_albums;
      if (!byAlbum.has(r.album_id)) byAlbum.set(r.album_id, { albumId: r.album_id, albumName: a.name, localAlbumId: a.local_album_id, total: 0, senders: new Map() });
      const entry = byAlbum.get(r.album_id);
      entry.total++;
      entry.senders.set(r.sender_id, (entry.senders.get(r.sender_id) ?? 0) + 1);
    }
    return [...byAlbum.values()].map((e) => ({
      ...e,
      senders: [...e.senders.entries()]
        .map(([senderId, count]) => ({ senderId, count, name: nameOf.get(`${e.albumId}|${senderId}`) ?? "Un invité" }))
        .sort((x, y) => y.count - x.count),
    })).sort((x, y) => y.total - x.total);
  } catch (e) { return []; }
}

// Les photos en attente d'un album (et d'un invité si senderId). Chaque photo reçoit une adresse temporaire (`url`, valable 1 h).
// Plus anciennes d'abord. Renvoie { ok, photos } ou { ok: false, message }.
export async function fetchMailboxPhotos(albumId, senderId, senderName) {
  try {
    let q = supabase.from("shared_photos")
      .select("id, album_id, sender_id, path, width, height, taken_at, created_at")
      .eq("album_id", albumId).eq("status", "pending").not("path", "is", null)
      .order("created_at", { ascending: true }).limit(2000);
    if (senderId) q = q.eq("sender_id", senderId);
    const { data, error } = await q;
    if (error) return { ok: false, message: isNetworkError(error) ? "Pas de connexion internet. Réessaie." : "Impossible de lire la boîte aux lettres." };

    const { data: members } = await supabase.from("shared_album_members").select("user_id, display_name").eq("album_id", albumId);
    const names = new Map((members ?? []).map((m) => [m.user_id, m.display_name]));

    const photos = [];
    for (let i = 0; i < data.length; i += 100) { // adresses temporaires par paquets de 100
      const chunk = data.slice(i, i + 100);
      const { data: signed, error: e2 } = await supabase.storage.from(BUCKET).createSignedUrls(chunk.map((r) => r.path), 3600);
      if (e2) return { ok: false, message: isNetworkError(e2) ? "Pas de connexion internet. Réessaie." : "Impossible d'ouvrir les photos." };
      chunk.forEach((r, k) => {
        const url = signed?.[k]?.signedUrl;
        if (!url) return;
        const t = r.taken_at ? new Date(r.taken_at).getTime() : null;
        photos.push({
          id: r.id, url, path: r.path, albumId: r.album_id, senderId: r.sender_id,
          senderName: senderName ?? names.get(r.sender_id) ?? "Un invité",
          width: r.width, height: r.height,
          creationTime: t && t > ONE_YEAR_MS ? t : new Date(r.created_at).getTime(),
          dateIsReceived: !(t && t > ONE_YEAR_MS), // pas de date de prise de vue : on affiche la date d'envoi (« Reçue le … »)
          location: "",
        });
      });
    }
    return { ok: true, photos };
  } catch (e) { return { ok: false, message: isNetworkError(e) ? "Pas de connexion internet. Réessaie." : "Impossible de lire la boîte aux lettres." }; }
}

const extOf = (path) => (path.split(".").pop() || "jpg").toLowerCase();

// GARDER : enregistre dans la photothèque + album, puis marque « kept » et efface le fichier du serveur.
export async function keepMailboxPhoto(photo, { localAlbumId, albumName }) {
  // 1. téléchargement dans le cache de l'appli
  const tmp = `${FileSystem.cacheDirectory}shared-${photo.id}.${extOf(photo.path)}`;
  const dl = await FileSystem.downloadAsync(photo.url, tmp);
  if (dl.status < 200 || dl.status >= 300) throw new Error(`Téléchargement refusé (${dl.status})`);
  // 2. photothèque du téléphone
  let assetId;
  try {
    const asset = await MediaLibrary.createAssetAsync(dl.uri);
    assetId = asset.id;
    await addPhotoToPelliculeAlbum(assetId, albumName); // dossier « Pellicule/<album> » (même règle que les autres albums)
  } finally {
    FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});
  }
  // 3. l'album de l'appli (s'il existe encore)
  const st = usePhotoStore.getState();
  if (st.albums.some((a) => a.id === localAlbumId)) st.addPhotoToAlbum(localAlbumId, assetId);
  // 4. le serveur : statut puis fichier
  await markDecided(photo, "kept");
  return assetId;
}

// REFUSER : marque « refused » et efface le fichier du serveur.
export async function refuseMailboxPhoto(photo) {
  await markDecided(photo, "refused");
}

async function markDecided(photo, status) {
  const { error } = await supabase.from("shared_photos")
    .update({ status, decided_at: new Date().toISOString(), path: null })
    .eq("id", photo.id).eq("status", "pending");
  if (error) throw new Error(error.message);
  supabase.storage.from(BUCKET).remove([photo.path]).catch(() => {}); // le fichier orphelin ne gêne personne s'il reste
}
