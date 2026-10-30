// constants/theme.js
// Toutes les couleurs et valeurs de style de l'app
// Modifier ici = modifier partout dans l'app
//
// Plusieurs palettes rangées côte à côte.
// THEME_ACTIF choisit celle utilisée par toute l'app.
// Revenir à l'ancienne app : mettre "ardoise".
// Plus tard : ce choix viendra du store (choix de l'utilisateur).

const PALETTES = {
  // Ancienne palette (bleu ardoise + teal) — gardée intacte
  ardoise: {
    bg:      "#f4f5f7",
    bgCard:  "#ffffff",
    bgMuted: "#eef0f4",
    border:  "#c8d0de",
    accent:      "#2e4d7a",
    accent2:     "#4a6d9e",
    accentGrad:  ["#2e4d7a", "#4a6d9e"],
    album:       "#1e7268",
    text:     "#1a2840",
    textMid:  "#3a5272",
    textMuted:"#7a8ea8",
    green:  "#2e7d52",
    red:    "#b83232",
    purple: "#6b48b8",
    yellow: "#b87a14",
    // Nuances (ajoutées pour le thème sauge)
    sage:      "#e3e9f2",
    sage2:     "#c8d4e6",
    sage3:     "#9fb3d1",
    albumSoft: "#dcefec",
    redSoft:   "#f5e8e8",
  },

  // Nouvelle palette (maquettes sauge, oct. 2026)
  sauge: {
    bg:      "#f4f3ef",
    bgCard:  "#fbfbf8",
    bgMuted: "#eae9e3",
    border:  "#e4e3dc",
    accent:      "#4c7a2b",
    accent2:     "#6f9a4b",
    accentGrad:  ["#4c7a2b", "#6f9a4b"],
    album:       "#b8653f",
    text:     "#23271f",
    textMid:  "#4b5045",
    textMuted:"#8d9186",
    green:  "#3d6522",
    red:    "#d2453c",
    purple: "#7a5fa8",
    yellow: "#c4621c",
    // Nuances
    sage:      "#dfe8d2",
    sage2:     "#c9d9b4",
    sage3:     "#a9c48b",
    albumSoft: "#f3e2d8",
    redSoft:   "#f7e3df",
  },
};

export const THEME_ACTIF = "sauge"; // ← l'interrupteur : "sauge" ou "ardoise"

export const C = PALETTES[THEME_ACTIF];
export { PALETTES };

// Police de l'app (intégrée au build via app.json → expo-font)
export const FONT = "Outfit";

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