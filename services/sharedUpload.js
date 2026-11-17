// services/sharedUpload.js
// Album partagé, côté invité : ENVOYER les photos choisies vers la « boîte aux lettres » du propriétaire.
//
// Circuit (une photo à la fois, la mémoire ne grossit pas) :
//   1. on prend le fichier ORIGINAL de la photo (téléchargé depuis iCloud si besoin ; date et lieu inclus) ;
//   2. on le dépose dans le dossier privé `shared-photos/<album>/<mon compte>/<id>.<ext>` ;
//   3. on écrit sa ligne dans `shared_photos` (statut « pending » = en attente du tri du propriétaire).
// REPRISE : la liste des photos restantes est gardée sur le téléphone (`outbox`). Réseau coupé, appli fermée → elle repart
// toute seule au prochain lancement (`startSharedUploadResume`). Une photo déjà partie n'est jamais renvoyée
// (`sentIds` sur le téléphone + contrainte unique côté serveur : album + compte + id de la photo).
// Rien ne part sans que la case d'accord ait été cochée (`SharedSendScreen` crée l'outbox seulement après).

import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import { AppState } from "react-native";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase";
import { useSharedStore } from "../store/useSharedStore";
import { useAuthStore } from "../store/useAuthStore";

const BUCKET = "shared-photos";
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", webp: "image/webp" };
const ONE_YEAR_MS = 365 * 24 * 3600 * 1000;

const running = new Set(); // albums dont l'envoi tourne en ce moment

const uuid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0;
  return (c === "x" ? r : (r & 3) | 8).toString(16);
});

const isNetworkError = (e) => /network|fetch|timed out|offline|internet/i.test(String(e?.message ?? e ?? ""));

// Fichier original d'une photo du téléphone. null = introuvable (supprimée depuis).
async function originalFile(photoId) {
  const info = await MediaLibrary.getAssetInfoAsync(photoId, { shouldDownloadFromNetwork: true });
  if (!info?.localUri) return null;
  const ext = (info.localUri.split("?")[0].split(".").pop() || "jpg").toLowerCase();
  const fileExt = MIME[ext] ? ext : "jpg";
  let bytes = null;
  try { bytes = (await FileSystem.getInfoAsync(info.localUri))?.size ?? null; } catch (e) {}
  return {
    uri: info.localUri, ext: fileExt, mime: MIME[fileExt],
    width: info.width ?? null, height: info.height ?? null, bytes,
    takenAt: info.creationTime > ONE_YEAR_MS ? new Date(info.creationTime).toISOString() : null,
  };
}

// Les photos de ce téléphone déjà envoyées à cet album (lues sur le serveur, mémorisées). Échec réseau = on garde ce qu'on sait.
export async function fetchSentIds(albumId) {
  const uid = useAuthStore.getState().session?.user?.id;
  if (!uid) return useSharedStore.getState().sentIds[albumId] ?? [];
  try {
    const ids = [];
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await supabase.from("shared_photos").select("sender_asset_id")
        .eq("album_id", albumId).eq("sender_id", uid).range(from, from + 999);
      if (error) throw error;
      ids.push(...data.map((r) => r.sender_asset_id));
      if (data.length < 1000) break;
    }
    useSharedStore.getState().mergeSentIds(albumId, ids);
  } catch (e) { /* hors ligne : on garde la mémoire locale */ }
  return useSharedStore.getState().sentIds[albumId] ?? [];
}

// Accord donné : la sélection devient un envoi (outbox), puis il démarre.
export function startSending(album) {
  const st = useSharedStore.getState();
  const sel = st.selections[album.id];
  if (!sel || sel.ids.length === 0) return;
  const old = st.outbox[album.id];
  const ids = [...new Set([...(old?.ids ?? []), ...sel.ids])];
  st.setOutbox(album.id, {
    name: album.name, ownerName: album.ownerName,
    batchId: old?.batchId ?? uuid(), ids, total: (old?.total ?? 0) + sel.ids.length,
  });
  st.clearSelection(album.id);
  runOutbox(album.id);
}

