// services/progressStats.js
// Calculs purs sur le carnet de bord dailyLog (pas d'UI, pas d'I/O).
// Partagés par la carte d'accueil (ProgressCard) et l'écran détail (ProgressScreen).
import { dayKey } from "../store/usePhotoStore";

// Mo → "340 Mo" / "1.4 Go" (même format que l'accueil)
export function formatSize(mo) {
  if (mo < 1) return "0 Mo";
  if (mo < 1024) return `${mo.toFixed(0)} Mo`;
  return `${(mo / 1024).toFixed(1)} Go`;
}

// Toutes les dates sont calées à midi : évite les pièges du changement d'heure.
export function noon(d) { const x = new Date(d); x.setHours(12, 0, 0, 0); return x; }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function mondayOf(d) { const x = noon(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }

// Chiffres d'un jour donné
export function dayStats(log, d) {
  const v = log?.[dayKey(d)];
  return {
    sorted: v?.sorted || 0, freedMo: v?.freedMo || 0,
    timedCount: v?.timedCount || 0, activeMs: v?.activeMs || 0,
  };
}

// Additionne sorted + freedMo entre deux dates incluses.
export function sumRange(log, from, to) {
  let sorted = 0, freedMo = 0, timedCount = 0, activeMs = 0;
  for (let d = noon(from); d <= to; d = addDays(d, 1)) {
    const s = dayStats(log, d);
    sorted += s.sorted; freedMo += s.freedMo;
    timedCount += s.timedCount; activeMs += s.activeMs;
  }
  return { sorted, freedMo, timedCount, activeMs };
}

// Temps moyen pour trier 20 photos, en texte ("1 min 40 s", "45 s").
// null si moins de 10 décisions chronométrées (pas assez fiable).
export const TIME_MIN_SAMPLES = 10;
export function avgFor20(stats) {
  if (!stats || stats.timedCount < TIME_MIN_SAMPLES) return null;
  const sec = Math.round((stats.activeMs / stats.timedCount) * 20 / 1000);
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60), r = sec % 60;
  return r ? `${m} min ${String(r).padStart(2, "0")} s` : `${m} min`;
}

// ─── Série 🔥 (jours d'affilée) ───────────────────────────────────────────
// Un jour est "validé" quand on y a trié au moins STREAK_MIN photos.
// Joker : 1 jour raté par semaine (lundi → dimanche) ne casse pas la série.
// Aujourd'hui ne casse jamais la série : la journée n'est pas finie.
export const STREAK_MIN = 10;

export function computeStreak(log) {
  const today = noon(new Date());
  const keys = Object.keys(log || {}).sort();
  const empty = { current: 0, best: 0, todayDone: false, todayLeft: STREAK_MIN, jokerUsedThisWeek: false };
  if (keys.length === 0) return empty;

  const [y, m, d] = keys[0].split("-").map(Number);
  const jokerWeeks = new Set(); // semaines (clé du lundi) où le joker a déjà servi
  let run = 0, best = 0;

  // On parcourt du plus ancien jour jusqu'à hier.
  for (let day = noon(new Date(y, m - 1, d)); day < today; day = addDays(day, 1)) {
    if (dayStats(log, day).sorted >= STREAK_MIN) {
      run += 1;
    } else {
      const week = dayKey(mondayOf(day));
      if (run > 0 && !jokerWeeks.has(week)) jokerWeeks.add(week); // joker : la série tient
      else run = 0;                                                // série cassée
    }
    best = Math.max(best, run);
  }

  const todaySorted = dayStats(log, today).sorted;
  const todayDone = todaySorted >= STREAK_MIN;
  const current = run + (todayDone ? 1 : 0);
  return {
    current,
    best: Math.max(best, current),
    todayDone,
    todayLeft: Math.max(0, STREAK_MIN - todaySorted),
    jokerUsedThisWeek: jokerWeeks.has(dayKey(mondayOf(today))),
  };
}
