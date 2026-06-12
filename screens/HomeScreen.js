// screens/HomeScreen.js
import React, { useState } from "react";
import {
  ScrollView, StatusBar, View, Text,
  TouchableOpacity, Alert, Modal, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { C, S, FILTERS } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { getAlbums, getAlbumAssetIds } from "../services/photoLibrary";

function formatSize(mo) {
  if (mo < 1) return "0 Mo";
  if (mo < 1024) return `${mo.toFixed(0)} Mo`;
  return `${(mo / 1024).toFixed(1)} Go`;
}

/**
 * Filtre date/type — "Screenshots" est maintenant géré séparément (row 2),
 * mais on le garde ici au cas où activeFilter vaudrait encore "Screenshots".
 */
function applyFilter(photos, filter) {
  if (filter === "Toutes") return photos;
  if (filter === "Screenshots") return photos.filter((p) => p.isScreenshot);

  const now = new Date();

  if (filter === "7 derniers jours") {
    const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    return photos.filter((p) => p.creationTime >= cutoff);
  }
  if (filter === "Mois dernier") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
    return photos.filter((p) => p.creationTime >= start && p.creationTime <= end);
  }
  if (/^\d{4}$/.test(filter)) {
    return photos.filter((p) => p.year === filter);
  }
  return photos;
}

// Filtres ligne 1 : uniquement les filtres date (Screenshots passe en ligne 2)
const ROW1_FILTERS = FILTERS.filter((f) => f !== "Screenshots");

