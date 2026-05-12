// ─────────────────────────────────────────────
// screens/FaceScreen.js
// ─────────────────────────────────────────────
import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, StatusBar, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { PHOTOS, FACE_DATA } from "../data/mockData";
import { useAndroidBack } from "../hooks/useAndroidBack";

const { width: SW } = Dimensions.get("window");

export function FaceScreen({ onBack, onStartSwipe }) {
  const [selected, setSelected] = useState([]);
  const [scanning, setScanning] = useState(true);
  useEffect(() => { setTimeout(() => setScanning(false), 1800); }, []);
  useAndroidBack(onBack);

  const toggle = name => setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  const photosTri = selected.length > 0 ? PHOTOS.filter(p => selected.some(n => p.faces.includes(n))) : [];

  if (scanning) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <ActivityIndicator size="large" color={C.accent} />
      <Text style={{ marginTop: 16, fontWeight: "800", fontSize: 16, color: C.text }}>Analyse des visages…</Text>
      <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Reconnaissance en cours</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <TouchableOpacity onPress={onBack} style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.textMuted, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={{ fontWeight: "800", fontSize: 18, color: C.text }}>Tri par visage</Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>Sélectionne une ou plusieurs personnes</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1, paddingHorizontal: S.pad }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          {Object.entries(FACE_DATA).map(([name, data]) => {
            const sel = selected.includes(name);
            const photos = PHOTOS.filter(p => p.faces.includes(name));
            return (
              <TouchableOpacity key={name} onPress={() => toggle(name)} style={{ width: (SW - 52) / 2, backgroundColor: sel ? `${data.color}18` : C.bgCard, borderRadius: S.radius, padding: 16, borderWidth: sel ? 2 : 1, borderColor: sel ? data.color : C.border }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, overflow: "hidden", alignSelf: "center", marginBottom: 10, borderWidth: 3, borderColor: sel ? data.color : C.border }}>
                  <Image source={{ uri: photos[0]?.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                </View>
                <Text style={{ fontWeight: "800", fontSize: 14, color: C.text, textAlign: "center" }}>{name}</Text>
                <Text style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 2 }}>{photos.length} photo{photos.length > 1 ? "s" : ""}</Text>
                <View style={{ flexDirection: "row", gap: 3, marginTop: 10, justifyContent: "center" }}>
                  {photos.slice(0, 3).map(p => <Image key={p.id} source={{ uri: p.url }} style={{ width: 28, height: 28, borderRadius: 6 }} />)}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        {selected.length > 0 && (
          <View style={{ backgroundColor: C.bgCard, borderRadius: S.radius, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 20 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {photosTri.slice(0, 6).map(p => <Image key={p.id} source={{ uri: p.url }} style={{ width: 52, height: 52, borderRadius: 10 }} />)}
              </View>
            </ScrollView>
            <TouchableOpacity onPress={() => onStartSwipe(photosTri)} style={{ backgroundColor: C.accent, borderRadius: 14, padding: 14, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Trier les {photosTri.length} photos →</Text>
            </TouchableOpacity>
          </View>
        )}
        {selected.length === 0 && <Text style={{ textAlign: "center", color: C.textMuted, fontSize: 13, paddingBottom: 30 }}>Sélectionne au moins une personne</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}