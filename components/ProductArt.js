// components/ProductArt.js
// Vignettes de l'abonnement « Coups de cœur » (maquette « magnets mis en avant », validée le 7 nov.) :
//   MagnetTile / MagnetGrid / MagnetCluster : magnets carrés aux coins arrondis (reflet + ombre)
//   PrintTile                                : tirage à bords blancs
// Les images sont les VRAIS coups de cœur de l'utilisateur (`useKeptUrls`) ; à défaut, des aplats sauge.
// Pas d'ombre sur fond transparent (Android) : chaque vignette a son fond plein.

import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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

// Un magnet : carré, coins arrondis, reflet en diagonale, ombre portée.
export function MagnetTile({ uri, size, index = 0, style }) {
  const r = size * 0.13;
  return (
    <View style={[{
      width: size, height: size, borderRadius: r, backgroundColor: fallbackAt(index),
      shadowColor: SHADOW_COLOR, shadowOffset: { width: 0, height: size * 0.07 }, shadowOpacity: 0.26, shadowRadius: size * 0.12, elevation: 4,
    }, style]}>
      <View style={{ flex: 1, borderRadius: r, overflow: "hidden" }}>
        {!!uri && <Image source={{ uri }} contentFit="cover" style={{ flex: 1 }} />}
        <LinearGradient colors={["rgba(255,255,255,0.38)", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.7 }} style={StyleSheet.absoluteFill} />
      </View>
    </View>
  );
}

// 3 × 3 magnets bien rangés (9 magnets du pack). `width` = largeur totale.
export function MagnetGrid({ width, gap = 5, urls = [], rotate = "0deg" }) {
  const size = (width - gap * 2) / 3;
  return (
    <View style={{ width, flexDirection: "row", flexWrap: "wrap", gap, transform: [{ rotate }] }}>
      {Array.from({ length: 9 }, (_, i) => (
        <MagnetTile key={i} index={i} uri={urls[i]} size={size} />
      ))}
    </View>
  );
}

// Magnets éparpillés façon « sur le frigo » (en-tête). Positions faites à la main pour 288 × 156,
// mises à l'échelle selon `width` : [taille, gauche, haut, angle].
const CLUSTER = [
  [78, 14, 18, -10], [86, 96, 8, 7], [76, 196, 22, -5],
  [70, 52, 78, 9], [80, 138, 74, -8], [62, 222, 90, 5],
];
export function MagnetCluster({ width, urls = [] }) {
  const k = width / 288;
  return (
    <View style={{ width, height: 156 * k }}>
      {CLUSTER.map(([size, left, top, rot], i) => (
        <MagnetTile key={i} index={i} uri={urls[i]} size={size * k}
          style={{ position: "absolute", left: left * k, top: top * k, zIndex: i + 1, transform: [{ rotate: `${rot}deg` }] }} />
      ))}
    </View>
  );
}

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
