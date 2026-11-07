// services/printOrders.js
// Envoi d'une sélection validée de l'abonnement « Coups de cœur » vers Supabase, pour impression.
// 1. chaque photo (fichier original) est déposée dans le dossier privé `print-photos/<compte>/<abonnement>/<mois>/`
// 2. une ligne est écrite dans la table `print_orders` (adresse, nom, petit mot, chemins des photos)
// SQL à lancer une fois : supabase/sql/print_orders.sql. Pas de paiement ici (étape à part).
// Les photos partent telles quelles (pas de réduction : aucun module natif de plus) ; sur iPhone
// elles peuvent être en HEIC, que le Mac ouvre normalement.
// Quand Augustin change `status` dans la table, `syncOrderStatuses()` remet le suivi de l'app à jour.

import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase";
import { useSubscriptionStore } from "../store/useSubscriptionStore";
import { productOf } from "../constants/subscription";

const BUCKET = "print-photos";
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", webp: "image/webp" };

export const NOT_SIGNED_IN = "NOT_SIGNED_IN";

// Fichier original d'une photo du téléphone (téléchargé depuis iCloud si besoin).
async function originalFile(photoId) {
  const info = await MediaLibrary.getAssetInfoAsync(photoId, { shouldDownloadFromNetwork: true });
  if (!info?.localUri) throw new Error("Photo introuvable sur le téléphone.");
  const ext = (info.localUri.split("?")[0].split(".").pop() || "jpg").toLowerCase();
  return { uri: info.localUri, ext: MIME[ext] ? ext : "jpg" };
}

// Envoie la sélection. onProgress(done, total) pour la barre d'avancement. Lève une erreur au moindre échec
// (rien n'est alors considéré comme envoyé : l'appelant laisse la sélection modifiable).
export async function submitSelection({ sub, month, photoIds, onProgress }) {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session) throw new Error(NOT_SIGNED_IN);
  const uid = session.user.id;

  const paths = [];
  for (let i = 0; i < photoIds.length; i++) {
    onProgress?.(i, photoIds.length);
    const { uri, ext } = await originalFile(photoIds[i]);
    const path = `${uid}/${sub.id}/${month}/${i + 1}.${ext}`;
    const res = await FileSystem.uploadAsync(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, uri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, // le fichier part tel quel, sans le charger en mémoire
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": MIME[ext],
        "x-upsert": "true", // un 2e essai remplace la photo déjà déposée
      },
    });
    if (res.status < 200 || res.status >= 300) throw new Error(`Photo ${i + 1} refusée (${res.status}) : ${res.body?.slice?.(0, 120)}`);
    paths.push(path);
  }

  const { error } = await supabase.from("print_orders").upsert(
    {
      user_id: uid,
      sub_id: sub.id,
      month,
      kind: sub.kind,
      recipient: sub.recipient || sub.name || "",
      address: sub.address,
      message: sub.message || null,
      photo_count: paths.length,
      photos: paths,
      product: productOf(sub).key,   // "prints" | "magnets" : à quoi servent ces photos
      spec: productOf(sub).spec,     // taille finale (mm), recadrage… pour l'imprimeur, quel qu'il soit
    },
    { onConflict: "user_id,sub_id,month" }
  );
  if (error) throw error;
  onProgress?.(photoIds.length, photoIds.length);
  return paths;
}

// Relit les statuts des commandes (validated / printing / shipped / delivered) et met à jour le suivi local.
// Silencieux en cas d'erreur (hors ligne, pas connecté) : on garde ce qu'on sait.
export async function syncOrderStatuses() {
  try {
    const { data, error } = await supabase.from("print_orders").select("sub_id, month, status");
    if (error || !data) return;
    const { setStage } = useSubscriptionStore.getState();
    data.forEach((r) => setStage(r.sub_id, r.month, r.status));
  } catch (e) { /* hors ligne */ }
}
