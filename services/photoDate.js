// services/photoDate.js
// Date à afficher pour une photo (mode swipe) : « 12 mars 2024 » = date de prise de vue ;
// « Reçue le 12 mars 2024 » quand la photo n'a pas de date de prise (WhatsApp, web, vieux transferts) et qu'on a dû
// se rabattre sur la date de modification du fichier = date d'arrivée sur le téléphone (`photo.dateIsReceived`,
// posé dans services/photoLibrary.js). Sans date exploitable : l'année seule, comme avant.
export function photoDateLabel(photo) {
  const ts = photo?.creationTime;
  if (!ts || ts < 365 * 24 * 3600 * 1000) return photo?.year ?? ""; // pas de vraie date : on ne montre pas « 1 janvier 1970 »
  const label = new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return photo.dateIsReceived ? `Reçue le ${label}` : label;
}
