// services/achievements.js
// Galons (grades selon les photos triées). Calculs purs, pas d'UI.
//
// Un galon débloqué est mémorisé dans le store (achievements = { "rank-3": timestamp })
// → il reste acquis même si la donnée redescend.

// ─── Galons ───────────────────────────────────────────────────────────────
// metal : bronze / silver / gold · chevrons : 1 à 3 (0 = étoile, grade ultime)
export const RANKS = [
  { id: "rank-1",  name: "Recrue",           min: 25,    metal: "bronze", chevrons: 1 },
  { id: "rank-2",  name: "Apprenti",         min: 50,    metal: "bronze", chevrons: 2 },
  { id: "rank-3",  name: "Trieur",           min: 100,   metal: "bronze", chevrons: 3 },
  { id: "rank-4",  name: "Trieur confirmé",  min: 250,   metal: "silver", chevrons: 1 },
  { id: "rank-5",  name: "Pro du tri",       min: 500,   metal: "silver", chevrons: 2 },
  { id: "rank-6",  name: "Expert",           min: 1000,  metal: "silver", chevrons: 3 },
  { id: "rank-7",  name: "Maître du tri",    min: 2000,  metal: "gold",   chevrons: 1 },
  { id: "rank-8",  name: "Grand maître",     min: 3500,  metal: "gold",   chevrons: 2 },
  { id: "rank-9",  name: "Légende",          min: 5000,  metal: "gold",   chevrons: 3 },
  { id: "rank-10", name: "Légende vivante",  min: 10000, metal: "gold",   chevrons: 0 },
];

// Grade actuel (null avant 25 photos) + suivant + avancement 0→1 vers le suivant.
export function rankInfo(totalSorted) {
  let idx = -1;
  RANKS.forEach((r, i) => { if (totalSorted >= r.min) idx = i; });
  const current = idx >= 0 ? RANKS[idx] : null;
  const next = RANKS[idx + 1] || null;
  const from = current ? current.min : 0;
  const progress = next ? (totalSorted - from) / (next.min - from) : 1;
  return { current, next, level: idx + 1, left: next ? next.min - totalSorted : 0, progress: Math.max(0, Math.min(1, progress)) };
}

// Total de photos triées depuis toujours (lifetimeSorted, ou à défaut la somme du carnet journalier).
export function totalSortedOf(state) {
  const sum = Object.values(state.dailyLog || {}).reduce((a, d) => a + (d.sorted || 0), 0);
  return state.lifetimeSorted ?? sum;
}

// Ids des galons atteints pour ce total de photos triées.
export function reachedIds(totalSorted) {
  return RANKS.filter((r) => totalSorted >= r.min).map((r) => r.id);
}
