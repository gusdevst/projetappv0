// ─── Livre photo : logique pure (pas d'UI, pas de store) ───────────────────
// Un livre = une couverture + une liste de pages. Chaque page = une mise en
// page (1 à 4 cadres) + les ids des photos placées dans ses cadres.
//
//   book = {
//     albumId, format: 24,
//     cover: { photoId, title, font, size, color, pos },
//     pages: [ { layout: 2, slots: ["id1", null] }, … ],
//     updatedAt,
//   }
//
// Toutes les fonctions renvoient un NOUVEAU livre (on ne modifie jamais
// l'ancien) → Zustand voit le changement et l'écran se redessine.

export const BOOK_FORMATS = [24, 32, 48, 64];
export const BOOK_LAYOUTS = [1, 2, 3, 4];
export const DEFAULT_PER_PAGE = 2;

// Réglages de la couverture (les clés ; l'écran les traduit en police / taille / couleur).
export const COVER_FONTS  = ["moderne", "elegante", "manuscrite", "affiche"];
export const COVER_SIZES  = ["S", "M", "L"];
export const COVER_COLORS = ["blanc", "noir", "terracotta", "sauge"];
export const COVER_POS    = ["haut", "milieu", "bas"];

const emptyPage = (layout = DEFAULT_PER_PAGE) => ({ layout, slots: Array(layout).fill(null) });
const touch = (book) => ({ ...book, updatedAt: Date.now() });

// Plus petit format où l'album tient à 2 photos par page (sinon 64).
export function pickFormat(photoCount) {
  return BOOK_FORMATS.find((f) => f * DEFAULT_PER_PAGE >= photoCount) ?? BOOK_FORMATS[BOOK_FORMATS.length - 1];
}

// Nouveau livre pré-rempli dans l'ordre de l'album.
export function createBook(album) {
  const ids = album.photoIds;
  const format = pickFormat(ids.length);
  const pages = Array.from({ length: format }, () => emptyPage());
  return autofill(
    {
      albumId: album.id,
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
  let pages = book.pages.slice(0, format);
  while (pages.length < format) pages.push(emptyPage());
  return touch({ ...book, format, pages });
}

// Changer la mise en page d'une page. Les photos en trop sortent du livre.
export function setLayout(book, pageIndex, layout) {
  const pages = book.pages.map((p, pi) => {
    if (pi !== pageIndex) return p;
    const kept = p.slots.filter(Boolean).slice(0, layout);
    return { layout, slots: Array.from({ length: layout }, (_, i) => kept[i] ?? null) };
  });
  return touch({ ...book, pages });
}

// Placer une photo dans un cadre. Si elle était déjà ailleurs, elle se déplace.
export function placePhoto(book, pageIndex, slotIndex, photoId) {
  const pages = book.pages.map((p, pi) => ({
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
    pi !== pageIndex ? p : { ...p, slots: p.slots.map((id, si) => (si === slotIndex ? null : id)) }
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
