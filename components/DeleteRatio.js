// « 7 photos sur 10 sont supprimées » + 10 petites cases (rouge = supprimée).
// Utilisé sur le Bilan (grand) et dans Progression › Tes chiffres (compact).
// ratio = résultat de deleteRatio() (services/progressStats).
import { View } from "react-native";
import Text from "./AppText";
import { C } from "../constants/theme";

export function DeleteRatio({ ratio, subtitle, compact = false }) {
  if (!ratio) return null;
  const w = compact ? 12 : 18, h = compact ? 16 : 22;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: compact ? 10 : 12 }}>
      <View style={{ flexDirection: "row", gap: compact ? 3 : 4 }}>
        {/* Case i remplie à hauteur de ce qui reste (ex. 9,6 → 9 pleines + 1 à 60 %) */}
        {Array.from({ length: ratio.d }, (_, i) => {
          const fill = Math.max(0, Math.min(1, ratio.n - i));
          return (
            <View key={i} style={{ width: w * 0.6, height: h, borderRadius: 4, backgroundColor: C.sage2, overflow: "hidden", justifyContent: "flex-end" }}>
              {fill > 0 && <View style={{ height: `${Math.round(fill * 100)}%`, backgroundColor: C.red }} />}
            </View>
          );
        })}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: compact ? 14 : 15, fontWeight: "600", color: C.text }}>
          <Text style={{ color: C.red }}>{ratio.label}</Text> {ratio.verb}
        </Text>
        {!!subtitle && <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>{subtitle}</Text>}
      </View>
    </View>
  );
}
