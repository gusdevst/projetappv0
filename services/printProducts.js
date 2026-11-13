// services/printProducts.js
// Le produit « Tirages photo » (page « Nouveaux tirages », Chambre noire → Tirages photos → ＋ Nouveau).
// Données lues dans l'API imprimeur.fr le 10 nov. 2026 (fonction `imprimeur-catalogue`, produit `print`) :
//   formats 10×15 cm et 10×10 cm · finition « Tirages seuls » · 20 tirages minimum · jusqu'à 1 000 par commande.
// L'API n'annonce NI papier NI finition : ne pas écrire « brillant » ou un grammage tant qu'imprimeur.fr ne les a pas confirmés.
// Les coffrets (Box…) et ScrapBooking existent chez eux mais l'API les refuse (« non commandables ») : volontairement absents.
//
// ⚠️ PRIX DU TIRAGE SIMPLE = EXEMPLE (maquette du 10 nov.), à fixer par Augustin. Repère : abonnement 12,90 € TTC pour 20 ;
// coût CONFIRMÉ par le support (11 nov.) = 0,20 € HT par tirage, sans dégressivité, + 4,97 € de port Colissimo par commande
// → 20 tirages = 8,97 € HT. Un tirage en plus à 0,35 € TTC (0,29 € HT) ne laisse que 0,09 € : relever `extraCents` (≥ 45).
// Modifier ici = modifier partout.

export const PRINT_PRODUCT = {
  name: "Tirages photo",
  formats: [
    { key: "10x15", label: "10 × 15 cm", widthMm: 100, heightMm: 150 },
    { key: "10x10", label: "10 × 10 cm", widthMm: 100, heightMm: 100 },
  ],
  minCount: 20,
  maxCount: 1000,
  oneShot: {
    baseCount: 20,        // nombre de tirages compris dans le prix de base
    baseCents: 1490,      // TTC, livraison comprise — EXEMPLE
    extraCents: 35,       // par tirage en plus — EXEMPLE
  },
};

// Prix d'un tirage simple de n tirages (centimes) ; 0 si n < minimum.
export const printOneShotCents = (n) => {
  if (n < PRINT_PRODUCT.minCount) return 0;
  const { baseCount, baseCents, extraCents } = PRINT_PRODUCT.oneShot;
  return baseCents + Math.max(0, n - baseCount) * extraCents;
};

export const PRINT_HIGHLIGHTS = [
  "Le format photo classique, 10 × 15 cm, ou carré 10 × 10 cm.",
  "Imprimés en France, livrés chez toi.",
  "À partir de 20 tirages par envoi (jusqu'à 1 000).",
  "Tes photos sont recadrées au centre si le format ne colle pas exactement.",
];

export const PRINT_STEPS = [
  "Tu choisis tes photos",
  "On les imprime en France",
  "Tu les reçois chez toi",
];

export const PRINT_GOOD_TO_KNOW = [
  "Les photos choisies sont envoyées à Pellicule pour être imprimées, puis supprimées.",
  "Il faut un compte, pour suivre ta commande.",
  "Les magnets se commandent par abonnement (« S'abonner » → tirages ou magnets).",
];
