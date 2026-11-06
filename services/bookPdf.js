// services/bookPdf.js
// Fabrication du PDF d'un livre photo (essai). Logique sans UI :
//   • pageGeometry : tailles d'une page à imprimer (rogné + fond perdu), en points d'écran et en mm
//   • buildPlan    : liste des pages du PDF dans l'ordre demandé par Gelato
//   • assemblePdf  : assemble les images JPEG en un PDF avec les boîtes de rognage / fond perdu
//
// Ordre du PDF d'essai : couverture de face · page blanche (garde) · pages intérieures · page blanche de fin.
// (La couverture à plat avec le dos viendra avec l'API Gelato.)
import { PDFDocument } from "pdf-lib";
import { PRINT_SPEC } from "./bookCheck";

export const PDF_SPEC = {
  bleedMm: PRINT_SPEC.bleedMm, // fond perdu de chaque côté (Gelato : 4 mm)
  dpi: 150,                    // résolution des images (Gelato : 150 minimum)
};

const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72; // un « point » PDF = 1/72 de pouce

// Géométrie d'une page. pixelRatio = densité de l'écran (PixelRatio.get()) : on dessine la page
// à (pixels voulus ÷ pixelRatio) points d'écran, pour que la capture tombe pile sur la bonne taille.
export function pageGeometry(book, pixelRatio) {
  const landscape = book.orientation === "landscape";
  const trimWmm = landscape ? PRINT_SPEC.pageHeightMm : PRINT_SPEC.pageWidthMm;
  const trimHmm = landscape ? PRINT_SPEC.pageWidthMm : PRINT_SPEC.pageHeightMm;
  const totalWmm = trimWmm + 2 * PDF_SPEC.bleedMm;
  const totalHmm = trimHmm + 2 * PDF_SPEC.bleedMm;

  const targetPx = Math.round((totalWmm / MM_PER_INCH) * PDF_SPEC.dpi); // largeur de l'image
  const widthPt = targetPx / pixelRatio;                                 // en points d'écran
  const heightPt = (widthPt * totalHmm) / totalWmm;
  const bleedPt = (widthPt * PDF_SPEC.bleedMm) / totalWmm;

  return {
    widthPt, heightPt, bleedPt,
    trimWidthPt: widthPt - 2 * bleedPt,
    trimHeightPt: heightPt - 2 * bleedPt,
    targetPx,
    pdf: { // taille d'une page du PDF, en points PDF (1/72 pouce)
      width: (totalWmm / MM_PER_INCH) * PT_PER_INCH,
      height: (totalHmm / MM_PER_INCH) * PT_PER_INCH,
      bleed: (PDF_SPEC.bleedMm / MM_PER_INCH) * PT_PER_INCH,
    },
  };
}

// Liste des pages du PDF. kind : "cover" | "page" (à dessiner) · "blank" (page blanche, rien à dessiner).
// Une page intérieure sans aucune photo ni titre est imprimée blanche sans rendu.
export function buildPlan(book) {
  const plan = [{ key: "cover", kind: "cover" }, { key: "garde", kind: "blank" }];
  book.pages.forEach((p, pageIndex) => {
    const empty = p.slots.every((id) => !id) && !p.title?.text;
    plan.push(empty ? { key: `p${pageIndex}`, kind: "blank" } : { key: `p${pageIndex}`, kind: "page", pageIndex });
  });
  plan.push({ key: "fin", kind: "blank" });
  return plan;
}

// Crée le document et ajoute les pages une à une.
export async function createPdf() {
  const doc = await PDFDocument.create();
  doc.setTitle("Livre photo Pellicule (essai)");
  doc.setCreator("Pellicule");
  return doc;
}

// image : base64 d'un JPEG, ou null pour une page blanche.
export async function addPdfPage(doc, geo, imageBase64) {
  const { width, height, bleed } = geo.pdf;
  const page = doc.addPage([width, height]);
  page.setBleedBox(0, 0, width, height);
  page.setTrimBox(bleed, bleed, width - 2 * bleed, height - 2 * bleed);
  if (imageBase64) {
    const img = await doc.embedJpg(imageBase64);
    page.drawImage(img, { x: 0, y: 0, width, height });
  }
}

export const pdfToBase64 = (doc) => doc.saveAsBase64();
