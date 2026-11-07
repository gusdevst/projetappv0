// services/printSelection.js
// Logique pure (sans écran) du tirage mensuel des coups de cœur.
// - une « sélection » = { photoIds, size, status: "draft" | "validated", createdAt, validatedAt }
// - `size` = nombre de photos voulu ce mois-ci (baisse de 1 si on retire une photo sans la remplacer)
// - une photo déjà validée pour un abonnement n'est plus jamais proposée à cet abonnement

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// "2026-11" (mois local)
export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthName(key) {
  return MONTHS[Number(key.slice(5, 7)) - 1] ?? "";
}

// Mois suivant : "2026-12" → "2027-01"
export function nextMonthKey(key) {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7)); // 1..12
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

const SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
// 1793991772832 → "7 nov."
export function shortDate(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${SHORT[d.getMonth()]}`;
}

// Étapes de suivi d'une sélection validée. `sel.stage` (absent = "validated") sera mis à jour
// plus tard depuis le serveur (impression manuelle au début).
export const STAGES = [
  { key: "validated", label: "Validée" },
  { key: "printing",  label: "En impression", hint: "Comptez 2 à 3 jours" },
  { key: "shipped",   label: "Expédiée" },
  { key: "delivered", label: "Livrée" },
];
export const stageIndex = (sel) => Math.max(0, STAGES.findIndex((s) => s.key === (sel?.stage ?? "validated")));

// Ids déjà envoyés (sélections validées) pour un abonnement. `byMonth` = { "2026-11": sélection, … }
export function sentIdsFor(byMonth = {}) {
  const out = new Set();
  Object.values(byMonth).forEach((sel) => {
    if (sel?.status === "validated") sel.photoIds.forEach((id) => out.add(id));
  });
  return out;
}

// n ids au hasard parmi `ids` (mélange partiel de Fisher-Yates), sans doublon.
export function pickRandom(ids, n) {
  const a = [...ids];
  const k = Math.min(n, a.length);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(Math.random() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

// Remet une sélection brouillon d'aplomb : retire les photos qui ne sont plus disponibles
// (supprimées du téléphone, déjà envoyées…) et complète au hasard jusqu'à `size`.
export function reconcile(current, poolIds, size) {
  const pool = new Set(poolIds);
  const kept = current.filter((id) => pool.has(id));
  if (kept.length >= size) return kept.slice(0, size);
  const left = poolIds.filter((id) => !kept.includes(id));
  return [...kept, ...pickRandom(left, size - kept.length)];
}

// Une autre photo au hasard pour la place `index` (null s'il n'y en a plus).
export function replaceAt(current, index, poolIds) {
  const taken = new Set(current);
  const candidates = poolIds.filter((id) => !taken.has(id));
  if (candidates.length === 0) return null;
  const next = [...current];
  next[index] = candidates[Math.floor(Math.random() * candidates.length)];
  return next;
}