// Fait partir les photos de l'outbox, une par une. Sans danger si déjà en cours.
export async function runOutbox(albumId) {
  if (running.has(albumId)) return;
  const first = useSharedStore.getState().outbox[albumId];
  if (!first || first.ids.length === 0) return;
  running.add(albumId);
  const { setUpload, setOutbox, markSent } = useSharedStore.getState();
  const total = first.total ?? first.ids.length;
  let skipped = 0;
  setUpload({ albumId, total, done: total - first.ids.length, running: true, error: null, finished: false, skipped: 0 });

  try {
    for (;;) {
      const box = useSharedStore.getState().outbox[albumId];
      if (!box || box.ids.length === 0) break;
      const photoId = box.ids[0];

      const { data: sess } = await supabase.auth.getSession();
      const s = sess?.session;
      if (!s) { setUpload({ running: false, error: "Connecte-toi pour envoyer tes photos." }); return; }

      let file;
      try { file = await originalFile(photoId); }
      catch (e) { file = null; }
      if (!file) { // photo disparue du téléphone : on la laisse de côté
        skipped++;
        setOutbox(albumId, { ...box, ids: box.ids.slice(1) });
        setUpload({ skipped });
        continue;
      }

      const rowId = uuid();
      const path = `${albumId}/${s.user.id}/${rowId}.${file.ext}`;
      let res;
      try {
        res = await FileSystem.uploadAsync(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, file.uri, {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, // le fichier part tel quel, sans passer par la mémoire
          headers: { Authorization: `Bearer ${s.access_token}`, apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": file.mime, "x-upsert": "true" },
        });
      } catch (e) {
        setUpload({ running: false, error: isNetworkError(e) ? "Pas de connexion internet. L'envoi reprendra tout seul." : `Envoi interrompu : ${e?.message ?? e}` });
        return;
      }
      if (res.status < 200 || res.status >= 300) {
        setUpload({ running: false, error: `Le serveur a refusé une photo (${res.status}). Réessaie plus tard.` });
        return;
      }

      const { error } = await supabase.from("shared_photos").insert({
        id: rowId, album_id: albumId, sender_asset_id: photoId, batch_id: box.batchId, path,
        mime: file.mime, width: file.width, height: file.height, bytes: file.bytes, taken_at: file.takenAt,
      });
      if (error) {
        if (error.code === "23505") { // déjà envoyée avant : on retire le doublon du stockage et on passe
          supabase.storage.from(BUCKET).remove([path]).catch(() => {});
        } else {
          supabase.storage.from(BUCKET).remove([path]).catch(() => {});
          setUpload({ running: false, error: isNetworkError(error) ? "Pas de connexion internet. L'envoi reprendra tout seul." : "Le serveur n'a pas enregistré une photo. Réessaie plus tard." });
          return;
        }
      }
      markSent(albumId, photoId);
      setUpload({ done: total - (useSharedStore.getState().outbox[albumId]?.ids.length ?? 0) });
    }
    setOutbox(albumId, null);
    setUpload({ running: false, finished: true, done: total, error: null });
  } finally {
    running.delete(albumId);
  }
}

// Relance les envois interrompus : au lancement de l'appli, à la connexion et au retour au premier plan.
export function startSharedUploadResume() {
  const resume = () => {
    if (!useAuthStore.getState().session) return;
    const { outbox } = useSharedStore.getState();
    Object.keys(outbox).forEach((id) => { if (outbox[id]?.ids?.length) runOutbox(id); });
  };
  const unsubAuth = useAuthStore.subscribe((s, prev) => { if (s.session && !prev.session) resume(); });
  const sub = AppState.addEventListener("change", (st) => { if (st === "active") resume(); });
  setTimeout(resume, 3000); // au lancement (la session Supabase met un instant à revenir)
  return () => { unsubAuth(); sub.remove(); };
}
