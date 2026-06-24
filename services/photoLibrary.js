// services/photoLibrary.js
// Wrapper autour d'expo-media-library : permission, chargement, suppression.
// Toutes les fonctions sont async et lèvent en cas d'erreur — c'est au store de gérer.

import * as MediaLibrary from "expo-media-library";
import { Platform } from "react-native";

// Pas de plafond — on charge toute la bibliothèque pour les tests.
// À remettre en place avant la prod si les perfs deviennent un problème.
export const MAX_PHOTOS = Infinity;
const BATCH_SIZE = 500;

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
 * Charge toutes les photos de la photothèque sans limite.
 * Retourne { photos, totalInLibrary }.
 */
export async function loadPhotos() {
  const allAssets = [];
  let after = undefined;
  let hasMore = true;
  let totalInLibrary = 0;

  while (hasMore) {
    const result = await MediaLibrary.getAssetsAsync({
      first: BATCH_SIZE,
      after,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: MediaLibrary.SortBy.creationTime,
    });
    totalInLibrary = result.totalCount ?? totalInLibrary;
    allAssets.push(...result.assets);
    hasMore = result.hasNextPage;
    after = result.endCursor;
  }

  return {
    photos: allAssets.map(mapAssetToPhoto),
    totalInLibrary,
  };
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

/**
 * Construit le nom final de l'album selon la plateforme.
 *
 * Android : les albums sont de vrais dossiers. "Pellicule/Mon Album" crée
 *   un sous-dossier "Mon Album" à l'intérieur du dossier "Pellicule" dans la galerie.
 *
 * iOS : les albums sont plats, Apple interdit les sous-dossiers.
 *   On préfixe le nom avec "Pellicule — " pour que tous les albums Pellicule
 *   apparaissent groupés alphabétiquement dans l'app Photos.
 */
function buildAlbumName(subName) {
  if (Platform.OS === "android") {
    return `Pellicule/${subName}`;
  }
  return `Pellicule — ${subName}`;
}

/**
 * Ajoute UNE photo au dossier Pellicule natif correspondant à subName.
 * Si le dossier n'existe pas encore, il est créé avec cette première photo.
 * Appelée automatiquement à chaque coup de cœur ou ajout à un album.
 *
 * @param {string} assetId - ID de la photo (asset.id de la media library)
 * @param {string} subName - Nom du sous-dossier, ex: "❤️ Coups de cœur" ou "Vacances"
 */
export async function addPhotoToPelliculeAlbum(assetId, subName) {
  if (!assetId || !subName) return;

  const albumName = buildAlbumName(subName);

  try {
    const existing = await MediaLibrary.getAlbumAsync(albumName);

    if (existing) {
      // Le dossier existe déjà → on y ajoute simplement la photo
      await MediaLibrary.addAssetsToAlbumAsync([assetId], existing.id, false);
    } else {
      // Première photo → on crée le dossier avec elle
      // Sur iOS comme Android, createAlbumAsync exige au moins une photo
      await MediaLibrary.createAlbumAsync(albumName, assetId, false);
    }
  } catch (err) {
    // On ne bloque pas l'UX si la synchro galerie échoue (permission partielle, etc.)
    console.warn("[Pellicule] addPhotoToPelliculeAlbum:", err.message);
  }
}

/**
 * Retourne la liste des albums photo du téléphone triés par nombre de photos.
 * Ex : "Camera Roll", "WhatsApp", "Screenshots", etc.
 */
export async function getAlbums() {
  const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: false });
  return albums
    .filter((a) => a.assetCount > 0)
    .sort((a, b) => b.assetCount - a.assetCount);
}

/**
 * Retourne un Set des IDs de toutes les photos d'un album donné.
 * Utilisé dans HomeScreen pour filtrer la queue sur un dossier précis.
 */
export async function getAlbumAssetIds(albumId) {
  const ids = [];
  let after = undefined;
  let hasMore = true;
  while (hasMore) {
    const result = await MediaLibrary.getAssetsAsync({
      album: albumId,
      first: 500,
      after,
      mediaType: MediaLibrary.MediaType.photo,
    });
    ids.push(...result.assets.map((a) => a.id));
    hasMore = result.hasNextPage;
    after = result.endCursor;
  }
  return new Set(ids);
}

// ─── Helpers internes ────────────────────────────────────────────────────

function mapAssetToPhoto(asset) {
  // Estimation de la taille en Mo. On part de l'hypothèse JPEG / HEIC compressé.
  // - JPEG qualité ~80 : ~0.5 byte/pixel en moyenne sur photos naturelles
  // - HEIC (iOS récent) : ~0.3 byte/pixel
  // On retient 0.4 byte/pixel comme moyenne raisonnable, ce qui donne ~5 Mo
  // pour une photo 12MP — proche de la réalité (vs 36 Mo en non compressé).
  // Pour la vraie taille fichier il faudrait expo-file-system par photo, ce qui
  // ajouterait plusieurs secondes au chargement initial → on reste sur l'approximation.
  const approxSizeMo = (asset.width * asset.height * 0.4) / (1024 * 1024);

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
