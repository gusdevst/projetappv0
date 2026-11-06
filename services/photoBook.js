// ─── Livre photo : logique pure (pas d'UI, pas de store) ───────────────────
// Un livre = une couverture + une liste de pages. Chaque page = une mise en
// page (1 à 4 cadres) + les ids des photos placées dans ses cadres.
//
//   book = {
//     albumId, format: 30,
//     cover: { photoId, title, font, size, color, pos },
//     pages: [ { layout: 2, slots: ["id1", null] }, … ],
//     updatedAt,
//   }
//
// Toutes les fonctions renvoient un NOUVEAU livre (on ne modifie jamais
// l'ancien) → Zustand voit le changement et l'écran se redessine.

// Un seul format papier : 21 × 28 cm (Gelato, voir PRINT_SPEC dans bookCheck.js).
// Au choix : "portrait" (vertical, défaut) ou "landscape" (horizontal) — valable pour tout le livre.
// Nombre de pages : de 30 à 200, de 2 en 2.
export const BOOK_PAGES = { min: 30, max: 200, step: 2 };
export const ORIENTATIONS = ["portrait", "landscape"];
export const BOOK_LAYOUTS = [1, 2, 3, 4];

// Rapport hauteur / largeur d'une page : portrait = 28/21 (4/3), paysage = 21/28 (3/4).
export const pageRatio = (book) => (book?.orientation === "landscape" ? 3 / 4 : 4 / 3);
export const isLandscape = (book) => book?.orientation === "landscape";

// Ramène un nombre de pages saisi à une valeur autorisée (paire, entre min et max).
export function clampPages(n) {
  const { min, max, step } = BOOK_PAGES;
  const v = Math.round((Number(n) || min) / step) * step;
  return Math.min(max, Math.max(min, v));
}

// Nombre de lignes de photos d'une mise en page. « Milieu » (titre entre deux lignes) exige au moins 2 lignes.
// Portrait : 1 → 1 ligne, 2 → 2 lignes (l'une au-dessus de l'autre), 3 et 4 → 2 lignes.
// Paysage : 2 photos côte à côte → 1 seule ligne.
export const layoutRows = (layout, landscape) => (layout === 1 || (landscape && layout === 2) ? 1 : 2);
export const DEFAULT_PER_PAGE = 2;

// Réglages de la couverture (les clés ; l'écran les traduit en police / taille / couleur).
export const COVER_FONTS  = ["moderne", "elegante", "manuscrite", "affiche", "calligraphie", "ronde"];
export const COVER_SIZES  = ["S", "M", "L"];
export const COVER_COLORS = ["blanc", "noir", "terracotta", "sauge"];
export const COVER_POS    = ["haut", "milieu", "bas"];
// Titre de page : page.title = { text, pos, size, font }. font absent = police de la couverture.
export const PAGE_TITLE_POS   = ["haut", "milieu", "bas"];
export const PAGE_TITLE_SIZES = ["S", "M", "L"];

// ─── Recadrage ──────────────────────────────────────────────────────────────
// page.crops = { [photoId]: { scale, x, y, rot, tilt } }
//   scale : zoom (1 = photo qui remplit juste le cadre, max 4)
//   x, y  : décalage en PART du cadre (0.1 = 10 % de sa largeur/hauteur) → marche à toutes les tailles
//   rot   : quart de tour (0, 90, 180, 270) · tilt : redressement fin (-15 à +15°)
export const DEFAULT_CROP = { scale: 1, x: 0, y: 0, rot: 0, tilt: 0 };
export const MAX_ZOOM = 4;
export const MAX_TILT = 15;
export const getCrop = (page, photoId) => ({ ...DEFAULT_CROP, ...(page.crops?.[photoId] ?? {}) });

// Garde seulement les recadrages des photos encore sur la page.
function pruneCrops(page) {
  if (!page.crops) return page;
  const ids = new Set(page.slots.filter(Boolean));
  const crops = Object.fromEntries(Object.entries(page.crops).filter(([id]) => ids.has(id)));
  return { ...page, crops };
}

export function setCrop(book, pageIndex, photoId, patch) {
  const pages = book.pages.map((p, pi) =>
    pi !== pageIndex ? p : { ...p, crops: { ...(p.crops ?? {}), [photoId]: { ...getCrop(p, photoId), ...patch } } }
  );
  return touch({ ...book, pages });
}

// Remettre la photo au centre, sans zoom ni redressement (le quart de tour est gardé).
export function resetCrop(book, pageIndex, photoId) {
  const page = book.pages[pageIndex];
  return setCrop(book, pageIndex, photoId, { ...DEFAULT_CROP, rot: getCrop(page, photoId).rot });
}

const emptyPage = (layout = DEFAULT_PER_PAGE) => ({ layout, slots: Array(layout).fill(null) });
const touch = (book) => ({ ...book, updatedAt: Date.now() });

// Plus petit nombre de pages où l'album tient à 2 photos par page (30 minimum, 200 maximum).
export function pickFormat(photoCount) {
  return clampPages(Math.ceil(photoCount / DEFAULT_PER_PAGE));
}

