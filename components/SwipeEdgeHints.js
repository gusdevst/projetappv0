// Filigranes permanents sur les 4 bords de l'écran de swipe.
// Chaque bord affiche l'action que l'utilisateur a réglée pour cette direction.
// pointerEvents="none" : purement visuel, les gestes passent à travers.
import { View, Text } from "react-native";

// action → libellé affiché sur le bord
function labelFor(action, isMenage) {
  switch (action) {
    case "skip":     return isMenage ? "GARDER" : "PASSER";
    case "delete":   return "SUPPRIMER";
    case "hesitate": return "J'HÉSITE";
    case "album":    return "ALBUM";
    case "favorite": return "COUP DE CŒUR";
    case "share":    return "PARTAGER";
    default:         return null; // "none" ou inconnu → rien sur ce bord
  }
}

const TOP = 96;     // sous la barre du haut
const BOTTOM = 150; // au-dessus des boutons du bas

// Ombre portée : garde le texte lisible sur une photo claire, sans fond coloré.
const labelStyle = {
  color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 1.2, opacity: 0.9,
  textShadowColor: "rgba(0,0,0,0.75)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
};

export function SwipeEdgeHints({ mappings, isMenage }) {
  const up    = labelFor(mappings?.up, isMenage);
  const down  = labelFor(mappings?.down, isMenage);
  const left  = labelFor(mappings?.left, isMenage);
  const right = labelFor(mappings?.right, isMenage);

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 5 }}>
      {up && (
        <View style={{ position: "absolute", top: TOP + 10, left: 0, right: 0, alignItems: "center" }}>
          <Text style={labelStyle}>↑ {up}</Text>
        </View>
      )}

      {left && (
        <View style={{ position: "absolute", top: TOP, bottom: BOTTOM, left: 0, width: 44, justifyContent: "center", alignItems: "center" }}>
          <View style={{ width: 240, alignItems: "center", transform: [{ rotate: "-90deg" }] }}>
            <Text numberOfLines={1} style={labelStyle}>{left} ↑</Text>
          </View>
        </View>
      )}

      {right && (
        <View style={{ position: "absolute", top: TOP, bottom: BOTTOM, right: 0, width: 44, justifyContent: "center", alignItems: "center" }}>
          <View style={{ width: 240, alignItems: "center", transform: [{ rotate: "90deg" }] }}>
            <Text numberOfLines={1} style={labelStyle}>{right} ↑</Text>
          </View>
        </View>
      )}

      {down && (
        <View style={{ position: "absolute", bottom: 132, left: 0, right: 0, alignItems: "center" }}>
          <Text style={labelStyle}>{down} ↓</Text>
        </View>
      )}
    </View>
  );
}
