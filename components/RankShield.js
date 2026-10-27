// Écusson de galon : fond métal (bronze / argent / or) + 1 à 3 chevrons "^",
// ou une étoile pour le grade ultime. Dessiné avec de simples View.
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export const METALS = {
  bronze: { colors: ["#d08a52", "#b0703c"], light: "#f3e3d4", text: "#b0703c" },
  silver: { colors: ["#b4bfcc", "#8a97a8"], light: "#e9edf2", text: "#6f7d90" },
  gold:   { colors: ["#e8bf45", "#c99a1e"], light: "#fbf0cf", text: "#a87f12" },
};

// Un chevron "^" = un carré dont on ne garde que 2 bords, tourné de 45°.
function Chevron({ size, stroke }) {
  return (
    <View style={{
      width: size, height: size,
      borderTopWidth: stroke, borderLeftWidth: stroke, borderColor: "#fff",
      transform: [{ rotate: "45deg" }],
      marginTop: size * 0.18, marginBottom: -size * 0.25,
    }} />
  );
}

export function RankShield({ metal = "bronze", chevrons = 1, size = 44, locked = false }) {
  const m = METALS[metal] || METALS.bronze;
  const h = size * 1.14;
  const c = size * 0.32;            // taille d'un chevron
  const stroke = Math.max(2, size * 0.075);
  return (
    <LinearGradient
      colors={locked ? ["#d5dbe4", "#c3cad6"] : m.colors}
      start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }}
      style={{
        width: size, height: h,
        borderTopLeftRadius: size * 0.22, borderTopRightRadius: size * 0.22,
        borderBottomLeftRadius: size * 0.5, borderBottomRightRadius: size * 0.5,
        alignItems: "center", justifyContent: "center",
        paddingTop: size * 0.06,
      }}
    >
      {chevrons === 0
        ? <Text style={{ color: "#fff", fontSize: size * 0.5, lineHeight: size * 0.6, fontWeight: "900" }}>★</Text>
        : Array.from({ length: chevrons }, (_, i) => <Chevron key={i} size={c} stroke={stroke} />)}
    </LinearGradient>
  );
}
