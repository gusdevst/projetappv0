// screens/DuplicatesScreen.js
// Affiche les groupes de doublons probables détectés dans la photothèque.
// L'utilisateur peut soit trier tout un groupe (Swipe), soit voir individuellement.

import { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, StatusBar, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { findDuplicates } from "../services/photoAnalysis";

const { width: SW } = Dimensions.get("window");

export function DuplicatesScreen({ navigation }) {
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const deleted       = usePhotoStore((s) => s.deleted);
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(null);

  // Exclure les photos mises en corbeille — elles ne doivent pas apparaître ici
  const activePhotos = useMemo(() => {
    const ids = new Set(deleted.map((p) => p.id));
    return libraryPhotos.filter((p) => !ids.has(p.id));
  }, [libraryPhotos, deleted]);

  // findDuplicates est rapide (~ms) mais on memoize au cas où libraryPhotos change peu
  const groups = useMemo(() => findDuplicates(activePhotos), [activePhotos]);
  const totalDuplicates = groups.reduce((a, g) => a + g.photos.length, 0);

  // Toutes les photos doublons dans un seul array, pour le bouton "Tout trier"
  const allDuplicates = groups.flatMap((g) => g.photos);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.textMuted, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={{ fontWeight: "800", fontSize: 18, color: C.text }}>Doublons probables</Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            {groups.length === 0
              ? "Aucun doublon détecté"
              : `${groups.length} groupe(s) · ${totalDuplicates} photos`}
          </Text>
        </View>
      </View>

      {groups.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
          <Text style={{ fontSize: 56, marginBottom: 12 }}>🪞</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text, textAlign: "center" }}>
            Pas de doublons détectés
          </Text>
          <Text style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 8, lineHeight: 18 }}>
            On détecte les photos prises à moins de 2 secondes d'écart avec les mêmes dimensions (mode rafale, double appui…).
          </Text>
        </View>
      ) : (
        <>
          <ScrollView style={{ flex: 1, paddingHorizontal: S.pad }}>
            {groups.map((g, idx) => {
              const isSelected = idx === selectedGroupIdx;
              const first = g.photos[0];
              const dateStr = new Date(first.creationTime).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setSelectedGroupIdx(isSelected ? null : idx)}
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
                      <Image source={{ uri: first.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "800", fontSize: 14, color: C.text }}>{g.photos.length} photos quasi identiques</Text>
                      <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{dateStr}</Text>
                    </View>
                    <Text style={{ color: isSelected ? C.accent : C.textMuted, fontSize: 18, fontWeight: "800" }}>
                      {isSelected ? "✓" : "›"}
                    </Text>
                  </View>

                  {isSelected && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {g.photos.map((p) => (
                          <Image key={p.id} source={{ uri: p.url }} style={{ width: 64, height: 64, borderRadius: 8 }} />
                        ))}
                      </View>
                    </ScrollView>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ padding: S.pad, paddingTop: 0 }}>
            <TouchableOpacity
              onPress={() => {
                const queue = selectedGroupIdx !== null
                  ? groups[selectedGroupIdx].photos
                  : allDuplicates;
                navigation.navigate("Swipe", { queue });
              }}
              style={{ backgroundColor: C.accent, borderRadius: S.radius, padding: 16, alignItems: "center", elevation: 4 }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                {selectedGroupIdx !== null
                  ? `🔀 Trier ce groupe (${groups[selectedGroupIdx].photos.length} photos)`
                  : `🔀 Trier tous les doublons (${totalDuplicates} photos)`}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

export default DuplicatesScreen;
