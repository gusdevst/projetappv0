// Recherche par étiquettes — fonctions pures, sans I/O.
// Une photo du cache : { m, blur: {...}, tags: { l: [["Beach", 87], ["Sky", 74]], v } }
// (étiquette en anglais, confiance en pourcentage entier).
import { LABELS_ALGO_VERSION, LABELS_SEARCH_MIN_CONF } from "../constants/labelsConfig";

/** Forme de comparaison d'une étiquette : minuscules, « _ » = espace (Vision écrit « sea_waves »). */
export function normLabel(text) {
  return String(text).toLowerCase().replace(/_/g, " ").trim();
}

/** Les étiquettes en cache sont-elles encore valables ? (même version, photo non modifiée depuis) */
export function isLabelsFresh(entry, photo) {
  return !!entry?.tags
    && entry.tags.v === LABELS_ALGO_VERSION
    && Array.isArray(entry.tags.l)
    && (entry.m ?? null) === (photo.modificationTime ?? null);
}

/** Étiquettes d'une photo : [{ text, pct }] (vide si pas encore analysée). */
export function labelsOf(entry, photo) {
  if (!isLabelsFresh(entry, photo)) return [];
  return entry.tags.l.map(([text, pct]) => ({ text, pct }));
}

/**
 * Photos qui ont AU MOINS UNE des étiquettes demandées (comparaison sans majuscules).
 * @param photos  photos de la photothèque
 * @param cache   cache d'analyse { [id]: entry }
 * @param terms   étiquettes anglaises cherchées, ex. ["beach", "sand"]
 * @param opts    minPct (défaut : LABELS_SEARCH_MIN_CONF), deletedIds (Set)
 * @returns {{ photo, pct, label }[]}  de la plus sûre à la moins sûre
 */
export function searchByLabels(photos, cache, terms, { minPct = LABELS_SEARCH_MIN_CONF * 100, deletedIds } = {}) {
  const wanted = new Set(terms.map(normLabel).filter(Boolean));
  if (wanted.size === 0) return [];
  const out = [];
  for (const photo of photos) {
    if (photo.isScreenshot) continue;
    if (deletedIds?.has(photo.id)) continue;
    const entry = cache[photo.id];
    if (!isLabelsFresh(entry, photo)) continue;
    let best = null;
    for (const [text, pct] of entry.tags.l) {
      if (pct >= minPct && wanted.has(normLabel(text)) && (!best || pct > best.pct)) best = { pct, label: text };
    }
    if (best) out.push({ photo, pct: best.pct, label: best.label });
  }
  out.sort((a, b) => b.pct - a.pct);
  return out;
}

/**
 * Étiquettes les plus fréquentes dans la photothèque (pour construire le dictionnaire).
 * @returns {{ text, count }[]}  du plus fréquent au moins fréquent
 */
export function labelFrequencies(photos, cache, { minPct = LABELS_SEARCH_MIN_CONF * 100, limit = 60 } = {}) {
  const counts = new Map();
  for (const photo of photos) {
    if (photo.isScreenshot) continue;
    const entry = cache[photo.id];
    if (!isLabelsFresh(entry, photo)) continue;
    for (const [text, pct] of entry.tags.l) {
      if (pct >= minPct) counts.set(text, (counts.get(text) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
