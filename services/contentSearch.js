// Recherche complète : une phrase lue par searchParser + les étiquettes du cache + les dates des photos.
// Fonctions pures, sans I/O.
import { isLabelsFresh, normLabel } from "./labelSearch";
import { matchPeriod } from "./searchParser";
import { LABELS_SEARCH_MIN_CONF } from "../constants/labelsConfig";

const labelSets = new WeakMap(); // idée → Set d'étiquettes normalisées (calculé une fois)
function labelSetOf(concept) {
  let s = labelSets.get(concept);
  if (!s) {
    s = new Set(concept.labels.map(normLabel));
    labelSets.set(concept, s);
  }
  return s;
}

/** Meilleure étiquette de la photo pour cette idée : { pct, label } ou null. */
function bestFor(entry, concept, minPct) {
  const set = labelSetOf(concept);
  const need = Math.max(minPct, concept.minPct ?? 0);
  let best = null;
  for (const [text, pct] of entry.tags.l) {
    if (pct >= need && set.has(normLabel(text)) && (!best || pct > best.pct)) best = { pct, label: text };
  }
  return best;
}

/**
 * @param parsed  résultat de parseQuery
 * @param photos  photos de la photothèque
 * @param cache   cache d'analyse { [id]: entry }
 * @param opts    minPct (confiance minimale générale, défaut LABELS_SEARCH_MIN_CONF × 100), deletedIds (Set)
 * @returns {{ results: {photo, pct, label}[], notAnalyzed: number }}
 *   results : de la plus sûre à la moins sûre (par date récente si la recherche n'a qu'une période).
 *   notAnalyzed : photos de la période pas encore passées par l'analyse (la liste peut donc encore grandir).
 */
export function searchContent(parsed, photos, cache, { minPct = LABELS_SEARCH_MIN_CONF * 100, deletedIds } = {}) {
  const { concepts, mode, period } = parsed;
  const results = [];
  let notAnalyzed = 0;

  for (const photo of photos) {
    if (photo.isScreenshot) continue;
    if (deletedIds?.has(photo.id)) continue;
    if (!matchPeriod(period, photo.creationTime)) continue;

    if (concepts.length === 0) {
      if (period) results.push({ photo, pct: null, label: null });
      continue;
    }

    const entry = cache[photo.id];
    if (!isLabelsFresh(entry, photo)) {
      notAnalyzed++;
      continue;
    }
    const hits = concepts.map((c) => bestFor(entry, c, minPct));
    const ok = mode === "or" ? hits.some(Boolean) : hits.every(Boolean);
    if (!ok) continue;
    const found = hits.filter(Boolean);
    const pct = mode === "or" ? Math.max(...found.map((h) => h.pct)) : Math.min(...found.map((h) => h.pct));
    results.push({ photo, pct, label: found.map((h) => h.label).join(" + ") });
  }

  if (concepts.length === 0) results.sort((a, b) => (b.photo.creationTime || 0) - (a.photo.creationTime || 0));
  else results.sort((a, b) => b.pct - a.pct);
  return { results, notAnalyzed };
}
