// constants/theme.js
// Toutes les couleurs et valeurs de style de l'app
// Modifier ici = modifier partout dans l'app
//
// Palette : Ardoise (slate blue)
// Mode MÉNAGE  → accent  (#2e4d7a) — bleu ardoise
// Mode ALBUM   → album   (#1e7268) — teal chaleureux, distinct du ménage

export const C = {
  // Fonds
  bg:      "#f4f5f7",
  bgCard:  "#ffffff",
  bgMuted: "#eef0f4",
  border:  "#c8d0de",

  // Mode MÉNAGE — Ardoise bleu
  accent:      "#2e4d7a",
  accent2:     "#4a6d9e",
  accentGrad:  ["#2e4d7a", "#4a6d9e"],

  // Mode ALBUM — Teal chaleureux (visuellement distinct du ménage)
  album:       "#1e7268",

  // Textes
  text:     "#1a2840",
  textMid:  "#3a5272",
  textMuted:"#7a8ea8",

  // États sémantiques
  green:  "#2e7d52",
  red:    "#b83232",
  purple: "#6b48b8",
  yellow: "#b87a14",
};

export const FILTERS = [
  "Toutes",
  "7 derniers jours",
  "Mois dernier",
  "2026",
  "Screenshots",
];

// Espacements standard
export const S = {
  radius:     20,
  radiusSm:   12,
  radiusLg:   28,
  radiusFull: 99,
  pad:        20,
  padSm:      12,
  padLg:      28,
};