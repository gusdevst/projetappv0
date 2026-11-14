// components/ProductArt.js
// Vignettes de l'abonnement « Coups de cœur » :
//   PrintTile : tirage à bords blancs
// (MagnetTile / MagnetGrid / MagnetCluster retirés le 14 nov. 2026 : voir archive/magnets/app/ProductArt.js)
// Les images sont les VRAIS coups de cœur de l'utilisateur (`useKeptUrls`) ; à défaut, des aplats sauge.
// Pas d'ombre sur fond transparent (Android) : chaque vignette a son fond plein.

import { View } from "react-native";
import { Image } from "expo-image";
import { C } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";

// Aplats de secours (palette du thème) quand l'utilisateur n'a pas assez de coups de cœur.
const FALLBACKS = [C.sage2, C.albumSoft, C.sage3, C.sage, C.albumSoft, C.sage2, C.sage3, C.albumSoft, C.sage];
export const fallbackAt = (i) => FALLBACKS[i % FALLBACKS.length];

// Adresses des n derniers coups de cœur (les plus récents d'abord).
export function useKeptUrls(n) {
  const kept = usePhotoStore((s) => s.kept);
  return kept.slice(-n).reverse().map((p) => p.url);
}

const SHADOW_COLOR = "#28281e";

// Un tirage : photo 3:2 entourée de blanc.
export function PrintTile({ uri, width, index = 0, style }) {
  const height = width * 0.72;
  const pad = width * 0.05;
  return (
    <View style={[{
      width, height, backgroundColor: "#fff", borderRadius: 3, padding: pad,
      shadowColor: SHADOW_COLOR, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.22, shadowRadius: 9, elevation: 4,
    }, style]}>
      <View style={{ flex: 1, backgroundColor: fallbackAt(index + 3) }}>
        {!!uri && <Image source={{ uri }} contentFit="cover" style={{ flex: 1 }} />}
      </View>
    </View>
  );
}
