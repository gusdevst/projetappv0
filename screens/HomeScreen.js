// screens/HomeScreen.js
import React, { useState } from "react";

import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  View,
  Text,
  TouchableOpacity,
} from "react-native";

import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { PHOTOS, FILTERS } from "../data/mockData";

export function HomeScreen({ navigation }) {
const kept    = usePhotoStore((state) => state.kept);
const deleted = usePhotoStore((state) => state.deleted);
const printed = usePhotoStore((state) => state.printed);
  const [activeFilter, setActiveFilter] = useState("Toutes");
useFocusEffect(
  useCallback(() => {
    // Rien à faire — Zustand met à jour automatiquement
  }, [])
);
  const deletedSize = deleted.reduce((a, p) => a + p.size, 0);

  const triees =
    kept.length +
    deleted.length +
    printed.length;

  const queue = PHOTOS.filter(
    (p) =>
      !kept.map((x) => x.id).includes(p.id) &&
      !deleted.map((x) => x.id).includes(p.id) &&
      !printed.map((x) => x.id).includes(p.id)
  );

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: C.bg,
      }}
    >
      <StatusBar
        backgroundColor={C.bg}
        barStyle="dark-content"
      />

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 40,
        }}
      >

        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 30,
                fontWeight: "900",
                color: C.accent,
              }}
            >
              Phototri 🌸
            </Text>

            <Text
              style={{
                fontSize: 12,
                color: C.textMuted,
                marginTop: 2,
              }}
            >
              Tes souvenirs méritent mieux
            </Text>
          </View>

          <TouchableOpacity
           onPress={() => navigation.navigate("Settings")}
            style={{
              backgroundColor: C.bgCard,
              borderRadius: 14,
              padding: 10,
              borderWidth: 1,
              borderColor: C.border,
            }}
          >
            <Text style={{ fontSize: 20 }}>
              ⚙️
            </Text>
          </TouchableOpacity>
        </View>

        {/* CTA principal */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Swipe", { queue })}
          style={{
            backgroundColor: C.accent,
            borderRadius: 20,
            padding: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 12,
            elevation: 6,
            shadowColor: C.accent,
            shadowOffset: {
              width: 0,
              height: 6,
            },
            shadowOpacity: 0.35,
            shadowRadius: 12,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: "#fff",
            }}
          >
            🔀 Démarrer le tri · {queue.length} photos
          </Text>
        </TouchableOpacity>

        {/* Filtres */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 14 }}
        >
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              paddingVertical: 2,
            }}
          >
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setActiveFilter(f)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 99,
                  borderWidth: 1.5,
                  borderColor:
                    activeFilter === f
                      ? C.accent
                      : C.border,
                  backgroundColor:
                    activeFilter === f
                      ? C.accent
                      : C.bgCard,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color:
                      activeFilter === f
                        ? "#fff"
                        : C.textMuted,
                  }}
                >
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Stats */}
        <View
          style={{
            backgroundColor: C.bgCard,
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: C.border,
            marginBottom: 14,
            flexDirection: "row",
          }}
        >
          {[
            {
              label: "Photos",
              val: PHOTOS.length,
              color: C.accent,
            },
            {
              label: "Triées",
              val: triees,
              color: C.green,
            },
            {
              label: "À libérer",
              val: `${deletedSize.toFixed(1)}Mo`,
              color: C.red,
            },
          ].map((s, i) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                alignItems: "center",
                borderLeftWidth: i > 0 ? 1 : 0,
                borderLeftColor: C.border,
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  color: s.color,
                }}
              >
                {s.val}
              </Text>

              <Text
                style={{
                  fontSize: 11,
                  color: C.textMuted,
                  marginTop: 2,
                }}
              >
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Tri */}
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.navigate("Faces")}
            style={{
              flex: 1,
              backgroundColor: C.bgCard,
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: C.border,
            }}
          >
            <Text
              style={{
                fontSize: 24,
                marginBottom: 8,
              }}
            >
              👤
            </Text>

            <Text
              style={{
                fontWeight: "700",
                fontSize: 13,
                color: C.text,
              }}
            >
              Par visage
            </Text>

            <Text
              style={{
                fontSize: 11,
                color: C.textMuted,
                marginTop: 2,
              }}
            >
              Famille, amis…
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate("Map")}
            style={{
              flex: 1,
              backgroundColor: C.bgCard,
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: C.border,
            }}
          >
            <Text
              style={{
                fontSize: 24,
                marginBottom: 8,
              }}
            >
              🗺
            </Text>

            <Text
              style={{
                fontWeight: "700",
                fontSize: 13,
                color: C.text,
              }}
            >
              Par lieu
            </Text>

            <Text
              style={{
                fontSize: 11,
                color: C.textMuted,
                marginTop: 2,
              }}
            >
              Carte interactive
            </Text>
          </TouchableOpacity>
        </View>
{/* Sections */}
{[
  { key: "deleted", emoji: "🗑",  label: "Corbeille",        desc: `${deleted.length} photos · ${deletedSize.toFixed(1)} Mo`, bg: "#ffe8e8" },
  { key: "album",   emoji: "📷", label: "Album souvenirs",   desc: `${printed.length} photos à imprimer`, bg: "#f0e8ff" },
  { key: "kept",    emoji: "❤️", label: "Photos conservées", desc: `${kept.length} photos gardées`, bg: "#e8f8ee" },
].map(s => (
  <TouchableOpacity key={s.key} onPress={() => navigation.navigate("Gallery", { section: s.key })} style={{ backgroundColor: C.bgCard, borderRadius: S.radius, padding: 16, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

export default HomeScreen;