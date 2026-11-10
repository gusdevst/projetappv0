// services/bookCheck.js
// Contrôles d'un livre photo avant impression (logique pure : pas d'UI, pas de store).
// Les règles d'impression (pages min / max, dpi, fond perdu…) viennent de services/bookProducts.js (bookSpec).
// L'ancienne règle Gelato (PRINT_SPEC) est archivée dans archive/gelato/.
import { getCrop, isDoubleLeft, isDoubleRight } from "./photoBook";
import { bookSpec } from "./bookProducts";

// Largeur du cadre en part de la page (voir ROWS dans components/book/BookPage.js).
// Vertical : 1 et 2 photos = pleine largeur · 3 photos = 1 grand en haut + 2 petits · 4 photos = 4 petits.
// Horizontal : 2 photos sont côte à côte (chacune une demi-largeur).
function slotFraction(layout, slotIndex, landscape) {
  if (layout === 1) return 0.9;
  if (layout === 2) return landscape ? 0.45 : 0.9;
  if (layout === 3) return slotIndex === 0 ? 0.9 : 0.45;
  return 0.45;
}

// Nombre de pixels (petit côté de la photo) nécessaires pour bien remplir ce cadre.
// Un recadrage zoomé demande davantage de pixels.
function requiredPx(layout, slotIndex, scale, spec, double) {
  const landscape = spec.orientation === "landscape";
  const pageWidthCm = spec.widthMm / 10; // largeur d'une page : 21 (A4 vertical, 21×15)
  // Double page : le cadre couvre les 2 pages moins la marge de 5 % aux deux bouts = 1,9 largeur de page.
  const cm = (double ? 1.9 : slotFraction(layout, slotIndex, landscape)) * pageWidthCm;
  return Math.round((cm / 2.54) * spec.minDpi * (scale || 1));
}

// photoById : { id: { width, height } }
// Renvoie :
//   coverOk      : la couverture a une photo présente sur le téléphone
//   pagesOk      : le nombre de pages est accepté par l'imprimeur
//   emptyPages   : numéros (0, 1, …) des pages sans aucune photo
//   lowQuality   : [{ photoId, pageIndex, have, need }] photos trop petites pour leur cadre
//   unplaced     : nombre de photos de l'album pas dans le livre
export function checkBook(book, albumIds, photoById) {
  const spec = bookSpec(book);
  const coverId = book.cover?.photoId;
  // Le style « Titre seul » n'a pas de photo : rien à vérifier de ce côté.
  const coverOk = book.cover?.style === "titre" || (!!coverId && !!photoById[coverId]);

  const emptyPages = [];
  const lowQuality = [];
  const placed = new Set();

  book.pages.forEach((page, pageIndex) => {
    if (isDoubleRight(page)) return; // la moitié droite est comptée avec la page de gauche
    if (page.slots.every((id) => !id)) { emptyPages.push(pageIndex); if (isDoubleLeft(page)) emptyPages.push(pageIndex + 1); }
    page.slots.forEach((id, slotIndex) => {
      if (!id) return;
      placed.add(id);
      const photo = photoById[id];
      if (!photo?.width || !photo?.height) return; // taille inconnue : on ne dit rien
      const have = Math.min(photo.width, photo.height);
      const need = requiredPx(page.layout, slotIndex, getCrop(page, id).scale, spec, isDoubleLeft(page));
      if (have < need) lowQuality.push({ photoId: id, pageIndex, have, need });
    });
  });

  const unplaced = albumIds.filter((id) => !placed.has(id)).length;
  // Nombre de pages accepté par l'imprimeur du format choisi (layflat : 24 → 120).
  const pagesOk = book.format >= spec.pages.min && book.format <= spec.pages.max && book.format % spec.pages.step === 0;
  return { coverOk, pagesOk, pagesMin: spec.pages.min, pagesMax: spec.pages.max, emptyPages, lowQuality, unplaced };
}
