
// ─────────────────────────────────────────────
// screens/SummaryScreen.js
// ─────────────────────────────────────────────
import { View, Text, ScrollView, TouchableOpacity, Image, StatusBar, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { useAndroidBack } from "../hooks/useAndroidBack";

const { width: SW } = Dimensions.get("window");

export function SummaryScreen({ kept, deleted, printed, onHome }) {
  const deletedSize = deleted.reduce((a, p) => a + p.size, 0);
  useAndroidBack(onHome);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={{ fontSize: 56, textAlign: "center", marginBottom: 8 }}>🎉</Text>
        <Text style={{ fontSize: 26, fontWeight: "900", color: C.text, textAlign: "center", marginBottom: 4 }}>Tri terminé !</Text>
        <Text style={{ fontSize: 14, color: C.textMuted, textAlign: "center", marginBottom: 24 }}>Voici ton bilan</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Conservées", val: kept.length,          color: C.green,  emoji: "❤️" },
            { label: "Supprimées", val: deleted.length,        color: C.red,    emoji: "🗑" },
            { label: "À imprimer", val: printed.length,        color: C.purple, emoji: "🖨" },
            { label: "Mo libérés", val: deletedSize.toFixed(1),color: C.yellow, emoji: "✨" },
          ].map(s => (
            <View key={s.label} style={{ width: (SW - 60) / 2, backgroundColor: C.bgCard, borderRadius: S.radius, padding: 20, alignItems: "center", borderWidth: 1, borderColor: C.border }}>
              <Text style={{ fontSize: 24, marginBottom: 6 }}>{s.emoji}</Text>
              <Text style={{ fontSize: 28, fontWeight: "900", color: s.color }}>{s.val}</Text>
              <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{s.label}</Text>
            </View>
          ))}
        </View>
        {printed.length > 0 && (
          <View style={{ backgroundColor: C.bgCard, borderRadius: S.radius, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 16 }}>
            <Text style={{ fontWeight: "800", fontSize: 14, color: C.accent, marginBottom: 10 }}>📸 Photos à imprimer</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {printed.map(p => <Image key={p.id} source={{ uri: p.url }} style={{ width: 70, height: 70, borderRadius: 12 }} />)}
              </View>
            </ScrollView>
            <TouchableOpacity style={{ marginTop: 12, backgroundColor: C.accent, borderRadius: 12, padding: 13, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Commander chez CEWE →</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity onPress={onHome} style={{ backgroundColor: C.accent, borderRadius: S.radius, padding: 16, alignItems: "center", elevation: 4 }}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>← Retour à l'accueil</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
