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

import { BOOK_PRODUCTS, DEFAULT_BOOK_PRODUCT, bookSpec } from "./bookProducts";

// Formats : voir services/bookProducts.js. Livres imprimeur.fr layflat (book.product = "a4" ou "paysage"), 24 → 120 pages, de 2 en 2.
// (L'ancien format Gelato 21 × 28 est retiré de l'app : archive/gelato/README.md.)
export const ORIENTATIONS = ["portrait", "landscape"];
export const BOOK_LAYOUTS = [1, 2, 3, 4];

// Nombre de pages autorisé pour CE livre.
export const pagesRange = (book) => bookSpec(book).pages;

// Rapport hauteur / largeur d'une page : 21×29,7 = 1,414 · 21×15 = 0,714.
export const pageRatio = (book) => { const s = bookSpec(book); return s.heightMm / s.widthMm; };
export const isLandscape = (book) => bookSpec(book).orientation === "landscape";

// Ramène un nombre de pages saisi à une valeur autorisée (paire, entre min et max) pour ce livre.
export function clampPages(n, book) {
  const { min, max, step } = pagesRange(book);
  const v = Math.round((Number(n) || min) / step) * step;
  return Math.min(max, Math.max(min, v));
}

// Nombre de lignes de photos d'une mise en page. « Milieu » (titre entre deux lignes) exige au moins 2 lignes.
// Portrait : 1 → 1 ligne, 2 → 2 lignes (l'une au-dessus de l'autre), 3 et 4 → 2 lignes.
// Paysage : 2 photos côte à côte → 1 seule ligne.
export const layoutRows = (layout, landscape) => (layout === 1 || (landscape && layout === 2) ? 1 : 2);
export const DEFAULT_PER_PAGE = 2;

// ─── Style de couverture + couleur de fond ──────────────────────────────────
// cover.style : "pleine" (photo plein cadre, comme avant) · "centree" · "polaroid" · "bandeau" · "cadre" · "titre" (sans photo)
// cover.bg    : clé d'une couleur de COVER_BGS. Sert au fond de la face avant (selon le style) ET au dos / 4ᵉ de couverture.
// cover.color : couleur du titre ; "auto" = choisie selon le style et le fond (lisible : clair sur foncé, foncé sur clair).
export const COVER_STYLES = [
  { key: "pleine",   label: "Pleine page" },
  { key: "centree",  label: "Photo centrée" },
  { key: "polaroid", label: "Polaroïd" },
  { key: "bandeau",  label: "Bandeau" },
  { key: "cadre",    label: "Cadre fin" },
  { key: "titre",    label: "Titre seul" },
];
export const DEFAULT_COVER_STYLE = "pleine";

// 26 couleurs de fond, rangées par famille (neutres · verts · bleus · rouges / roses · jaunes · violets).
export const COVER_BGS = [
  { key: "creme",      label: "Crème",         hex: "#f1ebdf" },
  { key: "blanc",      label: "Blanc",         hex: "#fbfbf8" },
  { key: "sable",      label: "Sable",         hex: "#e2d3bb" },
  { key: "nude",       label: "Nude",          hex: "#dcc3b3" },
  { key: "perle",      label: "Gris perle",    hex: "#d5d5d0" },
  { key: "ardoise",    label: "Ardoise",       hex: "#6b7480" },
  { key: "noir",       label: "Noir",          hex: "#23271f" },
  { key: "sauge",      label: "Sauge",         hex: "#a9c48b" },
  { key: "eucalyptus", label: "Eucalyptus",    hex: "#9fb8a6" },
  { key: "kaki",       label: "Kaki",          hex: "#7a7a4a" },
  { key: "foret",      label: "Vert forêt",    hex: "#4c7a2b" },
  { key: "emeraude",   label: "Émeraude",      hex: "#1f6b4f" },
  { key: "ciel",       label: "Bleu ciel",     hex: "#a9c8e0" },
  { key: "cyclades",   label: "Bleu Cyclades", hex: "#4d8fb5" },
  { key: "roi",        label: "Bleu roi",      hex: "#2f5aa8" },
  { key: "indigo",     label: "Indigo",        hex: "#3b3f7a" },
  { key: "nuit",       label: "Bleu nuit",     hex: "#23354f" },
  { key: "poudre",     label: "Rose poudré",   hex: "#e8c4bf" },
  { key: "fuchsia",    label: "Rose vif",      hex: "#d9788f" },
  { key: "corail",     label: "Corail",        hex: "#e5735a" },
  { key: "terracotta", label: "Terracotta",    hex: "#b8653f" },
  { key: "bordeaux",   label: "Bordeaux",      hex: "#7a2a35" },
  { key: "moutarde",   label: "Moutarde",      hex: "#d9a93b" },
  { key: "safran",     label: "Safran",        hex: "#e09a2d" },
  { key: "lilas",      label: "Lilas",         hex: "#b7a3d1" },
  { key: "prune",      label: "Prune",         hex: "#5b3a63" },
];
export const DEFAULT_COVER_BG = "creme";
export const coverBgHex = (key) => (COVER_BGS.find((c) => c.key === key) ?? COVER_BGS[0]).hex;

