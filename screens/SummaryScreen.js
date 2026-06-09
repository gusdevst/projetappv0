
// ─────────────────────────────────────────────
// screens/SummaryScreen.js
// ─────────────────────────────────────────────
import { useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, StatusBar, Dimensions, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";

const { width: SW } = Dimensions.get("window");

export function SummaryScreen({ navigation }) {
  const kept           = usePhotoStore((state) => state.kept);
  const deleted        = usePhotoStore((state) => state.deleted);
  const printed        = usePhotoStore((state) => state.printed);
  const hesitated      = usePhotoStore((state) => state.hesitated);
  const resetSkipped   = usePhotoStore((state) => state.resetSkipped);
  const resetHesitated = usePhotoStore((state) => state.resetHesitated);
  const deletedSize    = deleted.reduce((a, p) => a + (p.size || 0), 0);

  // Tri terminé → on libère les photos "skipped" pour le prochain tri
  useEffect(() => {
    resetSkipped();
  }, [resetSkipped]);

  // Relancer le tri uniquement sur les photos hésitées
  const handleRetrierHesites = () => {
    if (hesitated.length === 0) return;
    const queue = hesitated.map((p) => ({ ...p }));
    resetHesitated(); // on vide la pile avant de relancer
    navigation.navigate("Swipe", { queue });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ padding: 24 }}>

        <Text style={{ fontSize: 56, textAlign: "center", marginBottom: 8 }}>🎉</Text>
        <Text style={{ fontSize: 26, fontWeight: "900", color: C.text, textAlign: "center", marginBottom: 4 }}>
          Tri terminé !
        </Text>
        <Text style={{ fontSize: 14, color: C.textMuted, textAlign: "center", marginBottom: 24 }}>
          Voici ton bilan
        </Text>

        {/* ── Grille de stats ───────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Coups de cœur", val: kept.length,           color: C.green,  emoji: "❤️" },
            { label: "Supprimées",    val: deleted.length,         color: C.red,    emoji: "🗑" },
            { label: "À imprimer",    val: printed.length,         color: C.purple, emoji: "🖨" },
            { label: "Mo libérés",    val: deletedSize.toFixed(1), color: C.yellow, emoji: "✨" },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                width: (SW - 60) / 2,
                backgroundColor: C.bgCard,
                borderRadius: S.radius,
                padding: 20,
                alignItems: "center",
                borderWidth: 1,
                borderColor: C.border,
              }}
            >
              <Text style={{ fontSize: 24, marginBottom: 6 }}>{s.emoji}</Text>
              <Text style={{ fontSize: 28, fontWeight: "900", color: s.color }}>{s.val}</Text>
              <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Section "J'hésite" (visible seulement si des photos hésitées) ── */}
        {hesitated.length > 0 && (
          <View
            style={{
              backgroundColor: C.bgCard,
              borderRadius: S.radius,
              padding: 16,
              borderWidth: 2,
              borderColor: "rgba(255,165,0,0.4)",
              marginBottom: 16,
            }}
          >
            {/* En-tête */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Text style={{ fontSize: 20 }}>🤔</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", fontSize: 14, color: C.text }}>
                  {hesitated.length} photo{hesitated.length > 1 ? "s" : ""} en attente de décision
                </Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                  Tu avais hésité sur ces photos. Prêt à trancher ?
                </Text>
              </View>
            </View>

            {/* Miniatures */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {hesitated.map((p) => (
                  <Image
                    key={p.id}
                    source={{ uri: p.url }}
                    style={{ width: 70, height: 70, borderRadius: 12 }}
                  />
                ))}
              </View>
            </ScrollView>

            {/* Bouton Retrier */}
            <TouchableOpacity
              onPress={handleRetrierHesites}
              style={{
                backgroundColor: "rgba(255,165,0,0.15)",
                borderWidth: 1.5,
                borderColor: "rgba(255,165,0,0.6)",
                borderRadius: 12,
                padding: 13,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "rgb(200,120,0)", fontWeight: "800", fontSize: 14 }}>
                Retrier ces photos →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Section "À imprimer" ─────────────────────────────────────── */}
        {printed.length > 0 && (
          <View
            style={{
              backgroundColor: C.bgCard,
              borderRadius: S.radius,
              padding: 16,
              borderWidth: 1,
              borderColor: C.border,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontWeight: "800", fontSize: 14, color: C.accent, marginBottom: 10 }}>
              📸 Photos à imprimer
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {printed.map((p) => (
                  <Image key={p.id} source={{ uri: p.url }} style={{ width: 70, height: 70, borderRadius: 12 }} />
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "Bientôt disponible",
                  "L'impression chez nos partenaires arrive très vite 🌸 Merci de ton intérêt !"
                )
              }
              style={{
                marginTop: 12,
                backgroundColor: C.accent,
                borderRadius: 12,
                padding: 13,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
                Commander chez CEWE →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Retour accueil ───────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => navigation.popToTop()}
          style={{
            backgroundColor: C.accent,
            borderRadius: S.radius,
            padding: 16,
            alignItems: "center",
            elevation: 4,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>← Retour à l'accueil</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}
