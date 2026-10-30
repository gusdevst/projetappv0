// components/AppText.js
// Remplace le <Text> de React Native dans toute l'app.
// Rôle : appliquer la police Outfit par défaut à chaque texte.
// Un style passé en prop (couleur, taille, gras…) s'ajoute par-dessus.

import { Text } from "react-native";
import { FONT } from "../constants/theme";

export default function AppText({ style, ...props }) {
  return <Text {...props} style={[{ fontFamily: FONT }, style]} />;
}
