// components/BackButton.js
// Bouton retour rond, partagé par les en-têtes d'écrans.
// La flèche est un chevron dessiné avec 2 bordures + rotation (pas de shaft ni de
// dépendance à une lib d'icônes), parfaitement centré dans le cercle.
// Modifier ici = changer le bouton retour de toute l'app.
//
// Deux façons de colorer le fond (fond plein + flèche blanche) :
// - `mode` : "menage" | "album" → couleur du mode de tri en cours (bleu ardoise / teal).
// - `accentColor` : couleur directe, pour les écrans qui ont leur propre couleur
//   de section (ex. corbeille en rouge, coups de cœur en vert). Prioritaire sur `mode`.
// Sans les deux, le bouton garde son style neutre (fond blanc, bordure grise).
import React from "react";
import { TouchableOpacity, View } from "react-native";
import { C } from "../constants/theme";

const MODE_BACKGROUND = {
  menage: C.accent,
  album: C.album,
};

export default function BackButton({ onPress, mode, accentColor, color, style }) {
  const filledColor = accentColor ?? MODE_BACKGROUND[mode];
  const backgroundColor = filledColor ?? C.bgCard;
  const arrowColor = color ?? (filledColor ? "#ffffff" : C.textMuted);

  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[
        {
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor,
          borderWidth: filledColor ? 0 : 1,
          borderColor: C.border,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {/*
        Chevron "‹" : un carré dont seuls le bord gauche et le bord bas sont visibles,
        tourné de 45°. Le marginLeft recentre la pointe (le carré tourné déborde
        naturellement vers la gauche, sans ce réglage le chevron paraît décalé).
      */}
      <View
        style={{
          width: 11,
          height: 11,
          marginLeft: 4,
          borderLeftWidth: 2.5,
          borderBottomWidth: 2.5,
          borderColor: arrowColor,
          borderBottomLeftRadius: 2,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </TouchableOpacity>
  );
}
