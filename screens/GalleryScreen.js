// ─────────────────────────────────────────────
// screens/GalleryScreen.js
// ─────────────────────────────────────────────
import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Dimensions, StatusBar, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { PhotoGrid } from "../components/PhotoGrid";
import { usePhotoStore } from "../store/usePhotoStore";

const { width: SW, height: SH } = Dimensions.get("window");

// Mapping section (passé via route.params) → titre, couleur d'accent, et clé du store
const SECTION_CONFIG = {
  kept:    { title: "Photos conservées", accent: C.green,  storeKey: "kept",    showEmpty: false },
  deleted: { title: "Corbeille",         accent: C.red,    storeKey: "deleted", showEmpty: true  },
  album:   { title: "Album souvenirs",   accent: C.purple, storeKey: "printed", showEmpty: false },
};

export function GalleryScreen({ navigation, route }) {
  const section = route?.params?.section ?? "kept";
  const config  = SECTION_CONFIG[section] ?? SECTION_CONFIG.kept;
  const photos     = usePhotoStore((state) => state[config.storeKey]);
  const emptyTrash = usePhotoStore((state) => state.emptyTrash);
  const { title, accent, showEmpty } = config;
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Confirme avant de vraiment supprimer (suppression définitive côté MediaLibrary,
  // même si iOS met d'abord dans "Récemment supprimées" 30 jours).
  const confirmEmptyTrash = () => {
    Alert.alert(
      "Vider la corbeille",
      `Supprimer définitivement ${photos.length} photo(s) ? Sur iOS, elles seront récupérables 30 jours dans "Récemment supprimées".`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            const ok = await emptyTrash();
            setDeleting(false);
            if (!ok) {
              Alert.alert("Erreur", "La suppression a échoué. Vérifie que tu as bien autorisé Phototri à supprimer des photos.");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.textMuted, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: "800", fontSize: 20, color: C.text, flex: 1 }}>{title}</Text>
        <Text style={{ fontSize: 13, color: accent, fontWeight: "800" }}>{photos.length} photos</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 14 }}>
        {photos.length === 0
          ? <Text style={{ color: C.textMuted, textAlign: "center", marginTop: 60, fontSize: 15 }}>Aucune photo ici</Text>
          : <PhotoGrid photos={photos} onPress={p => setSelected(p)} />
        }
        {showEmpty && photos.length > 0 && (
          <TouchableOpacity
            onPress={confirmEmptyTrash}
            disabled={deleting}
            style={{ backgroundColor: C.red, borderRadius: S.radius, padding: 14, alignItems: "center", marginTop: 20, opacity: deleting ? 0.6 : 1 }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
              {deleting ? "Suppression…" : `Vider la corbeille (${photos.reduce((a, p) => a + p.size, 0).toFixed(1)} Mo)`}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <Modal visible={!!selected} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" }}>
          <TouchableOpacity onPress={() => setSelected(null)} style={{ position: "absolute", top: 52, right: 20, backgroundColor: "rgba(255,255,255,.2)", borderRadius: S.radiusFull, padding: 10 }}>
            <Text style={{ color: "#fff", fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
          {selected && <>
            <Image source={{ uri: selected.url }} style={{ width: SW - 40, height: SH * 0.65, borderRadius: S.radius }} resizeMode="contain" />
            <Text style={{ color: "#fff", fontWeight: "700", marginTop: 16, fontSize: 15 }}>{selected.location ? `${selected.location} · ${selected.year}` : selected.year}</Text>
          </>}
        </View>
      </Modal>
    </SafeAreaView>
  );
}