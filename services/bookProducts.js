// services/bookProducts.js
// Les formats de livre photo et leurs prix (logique pure : pas d'UI, pas de store, pas de réseau).
//
// Deux produits imprimeur.fr « layflat » (pages rigides qui s'ouvrent à plat à 180°, couverture rigide),
// choisis par Augustin le 9 nov. 2026 :
//   a4      = 21 × 29,7 cm (vertical)
//   paysage = 21 × 15 cm   (horizontal)
// Pages de 24 à 120, de 2 en 2.
//
// FICHIER À ENVOYER (gabarits imprimeur.fr reçus le 9 nov. 2026, un PDF de 26 pages par format pour un livre de 24 pages) :
//   page 1 = couverture de FACE · pages 2 → N+1 = les N pages du livre, une par une · dernière page = couverture de DOS.
//   Pas de dos / tranche, pas de page blanche de garde, pas de couverture à plat. Chaque page = le FORMAT EXACT
//   (210 × 297 mm, 297 × 210, 210 × 150, 150 × 210), TrimBox = BleedBox = MediaBox : le gabarit n'a donc PAS de fond perdu.
//
// ⚠️ Les prix « cost » viennent de l'API imprimeur.fr (fonction `imprimeur-catalogue`, relevé du 9 nov. 2026, prix HT
//    de NOTRE compte). Si imprimeur.fr change ses tarifs, relancer la fonction et mettre à jour ce fichier.
// ⚠️ ENCORE À CONFIRMER : (1) fond perdu — la fiche album d'imprimeur.fr parle de « 5 mm de fond perdu » mais les gabarits sont au
//    format exact : on suit les gabarits (bleedMm = 0) ; à valider avec une commande TEST (clé impr_test_, rien n'est imprimé) ;
//    (2) dpi minimum (150 supposé), zone de sécurité (5 mm supposée). Aucun des deux n'est dans les gabarits.
//
// Gelato (ancien livre 21 × 28 cm, 30 → 200 pages) est retiré de l'app : voir archive/gelato/README.md.

const LAYFLAT = {
  supplier: "imprimeur",
  finish: "layflat",
  finishLabel: "Layflat · couverture rigide",
  pages: { min: 24, max: 120, step: 2 },
  bleedMm: 0,  // gabarits = format exact, sans fond perdu (voir plus haut)
  safeMm: 5,   // hypothèse (à confirmer)
  minDpi: 150, // hypothèse (à confirmer)
};

export const BOOK_PRODUCTS = {
  a4: {
    ...LAYFLAT,
    key: "a4",
    label: "Vertical",
    sizeLabel: "21 × 29,7 cm",
    widthMm: 210,
    heightMm: 297,
    orientation: "portrait",
    // Coût imprimeur.fr, en centimes HT : 24 pages incluses, puis par page en plus.
    cost: { baseCents: 1690, extraPageCents: 39 },
    // Prix de vente TTC, en centimes, livraison comprise.
    sale: { baseCents: 3490, extraPageCents: 65 }, // 34,90 € (décidé par Augustin, 9 nov. 2026)
  },
  paysage: {
    ...LAYFLAT,
    key: "paysage",
    label: "Horizontal",
    sizeLabel: "21 × 15 cm",
    widthMm: 210,
    heightMm: 150,
    orientation: "landscape",
    cost: { baseCents: 1490, extraPageCents: 39 },
    sale: { baseCents: 2990, extraPageCents: 65 }, // 29,90 € (décidé par Augustin, 9 nov. 2026)
  },
};
export const BOOK_PRODUCT_KEYS = ["a4", "paysage"];
export const DEFAULT_BOOK_PRODUCT = "a4";

// Port imprimeur.fr (Colissimo, en France, HT) : forfait par commande, le même pour tous les albums (relevé du 9 nov. 2026).
export const SHIPPING_COST_CENTS = 497;
export const VAT_RATE = 0.2; // hypothèse : TVA 20 % sur un livre photo personnalisé (à confirmer avec ton comptable)

// Règle d'un livre : ses dimensions, son nombre de pages, son fond perdu…
// Un livre sans `product` (créé avant le 9 nov. 2026) est rattaché au format qui correspond à son orientation
// (vertical → "a4", horizontal → "paysage") ; il est aussi converti au démarrage (voir upgradeLegacyBook dans photoBook.js).
export function bookSpec(book) {
  return BOOK_PRODUCTS[book?.product]
    ?? (book?.orientation === "landscape" ? BOOK_PRODUCTS.paysage : BOOK_PRODUCTS[DEFAULT_BOOK_PRODUCT]);
}

// Prix de vente TTC en centimes (null si le nombre de pages est inconnu).
export function bookPriceCents(book, pages = book?.format) {
  const p = bookSpec(book);
  if (!Number.isFinite(pages)) return null;
  const extra = Math.max(0, pages - p.pages.min);
  return p.sale.baseCents + extra * p.sale.extraPageCents;
}

// Coût pour Pellicule, en centimes HT : impression + port (ce que imprimeur.fr nous facture).
export function bookCostCents(book, pages = book?.format) {
  const p = bookSpec(book);
  if (!Number.isFinite(pages)) return null;
  const extra = Math.max(0, pages - p.pages.min);
  return p.cost.baseCents + extra * p.cost.extraPageCents + SHIPPING_COST_CENTS;
}

// Ce qu'il reste à Pellicule sur un livre : prix TTC → HT, moins le coût (avant frais de paiement).
export function bookMarginCents(book, pages = book?.format) {
  const price = bookPriceCents(book, pages);
  const cost = bookCostCents(book, pages);
  return price == null ? null : Math.round(price / (1 + VAT_RATE)) - cost;
}
