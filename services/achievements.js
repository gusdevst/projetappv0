// services/achievements.js
// Galons (grades selon les photos triées) + badges. Calculs purs, pas d'UI.
//
import { computeStreak, STREAK_MIN } from "./progressStats";

// Un galon / badge débloqué est mémorisé dans le store (achievements = { id: timestamp })
// → il reste acquis même si la donnée redescend (ex. coups de cœur retirés).

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

// ─── Badges ───────────────────────────────────────────────────────────────
// value(ctx) = où en est l'user · goal = cible · fmt = affichage de l'avancement
const GO = 1024; // Mo
const fmtGo = (mo) => `${(mo / GO).toFixed(1).replace(".", ",")}`;
export const BADGES = [
  { id: "clean-1",  emoji: "🧹", name: "Coup de balai",              desc: "1 Go libéré",  goal: 1 * GO,  value: (c) => c.freedMo, fmt: (v, g) => `${fmtGo(v)} / ${g / GO} Go` },
  { id: "clean-3",  emoji: "🌀", name: "Coup d'aspirateur",          desc: "3 Go libérés", goal: 3 * GO,  value: (c) => c.freedMo, fmt: (v, g) => `${fmtGo(v)} / ${g / GO} Go` },
  { id: "clean-5",  emoji: "🧽", name: "Grand ménage de printemps",  desc: "5 Go libérés", goal: 5 * GO,  value: (c) => c.freedMo, fmt: (v, g) => `${fmtGo(v)} / ${g / GO} Go` },
  { id: "clean-10", emoji: "✨", name: "Nickel chrome",              desc: "10 Go libérés", goal: 10 * GO, value: (c) => c.freedMo, fmt: (v, g) => `${fmtGo(v)} / ${g / GO} Go` },
  { id: "flash",    emoji: "⚡", name: "Éclair",                     desc: "20 photos en moins de 40 s (moyenne d'une journée)", goal: 1, value: (c) => (c.hadFlashDay ? 1 : 0), fmt: () => "< 40 s / 20" },
  { id: "hearts",   emoji: "❤️", name: "Cœur d'or",                  desc: "50 coups de cœur", goal: 50, value: (c) => c.keptCount, fmt: (v, g) => `${v} / ${g}` },
  { id: "album",    emoji: "📕", name: "Premier album",              desc: "1 album créé", goal: 1, value: (c) => c.albumCount, fmt: (v, g) => `${v} / ${g}` },
  { id: "clear",    emoji: "🏁", name: "Galerie nette",              desc: "Toute la photothèque triée au moins une fois", goal: 100, value: (c) => c.sortedPct, fmt: (v) => `${v} %` },

  // Régularité A : jours d'affilée (record de série, joker compris)
  { id: "streak-3",  emoji: "🔥", name: "Étincelle", desc: "3 jours d'affilée",  goal: 3,  value: (c) => c.bestStreak, fmt: (v, g) => `${v} / ${g} j` },
  { id: "streak-7",  emoji: "🕯️", name: "Flamme",    desc: "7 jours d'affilée",  goal: 7,  value: (c) => c.bestStreak, fmt: (v, g) => `${v} / ${g} j` },
  { id: "streak-30", emoji: "🌋", name: "Volcan",    desc: "30 jours d'affilée", goal: 30, value: (c) => c.bestStreak, fmt: (v, g) => `${v} / ${g} j` },

  // Régularité B : journées validées au total (même non consécutives)
  { id: "days-10",  emoji: "📅", name: "Habitué", desc: "10 journées validées",  goal: 10,  value: (c) => c.validatedDays, fmt: (v, g) => `${v} / ${g}` },
  { id: "days-30",  emoji: "🗓️", name: "Assidu",  desc: "30 journées validées",  goal: 30,  value: (c) => c.validatedDays, fmt: (v, g) => `${v} / ${g}` },
  { id: "days-100", emoji: "🏅", name: "Fidèle",  desc: "100 journées validées", goal: 100, value: (c) => c.validatedDays, fmt: (v, g) => `${v} / ${g}` },
];

// ─── Contexte : toutes les mesures utiles, lues depuis l'état du store ────
const FLASH_MIN_SAMPLES = 20;   // au moins 20 décisions chronométrées dans la journée
const FLASH_MAX_MS_PER_20 = 40 * 1000;

export function buildContext(state) {
  const log = state.dailyLog || {};
  const days = Object.values(log);
  const sumSorted = days.reduce((a, d) => a + (d.sorted || 0), 0);

  const hadFlashDay = days.some((d) =>
    (d.timedCount || 0) >= FLASH_MIN_SAMPLES && (d.activeMs / d.timedCount) * 20 < FLASH_MAX_MS_PER_20
  );

  const lib = state.libraryPhotos || [];
  const tried = new Set([...(state.kept || []), ...(state.deleted || []), ...(state.printed || []), ...(state.skipped || [])].map((p) => p.id));
  const sortedInLib = lib.filter((p) => tried.has(p.id)).length;
  const sortedPct = lib.length ? Math.floor((sortedInLib / lib.length) * 100) : 0;

  return {
    totalSorted: state.lifetimeSorted ?? sumSorted,
    freedMo:     state.freedMo || 0,
    keptCount:   (state.kept || []).length,
    albumCount:  (state.albums || []).length,
    hadFlashDay,
    bestStreak:    computeStreak(log).best,
    validatedDays: days.filter((d) => (d.sorted || 0) >= STREAK_MIN).length,
    sortedPct:   lib.length && sortedInLib === lib.length ? 100 : Math.min(99, sortedPct),
  };
}

// Liste des ids (galons + badges) atteints avec le contexte actuel.
export function reachedIds(ctx) {
  const ids = RANKS.filter((r) => ctx.totalSorted >= r.min).map((r) => r.id);
  BADGES.forEach((b) => { if (b.value(ctx) >= b.goal) ids.push(b.id); });
  return ids;
}
