// screens/HomeScreen.js
import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S, FILTERS } from "../constants/theme";
import { PHOTOS, PRINT_PARTNERS } from "../data/mockData";

export function HomeScreen({ onSwipe, onFaces, onMap, onSection, onSettings, kept, deleted, printed }) {
  const [activeFilter, setActiveFilter] = useState("Toutes");

  const deletedSize = deleted.reduce((a, p) => a + p.size, 0);
  const triees = kept.length + deleted.length + printed.length;
  const queue = PHOTOS.filter(p =>
    !kept.map(x => x.id).includes(p.id) &&
    !deleted.map(x => x.id).includes(p.id) &&
    !printed.map(x => x.id).includes(p.id)
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ padding: S.pad, paddingBottom: 40 }}>

        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 30, fontWeight: "900", color: C.accent }}>Phototri 🌸</Text>
            <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Tes souvenirs méritent mieux</Text>
          </View>
          <TouchableOpacity onPress={onSettings} style={{ backgroundColor: C.bgCard, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ fontSize: 20 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* CTA */}
        <TouchableOpacity onPress={() => onSwipe(queue)} style={{ backgroundColor: C.accent, borderRadius: S.radius, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12, elevation: 6, shadowColor: C.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: .35, shadowRadius: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>🔀 Démarrer le tri · {queue.length} photos</Text>
        </TouchableOpacity>

        {/* Filtres */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}>
            {FILTERS.map(f => (
              <TouchableOpacity key={f} onPress={() => setActiveFilter(f)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: S.radiusFull, borderWidth: 1.5, borderColor: activeFilter === f ? C.accent : C.border, backgroundColor: activeFilter === f ? C.accent : C.bgCard }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: activeFilter === f ? "#fff" : C.textMuted }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Stats */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: S.radius, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 14, flexDirection: "row" }}>
          {[
            { label: "Photos",    val: PHOTOS.length,              color: C.accent },
            { label: "Triées",    val: triees,                     color: C.green  },
            { label: "À libérer", val: `${deletedSize.toFixed(1)}Mo`, color: C.red },
          ].map((s, i) => (
            <View key={s.label} style={{ flex: 1, alignItems: "center", borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: C.border }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: s.color }}>{s.val}</Text>
              <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Tri par visage / lieu */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
          {[
            { emoji: "👤", label: "Par visage", desc: "Famille, amis…", onPress: onFaces },
            { emoji: "🗺",  label: "Par lieu",   desc: "Carte interactive", onPress: onMap  },
          ].map(b => (
            <TouchableOpacity key={b.label} onPress={b.onPress} style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: S.radius, padding: 16, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ fontSize: 24, marginBottom: 8 }}>{b.emoji}</Text>
              <Text style={{ fontWeight: "700", fontSize: 13, color: C.text }}>{b.label}</Text>
              <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{b.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sections */}
        {[
          { key: "deleted", emoji: "🗑",  label: "Corbeille",          desc: `${deleted.length} photos · ${deletedSize.toFixed(1)} Mo`, bg: "#ffe8e8" },
          { key: "album",   emoji: "📷", label: "Album souvenirs",     desc: `${printed.length} photos à imprimer`,                    bg: "#f0e8ff" },
          { key: "kept",    emoji: "❤️", label: "Photos conservées",   desc: `${kept.length} photos gardées`,                          bg: "#e8f8ee" },
        ].map(s => (
          <TouchableOpacity key={s.key} onPress={() => onSection(s.key)} style={{ backgroundColor: C.bgCard, borderRadius: S.radius, padding: 16, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <View style={{ width: 44, height: 44, backgroundColor: s.bg, borderRadius: 14, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 20 }}>{s.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", fontSize: 14, color: C.text }}>{s.label}</Text>
              <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{s.desc}</Text>
            </View>
            <Text style={{ color: C.textMuted, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Affiliation */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: S.radius, padding: 16, borderWidth: 1, borderColor: C.border, marginTop: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Text style={{ fontSize: 22 }}>📸</Text>
            <View>
              <Text style={{ fontWeight: "800", fontSize: 14, color: C.text }}>Immortalisez vos souvenirs</Text>
              <Text style={{ fontSize: 11, color: C.textMuted }}>Imprimez vos plus belles photos</Text>
            </View>
          </View>
          {PRINT_PARTNERS.map(p => (
            <TouchableOpacity key={p.name} style={{ backgroundColor: p.bg, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ fontSize: 18 }}>{p.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", fontSize: 13, color: p.color }}>{p.name}</Text>
                <Text style={{ fontSize: 11, color: C.textMuted }}>{p.desc}</Text>
              </View>
              <Text style={{ color: C.textMuted }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}