// services/posterProducts.js
// Les posters photo (imprimeur.fr) : formats, prix, qualité d'une photo selon le format.
// Logique pure : pas d'UI, pas de store, pas de réseau.
//
// ── Source des données (relevé du 10 nov. 2026, API imprimeur.fr via la fonction `imprimeur-catalogue`, clé TEST) ──
//   · produit `poster`, finition unique `standard` (« Poster seul »), 1 exemplaire minimum, pas de maximum par ligne ;
//   · prix unitaire HT : 3,22 € · 4,86 € · 10,98 € · 15,00 € ; port = forfait par commande (Colissimo 4,97 € HT,
//     Chronopost 8,25 € HT), le MÊME pour les 4 formats et quelle que soit la quantité (testé avec 5 exemplaires) ;
//   · papier pelliculé brillant 250 g, livré roulé et protégé, production 1 à 3 jours ouvrés (fiche produit) ;
//   · l'API affiche « 20×30 / 30×40 / 42×59 / 59×84 cm » mais les tailles RÉELLES sont A4 / A3 / A2 / A1
//     (210×297, 297×420, 420×594, 590×840 mm) : l'app affiche les vraies dimensions.
// ⚠️ Pas publiés par imprimeur.fr : dpi minimum et fond perdu. On suppose 150 dpi et 0 mm, à valider par une commande TEST.
// ⚠️ Fichier à envoyer : UN JPG / PNG par exemplaire, via une URL publique (pas encore branché : commande en standby).
//
// Prix de vente = ceux proposés dans la maquette `maquette-poster.html` (TTC, livraison comprise) : à confirmer par Augustin.

import { SHIPPING_COST_CENTS, VAT_RATE } from "./bookProducts";

export const POSTER_PRODUCT_ID = "poster";   // product_id côté imprimeur.fr
export const POSTER_FINITION = "standard";   // finition_code côté imprimeur.fr
export const POSTER_MIN_DPI = 150;           // hypothèse (non publié)
export const POSTER_MAX_QTY = 10;            // limite de l'écran (pas de limite côté imprimeur.fr)

export const POSTER_FORMATS = {
  a4: {
    key: "a4", name: "A4", sizeLabel: "21 × 29,7 cm", imprimeurCode: "20x30cm",
    widthMm: 210, heightMm: 297,
    costCents: 322,     // coût imprimeur.fr, HT
    saleCents: 1490,    // prix de vente TTC, livraison comprise
  },
  a3: {
    key: "a3", name: "A3", sizeLabel: "29,7 × 42 cm", imprimeurCode: "30x40cm",
    widthMm: 297, heightMm: 420,
    costCents: 486,
    saleCents: 1790,
  },
  a2: {
    key: "a2", name: "A2", sizeLabel: "42 × 59,4 cm", imprimeurCode: "42x59cm",
    widthMm: 420, heightMm: 594,
    costCents: 1098,
    saleCents: 2790,
  },
  a1: {
    key: "a1", name: "A1", sizeLabel: "59 × 84 cm", imprimeurCode: "59x84cm",
    widthMm: 590, heightMm: 840,
    costCents: 1500,
    saleCents: 3490,
  },
};
export const POSTER_FORMAT_KEYS = ["a4", "a3", "a2", "a1"];
export const DEFAULT_POSTER_FORMAT = "a3";

// Textes de la page de présentation (fiche produit imprimeur.fr, 10 nov. 2026). On n'ajoute rien de plus.
export const POSTER_HIGHLIGHTS = [
  "Impression haute définition",
  "Papier photo pelliculé brillant, 250 g",
  "Imprimé en France, prêt en 1 à 3 jours ouvrés",
  "Livré roulé et protégé, chez toi en 2 à 4 jours",
  "Satisfait ou refait", // ⚠️ à vérifier dans les CGV d'imprimeur.fr avant la mise en ligne
];

const fmt = (key) => POSTER_FORMATS[key] ?? POSTER_FORMATS[DEFAULT_POSTER_FORMAT];

