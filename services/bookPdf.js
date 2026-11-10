// services/bookPdf.js
// Fabrication du PDF d'un livre photo (essai). Logique sans UI :
//   • pageGeometry : tailles d'une page à imprimer (rognée + fond perdu), en points d'écran et en mm
//   • buildPlan    : liste des pages du PDF dans l'ordre demandé par imprimeur.fr
//   • addPdfPage   : ajoute une image JPEG au PDF avec les boîtes de rognage / fond perdu
//
// Structure du PDF layflat imprimeur.fr (gabarits reçus le 9 nov. 2026) : couverture de FACE · pages 1 → N une par une ·
// couverture de DOS. Chaque page au format exact, sans fond perdu, sans dos ni page blanche.
// (La structure Gelato, avec couverture à plat, est archivée dans archive/gelato/.)
import { PDFDocument } from "pdf-lib";
import { bookSpec } from "./bookProducts";
import { isDoubleLeft, isDoubleRight } from "./photoBook";

export const PDF_SPEC = {
  dpi: 150, // résolution des images (hypothèse : imprimeur.fr ne précise pas de minimum)
};

const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72; // un « point » PDF = 1/72 de pouce

// Géométrie d'une page. pixelRatio = densité de l'écran (PixelRatio.get()) : on dessine la page
// à (pixels voulus ÷ pixelRatio) points d'écran, pour que la capture tombe pile sur la bonne taille.
export function pageGeometry(book, pixelRatio) {
  const spec = bookSpec(book); // dimensions de la page rognée et fond perdu de CE livre
  const trimWmm = spec.widthMm;
  const trimHmm = spec.heightMm;
  const bleedMm = spec.bleedMm;
  const totalWmm = trimWmm + 2 * bleedMm;
  const totalHmm = trimHmm + 2 * bleedMm;

  const targetPx = Math.round((totalWmm / MM_PER_INCH) * PDF_SPEC.dpi); // largeur de l'image
  const widthPt = targetPx / pixelRatio;                                 // en points d'écran
  const heightPt = (widthPt * totalHmm) / totalWmm;
  const bleedPt = (widthPt * bleedMm) / totalWmm;

  return {
    widthPt, heightPt, bleedPt,
    trimWidthPt: widthPt - 2 * bleedPt,
    trimHeightPt: heightPt - 2 * bleedPt,
    targetPx,
    pdf: pdfPageSpec(totalWmm, totalHmm, { x: bleedMm, y: bleedMm, w: trimWmm, h: trimHmm }),
  };
}

const mmToPdf = (mm) => (mm / MM_PER_INCH) * PT_PER_INCH;

// Taille d'une page du PDF et de sa zone rognée (trim), en points PDF (1/72 pouce).
// trim en mm, origine en HAUT à gauche ; le PDF compte depuis le BAS : on retourne l'axe y.
function pdfPageSpec(totalWmm, totalHmm, trim) {
  return {
    width: mmToPdf(totalWmm),
    height: mmToPdf(totalHmm),
    trim: { x: mmToPdf(trim.x), y: mmToPdf(totalHmm - trim.y - trim.h), w: mmToPdf(trim.w), h: mmToPdf(trim.h) },
  };
}

// Liste des pages du PDF. kind : "front" / "back" (couverture de face / de dos) · "page" (à dessiner) · "blank" (page blanche, rien à dessiner).
// Une page intérieure sans aucune photo ni titre est imprimée blanche sans rendu.
export function buildPlan(book) {
  const plan = [{ key: "front", kind: "front" }];
  book.pages.forEach((p, pageIndex) => {
    // Une moitié de double page est « vide » seulement si la double page n'a pas de photo.
    const doubleOwner = isDoubleRight(p) ? book.pages[pageIndex - 1] : isDoubleLeft(p) ? p : null;
    const empty = doubleOwner ? !doubleOwner.slots[0] : p.slots.every((id) => !id) && !p.title?.text;
    plan.push(empty ? { key: `p${pageIndex}`, kind: "blank" } : { key: `p${pageIndex}`, kind: "page", pageIndex });
  });
  plan.push({ key: "back", kind: "back" });
  return plan;
}

// Crée le document et ajoute les pages une à une.
export async function createPdf() {
  const doc = await PDFDocument.create();
  doc.setTitle("Livre photo Pellicule (essai)");
  doc.setCreator("Pellicule");
  return doc;
}

// spec : { width, height, trim } en points PDF (geo.pdf d'une page intérieure ou de la couverture).
// image : base64 d'un JPEG, ou null pour une page blanche.
export async function addPdfPage(doc, spec, imageBase64) {
  const { width, height, trim } = spec;
  const page = doc.addPage([width, height]);
  page.setBleedBox(0, 0, width, height);
  page.setTrimBox(trim.x, trim.y, trim.w, trim.h);
  if (imageBase64) {
    const img = await doc.embedJpg(imageBase64);
    page.drawImage(img, { x: 0, y: 0, width, height });
  }
}

export const pdfToBase64 = (doc) => doc.saveAsBase64();
