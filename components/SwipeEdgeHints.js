// Actions affichées en filigrane sur les 4 bords de l'écran de swipe.
// Chaque bord affiche l'action réglée pour cette direction ET sert de bouton :
// un appui = même effet que le swipe dans cette direction.
// pointerEvents="box-none" : le calque laisse passer les gestes partout,
// sauf sur les 4 zones d'appui.
import { View, Text, TouchableOpacity } from "react-native";

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
const TAP = 48;     // épaisseur de la zone d'appui (≥ 44 px, taille d'un doigt)
const LEN = 180;    // longueur de la zone d'appui

// Ombre portée : garde le texte lisible sur une photo claire, sans fond coloré.
const labelStyle = {
  color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 1.2, opacity: 0.9,
  textShadowColor: "rgba(0,0,0,0.75)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
};

export function SwipeEdgeHints({ mappings, isMenage, onPress, onLongPress }) {
  const up    = labelFor(mappings?.up, isMenage);
  const down  = labelFor(mappings?.down, isMenage);
  const left  = labelFor(mappings?.left, isMenage);
  const right = labelFor(mappings?.right, isMenage);

  const tapProps = (dir) => ({
    onPress: () => onPress?.(dir),
    onLongPress: onLongPress ? () => onLongPress(dir) : undefined,
    delayLongPress: 350,
    activeOpacity: 0.5,
    accessibilityRole: "button",
  });

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 5 }}>
      {up && (
        <View pointerEvents="box-none" style={{ position: "absolute", top: TOP, left: 0, right: 0, alignItems: "center" }}>
          <TouchableOpacity {...tapProps("up")} accessibilityLabel={up}
            style={{ width: LEN, height: TAP, alignItems: "center", justifyContent: "center" }}>
            <Text style={labelStyle}>↑ {up}</Text>
          </TouchableOpacity>
        </View>
      )}

      {left && (
        <View pointerEvents="box-none" style={{ position: "absolute", top: TOP, bottom: BOTTOM, left: 0, width: TAP, justifyContent: "center" }}>
          <TouchableOpacity {...tapProps("left")} accessibilityLabel={left}
            style={{ width: TAP, height: LEN, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 240, alignItems: "center", transform: [{ rotate: "-90deg" }] }}>
              <Text numberOfLines={1} style={labelStyle}>{left} ↑</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {right && (
        <View pointerEvents="box-none" style={{ position: "absolute", top: TOP, bottom: BOTTOM, right: 0, width: TAP, justifyContent: "center" }}>
          <TouchableOpacity {...tapProps("right")} accessibilityLabel={right}
            style={{ width: TAP, height: LEN, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 240, alignItems: "center", transform: [{ rotate: "90deg" }] }}>
              <Text numberOfLines={1} style={labelStyle}>{right} ↑</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {down && (
        <View pointerEvents="box-none" style={{ position: "absolute", bottom: 118, left: 0, right: 0, alignItems: "center" }}>
          <TouchableOpacity {...tapProps("down")} accessibilityLabel={down}
            style={{ width: LEN, height: TAP, alignItems: "center", justifyContent: "center" }}>
            <Text style={labelStyle}>{down} ↓</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
