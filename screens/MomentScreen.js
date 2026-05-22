// screens/MomentScreen.js
// Trier par "moment" — groupes de photos prises dans une même session temporelle
// (12h max sans nouvelle photo = même moment). Remplace l'ancien FaceScreen.

import { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, StatusBar, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { groupByMoment } from "../services/photoAnalysis";

const { width: SW } = Dimensions.get("window");

export function MomentScreen({ navigation }) {
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const [selectedId, setSelectedId] = useState(null);

  // Calcul des moments — coût négligeable, mais mémorisé pour éviter le recalcul à chaque render
  const moments = useMemo(() => groupByMoment(libraryPhotos), [libraryPhotos]);
  const selected = moments.find((m) => m.id === selectedId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.textMuted, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={{ fontWeight: "800", fontSize: 18, color: C.text }}>Tri par moment</Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            {moments.length === 0 ? "Pas encore de photos chargées" : `${moments.length} moment(s) détecté(s)`}
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: S.pad }}>
        {moments.length === 0 ? (
          <View style={{ alignItems: "center", justifyContent: "center", padding: 40 }}>
            <Text style={{ fontSize: 56, marginBottom: 12 }}>📅</Text>
            <Text style={{ fontSize: 14, color: C.textMuted, textAlign: "center" }}>
              Aucun moment détecté pour le moment.
            </Text>
          </View>
        ) : (
          moments.map((m) => {
            const isSelected = m.id === selectedId;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => setSelectedId(isSelected ? null : m.id)}
                style={{
                  backgroundColor: isSelected ? `${C.accent}15` : C.bgCard,
                  borderRadius: S.radius,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? C.accent : C.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: isSelected ? C.accent : C.border }}>
                    <Image source={{ uri: m.photos[0]?.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", fontSize: 14, color: C.text }}>{m.label}</Text>
                    <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                      {m.photos.length} photo{m.photos.length > 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Text style={{ color: isSelected ? C.accent : C.textMuted, fontSize: 18, fontWeight: "800" }}>
                    {isSelected ? "✓" : "›"}
                  </Text>
                </View>

                {isSelected && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {m.photos.slice(0, 8).map((p) => (
                        <Image key={p.id} source={{ uri: p.url }} style={{ width: 52, height: 52, borderRadius: 8 }} />
                      ))}
                    </View>
                  </ScrollView>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {selected && (
        <View style={{ padding: S.pad, paddingTop: 0 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Swipe", { queue: selected.photos })}
            style={{ backgroundColor: C.accent, borderRadius: S.radius, padding: 16, alignItems: "center", elevation: 4 }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
              🔀 Trier les {selected.photos.length} photo{selected.photos.length > 1 ? "s" : ""}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

export default MomentScreen;
