// components/book/BackCover.js
// Couverture de DOS d'un livre photo (dernière page du PDF) : la couleur de fond de la couverture, et AU CENTRE le logo
// Pellicule avec « Fait avec Pellicule ❤️ » (demande d'Augustin, 11 nov. 2026 : sur le dos de CHAQUE livre).
// Tout est proportionnel à la largeur : le dos garde le même aspect quel que soit le format (A4, 21 × 15).
// Le logo a sa propre pastille claire, donc il reste lisible sur un fond foncé ; le texte passe en blanc sur fond foncé.
// Rien d'important près du bord : le bloc est au centre, bien dans les 5 mm de sécurité.

import { View } from "react-native";
import Text from "../AppText";
import Logo from "../Logo";
import { C } from "../../constants/theme";
import { coverBgHex, isLightHex } from "../../services/photoBook";

export const BACK_COVER_TEXT = "Fait avec Pellicule ❤️";

export default function BackCover({ bg, size, ratio = 1 }) {
  const hex = coverBgHex(bg);
  const light = isLightHex(hex);
  return (
    <View style={{ width: size, height: Math.round(size * ratio), backgroundColor: hex, alignItems: "center", justifyContent: "center" }}>
      <Logo size={Math.round(size * 0.13)} />
      <Text style={{ marginTop: size * 0.03, fontSize: size * 0.026, fontWeight: "500", letterSpacing: size * 0.0006, color: light ? C.textMid : "#ffffff" }}>
        {BACK_COVER_TEXT}
      </Text>
    </View>
  );
}
