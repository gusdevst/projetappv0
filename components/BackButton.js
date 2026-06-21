// components/BackButton.js
// Bouton retour rond, partagé par les en-têtes d'écrans.
// La flèche est parfaitement centrée (cercle + centrage flex) pour un rendu net
// et identique partout. Modifier ici = changer le bouton retour de toute l'app.
import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { C } from "../constants/theme";

export default function BackButton({ onPress, color = C.textMuted, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[
        {
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: C.bgCard,
          borderWidth: 1,
          borderColor: C.border,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        style={{
          color,
          fontSize: 19,
          fontWeight: "700",
          lineHeight: 19,
          // léger recentrage optique de la flèche dans le cercle
          marginLeft: -1,
        }}
      >
        ←
      </Text>
    </TouchableOpacity>
  );
}
