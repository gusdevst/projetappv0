// services/gpsCache.js
// Cache persistant des coordonnées GPS, stocké dans AsyncStorage.
// Évite de rappeler getAssetInfoAsync sur des photos déjà scannées.

import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "gps_cache_v2";

/**
 * Charge le cache GPS depuis AsyncStorage.
 * @returns {Promise<Record<string, {lat: number, lng: number}>>}
 *   Un objet { [assetId]: {lat, lng} } pour les photos avec GPS.
 *   Les photos sans GPS ne sont PAS stockées (null ne vaut pas la peine d'être mis en cache).
 */
export async function loadGpsCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Sauvegarde le cache GPS mis à jour.
 * @param {Record<string, {lat: number, lng: number}>} cache
 */
export async function saveGpsCache(cache) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

/**
 * Vide complètement le cache (utile pour debug ou reset).
 */
export async function clearGpsCache() {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {}
}
