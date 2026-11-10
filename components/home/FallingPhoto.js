// components/home/FallingPhoto.js
// Une VRAIE photo de l'appareil, cadre blanc, légèrement inclinée : elle « tombe » dans l'illustration du haut de l'accueil
// (bac du mode Tri, album ouvert du mode Album). Posée PAR-DESSUS le dessin SVG (coordonnées en pixels du dessin).
// Pas de photo (photothèque pas chargée / vide) : l'écran garde son dessin d'origine.

import { View } from "react-native";
import { Image } from "expo-image";

export default function FallingPhoto({ uri, left, top, size, rotate = "-6deg", radius = 10 }) {
  const pad = Math.max(2, Math.round(size * 0.05));
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute", left, top, width: size, height: size,
        borderRadius: radius, backgroundColor: "#fff", padding: pad,
        transform: [{ rotate }],
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 4, elevation: 2,
      }}
    >
      <Image source={{ uri }} contentFit="cover" style={{ flex: 1, borderRadius: Math.max(2, radius - pad) }} />
    </View>
  );
}