// Prix de vente TTC (centimes), livraison comprise, pour `qty` exemplaires du même format.
export function posterPriceCents(key, qty = 1) {
  return fmt(key).saleCents * Math.max(1, qty);
}

// Coût pour Pellicule (centimes HT) : impression de chaque exemplaire + UN seul port par commande.
export function posterCostCents(key, qty = 1) {
  return fmt(key).costCents * Math.max(1, qty) + SHIPPING_COST_CENTS;
}

// Ce qu'il reste à Pellicule : prix TTC → HT, moins le coût (avant frais de paiement).
export function posterMarginCents(key, qty = 1) {
  return Math.round(posterPriceCents(key, qty) / (1 + VAT_RATE)) - posterCostCents(key, qty);
}

// Sens du poster : il suit la photo. Photo horizontale → poster horizontal (la feuille est simplement tournée à 90° :
// imprimeur.fr ne liste que des formats « portrait », on lui enverra l'image tournée dans une feuille verticale ;
// à valider par une commande TEST). Photo verticale ou carrée → poster vertical.
export const posterIsLandscape = (photo) => !!photo?.width && !!photo?.height && photo.width > photo.height;

// Dimensions du poster (mm) dans le sens choisi : { widthMm, heightMm }.
export function posterDims(key, landscape = false) {
  const f = fmt(key);
  return landscape ? { widthMm: f.heightMm, heightMm: f.widthMm } : { widthMm: f.widthMm, heightMm: f.heightMm };
}

// « 21 × 29,7 cm » (vertical) ou « 29,7 × 21 cm » (horizontal).
export function posterSizeLabel(key, landscape = false) {
  const label = fmt(key).sizeLabel;
  if (!landscape) return label;
  const [a, b] = label.replace(" cm", "").split(" × ");
  return `${b} × ${a} cm`;
}

// Qualité d'une photo sur un poster : on la recadre au centre pour REMPLIR le poster (« cover »).
// Renvoie { dpi, lossPct } ou null si la taille de la photo est inconnue.
//   dpi     : résolution obtenue sur le papier ;
//   lossPct : part de la photo qui sera coupée par le recadrage (0 à 100).
export function posterQuality(photo, key) {
  const w = photo?.width, h = photo?.height;
  if (!w || !h) return null;
  const { widthMm, heightMm } = posterDims(key, posterIsLandscape(photo));
  const dpi = 25.4 * Math.min(w / widthMm, h / heightMm);
  const posterRatio = widthMm / heightMm;           // largeur / hauteur
  const photoRatio = w / h;
  const keptFraction = photoRatio > posterRatio ? posterRatio / photoRatio : photoRatio / posterRatio;
  return { dpi: Math.round(dpi), lossPct: Math.round((1 - keptFraction) * 100) };
}

// Niveau de qualité à afficher. tone : "good" (vert) | "ok" (vert) | "warn" (orange) | "bad" (rouge).
export function posterQualityLevel(dpi) {
  if (dpi == null) return { key: "unknown", label: "Qualité inconnue", tone: "warn" };
  if (dpi >= 200) return { key: "perfect", label: "Parfait", tone: "good" };
  if (dpi >= POSTER_MIN_DPI) return { key: "good", label: "Bonne qualité", tone: "ok" };
  if (dpi >= 100) return { key: "tight", label: "Un peu juste", tone: "warn" };
  return { key: "low", label: "Trop petite", tone: "bad" };
}

// Format proposé d'office pour une photo : le plus grand format (jusqu'à A2) dont la qualité est « bonne ».
// A1 n'est jamais présélectionné (le plus cher). Taille inconnue → A3. Sinon A4.
export function bestPosterFormat(photo) {
  if (!photo?.width || !photo?.height) return DEFAULT_POSTER_FORMAT;
  const ok = ["a2", "a3", "a4"].find((k) => posterQuality(photo, k).dpi >= POSTER_MIN_DPI);
  return ok ?? "a4";
}

// Au-delà de cette part de photo coupée, on prévient l'utilisateur.
export const POSTER_CROP_WARN_PCT = 25;
