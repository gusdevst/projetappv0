// screens/HomeScreen.js
import React, { useState } from "react";

import {
  ScrollView,
  StatusBar,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { C, S, FILTERS } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";

/**
 * Applique le filtre sélectionné à la liste de photos.
 * - "Toutes" : pas de filtre
 * - "4 derniers jours" : photos prises il y a moins de 4 jours
 * - "Mois dernier" : photos du mois calendaire précédent
 * - "2026" / "2025" : photos prises cette année-là
 * - "Screenshots" : uniquement les captures d'écran
 */
function applyFilter(photos, filter) {
  if (filter === "Toutes") return photos;
  if (filter === "Screenshots") return photos.filter((p) => p.isScreenshot);

  const now = new Date();

  if (filter === "4 derniers jours") {
    const cutoff = now.getTime() - 4 * 24 * 60 * 60 * 1000;
    return photos.filter((p) => p.creationTime >= cutoff);
  }

  if (filter === "Mois dernier") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
    return photos.filter((p) => p.creationTime >= start && p.creationTime <= end);
  }

  // Filtres année (ex: "2025", "2026")
  if (/^\d{4}$/.test(filter)) {
    return photos.filter((p) => p.year === filter);
  }

  return photos;
}

export function HomeScreen({ navigation }) {
  const kept              = usePhotoStore((state) => state.kept);
  const deleted           = usePhotoStore((state) => state.deleted);
  const printed           = usePhotoStore((state) => state.printed);
  const libraryPhotos     = usePhotoStore((state) => state.libraryPhotos);
  const libraryTotalCount = usePhotoStore((state) => state.libraryTotalCount);
  const libraryLoading    = usePhotoStore((state) => state.libraryLoading);
  const [activeFilter, setActiveFilter] = useState("Toutes");

  // Si l'utilisateur a plus de photos que ce qu'on charge, on affichera une note.
  const showLimitNote = libraryTotalCount > libraryPhotos.length && libraryPhotos.length > 0;

  const deletedSize = deleted.reduce((a, p) => a + p.size, 0);

  const triees = kept.length + deleted.length + printed.length;

  // File des photos à trier = photothèque réelle, moins celles déjà triées, puis filtrée
  const triedIds = new Set([
    ...kept.map((x) => x.id),
    ...deleted.map((x) => x.id),
    ...printed.map((x) => x.id),
  ]);
  const remaining = libraryPhotos.filter((p) => !triedIds.has(p.id));
  const queue = applyFilter(remaining, activeFilter);

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
          onPress={() => queue.length > 0 && navigation.navigate("Swipe", { queue })}
          disabled={libraryLoading || queue.length === 0}
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
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            opacity: libraryLoading || queue.length === 0 ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>
            {libraryLoading
              ? "Chargement de tes photos…"
              : remaining.length === 0
              ? "🎉 Tout est trié !"
              : queue.length === 0
              ? `Aucune photo dans "${activeFilter}"`
              : `🔀 Démarrer le tri · ${queue.length} photos`}
          </Text>
        </TouchableOpacity>

        {/* Note quand on n'affiche qu'une partie de la photothèque */}
        {showLimitNote && (
          <Text
            style={{
              fontSize: 11,
              color: C.textMuted,
              textAlign: "center",
              marginBottom: 12,
              fontStyle: "italic",
            }}
          >
            Affichage des {libraryPhotos.length} photos les plus récentes sur {libraryTotalCount} au total.
          </Text>
        )}

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

        {/* Tri (par visage / par lieu / doublons) */}
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.navigate("Moments")}
            style={{
              flex: 1,
              backgroundColor: C.bgCard,
              borderRadius: 20,
              padding: 14,
              borderWidth: 1,
              borderColor: C.border,
            }}
          >
            <Text style={{ fontSize: 22, marginBottom: 6 }}>📅</Text>
            <Text style={{ fontWeight: "700", fontSize: 13, color: C.text }}>
              Par moment
            </Text>
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              Soirée, voyage…
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate("Map")}
            style={{
              flex: 1,
              backgroundColor: C.bgCard,
              borderRadius: 20,
              padding: 14,
              borderWidth: 1,
              borderColor: C.border,
            }}
          >
            <Text style={{ fontSize: 22, marginBottom: 6 }}>🗺</Text>
            <Text style={{ fontWeight: "700", fontSize: 13, color: C.text }}>
              Par lieu
            </Text>
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              Carte interactive
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate("Duplicates")}
            style={{
              flex: 1,
              backgroundColor: C.bgCard,
              borderRadius: 20,
              padding: 14,
              borderWidth: 1,
              borderColor: C.border,
            }}
          >
            <Text style={{ fontSize: 22, marginBottom: 6 }}>🪞</Text>
            <Text style={{ fontWeight: "700", fontSize: 13, color: C.text }}>
              Doublons
            </Text>
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              Photos similaires
            </Text>
          </TouchableOpacity>
        </View>

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
              val: libraryPhotos.length,
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