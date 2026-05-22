// ─────────────────────────────────────────────
// screens/GalleryScreen.js
// ─────────────────────────────────────────────
import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Dimensions, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { PhotoGrid } from "../components/PhotoGrid";
import { useAndroidBack } from "../hooks/useAndroidBack";

const { width: SW, height: SH } = Dimensions.get("window");

export function GalleryScreen({ title, photos, accent, onBack, showEmpty, onEmpty }) {
  const [selected, setSelected] = useState(null);
  useAndroidBack(onBack);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <TouchableOpacity onPress={onBack} style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border }}>
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
          <TouchableOpacity onPress={onEmpty} style={{ backgroundColor: C.red, borderRadius: S.radius, padding: 14, alignItems: "center", marginTop: 20 }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Vider la corbeille ({photos.reduce((a, p) => a + p.size, 0).toFixed(1)} Mo)</Text>
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
            <Text style={{ color: "#fff", fontWeight: "700", marginTop: 16, fontSize: 15 }}>{selected.location} · {selected.year}</Text>
          </>}
        </View>
      </Modal>
    </SafeAreaView>
  );
}