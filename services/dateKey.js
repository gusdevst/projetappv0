// services/dateKey.js
// Clé du jour "2026-10-26" en heure LOCALE (pas UTC, sinon un tri à 1h du matin tombe la veille).
// Fichier à part, sans dépendance : le store ET les services de calcul l'utilisent
// sans s'importer les uns les autres (évite une boucle d'imports).
export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
