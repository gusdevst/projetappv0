// services/bookCheck.js
// Contrôles d'un livre photo avant impression (logique pure : pas d'UI, pas de store).
//
// PRINT_SPEC : minDpi / bleedMm / safeMm viennent de Gelato (support.gelato.com, nov. 2026) :
// images 150 dpi minimum (300 max), fond perdu 4 mm, zone de sécurité 4 mm.
// ⚠️ pageCm (page carrée de 21 cm) reste PROVISOIRE : à remplacer par la taille du produit Gelato choisi.
import { getCrop } from "./photoBook";

export const PRINT_SPEC = {
  // Produit Gelato choisi (nov. 2026) : livre photo couverture rigide 210×280 mm (8×11 po), 170 g couché soie,
  // pelliculage mat, collé à gauche. Pages de 30 à 200, de 2 en 2. Prix vu : 15,46 € HT + 5,39 $ livraison (30 pages).
  product: "photobooks-hardcover_pf_210x280-mm-8x11-inch_pt_170-gsm-65lb-coated-silk_cl_4-4_ccl_4-4_bt_glued-left_ct_matt-lamination_prt_1-0_cpt_130-gsm-65-lb-cover-coated-silk_ver",
  pageWidthMm: 210,  // page verticale ; en horizontal, largeur et hauteur s'échangent
  pageHeightMm: 280,
  minPages: 30, // Gelato : nombre de pages fixe entre 30 et 200
  maxPages: 200,
  minDpi: 150, // Gelato : 150 dpi minimum
  bleedMm: 4,  // Gelato : fond perdu 4 mm sur tous les côtés
  safeMm: 4,   // Gelato : texte / éléments importants à 4 mm au moins du bord
};

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
function requiredPx(layout, slotIndex, scale, landscape) {
  const pageWidthCm = landscape ? PRINT_SPEC.pageHeightMm / 10 : PRINT_SPEC.pageWidthMm / 10; // largeur de page : 21 (vertical) ou 28 (horizontal)
  const cm = slotFraction(layout, slotIndex, landscape) * pageWidthCm;
  return Math.round((cm / 2.54) * PRINT_SPEC.minDpi * (scale || 1));
}

// photoById : { id: { width, height } }
// Renvoie :
//   coverOk      : la couverture a une photo présente sur le téléphone
//   pagesOk      : le nombre de pages est accepté par l'imprimeur
//   emptyPages   : numéros (0, 1, …) des pages sans aucune photo
//   lowQuality   : [{ photoId, pageIndex, have, need }] photos trop petites pour leur cadre
//   unplaced     : nombre de photos de l'album pas dans le livre
export function checkBook(book, albumIds, photoById) {
  const coverId = book.cover?.photoId;
  const coverOk = !!coverId && !!photoById[coverId];

  const emptyPages = [];
  const lowQuality = [];
  const placed = new Set();

  book.pages.forEach((page, pageIndex) => {
    if (page.slots.every((id) => !id)) emptyPages.push(pageIndex);
    page.slots.forEach((id, slotIndex) => {
      if (!id) return;
      placed.add(id);
      const photo = photoById[id];
      if (!photo?.width || !photo?.height) return; // taille inconnue : on ne dit rien
      const have = Math.min(photo.width, photo.height);
      const need = requiredPx(page.layout, slotIndex, getCrop(page, id).scale, book.orientation === "landscape");
      if (have < need) lowQuality.push({ photoId: id, pageIndex, have, need });
    });
  });

  const unplaced = albumIds.filter((id) => !placed.has(id)).length;
  // Les anciens livres (24 pages) ne sont plus imprimables : il faut passer à 30 pages ou plus.
  const pagesOk = book.format >= PRINT_SPEC.minPages && book.format <= PRINT_SPEC.maxPages && book.format % 2 === 0;
  return { coverOk, pagesOk, emptyPages, lowQuality, unplaced };
}
