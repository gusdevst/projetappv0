// constants/subscription.js
// Réglages de l'abonnement mensuel « Coups de cœur » (valeurs décidées avec Augustin, 6 nov. 2026).
// Modifier ici = modifier partout dans l'app.

export const SUB_PRICE_LABEL  = "7,99 €";   // par mois et par abonnement, livraison incluse (10 tirages)
export const SUB_PHOTOS       = 10;         // tirages par mois (abonnement « pour moi »)
export const SUB_GIFT_CHOICES = [5, 10, 15, 20]; // « pour un proche » : nombre de photos au choix
// Prix décidés par nombre de photos. Absent = prix pas encore fixé (5, 15 et 20 photos).
export const SUB_PRICE_BY_COUNT = { 10: SUB_PRICE_LABEL };
export const priceLabelFor = (count) => SUB_PRICE_BY_COUNT[count] ?? null;
export const SUB_FORMAT_LABEL = "10 × 15 cm"; // à confirmer
export const SUB_SEND_DAY     = 1;          // la sélection est proposée le 1er du mois
export const SUB_VALIDATE_BY  = 25;         // à valider avant le 25 du mois
