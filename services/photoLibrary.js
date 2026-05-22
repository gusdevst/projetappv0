// services/photoLibrary.js
// Wrapper autour d'expo-media-library : permission, chargement, suppression.
// Toutes les fonctions sont async et lèvent en cas d'erreur — c'est au store de gérer.

import * as MediaLibrary from "expo-media-library";

// Plafond de sécurité : on charge au max 500 photos pour éviter de figer l'app
// chez les utilisateurs avec 50000+ photos. À ajuster post-MVP si besoin.
const MAX_PHOTOS = 500;
const BATCH_SIZE = 100;

/**
 * Retourne le statut actuel de la permission photo sans la demander.
 * @returns {Promise<"granted" | "denied" | "undetermined">}
 */
export async function getPermissionStatus() {
  const { status } = await MediaLibrary.getPermissionsAsync();
  return status;
}

/**
 * Demande la permission photo. Déclenche le prompt système si "undetermined".
 * Sur iOS, si l'utilisateur a déjà refusé, la fonction retourne "denied" sans re-prompter.
 * @returns {Promise<"granted" | "denied" | "undetermined">}
 */
export async function requestPermission() {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return status;
}

/**
 * Charge les photos de la photothèque (paginée par batch de 100, max 500 total).
 * Retourne un tableau de photos au format attendu par les écrans :
 * { id, url, creationTime, year, size, width, height }
 * Les coordonnées GPS ne sont PAS incluses ici (trop coûteux) — fetch via loadPhotoLocation.
 */
export async function loadPhotos() {
  const allAssets = [];
  let after = undefined;
  let hasMore = true;

  while (hasMore && allAssets.length < MAX_PHOTOS) {
    const result = await MediaLibrary.getAssetsAsync({
      first: BATCH_SIZE,
      after,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: MediaLibrary.SortBy.creationTime,
    });
    allAssets.push(...result.assets);
    hasMore = result.hasNextPage;
    after = result.endCursor;
  }

  return allAssets.slice(0, MAX_PHOTOS).map(mapAssetToPhoto);
}

/**
 * Charge les coordonnées GPS d'une photo (appel individuel, coûteux).
 * À appeler seulement quand on en a besoin (MapScreen).
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export async function loadPhotoLocation(assetId) {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(assetId);
    if (info.location?.latitude && info.location?.longitude) {
      return { lat: info.location.latitude, lng: info.location.longitude };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Supprime définitivement des photos via le système.
 * Sur iOS, les photos partent en "Récemment supprimées" (récupérables 30j).
 * Sur Android, ça déclenche un prompt système de confirmation.
 * @param {string[]} assetIds
 * @returns {Promise<boolean>} true si tout est bien supprimé
 */
export async function deletePhotos(assetIds) {
  if (assetIds.length === 0) return true;
  return await MediaLibrary.deleteAssetsAsync(assetIds);
}

// ─── Helpers internes ────────────────────────────────────────────────────

function mapAssetToPhoto(asset) {
  // Approximation grossière de la taille en Mo : 3 bytes par pixel (RGB) × dimensions / 1024^2
  // Pour avoir la vraie taille fichier il faudrait expo-file-system getInfoAsync, trop coûteux ici.
  const approxSizeMo = (asset.width * asset.height * 3) / (1024 * 1024);

  const date = new Date(asset.creationTime);
  const year = String(date.getFullYear());

  return {
    id: asset.id,
    url: asset.uri,
    filename: asset.filename ?? "",
    creationTime: asset.creationTime, // ms epoch — utilisé par photoAnalysis pour clusters/doublons
    year,
    size: Number(approxSizeMo.toFixed(1)),
    width: asset.width,
    height: asset.height,
    isScreenshot: detectScreenshot(asset),
    // Champs "legacy" attendus par les écrans, à enrichir plus tard via loadPhotoLocation/reverse geocoding
    location: "",
    city: "",
    lat: null,
    lng: null,
    faces: [], // vide — feature retirée du MVP
  };
}

/**
 * Détecte si une photo est une capture d'écran.
 * - iOS : asset.mediaSubtypes inclut "screenshot"
 * - Android : nom de fichier contient "screenshot" (insensible à la casse)
 */
function detectScreenshot(asset) {
  if (Array.isArray(asset.mediaSubtypes) && asset.mediaSubtypes.includes("screenshot")) {
    return true;
  }
  if (typeof asset.filename === "string" && asset.filename.toLowerCase().includes("screenshot")) {
    return true;
  }
  return false;
}