// Couleur claire ? (sert à choisir un titre foncé ou clair). Luminance perçue de 0 à 1.
export function isLightHex(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

// Réglages de la couverture (les clés ; l'écran les traduit en police / taille / couleur).
export const COVER_FONTS  = ["moderne", "manuscrite", "affiche", "calligraphie"]; // « Élégante » et « Ronde » retirées le 9 nov. (un livre qui les avait repasse en « Moderne »)
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

// ─── Double page ────────────────────────────────────────────────────────────
// Une double page = UNE photo sur 2 pages face à face. Les doubles pages de l'aperçu sont (pages 2–3), (4–5)… en numéros
// d'affichage, soit les index (1,2), (3,4)… : la page 0 est seule face à l'intérieur de la couverture et, si le
// livre a un nombre pair de pages, la dernière est seule face à « Fin du livre » → pas de double page possible pour elles.
// Représentation : page de gauche { double: "left", layout: 1, slots: [idPhoto], crops } · page de droite { double: "right",
// layout: 1, slots: [null] } (la photo et son recadrage ne sont gardés qu'à gauche ; le cadre de recadrage couvre les 2 pages).
export const isDoubleLeft  = (p) => p?.double === "left";
export const isDoubleRight = (p) => p?.double === "right";
export const isDoublePage  = (p) => !!p?.double;
export const spreadLeftOf  = (pageIndex) => (pageIndex % 2 === 1 ? pageIndex : pageIndex - 1);
export const canDouble     = (book, pageIndex) => { const l = spreadLeftOf(pageIndex); return l >= 1 && l + 1 < book.pages.length; };
// Index de la page de gauche si cette page fait partie d'une double page, sinon null.
export const doubleLeftIndex = (book, i) => (isDoubleLeft(book.pages[i]) ? i : isDoubleRight(book.pages[i]) ? i - 1 : null);
// Photos affichées par cette page (une moitié de double page montre la photo de la page de gauche).
export function pagePhotoIds(book, i) {
  const l = doubleLeftIndex(book, i);
  return (l != null ? book.pages[l] : book.pages[i]).slots.filter(Boolean);
}
// Une page de droite sans page de gauche (ou l'inverse), après un changement du nombre de pages, redevient une page vide normale.
function sanitizeDoubles(pages) {
  return pages.map((p, i) => {
    if (isDoubleLeft(p) && !isDoubleRight(pages[i + 1])) return emptyPage();
    if (isDoubleRight(p) && !isDoubleLeft(pages[i - 1])) return emptyPage();
    return p;
  });
}
// Transforme les 2 pages face à face autour de pageIndex en double page (vide). Leurs photos retournent dans l'album.
export function setDouble(book, pageIndex) {
  if (!canDouble(book, pageIndex)) return book;
  const l = spreadLeftOf(pageIndex);
  if (isDoubleLeft(book.pages[l])) return book;
  const pages = book.pages.map((p, i) =>
    i === l ? { layout: 1, slots: [null], double: "left" } : i === l + 1 ? { layout: 1, slots: [null], double: "right" } : p
  );
  return touch({ ...book, pages });
}
// Sépare la double page : 2 pages vides normales (la photo retourne dans l'album).
export function clearDouble(book, pageIndex) {
  const l = doubleLeftIndex(book, pageIndex);
  if (l == null) return book;
  const pages = book.pages.map((p, i) => (i === l || i === l + 1 ? emptyPage() : p));
  return touch({ ...book, pages });
}

// Plus petit nombre de pages où l'album tient à 2 photos par page (dans les limites du format du livre).
export function pickFormat(photoCount, book) {
  return clampPages(Math.ceil(photoCount / DEFAULT_PER_PAGE), book);
}

// Nouveau livre pré-rempli dans l'ordre de l'album. `product` = format choisi à la création ("a4" ou "paysage",
// défaut : A4 vertical layflat). Il démarre à 24 pages (le minimum), même si l'album est grand : voir completeBook pour le compléter.
export function createBook(album, product = DEFAULT_BOOK_PRODUCT) {
  const ids = album.photoIds;
  if (!BOOK_PRODUCTS[product]) product = DEFAULT_BOOK_PRODUCT;
  const orientation = BOOK_PRODUCTS[product].orientation;
  const format = pagesRange({ product, orientation }).min; // un livre démarre TOUJOURS au minimum (24 pages), l'utilisateur en ajoute ou complète ensuite
  const pages = Array.from({ length: format }, () => emptyPage());
  return autofill(
    {
      albumId: album.id,
      product,
      orientation,
      format,
      cover: { photoId: ids[0] ?? null, title: album.name, font: "moderne", size: "M", color: "blanc", pos: "bas",
               style: DEFAULT_COVER_STYLE, bg: DEFAULT_COVER_BG },
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
  format = clampPages(format, book);
  let pages = book.pages.slice(0, format);
  while (pages.length < format) pages.push(emptyPage());
  return touch({ ...book, format, pages: sanitizeDoubles(pages) }); // une double page dont une moitié disparaît est séparée
}

// Changer de format (livre imprimeur.fr) : "a4" (21 × 29,7 vertical) ou "paysage" (21 × 15 horizontal).
// L'orientation suit le format. Les photos restent ; si le nouveau format a moins de pages, celles en trop retournent dans l'album.
export function setProduct(book, key) {
  const p = BOOK_PRODUCTS[key];
  if (!p || book.product === key) return book;
  return setFormat(setOrientation({ ...book, product: key, orientation: book.orientation }, p.orientation), book.format);
}

// Convertit un livre créé avant le 9 nov. 2026 (format Gelato, sans `product`) en livre layflat : vertical → "a4",
// horizontal → "paysage"; pages ramenées entre 24 et 120 (les photos des pages en trop retournent dans l'album).
// Un livre déjà converti est rendu tel quel.
export function upgradeLegacyBook(book) {
  if (!book || BOOK_PRODUCTS[book.product]) return book;
  const key = book.orientation === "landscape" ? "paysage" : "a4";
  return setFormat({ ...book, product: key, orientation: BOOK_PRODUCTS[key].orientation }, book.format);
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
  if (isDoublePage(book.pages[pageIndex])) book = clearDouble(book, pageIndex); // 1 à 4 photos : on sort de la double page
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
  const pages = book.pages.map((p) => (isDoubleRight(p) ? p : { ...p, slots: p.slots.map((id) => id ?? free.shift() ?? null) }));
  return touch({ ...book, pages });
}

// Compléter le livre avec les photos de l'album pas encore placées : d'abord les cadres vides, puis on AJOUTE des pages
// (2 par 2, 2 photos par page) jusqu'au maximum du format. order : "date" = de la plus ancienne à la plus récente (la plus
// récente à la fin) · "album" = dans l'ordre de l'album. dates : { idPhoto: date en ms }. Les photos déjà placées ne bougent pas.
export const COMPLETE_ORDERS = [
  { key: "date",  label: "Par date",         hint: "la plus récente à la fin" },
  { key: "album", label: "Ordre de l'album", hint: "comme dans l'album" },
];
export function completeBook(book, albumPhotoIds, { order = "date", dates = {} } = {}) {
  const placed = placedMap(book);
  let free = albumPhotoIds.filter((id) => placed[id] === undefined);
  if (order === "date") {
    free = free.map((id, i) => [id, i]).sort((a, b) => (dates[a[0]] ?? 0) - (dates[b[0]] ?? 0) || a[1] - b[1]).map((x) => x[0]);
  }
  const queue = free.slice();
  const pages = book.pages.map((p) => (isDoubleRight(p) ? p : { ...p, slots: p.slots.map((id) => id ?? queue.shift() ?? null) }));
  const { max, step } = pagesRange(book);
  while (queue.length && pages.length + step <= max) {
    for (let k = 0; k < step; k++) pages.push({ layout: DEFAULT_PER_PAGE, slots: Array.from({ length: DEFAULT_PER_PAGE }, () => queue.shift() ?? null) });
  }
  return touch({ ...book, format: pages.length, pages });
}

// Modifier le titre d'une page : setPageTitle(book, 4, { text: "Plage" }).
export function setPageTitle(book, pageIndex, patch) {
  const pages = book.pages.map((p, pi) =>
    pi !== pageIndex ? p : { ...p, title: { text: "", pos: "bas", size: "M", ...p.title, ...patch } }
  );
  return touch({ ...book, pages });
}

// Recadrage de la photo de couverture (comme les photos des pages) : cover.crop = { scale, x, y, rot, tilt }.
export const getCoverCrop = (cover) => ({ ...DEFAULT_CROP, ...(cover?.crop ?? {}) });
export function setCoverCrop(book, patch) {
  return setCover(book, { crop: { ...getCoverCrop(book.cover), ...patch } });
}
// Remettre la photo au centre, sans zoom ni redressement (le quart de tour est gardé).
export function resetCoverCrop(book) {
  return setCoverCrop(book, { ...DEFAULT_CROP, rot: getCoverCrop(book.cover).rot });
}

// Modifier la couverture : setCover(book, { title: "Été" }).
export function setCover(book, patch) {
  return touch({ ...book, cover: { ...book.cover, ...patch } });
}

// Styles où la couleur de fond se VOIT sur la face avant (les autres : la photo couvre tout). Le choix du fond
// n'est proposé que pour ceux-là. (Le dos du livre prend toujours la couleur de fond choisie.)
export const COVER_STYLES_WITH_BG = ["centree", "polaroid", "bandeau", "titre"];
export const styleNeedsBg = (style) => COVER_STYLES_WITH_BG.includes(style ?? DEFAULT_COVER_STYLE);

// Titre de couverture : position AUTOMATIQUE (cover.titleXY absent : haut / milieu / bas ou zone du style) ou
// MANUELLE (cover.titleXY = { x, y }, centre du titre en parts de la couverture, 0 → 1, déplacé au doigt).
// Point de départ du mode manuel = là où le titre est en automatique.
export function autoTitleXY(cover) {
  const style = cover?.style ?? DEFAULT_COVER_STYLE;
  if (style === "pleine" || style === "cadre") return { x: 0.5, y: { haut: 0.14, milieu: 0.5, bas: 0.86 }[cover?.pos] ?? 0.86 };
  return { x: 0.5, y: { centree: 0.85, polaroid: 0.84, bandeau: 0.84, titre: 0.5 }[style] ?? 0.85 };
}

// Changer de style de couverture : le titre repasse en couleur et en position automatiques (lisible sur le nouveau style).
export function setCoverStyle(book, style) {
  if (!COVER_STYLES.some((s) => s.key === style) || (book.cover.style ?? DEFAULT_COVER_STYLE) === style) return book;
  return setCover(book, { style, color: "auto", titleXY: undefined });
}

// Changer la couleur de fond : si le titre est en automatique, il se réadapte tout seul.
export function setCoverBg(book, bg) {
  return setCover(book, { bg });
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
    cover = { ...cover, photoId: albumPhotoIds[0] ?? null, crop: undefined }; // nouvelle photo : on repart d'un cadrage neuf
  }
  return changed ? touch({ ...book, pages, cover }) : book;
}

// Chiffres pour la carte « 43 / 44 photos placées · 2 pages vides ».
export function bookStats(book, albumPhotoIds) {
  const placed = placedMap(book);
  const placedCount = albumPhotoIds.filter((id) => placed[id] !== undefined).length;
  // La moitié droite d'une double page n'a pas de cadre à elle : elle ne compte ni comme cadre ni comme page vide.
  const own = book.pages.filter((p) => !isDoubleRight(p));
  const slots  = own.reduce((n, p) => n + p.slots.length, 0);
  const filled = own.reduce((n, p) => n + p.slots.filter(Boolean).length, 0);
  const emptyPages = own.filter((p) => p.slots.every((id) => !id)).length;
  return { placedCount, total: albumPhotoIds.length, fillRatio: slots ? filled / slots : 0, emptyPages };
}
