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
    tagline: "10 × 15 cm, papier brillant", fixedCount: null,
    spec: { widthMm: 102, heightMm: 152, crop: "none", finish: "gloss" },
  },
  magnets: {
    key: "magnets", label: "Magnets", unit: "magnet", units: "magnets",
    tagline: "9 aimants carrés de 5 × 5 cm", fixedCount: 9,
    spec: { widthMm: 50, heightMm: 50, crop: "center", finish: "gloss", layout: "3x3" },
  },
};
export const productOf = (sub) => SUB_PRODUCTS[sub?.product] ?? SUB_PRODUCTS.prints; // anciens abonnements = tirages

export const SUB_PRICE_LABEL  = "7,99 €";   // par mois et par abonnement, livraison incluse (10 tirages)
export const SUB_PHOTOS       = 10;         // tirages par mois (abonnement « pour moi »)
export const SUB_GIFT_CHOICES = [5, 10, 15, 20]; // « pour un proche » : nombre de tirages au choix
export const SUB_MAGNETS      = 9;          // magnets par mois (pour moi comme pour un proche)
export const SUB_MAGNETS_PRICE_LABEL = "9,90 €";

// Prix par type d'envoi et par nombre de photos (modifiables ici). Tirages : +3 € par tranche de 5 dès 10.
// Absent = prix pas fixé (le bouton d'abonnement reste grisé).
export const SUB_PRICES = {
  prints:  { 5: "4,99 €", 10: SUB_PRICE_LABEL, 15: "10,99 €", 20: "13,99 €" },
  magnets: { [SUB_MAGNETS]: SUB_MAGNETS_PRICE_LABEL },
};
export const priceLabelFor = (count, product = "prints") => SUB_PRICES[product]?.[count] ?? null;
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