export function HomeScreen({ navigation }) {
  const kept              = usePhotoStore((state) => state.kept);
  const deleted           = usePhotoStore((state) => state.deleted);
  const printed           = usePhotoStore((state) => state.printed);
  const skipped           = usePhotoStore((state) => state.skipped);
  const libraryPhotos     = usePhotoStore((state) => state.libraryPhotos);
  const libraryTotalCount = usePhotoStore((state) => state.libraryTotalCount);
  const libraryLoading    = usePhotoStore((state) => state.libraryLoading);

  const [activeFilter, setActiveFilter] = useState("Toutes");

  // ── Aléatoire 50 ─────────────────────────────────────────────────────────
  const [randomFiftyActive, setRandomFiftyActive] = useState(false);
  const [randomQueue,       setRandomQueue]       = useState([]);

  // ── Sélecteur de dossier (ligne 2) ──────────────────────────────────────
  const [selectedAlbum,   setSelectedAlbum]   = useState(null);  // { id, title } | null
  const [albumPhotoIds,   setAlbumPhotoIds]   = useState(null);  // Set<string> | null
  const [showAlbumModal,  setShowAlbumModal]  = useState(false);
  const [availableAlbums, setAvailableAlbums] = useState([]);
  const [albumsLoading,   setAlbumsLoading]   = useState(false);
  const [albumFiltering,  setAlbumFiltering]  = useState(false);

  async function openAlbumPicker() {
    setShowAlbumModal(true);
    if (availableAlbums.length === 0) {
      setAlbumsLoading(true);
      try { setAvailableAlbums(await getAlbums()); }
      catch { Alert.alert("Erreur", "Impossible de charger les dossiers."); }
      finally { setAlbumsLoading(false); }
    }
  }

  async function selectAlbum(album) {
    setShowAlbumModal(false);
    setAlbumFiltering(true);
    try {
      setAlbumPhotoIds(await getAlbumAssetIds(album.id));
      setSelectedAlbum(album);
    } catch { Alert.alert("Erreur", "Impossible de charger ce dossier."); }
    finally { setAlbumFiltering(false); }
  }

  function clearAlbum() { setSelectedAlbum(null); setAlbumPhotoIds(null); }

  function toggleRandomFifty(currentRemaining) {
    if (randomFiftyActive) {
      setRandomFiftyActive(false);
    } else {
      const shuffled = [...currentRemaining].sort(() => Math.random() - 0.5).slice(0, 50);
      setRandomQueue(shuffled);
      setRandomFiftyActive(true);
    }
  }

  // ── Queue de tri ─────────────────────────────────────────────────────────
  const deletedSize = deleted.reduce((a, p) => a + p.size, 0);
  const librarySize = libraryPhotos.reduce((a, p) => a + p.size, 0);

  const showLimitNote = libraryTotalCount > libraryPhotos.length && libraryPhotos.length > 0;

  const triedIds = new Set([
    ...kept.map((x) => x.id),
    ...deleted.map((x) => x.id),
    ...printed.map((x) => x.id),
    ...skipped.map((x) => x.id),
  ]);
  const triees      = triedIds.size;
  const progressPct = libraryPhotos.length > 0
    ? Math.min(100, (triees / libraryPhotos.length) * 100) : 0;

  // Photos non triées, filtrées par album si sélectionné, puis par filtre date
  let remaining = libraryPhotos.filter((p) => !triedIds.has(p.id));
  if (albumPhotoIds) remaining = remaining.filter((p) => albumPhotoIds.has(p.id));
  const queue = randomFiftyActive
    ? randomQueue.filter((p) => !triedIds.has(p.id))
    : applyFilter(remaining, activeFilter);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 30, fontWeight: "900", color: C.accent }}>Phototri 🌸</Text>
            <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Tes souvenirs méritent mieux</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("Settings")}
            style={{ backgroundColor: C.bgCard, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: C.border }}
          >
            <Text style={{ fontSize: 20 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* ── CTA ─────────────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => queue.length > 0 && navigation.navigate("TriMode", { preQueue: queue })}
          disabled={libraryLoading || albumFiltering || queue.length === 0}
          style={{
            backgroundColor: C.accent, borderRadius: 20, padding: 20,
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
            marginBottom: 12, elevation: 6,
            shadowColor: C.accent, shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35, shadowRadius: 12,
            opacity: libraryLoading || albumFiltering || queue.length === 0 ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>
            {libraryLoading || albumFiltering
              ? "Chargement de tes photos…"
              : queue.length === 0
              ? "🎉 Tout est trié !"
              : `🔀 Démarrer le tri · ${queue.length} photos`}
          </Text>
        </TouchableOpacity>

        {showLimitNote && (
          <Text style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginBottom: 12, fontStyle: "italic" }}>
            Affichage des {libraryPhotos.length} photos les plus récentes sur {libraryTotalCount} au total.
          </Text>
        )}

        {/* ── Ligne 1 : filtres date — View flex simple, plus de scroll ── */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          {ROW1_FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(f)}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99,
                borderWidth: 1.5,
                borderColor: activeFilter === f ? C.accent : C.border,
                backgroundColor: activeFilter === f ? C.accent : C.bgCard,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: activeFilter === f ? "#fff" : C.textMuted }}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Ligne 2 : dossier + aléatoire 50 + screenshots ─────────── */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14, alignItems: "center" }}>

          {/* Pill dossier */}
          <TouchableOpacity
            onPress={openAlbumPicker}
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99,
              borderWidth: 1.5,
              borderColor: selectedAlbum ? C.accent : C.border,
              backgroundColor: selectedAlbum ? `${C.accent}15` : C.bgCard,
            }}
          >
            <Text style={{ fontSize: 13 }}>📁</Text>
            <Text
              style={{ fontSize: 12, fontWeight: "700", color: selectedAlbum ? C.accent : C.textMuted, maxWidth: 90 }}
              numberOfLines={1}
            >
              {selectedAlbum ? selectedAlbum.title : "Dossiers"}
            </Text>
            {selectedAlbum ? (
              <TouchableOpacity onPress={clearAlbum} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 11, color: C.textMuted }}>✕</Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ fontSize: 10, color: C.textMuted }}>▾</Text>
            )}
          </TouchableOpacity>

          {/* Pill Aléatoire 50 */}
          <TouchableOpacity
            onPress={() => toggleRandomFifty(remaining)}
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99,
              borderWidth: 1.5,
              borderColor: randomFiftyActive ? C.accent : C.border,
              backgroundColor: randomFiftyActive ? C.accent : C.bgCard,
            }}
          >
            <Text style={{ fontSize: 13 }}>🎲</Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: randomFiftyActive ? "#fff" : C.textMuted }}>
              Aléatoire 50
            </Text>
          </TouchableOpacity>

          {/* Pill Screenshots */}
          <TouchableOpacity
            onPress={() => setActiveFilter(activeFilter === "Screenshots" ? "Toutes" : "Screenshots")}
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99,
              borderWidth: 1.5,
              borderColor: activeFilter === "Screenshots" ? C.accent : C.border,
              backgroundColor: activeFilter === "Screenshots" ? C.accent : C.bgCard,
            }}
          >
            <Text style={{ fontSize: 13 }}>📸</Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: activeFilter === "Screenshots" ? "#fff" : C.textMuted }}>
              Screenshots
            </Text>
          </TouchableOpacity>

          {albumFiltering && <ActivityIndicator size="small" color={C.accent} />}
        </View>

        {/* ── Grille 2×2 ──────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5, marginBottom: 14 }}>
          {[
            { emoji: "📅", label: "Par moment", desc: "Soirée, voyage…",    onPress: () => navigation.navigate("Moments") },
            { emoji: "🗺",  label: "Par lieu",   desc: "Carte interactive",  onPress: () => navigation.navigate("Map") },
            { emoji: "👤", label: "Par visage", desc: "Reconnaissance auto", onPress: () => Alert.alert("Bientôt disponible", "La reconnaissance des visages arrive prochainement 🌸 — elle demande un modèle de détection qu'on est en train de mettre en place.") },
            { emoji: "🪞", label: "Doublons",   desc: "Photos similaires",  onPress: () => navigation.navigate("Duplicates") },
          ].map((t) => (
            <View key={t.label} style={{ width: "50%", padding: 5 }}>
              <TouchableOpacity
                onPress={t.onPress}
                style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.border, alignItems: "center" }}
              >
                <Text style={{ fontSize: 22, marginBottom: 6 }}>{t.emoji}</Text>
                <Text style={{ fontWeight: "700", fontSize: 13, color: C.text, textAlign: "center" }}>{t.label}</Text>
                <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2, textAlign: "center" }}>{t.desc}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* ── Stats + avancement ──────────────────────────────────────── */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 }}>
          <View style={{ flexDirection: "row" }}>
            {[
              { label: "Photos",    val: libraryPhotos.length, subval: formatSize(librarySize), color: C.accent },
              { label: "Triées",    val: triees,               subval: null,                    color: C.green },
              { label: "À libérer", val: formatSize(deletedSize), subval: null, color: C.red, onPress: () => navigation.navigate("Gallery", { section: "deleted" }) },
            ].map((s, i) => (
              <TouchableOpacity
                key={s.label}
                onPress={s.onPress}
                disabled={!s.onPress}
                style={{ flex: 1, alignItems: "center", borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: C.border }}
              >
                <Text style={{ fontSize: 17, fontWeight: "800", color: s.color }}>{s.val}</Text>
                {s.subval && <Text style={{ fontSize: 9, fontWeight: "700", color: s.color, opacity: 0.7, marginTop: 1 }}>{s.subval}</Text>}
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {libraryPhotos.length > 0 && (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: C.textMuted }}>
                  {progressPct >= 100 ? "🎉 Tout est trié !" : "Avancement du tri"}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "900", color: C.accent }}>{Math.round(progressPct)}%</Text>
              </View>
              <View style={{ height: 6, backgroundColor: C.border, borderRadius: 3, overflow: "hidden" }}>
                <View style={{ height: 6, width: `${progressPct}%`, backgroundColor: C.accent, borderRadius: 3 }} />
              </View>
              <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 5 }}>
                {triees} sur {libraryPhotos.length} photos triées
                {libraryTotalCount > libraryPhotos.length && ` · ${libraryTotalCount - libraryPhotos.length} non chargées`}
              </Text>
            </View>
          )}
        </View>

        {/* ── 3 sections côte à côte ───────────────────────────────────
            Chaque carte : icône colorée + compteur + label.
            flex:1 sur chaque carte = largeur identique automatique. */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { key: "deleted", emoji: "🗑",  label: "Corbeille",  count: deleted.length, sub: `${deletedSize.toFixed(0)} Mo`, bg: "#ffe8e8", color: "#e8637a" },
            { key: "album",   emoji: "🗂️", label: "Mes albums",  count: printed.length, sub: "photos gardées",               bg: "#f0e8ff", color: "#b07ad8" },
            { key: "kept",    emoji: "❤️", label: "Coup de ❤️",  count: kept.length,    sub: "favoris",                      bg: "#e8f8ee", color: "#5cb87a" },
          ].map((s) => (
            <TouchableOpacity
              key={s.key}
              onPress={() => navigation.navigate("Gallery", { section: s.key })}
              style={{
                flex: 1, backgroundColor: C.bgCard, borderRadius: S.radius,
                padding: 14, borderWidth: 1, borderColor: C.border, alignItems: "center",
              }}
            >
              <View style={{ width: 42, height: 42, backgroundColor: s.bg, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                <Text style={{ fontSize: 20 }}>{s.emoji}</Text>
              </View>
              <Text style={{ fontSize: 20, fontWeight: "900", color: s.color }}>{s.count}</Text>
              <Text style={{ fontSize: 11, fontWeight: "700", color: C.text, marginTop: 2 }}>{s.label}</Text>
              <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{s.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

      {/* ── Modal sélection de dossier ──────────────────────────────── */}
      <Modal visible={showAlbumModal} transparent animationType="slide" onRequestClose={() => setShowAlbumModal(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setShowAlbumModal(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 36 }}>
              {/* Poignée */}
              <View style={{ alignItems: "center", paddingTop: 12, marginBottom: 4 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
              </View>

              <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                <Text style={{ fontWeight: "800", fontSize: 17, color: C.text }}>Choisir un dossier</Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                  Seules les photos de ce dossier seront dans ta session de tri.
                </Text>
              </View>

              {/* Option "Toute la photothèque" */}
              <TouchableOpacity
                onPress={() => { clearAlbum(); setShowAlbumModal(false); }}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 12,
                  paddingHorizontal: 20, paddingVertical: 14,
                  backgroundColor: !selectedAlbum ? `${C.accent}12` : "transparent",
                  borderBottomWidth: 1, borderBottomColor: C.border,
                }}
              >
                <Text style={{ fontSize: 22 }}>📷</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", fontSize: 14, color: C.text }}>Toute la photothèque</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted }}>{libraryPhotos.length} photos chargées</Text>
                </View>
                {!selectedAlbum && <Text style={{ color: C.accent, fontSize: 16 }}>✓</Text>}
              </TouchableOpacity>

              {albumsLoading ? (
                <View style={{ padding: 30, alignItems: "center" }}>
                  <ActivityIndicator color={C.accent} />
                  <Text style={{ marginTop: 10, color: C.textMuted, fontSize: 13 }}>Chargement des dossiers…</Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 340 }}>
                  {availableAlbums.map((album) => {
                    const isActive = selectedAlbum?.id === album.id;
                    return (
                      <TouchableOpacity
                        key={album.id}
                        onPress={() => selectAlbum(album)}
                        style={{
                          flexDirection: "row", alignItems: "center", gap: 12,
                          paddingHorizontal: 20, paddingVertical: 13,
                          backgroundColor: isActive ? `${C.accent}12` : "transparent",
                          borderBottomWidth: 1, borderBottomColor: C.border,
                        }}
                      >
                        <Text style={{ fontSize: 20 }}>📁</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: "700", fontSize: 14, color: C.text }}>{album.title}</Text>
                          <Text style={{ fontSize: 12, color: C.textMuted }}>{album.assetCount} photos</Text>
                        </View>
                        {isActive && <Text style={{ color: C.accent, fontSize: 16 }}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

export default HomeScreen;
