// Mini-écran de tri pour les tutos : une "photo" avec les actions écrites
// sur les 4 bords, exactement comme pendant une vraie session.
// Les libellés suivent les réglages de swipe de l'utilisateur (mode Tri).
import { View } from "react-native";
import Text from "./AppText";
import { LinearGradient } from "expo-linear-gradient";
import { usePhotoStore } from "../store/usePhotoStore";
import { labelFor } from "./SwipeEdgeHints";

const W = 190;
const H = 250;

const labelStyle = {
  color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1,
  textShadowColor: "rgba(0,0,0,0.75)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
};

export function SwipeDemo({ style }) {
  const mappings = usePhotoStore((s) => s.swipeMappingsMenage);
  const up    = labelFor(mappings?.up, true);
  const down  = labelFor(mappings?.down, true);
  const left  = labelFor(mappings?.left, true);
  const right = labelFor(mappings?.right, true);

  return (
    <View style={[{ width: W, height: H, borderRadius: 22, overflow: "hidden", backgroundColor: "#000" }, style]}>
      {/* Fausse photo (ciel / mer / sable) */}
      <LinearGradient
        colors={["#8fb3d3", "#b9cfe0", "#3e6f92", "#d9c3a0"]}
        locations={[0, 0.45, 0.6, 1]}
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
      />

      {up && (
        <View style={{ position: "absolute", top: 10, left: 0, right: 0, alignItems: "center" }}>
          <Text style={labelStyle}>↑ {up}</Text>
        </View>
      )}
      {down && (
        <View style={{ position: "absolute", bottom: 10, left: 0, right: 0, alignItems: "center" }}>
          <Text style={labelStyle}>{down} ↓</Text>
        </View>
      )}
      {left && (
        <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 28, justifyContent: "center", alignItems: "center" }}>
          <View style={{ width: 160, alignItems: "center", transform: [{ rotate: "-90deg" }] }}>
            <Text numberOfLines={1} style={labelStyle}>{left} ↑</Text>
          </View>
        </View>
      )}
      {right && (
        <View style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 28, justifyContent: "center", alignItems: "center" }}>
          <View style={{ width: 160, alignItems: "center", transform: [{ rotate: "90deg" }] }}>
            <Text numberOfLines={1} style={labelStyle}>{right} ↑</Text>
          </View>
        </View>
      )}

      {/* Le doigt au centre */}
      <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 40 }}>👆</Text>
      </View>
    </View>
  );
}
