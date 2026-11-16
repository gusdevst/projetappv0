// services/pageCollage.js
// Mise en page « Pêle-mêle » d'une page de livre : 3 à 9 photos sous forme de tirages (cadre blanc façon polaroïd),
// DROITS, de même taille, rangés en lignes et en colonnes. Logique pure (pas d'UI, pas de store).
//
// GARANTIE : les tirages ne se superposent JAMAIS. Chaque tirage vit dans sa propre case de la grille, séparée des autres
// par `gap`, et reste entièrement dans la zone. (Testé sur toutes les tailles de page : voir CLAUDE.md §27.)
// Le réglage de chaque photo (zoom, décalage, rotation) se fait comme pour les autres mises en page : page.crops[idPhoto].
//
// Modèle : page = { layout: 5, slots: [id | null, …] } ; le nombre de photos = page.slots.length.

export const PELE_LAYOUT = 5;
export const PELE_MIN = 3;
export const PELE_MAX = 9;
export const PELE_DEFAULT = 6;
export const clampPele = (n) => Math.min(PELE_MAX, Math.max(PELE_MIN, Math.round(Number(n) || PELE_DEFAULT)));

// Bords blancs d'un tirage, en part de SA largeur : côtés, haut, bas (le bas est plus épais, comme un polaroïd).
export const PELE_PAD = { s: 0.06, t: 0.06, b: 0.2 };
// Rapport hauteur / largeur d'un tirage : on remplit la case, mais sans dépasser ces limites (ni trop plat, ni trop haut).
const MIN_ASPECT = 0.95;
const MAX_ASPECT = 1.35;

// n tirages dans une zone W × H (mêmes unités que `gap`). Renvoie n rectangles { x, y, w, h } (x, y = coin haut gauche, dans la zone).
// Choisit colonnes × lignes pour obtenir les PLUS GRANDS tirages. Une dernière ligne incomplète reste sur les colonnes
// (centrée si le nombre de cases vides est pair, sinon alignée à gauche).
export function peleCells(n, W, H, gap = 0) {
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cw = (W - gap * (cols - 1)) / cols;
    const ch = (H - gap * (rows - 1)) / rows;
    if (cw <= 0 || ch <= 0) continue;
    const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, ch / cw));
    const w = Math.min(cw, ch / aspect);
    const h = w * aspect;
    const area = w * h;
    // À surface égale, on préfère moins de cases vides.
    const score = area - (cols * rows - n) * 1e-6;
    if (!best || score > best.score) best = { cols, rows, cw, ch, w, h, score };
  }
  if (!best) return Array.from({ length: n }, () => ({ x: 0, y: 0, w: 0, h: 0 }));
  const { cols, rows, cw, ch, w, h } = best;
  const cells = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? n - cols * (rows - 1) : cols;
    const col = i - row * cols;
    const empty = cols - inRow;
    const offset = empty % 2 === 0 ? (empty / 2) * (cw + gap) : 0;
    const x0 = offset + col * (cw + gap);
    const y0 = row * (ch + gap);
    cells.push({ x: x0 + (cw - w) / 2, y: y0 + (ch - h) / 2, w, h });
  }
  return cells;
}

// Zone de la PHOTO dans un tirage : { x, y, w, h } relative au coin du tirage. mini = pas de bords blancs (miniatures).
export function peleWindow(cell, mini = false) {
  if (mini) return { x: 0, y: 0, w: cell.w, h: cell.h };
  const x = PELE_PAD.s * cell.w;
  const y = PELE_PAD.t * cell.w;
  return { x, y, w: cell.w - 2 * x, h: cell.h - y - PELE_PAD.b * cell.w };
}

// ─── Déplacer les tirages à la main (15 nov. 2026) ──────────────────────────
// page.pos = { [numéro de cadre]: { x, y } } : coin haut gauche de chaque tirage, en largeur de la zone de photos (1 = toute la largeur,
// y aussi) → la même position vaut à toutes les tailles (écran, miniature, PDF). Absent = rangement automatique.
// Dès qu'on déplace UN tirage, les positions de TOUS sont enregistrées (le rangement de départ sert de base).
// La taille des tirages ne change pas (elle dépend du nombre de photos).

const clampTo = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const overlaps = (a, b, margin = 0) =>
  a.x < b.x + b.w + margin && b.x < a.x + a.w + margin && a.y < b.y + b.h + margin && b.y < a.y + a.h + margin;

// Cases réellement dessinées (px, zone W × H) : les positions choisies si elles sont toutes présentes, dans la zone et SANS chevauchement ;
// sinon le rangement automatique (`auto` = peleCells). Garantie : jamais deux tirages l'un sur l'autre.
export function resolvePele(auto, pos, W, H) {
  if (!pos) return auto;
  const out = [];
  for (let i = 0; i < auto.length; i++) {
    const p = pos[i];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return auto;
    out.push({ ...auto[i], x: clampTo(p.x * W, 0, W - auto[i].w), y: clampTo(p.y * W, 0, H - auto[i].h) });
  }
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) if (overlaps(out[i], out[j], -0.01)) return auto;
  return out;
}

// Positions (unités de la zone) à partir de cases en px : à enregistrer dans page.pos.
export const cellsToPos = (cells, W) => Object.fromEntries(cells.map((c, i) => [i, { x: c.x / W, y: c.y / W }]));

// Tu tires le tirage i vers (wantedX, wantedY) : renvoie la position valide LA PLUS PROCHE (dans la zone W × H, à au moins `gap`
// des autres tirages). Le tirage glisse le long des autres au lieu de les recouvrir. `cells` = cases actuelles (px).
export function placePrint(cells, i, wantedX, wantedY, W, H, gap = 0) {
  const me = cells[i];
  const maxX = W - me.w, maxY = H - me.h;
  const cx = clampTo(wantedX, 0, maxX), cy = clampTo(wantedY, 0, maxY);
  const others = cells.filter((_, j) => j !== i);
  const xs = new Set([cx, me.x]), ys = new Set([cy, me.y]);
  for (const r of others) {
    xs.add(clampTo(r.x - gap - me.w, 0, maxX)); xs.add(clampTo(r.x + r.w + gap, 0, maxX));
    ys.add(clampTo(r.y - gap - me.h, 0, maxY)); ys.add(clampTo(r.y + r.h + gap, 0, maxY));
  }
  const free = (x, y) => !others.some((r) => overlaps({ x, y, w: me.w, h: me.h }, r, gap - 1e-6));
  let best = { x: me.x, y: me.y }, bestD = Infinity;
  for (const x of xs) for (const y of ys) {
    if (!free(x, y)) continue;
    const d = (x - wantedX) ** 2 + (y - wantedY) ** 2;
    if (d < bestD) { bestD = d; best = { x, y }; }
  }
  return best;
}
