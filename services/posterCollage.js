// services/posterCollage.js
// Poster « pêle-mêle » : plusieurs photos sur UN poster (maquette `maquette-poster-pele-mele.html`).
// Logique pure (pas d'UI, pas de store). L'app compose UNE image à partir de ces dispositions ; imprimeur.fr reçoit
// un fichier par poster, donc un pêle-mêle se commande comme un poster simple (mêmes formats, mêmes prix).
//
// REPÈRE : le poster fait 1 de large et POSTER_RATIO de haut (1 = largeur du poster). Toutes les cases sont exprimées dans cette unité,
// donc la disposition marche à toutes les tailles (aperçu, fichier d'impression 150 dpi…).
// Une case : { x, y, w, h, rot, pad } — `rot` en degrés ; `pad` = null (photo nue) ou { s, t, b } = bords blancs d'un tirage
// façon polaroïd, en part de la LARGEUR de la case (côtés, haut, bas).
//
// ⚠️ Le fichier d'impression n'est pas encore fabriqué (commande en standby) : il faudra dessiner CollagePoster hors écran
// (react-native-view-shot, comme les pages du livre) à la taille du format, puis l'envoyer comme un poster simple.

import { posterDims, POSTER_MIN_DPI, POSTER_FORMATS } from "./posterProducts";

export const COLLAGE_MIN = 2;
export const COLLAGE_MAX = 16; // 4 × 4 (demande d'Augustin, 11 nov. : « jusqu'à 15 ou 16 photos »)
export const COLLAGE_RATIO = 297 / 210; // hauteur / largeur d'un poster vertical de la série A

export const COLLAGE_STYLES = [
  { key: "grille",   label: "Grille" },
  { key: "mosaique", label: "Mosaïque" },
  { key: "pelemele", label: "Pêle-mêle" },
];
export const DEFAULT_COLLAGE_STYLE = "pelemele";

// Fonds proposés (le blanc est le papier nu).
export const COLLAGE_BGS = [
  { key: "blanc", color: "#ffffff" },
  { key: "creme", color: "#f7efe4" },
  { key: "noir",  color: "#23271f" },
  { key: "sauge", color: "#dfe8d2" },
  { key: "peche", color: "#f3e2d8" },
  { key: "ciel",  color: "#cfe0ef" },
];
export const DEFAULT_COLLAGE_BG = "creme";
export const collageBgColor = (key) => (COLLAGE_BGS.find((b) => b.key === key) ?? COLLAGE_BGS[1]).color;
// Couleur de texte lisible sur ce fond.
export const collageTitleColor = (key) => (key === "noir" ? "#f6e6e0" : "#5a3b2a");

const MARGIN = 0.035;       // marge autour du poster
const GAP = 0.02;           // espace entre les cases (grille, mosaïque)
export const TITLE_BAND = 0.16; // hauteur réservée au titre en bas (unité = largeur du poster)
const POLAROID_PAD = { s: 0.06, t: 0.06, b: 0.2 };

