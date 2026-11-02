// components/book/bookFonts.js
// Polices du livre photo, chargées PAR LE CODE (expo-font) au lieu du build natif.
// Pourquoi : sur Android, les polices déclarées dans app.json ne s'appliquaient pas.
// Chargées ici, elles marchent pareil sur iOS et Android, sans rebuild.
// On pointe vers UN fichier par police (pas l'index du paquet, qui embarquerait
// toutes les graisses et alourdirait l'app).

import { useFonts } from "expo-font";

export const BOOK_FONT_FILES = {
  PlayfairDisplay_600SemiBold: require("@expo-google-fonts/playfair-display/600SemiBold/PlayfairDisplay_600SemiBold.ttf"),
  Caveat_600SemiBold:          require("@expo-google-fonts/caveat/600SemiBold/Caveat_600SemiBold.ttf"),
  BebasNeue_400Regular:        require("@expo-google-fonts/bebas-neue/400Regular/BebasNeue_400Regular.ttf"),
  GreatVibes_400Regular:       require("@expo-google-fonts/great-vibes/400Regular/GreatVibes_400Regular.ttf"),
  Fredoka_600SemiBold:         require("@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf"),
};

// À appeler en haut des écrans qui affichent un titre de livre.
// Renvoie true quand les polices sont prêtes (avant : police par défaut, puis ça se met à jour).
export function useBookFonts() {
  const [loaded] = useFonts(BOOK_FONT_FILES);
  return loaded;
}
