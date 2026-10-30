// components/home/HomeHeader.js
// Haut de l'accueil : logo + « Pellicule » à gauche, pastille du mode à droite.
// La bascule Tri / Album se fait avec le bouton central de la barre du bas
// (la pastille aussi est touchable, pour ceux qui la tapent par réflexe).
// Les Réglages sont un onglet de la barre du bas.

import { View, TouchableOpacity } from "react-native";
import Text from "../AppText";
import Icon from "../Icons";
import Logo from "../Logo";
import { C } from "../../constants/theme";

export default function HomeHeader({ activeMode, onSwitchMode }) {
  const isMenage = activeMode === "menage";
  const color = isMenage ? C.accent : C.album;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
      <Logo size={34} />
      <Text style={{ flex: 1, marginLeft: 10, fontSize: 22, fontWeight: "600", color: C.text }}>Pellicule</Text>

      <TouchableOpacity
        onPress={() => onSwitchMode(isMenage ? "album" : "menage")}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={isMenage ? "Passer en mode Créer un album" : "Passer en mode Tri"}
        style={{
          flexDirection: "row", alignItems: "center", gap: 6,
          backgroundColor: isMenage ? C.sage : C.albumSoft,
          borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
        }}
      >
        <Icon name={isMenage ? "tri" : "album"} size={14} color={color} strokeWidth={2.2} />
        <Text style={{ fontSize: 12.5, fontWeight: "600", color }}>{isMenage ? "Mode Tri" : "Mode Album"}</Text>
      </TouchableOpacity>
    </View>
  );
}