// Petit générateur pseudo-aléatoire reproductible (même graine = même disposition).
function rng(seed) {
  let a = (seed * 2654435761 + 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ordre des photos dans les cases : graine 0 = ordre choisi ; sinon mélange reproductible (bouton « Mélanger »).
export function collagePhotoOrder(n, seed) {
  const order = Array.from({ length: n }, (_, i) => i);
  if (!seed) return order;
  const r = rng(seed + 77);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// Répartit n cases dans une zone : choisit colonnes × lignes pour que chaque case se rapproche du rapport h/w voulu,
// sans trop de cases vides. La dernière ligne (incomplète) est centrée. Renvoie des cases { x, y, w, h }.
// `snapLast` : la dernière ligne incomplète reste SUR LES COLONNES de la grille (jamais décalée d'une demi-colonne) :
// centrée si le nombre de cases vides est pair, sinon alignée à gauche. Sert au pêle-mêle (tirages alignés en lignes et colonnes).
function gridCells(n, area, gap, targetAspect, snapLast = false) {
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cw = (area.w - gap * (cols - 1)) / cols;
    const ch = (area.h - gap * (rows - 1)) / rows;
    if (cw <= 0 || ch <= 0) continue;
    const score = Math.abs(Math.log((ch / cw) / targetAspect)) + (cols * rows - n) * 0.12;
    if (!best || score < best.score) best = { cols, rows, cw, ch, score };
  }
  const { cols, rows, cw, ch } = best;
  const cells = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? n - cols * (rows - 1) : cols;
    const col = i - row * cols;
    const rowW = inRow * cw + (inRow - 1) * gap;
    const x0 = snapLast
      ? area.x + (((cols - inRow) % 2 === 0) ? ((cols - inRow) / 2) * (cw + gap) : 0)
      : area.x + (area.w - rowW) / 2;
    cells.push({ x: x0 + col * (cw + gap), y: area.y + row * (ch + gap), w: cw, h: ch });
  }
  return cells;
}

// Disposition d'un style : renvoie n cases { x, y, w, h, rot, pad } (n entre COLLAGE_MIN et COLLAGE_MAX).
// `seed` n'influe plus sur les dispositions (le « Mélanger » change l'ordre des photos, voir collagePhotoOrder). `hasTitle` réserve une bande en bas.
export function collageLayout(style, n, { seed = 0, hasTitle = false } = {}) {
  const bottom = hasTitle ? TITLE_BAND : 0;
  const area = { x: MARGIN, y: MARGIN, w: 1 - 2 * MARGIN, h: COLLAGE_RATIO - 2 * MARGIN - bottom };

  if (style === "grille") {
    return gridCells(n, area, GAP, 1.25).map((c) => ({ ...c, rot: 0, pad: null }));
  }

  if (style === "mosaique") {
    if (n === 2) {
      const h = (area.h - GAP) / 2;
      return [0, 1].map((i) => ({ x: area.x, y: area.y + i * (h + GAP), w: area.w, h, rot: 0, pad: null }));
    }
    // 1 grande photo « vedette » en haut, les autres en grille dessous.
    const heroH = area.h * 0.4;
    const rest = { x: area.x, y: area.y + heroH + GAP, w: area.w, h: area.h - heroH - GAP };
    return [
      { x: area.x, y: area.y, w: area.w, h: heroH, rot: 0, pad: null },
      ...gridCells(n - 1, rest, GAP, 1.1).map((c) => ({ ...c, rot: 0, pad: null })),
    ];
  }

  // Pêle-mêle : tirages (cadre blanc, effet polaroïd) DROITS et ALIGNÉS sur les mêmes lignes et les mêmes colonnes
  // (demande d'Augustin, 11 nov. : plus de décalage au hasard ni d'inclinaison). Tous de la même taille, centrés dans leur case de la grille.
  const A = 1.35; // rapport h/w d'un tirage
  return gridCells(n, area, GAP, 1.4, true).map((c) => {
    const w = Math.min(c.w, c.h / A);
    const h = w * A;
    return { x: c.x + (c.w - w) / 2, y: c.y + (c.h - h) / 2, w, h, rot: 0, pad: POLAROID_PAD };
  });
}

// Zone de la PHOTO dans une case (dans l'unité du poster, relative au coin de la case).
export function cellPhotoRect(cell) {
  if (!cell.pad) return { x: 0, y: 0, w: cell.w, h: cell.h };
  const x = cell.pad.s * cell.w;
  const y = cell.pad.t * cell.w;
  return { x, y, w: cell.w - 2 * x, h: cell.h - y - cell.pad.b * cell.w };
}

// Qualité d'impression d'un pêle-mêle : c'est la PLUS PETITE résolution parmi les photos (chaque photo est « cover » dans sa case,
// divisée par son zoom). photos[i] ↔ photoIds[i] ; order = collagePhotoOrder ; crops = { [photoId]: { scale } }.
// Renvoie { dpi, worstId } ou null si une taille de photo est inconnue.
export function collageQuality(photos, cells, key, order, crops = {}) {
  const widthMm = POSTER_FORMATS[key]?.widthMm ?? POSTER_FORMATS.a3.widthMm; // 1 unité du repère = la largeur du poster
  let worst = null;
  for (let i = 0; i < cells.length; i++) {
    const photo = photos[order[i]];
    if (!photo?.width || !photo?.height) return null;
    const rect = cellPhotoRect(cells[i]);
    const wMm = rect.w * widthMm, hMm = rect.h * widthMm;
    const zoom = Math.max(1, crops[photo.id]?.scale ?? 1);
    const dpi = (25.4 * Math.min(photo.width / wMm, photo.height / hMm)) / zoom;
    if (!worst || dpi < worst.dpi) worst = { dpi: Math.round(dpi), worstId: photo.id };
  }
  return worst;
}

// Plus grand format dont la qualité reste « bonne » (≥ POSTER_MIN_DPI), jusqu'à A2 ; sinon A4.
export function bestCollageFormat(photos, cells, order, crops) {
  const ok = ["a2", "a3", "a4"].find((k) => (collageQuality(photos, cells, k, order, crops)?.dpi ?? 0) >= POSTER_MIN_DPI);
  return ok ?? "a4";
}

// Les posters en collage sont toujours verticaux (voir posterDims(key, false)).
export const collageDims = (key) => posterDims(key, false);
