// Recherche complète : une phrase lue par searchParser + les étiquettes du cache + les dates des photos.
// Fonctions pures, sans I/O.
import { isLabelsFresh, normLabel } from "./labelSearch";
import { matchPeriod } from "./searchParser";
import { countryAt } from "./countryLookup";
import { cityKeysAt } from "./cityLookup";
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
 * @param opts    minPct (confiance minimale générale, défaut LABELS_SEARCH_MIN_CONF × 100), deletedIds (Set),
 *                geoById (Map id → { lat, lng }, les photos géolocalisées : nécessaire pour filtrer par pays)
 * @returns {{ results: {photo, pct, label}[], notAnalyzed: number, notLocated: number }}
 *   results : de la plus sûre à la moins sûre (par date récente si la recherche n'a qu'une période).
 *   notAnalyzed : photos de la période pas encore passées par l'analyse (la liste peut donc encore grandir).
 *   notLocated  : photos de la période SANS coordonnées connues (pas de GPS dans la photo, ou scan GPS pas fini) —
 *                 elles sont écartées dès qu'on filtre par pays.
 */
export function searchContent(parsed, photos, cache, { minPct = LABELS_SEARCH_MIN_CONF * 100, deletedIds, geoById } = {}) {
  const { concepts, mode, period } = parsed;
  // Pays : un filtre, comme la période (plusieurs pays = l'un OU l'autre). Sans table GPS fournie, on ne filtre pas.
  // Un lieu est un pays (« maroc ») ou une ville (« v:marrakech », kind "city").
  const placeList = geoById ? parsed.places ?? [] : [];
  const placeIds = placeList.length ? true : null;
  const countryIds = new Set(placeList.filter((p) => p.kind !== "city").map((p) => p.id));
  const cityIds = new Set(placeList.filter((p) => p.kind === "city").map((p) => p.id));
  // Saisons citées à part (« 2026, voyage, été ») : des sujets de plus, reconnus par la DATE de la photo.
  const seasons = parsed.seasons ?? [];
  const results = [];
  let notAnalyzed = 0;
  let notLocated = 0;

  for (const photo of photos) {
    if (photo.isScreenshot) continue;
    if (deletedIds?.has(photo.id)) continue;
    if (!matchPeriod(period, photo.creationTime)) continue;

    let placeLabel = null;
    if (placeIds) {
      const g = geoById.get(photo.id);
      if (!g) { notLocated++; continue; }
      let hit = null;
      if (countryIds.size) {
        const cid = countryAt(g.lat, g.lng);
        if (cid && countryIds.has(cid)) hit = placeList.find((p) => p.id === cid);
      }
      if (!hit && cityIds.size) {
        const id = cityKeysAt(g.lat, g.lng).find((k) => cityIds.has(k));
        if (id) hit = placeList.find((p) => p.id === id);
      }
      if (!hit) continue; // ni dans ce pays, ni près de cette ville
      placeLabel = hit.fr;
    }

    if (concepts.length === 0 && seasons.length === 0) {
      if (period || placeIds) results.push({ photo, pct: null, label: placeLabel });
      continue;
    }

    const seasonHits = seasons.map((s) =>
      matchPeriod({ parts: [s.part] }, photo.creationTime) ? { pct: 100, label: s.fr } : null
    );

    let conceptHits = [];
    if (concepts.length > 0) {
      const entry = cache[photo.id];
      if (!isLabelsFresh(entry, photo)) {
        // Pas encore analysée : on ne peut juger que par la date.
        if (mode === "or" && seasonHits.some(Boolean)) {
          results.push({ photo, pct: 100, label: seasonHits.filter(Boolean).map((h) => h.label).join(" + ") });
        } else if (mode === "and" && seasonHits.some((h) => !h)) {
          // « les deux à la fois » : la saison manque déjà, inutile de l'analyser
        } else {
          notAnalyzed++;
        }
        continue;
      }
      conceptHits = concepts.map((c) => bestFor(entry, c, minPct));
    }

    const hits = [...conceptHits, ...seasonHits];
    const ok = mode === "or" ? hits.some(Boolean) : hits.every(Boolean);
    if (!ok) continue;
    const found = hits.filter(Boolean);
    const pct = mode === "or" ? Math.max(...found.map((h) => h.pct)) : Math.min(...found.map((h) => h.pct));
    results.push({ photo, pct, label: found.map((h) => h.label).join(" + ") });
  }

  if (concepts.length === 0 && seasons.length === 0) results.sort((a, b) => (b.photo.creationTime || 0) - (a.photo.creationTime || 0));
  else results.sort((a, b) => b.pct - a.pct || (b.photo.creationTime || 0) - (a.photo.creationTime || 0));
  return { results, notAnalyzed, notLocated };
}
