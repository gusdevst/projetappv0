// services/gpsCache.js
// Cache persistant des coordonnées GPS, stocké dans AsyncStorage.
// Évite de rappeler getAssetInfoAsync sur des photos déjà scannées.
//
// Cache "négatif" : une photo scannée sans GPS trouvé est stockée avec la valeur
// null (clé présente, valeur null), pour ne JAMAIS la rescanner. Une clé ABSENTE
// du cache signifie "jamais scannée". Ne pas confondre les deux : toujours tester
// la présence de la clé avec `in` / hasOwnProperty, jamais `if (cache[id])` (qui
// est faux à la fois pour "absente" et pour "scannée, sans GPS").

import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "gps_cache_v2";

/**
 * Charge le cache GPS depuis AsyncStorage.
 * @returns {Promise<Record<string, {lat: number, lng: number} | null>>}
 *   Un objet { [assetId]: {lat, lng} | null }.
 *   - {lat, lng} : photo scannée, GPS trouvé.
 *   - null : photo scannée, aucun GPS.
 *   - clé absente : photo jamais scannée.
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
 * @param {Record<string, {lat: number, lng: number} | null>} cache
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
