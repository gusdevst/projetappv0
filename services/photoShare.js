// services/photoShare.js
// Partage d'une photo en qualité originale (HD) via la feuille de partage native.
// Pourquoi : photo.url vaut "ph://…" sur iPhone = une étiquette interne de la
// photothèque, que WhatsApp / Messages ne savent pas ouvrir. On va chercher le
// vrai fichier original (localUri, "file://…"), téléchargé depuis iCloud si besoin.
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

// Mémoire : id photo → fichier HD. Évite de refaire le travail.
const cache = new Map();

// Récupère le fichier original. Appelée à l'avance (préchargement) pour que
// la feuille de partage s'ouvre sans attente.
export async function getShareableUri(photoId) {
  if (cache.has(photoId)) return cache.get(photoId);
  const info = await MediaLibrary.getAssetInfoAsync(photoId, { shouldDownloadFromNetwork: true });
  const uri = info?.localUri ?? null;
  if (uri) cache.set(photoId, uri);
  return uri;
}

// Ouvre la feuille de partage native (Messages, WhatsApp, AirDrop…).
// Renvoie true si elle s'est ouverte, false sinon.
export async function sharePhoto(photoId) {
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    const uri = await getShareableUri(photoId);
    if (!uri) return false;
    await Sharing.shareAsync(uri);
    return true;
  } catch (e) {
    return false;
  }
}