// Nouveau livre pré-rempli dans l'ordre de l'album.
export function createBook(album) {
  const ids = album.photoIds;
  const format = pickFormat(ids.length);
  const pages = Array.from({ length: format }, () => emptyPage());
  return autofill(
    {
      albumId: album.id,
      orientation: "portrait",
      format,
      cover: { photoId: ids[0] ?? null, title: album.name, font: "moderne", size: "M", color: "blanc", pos: "bas" },
      pages,
      updatedAt: Date.now(),
    },
    ids
  );
}

// { photoId: numéro de page (0, 1, …) } pour les photos placées à l'intérieur.
export function placedMap(book) {
  const map = {};
  book.pages.forEach((p, pi) => p.slots.forEach((id) => { if (id) map[id] = pi; }));
  return map;
}

// Changer de format. Moins de pages → les photos des pages coupées retournent dans l'album.
export function setFormat(book, format) {
  format = clampPages(format);
  let pages = book.pages.slice(0, format);
  while (pages.length < format) pages.push(emptyPage());
  return touch({ ...book, format, pages });
}

// Changer d'orientation (vertical / horizontal). Les photos restent, seule la forme des cadres change.
// Un titre « milieu » n'a plus de sens s'il n'y a plus qu'une ligne de photos : il passe en bas.
export function setOrientation(book, orientation) {
  if (!ORIENTATIONS.includes(orientation) || book.orientation === orientation) return book;
  const landscape = orientation === "landscape";
  const pages = book.pages.map((p) =>
    p.title?.pos === "milieu" && layoutRows(p.layout, landscape) < 2 ? { ...p, title: { ...p.title, pos: "bas" } } : p
  );
  return touch({ ...book, orientation, pages });
}

// Changer la mise en page d'une page. Les photos en trop sortent du livre.
export function setLayout(book, pageIndex, layout) {
  const pages = book.pages.map((p, pi) => {
    if (pi !== pageIndex) return p;
    const kept = p.slots.filter(Boolean).slice(0, layout);
    // « Milieu » = entre deux lignes de photos → impossible avec 1 photo : le titre passe en bas.
    const title = layoutRows(layout, isLandscape(book)) < 2 && p.title?.pos === "milieu" ? { ...p.title, pos: "bas" } : p.title;
    return pruneCrops({ ...p, layout, title, slots: Array.from({ length: layout }, (_, i) => kept[i] ?? null) });
  });
  return touch({ ...book, pages });
}

// Placer une photo dans un cadre. Si elle était déjà ailleurs, elle se déplace.
export function placePhoto(book, pageIndex, slotIndex, photoId) {
  const pages = book.pages.map((p, pi) => pruneCrops({
    ...p,
    slots: p.slots.map((id, si) => {
      if (pi === pageIndex && si === slotIndex) return photoId;
      return id === photoId ? null : id;
    }),
  }));
  return touch({ ...book, pages });
}

export function clearSlot(book, pageIndex, slotIndex) {
  const pages = book.pages.map((p, pi) =>
    pi !== pageIndex ? p : pruneCrops({ ...p, slots: p.slots.map((id, si) => (si === slotIndex ? null : id)) })
  );
  return touch({ ...book, pages });
}

// Remplir les cadres vides avec les photos de l'album pas encore placées (dans l'ordre).
export function autofill(book, albumPhotoIds) {
  const placed = placedMap(book);
  const free = albumPhotoIds.filter((id) => placed[id] === undefined);
  const pages = book.pages.map((p) => ({ ...p, slots: p.slots.map((id) => id ?? free.shift() ?? null) }));
  return touch({ ...book, pages });
}

// Modifier le titre d'une page : setPageTitle(book, 4, { text: "Plage" }).
export function setPageTitle(book, pageIndex, patch) {
  const pages = book.pages.map((p, pi) =>
    pi !== pageIndex ? p : { ...p, title: { text: "", pos: "bas", size: "M", ...p.title, ...patch } }
  );
  return touch({ ...book, pages });
}

// Modifier la couverture : setCover(book, { title: "Été" }).
export function setCover(book, patch) {
  return touch({ ...book, cover: { ...book.cover, ...patch } });
}

// L'album a changé (photo retirée) → on enlève du livre les photos qui n'y sont plus.
// Renvoie le MÊME livre si rien ne change (évite de réécrire le store pour rien).
export function syncWithAlbum(book, albumPhotoIds) {
  const inAlbum = new Set(albumPhotoIds);
  let changed = false;
  const pages = book.pages.map((p) => ({
    ...p,
    slots: p.slots.map((id) => {
      if (id && !inAlbum.has(id)) { changed = true; return null; }
      return id;
    }),
  }));
  let cover = book.cover;
  if (cover.photoId && !inAlbum.has(cover.photoId)) {
    changed = true;
    cover = { ...cover, photoId: albumPhotoIds[0] ?? null };
  }
  return changed ? touch({ ...book, pages, cover }) : book;
}

// Chiffres pour la carte « 43 / 44 photos placées · 2 pages vides ».
export function bookStats(book, albumPhotoIds) {
  const placed = placedMap(book);
  const placedCount = albumPhotoIds.filter((id) => placed[id] !== undefined).length;
  const slots  = book.pages.reduce((n, p) => n + p.slots.length, 0);
  const filled = book.pages.reduce((n, p) => n + p.slots.filter(Boolean).length, 0);
  const emptyPages = book.pages.filter((p) => p.slots.every((id) => !id)).length;
  return { placedCount, total: albumPhotoIds.length, fillRatio: slots ? filled / slots : 0, emptyPages };
}
