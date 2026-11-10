// constants/subscription.js
// Réglages de l'abonnement mensuel « Coups de cœur » (valeurs décidées avec Augustin, 6 nov. 2026).
// Modifier ici = modifier partout dans l'app.

// ── Deux types d'envoi (au choix à l'abonnement) ─────────────────────────────
//   prints  = tirages photo 10 × 15 cm (5 / 10 / 15 / 20 au choix pour un proche)
//   magnets = 9 magnets (aimants) carrés de 5 × 5 cm — 5 × 5 pour tenir 20 magnets sur une A4 en fabrication
//             manuelle (hypothèse d'Augustin, 7 nov. 2026 : à challenger tant que le partenaire d'impression
//             n'est pas choisi). Prix posé le 7 nov. : 9,90 € / mois, livraison comprise.
// `spec` = ce que doit recevoir l'imprimeur (taille finale en mm, recadrage). Un seul endroit à changer
// quand le partenaire sera connu (Augustin, Gelato, Prodigi…) ; il est aussi écrit dans chaque commande.
export const SUB_PRODUCTS = {
  prints: {
    key: "prints", label: "Tirages photo", unit: "tirage", units: "tirages",
    tagline: "20 tirages 10 × 15 cm, papier brillant", fixedCount: 20, // 20 = minimum par commande chez imprimeur.fr (9 nov. 2026)
    spec: { widthMm: 102, heightMm: 152, crop: "none", finish: "gloss" },
  },
  magnets: {
    key: "magnets", label: "Magnets", unit: "magnet", units: "magnets",
    tagline: "9 aimants carrés de 5 × 5 cm", fixedCount: 9,
    spec: { widthMm: 50, heightMm: 50, crop: "center", finish: "gloss", layout: "3x3" },
  },
};
export const productOf = (sub) => SUB_PRODUCTS[sub?.product] ?? SUB_PRODUCTS.prints; // anciens abonnements = tirages

// Tirages : UNE seule offre depuis le 9 nov. 2026 = 20 tirages 10 × 15 cm (minimum par commande chez imprimeur.fr,
// qui ne sait pas faire moins). Hypothèse d'Augustin (9 nov.) : 0,18 € HT par tirage → 3,60 € + 4,97 € de port Colissimo = 8,57 € HT.
// Prix 12,90 € TTC (fixé par Augustin) = 10,75 € HT → ≈ +2,18 € par envoi, ≈ +1,74 € avec les frais de paiement (Stripe ≈ 1,5 % + 0,25 €).
export const SUB_PRICE_LABEL  = "12,90 €";  // par mois et par abonnement, livraison incluse (20 tirages)
export const SUB_PHOTOS       = 20;         // tirages par mois (abonnement « pour moi »)
export const SUB_MAGNETS      = 9;          // magnets par mois (pour moi comme pour un proche)
export const SUB_MAGNETS_PRICE_LABEL = "9,90 €";

// Prix par type d'envoi et par nombre de photos (modifiables ici). Tirages : +3 € par tranche de 5 dès 10.
// Absent = prix pas fixé (le bouton d'abonnement reste grisé).
export const SUB_PRICES = {
  prints:  { [SUB_PHOTOS]: SUB_PRICE_LABEL },
  magnets: { [SUB_MAGNETS]: SUB_MAGNETS_PRICE_LABEL },
};
// Une seule offre par produit : tout abonnement tirages = 20 tirages au prix SUB_PRICE_LABEL.
export const priceLabelFor = (count, product = "prints") =>
  SUB_PRICES[product]?.[count] ?? (product === "prints" ? SUB_PRICE_LABEL : null);
// "10,99 €" → 1099 (centimes) ; 0 si le prix n'est pas fixé.
export const priceCentsFor = (count, product = "prints") => {
  const label = priceLabelFor(count, product);
  return label ? Math.round(parseFloat(label.replace(",", ".")) * 100) : 0;
};
// 1598 → "15,98 €"
export const formatEuro = (cents) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;
export const SUB_FORMAT_LABEL = "10 × 15 cm"; // tirages — à confirmer
// Deux dates, au choix de l'utilisateur pour chaque abonnement (jour du mois, 1 → 28) :
//   selectionDay = jour où il reçoit sa sélection (= notification, à 9 h)
//   sendDay      = jour d'envoi à l'impression (= dernier jour pour valider), toujours après selectionDay
// Valeurs par défaut ci-dessous (aussi pour les abonnements créés avant ce choix).
export const SUB_SEND_DAY     = 1;          // sélection reçue le 1er du mois
export const SUB_VALIDATE_BY  = 25;         // envoi à l'impression le 25
export const SUB_DAY_MAX      = 28;         // pas de 29-31 : tous les mois ont ce jour
export const dayLabel = (d) => (d === 1 ? "1er" : String(d));
export const subDays = (sub) => ({
  selectionDay: sub?.selectionDay ?? SUB_SEND_DAY,
  sendDay:      sub?.sendDay ?? SUB_VALIDATE_BY,
});
