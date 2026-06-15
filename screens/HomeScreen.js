// screens/HomeScreen.js
import React, { useState } from "react";
import {
  ScrollView, StatusBar, View, Text,
  TouchableOpacity, Alert, Modal, ActivityIndicator, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { C, S, FILTERS } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { getAlbums, getAlbumAssetIds } from "../services/photoLibrary";

const C_ALBUM = "#7c6fcd";

// ── Données statiques : produits et partenaires d'impression ─────────────────
const PRODUCTS = [
  {
    key: "livre",
    emoji: "📖",
    label: "Livre photo",
    desc: "20 à 100 pages",
    longDesc: "Raconte une histoire avec tes plus belles photos. Parfait pour un voyage ou une année en famille.",
    bg: "#f0e8ff",
    color: C_ALBUM,
    partners: [
      { name: "Cheerz",   emoji: "🎨", desc: "Livre Lay Flat 20×20cm", price: "29,90€", best: false, url: "https://www.cheerz.com/fr/livres-photo" },
      { name: "CEWE",     emoji: "📚", desc: "Livre photo 20×20cm",    price: "19,90€", best: true,  url: "https://www.cewe.fr/livre-photo.html" },
      { name: "Photobox", emoji: "🎁", desc: "Livre Hardcover 20×20",  price: "27,50€", best: false, url: "https://www.photobox.fr/shop/photo-books" },
    ],
  },
  {
    key: "tirage",
    emoji: "🖼",
    label: "Tirage photo",
    desc: "Papier brillant ou mat",
    longDesc: "Des tirages de qualité professionnelle. À encadrer, offrir ou décorer ton intérieur.",
    bg: "#fff0f0",
    color: "#e8637a",
    partners: [
      { name: "Cheerz",   emoji: "🎨", desc: "Tirage 10×15cm (lot 50)", price: "12,90€", best: true,  url: "https://www.cheerz.com/fr/tirages-photo" },
      { name: "CEWE",     emoji: "📚", desc: "Tirage 10×15cm (lot 50)", price: "14,50€", best: false, url: "https://www.cewe.fr/tirages-photo.html" },
      { name: "Photobox", emoji: "🎁", desc: "Tirage 10×15cm (lot 50)", price: "16,90€", best: false, url: "https://www.photobox.fr/shop/prints" },
    ],
  },
  {
    key: "calendrier",
    emoji: "📅",
    label: "Calendrier",
    desc: "Mural ou de bureau",
    longDesc: "Un calendrier personnalisé avec tes photos pour toute l'année. Idéal comme cadeau.",
    bg: "#fff8e0",
    color: "#f5a623",
    partners: [
      { name: "Cheerz",   emoji: "🎨", desc: "Calendrier mural A3",  price: "24,90€", best: false, url: "https://www.cheerz.com/fr/calendriers" },
      { name: "CEWE",     emoji: "📚", desc: "Calendrier mural A3",  price: "17,90€", best: true,  url: "https://www.cewe.fr/calendrier-photo.html" },
      { name: "Photobox", emoji: "🎁", desc: "Calendrier mural A3",  price: "22,00€", best: false, url: "https://www.photobox.fr/shop/calendars" },
    ],
  },
  {
    key: "objet",
    emoji: "🎁",
    label: "Objets",
    desc: "Mug, puzzle, coussin…",
    longDesc: "Personnalise des objets du quotidien avec tes photos. Des cadeaux uniques qui font vraiment plaisir.",
    bg: "#e8f8ee",
    color: "#5cb87a",
    partners: [
      { name: "Cheerz",   emoji: "🎨", desc: "Mug photo 300ml",    price: "19,90€", best: false, url: "https://www.cheerz.com/fr/accessoires" },
      { name: "Photobox", emoji: "🎁", desc: "Mug photo 300ml",    price: "15,90€", best: true,  url: "https://www.photobox.fr/shop/gifts/mugs" },
      { name: "CEWE",     emoji: "📚", desc: "Puzzle photo 500 p", price: "24,90€", best: false, url: "https://www.cewe.fr/cadeaux-photo.html" },
    ],
  },
];

function formatSize(mo) {
  if (mo < 1) return "0 Mo";
  if (mo < 1024) return `${mo.toFixed(0)} Mo`;
  return `${(mo / 1024).toFixed(1)} Go`;
}

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
  if (/^\d{4}$/.test(filter)) return photos.filter((p) => p.year === filter);
  return photos;
}

const ROW1_FILTERS = FILTERS.filter((f) => f !== "Screenshots");

export function HomeScreen({ navigation }) {
  const kept              = usePhotoStore((state) => state.kept);
  const deleted           = usePhotoStore((state) => state.deleted);
  const printed           = usePhotoStore((state) => state.printed);
  const skipped           = usePhotoStore((state) => state.skipped);
  const libraryPhotos     = usePhotoStore((state) => state.libraryPhotos);
  const libraryTotalCount = usePhotoStore((state) => state.libraryTotalCount);
  const libraryLoading    = usePhotoStore((state) => state.libraryLoading);
  const randomCount       = usePhotoStore((state) => state.randomCount);
  const albums            = usePhotoStore((state) => state.albums);

  // ── Mode actif : ménage (orange) ou album (violet) ──────────────────────
  const [activeMode, setActiveMode] = useState("menage");
  const isMenage = activeMode === "menage";
  const modeColor = isMenage ? C.accent : C_ALBUM;

  const [activeFilter, setActiveFilter] = useState("Toutes");

  // ── Aléatoire ────────────────────────────────────────────────────────────
  const [randomFiftyActive, setRandomFiftyActive] = useState(false);
  const [randomQueue,       setRandomQueue]       = useState([]);

  // ── Modal impression partenaires ─────────────────────────────────────────
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [selectedProduct,   setSelectedProduct]   = useState(null);

  // ── Sélecteur de dossier ─────────────────────────────────────────────────
  const [selectedAlbum,   setSelectedAlbum]   = useState(null);
  const [albumPhotoIds,   setAlbumPhotoIds]   = useState(null);
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

  function toggleRandomFifty(filteredPool) {
    if (randomFiftyActive) {
      setRandomFiftyActive(false);
    } else {
      const shuffled = [...filteredPool].sort(() => Math.random() - 0.5).slice(0, randomCount);
      setRandomQueue(shuffled);
      setRandomFiftyActive(true);
    }
  }

  // ── Queues ───────────────────────────────────────────────────────────────
  const deletedSize = deleted.reduce((a, p) => a + p.size, 0);
  const librarySize = libraryPhotos.reduce((a, p) => a + p.size, 0);

  const menageExcludedIds = new Set([
    ...kept.map((x) => x.id),
    ...deleted.map((x) => x.id),
    ...printed.map((x) => x.id),
    ...skipped.map((x) => x.id),
  ]);

  const albumExcludedIds = new Set([
    ...deleted.map((x) => x.id),
    ...skipped.map((x) => x.id),
  ]);

  const excludedIds = isMenage ? menageExcludedIds : albumExcludedIds;

  const triees      = menageExcludedIds.size;
  const progressPct = libraryPhotos.length > 0
    ? Math.min(100, (triees / libraryPhotos.length) * 100) : 0;

  let remaining = libraryPhotos.filter((p) => !excludedIds.has(p.id));
  if (albumPhotoIds) remaining = remaining.filter((p) => albumPhotoIds.has(p.id));
  const filteredPool = applyFilter(remaining, activeFilter);
  const queue = randomFiftyActive
    ? randomQueue.filter((p) => !excludedIds.has(p.id))
    : filteredPool;

  // ── Navigation CTA ───────────────────────────────────────────────────────
  function handleCTA() {
    if (queue.length === 0) return;
    if (isMenage) {
      // En mode ménage on va directement au swipe, sans passer par la question
      navigation.navigate("Swipe", { queue, mode: "menage" });
    } else {
      navigation.navigate("TriMode", { preQueue: queue, skipToAlbum: true });
    }
  }

  const ctaLabel = () => {
    if (libraryLoading || albumFiltering) return "Chargement de tes photos…";
    if (queue.length === 0) return isMenage ? "🎉 Tout est trié !" : "Aucune photo disponible";
    if (isMenage) return `🔀 Faire le ménage · ${queue.length} photos`;
    return `📚 Créer un album · ${queue.length} photos`;
  };

  // ── Grille 2×2 : 4e item selon le mode ──────────────────────────────────
  const gridItems = [
    { emoji: "📅", label: "Par moment", desc: "Soirée, voyage…",    onPress: () => navigation.navigate("Moments", { mode: activeMode }) },
    { emoji: "🗺",  label: "Par lieu",   desc: "Carte interactive",  onPress: () => navigation.navigate("Map",     { mode: activeMode }) },
    { emoji: "👤", label: "Par visage", desc: "Bientôt disponible", onPress: () => Alert.alert("Bientôt disponible", "La reconnaissance des visages arrive prochainement 🌸") },
    isMenage
      ? { emoji: "🪞", label: "Doublons",      desc: "Photos similaires", onPress: () => navigation.navigate("Duplicates") }
      : { emoji: "❤️", label: "Coup de cœur",  desc: "Photos aimées",     onPress: () => navigation.navigate("Gallery", { section: "kept" }) },
  ];

  // ── Cartes du bas : 3e carte selon le mode ───────────────────────────────
  const bottomCards = [
    {
      key: "deleted",
      emoji: "🗑",  label: "Corbeille",  count: deleted.length,
      sub: `${deletedSize.toFixed(0)} Mo`, bg: "#ffe8e8", color: "#e8637a",
      nav: () => navigation.navigate("Gallery", { section: "deleted" }),
    },
    {
      key: "album",
      emoji: "🗂️", label: "Mes albums", count: albums.length,
      sub: `album${albums.length > 1 ? "s" : ""}`, bg: "#f0e8ff", color: C_ALBUM,
      nav: () => navigation.navigate("Gallery", { section: "album" }),
    },
    isMenage
      ? {
          key: "kept",
          emoji: "❤️", label: "Coup de ❤️", count: kept.length,
          sub: `${kept.length} photo${kept.length > 1 ? "s" : ""}`, bg: "#e8f8ee", color: "#5cb87a",
          nav: () => navigation.navigate("Gallery", { section: "kept" }),
        }
      : {
          key: "partners",
          emoji: "🤝", label: "Partenaires", count: 3,
          sub: "jusqu'à -15%", bg: "#fff3e0", color: "#f5a623",
          nav: () => { setSelectedProduct(null); setPrintModalVisible(true); },
        },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <View>
            <Text style={{ fontSize: 28, fontWeight: "900", color: C.accent }}>Phototri 🌸</Text>
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Tes souvenirs méritent mieux</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("Settings")}
            style={{ backgroundColor: C.bgCard, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: C.border }}
          >
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* ── Toggle Ménage / Album ────────────────────────────────────── */}
        <View style={{
          flexDirection: "row",
          backgroundColor: C.bgCard,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: C.border,
          padding: 4,
          marginBottom: 10,
          gap: 4,
        }}>
          {[
            { key: "menage", label: "🔀 Ménage",         color: C.accent },
            { key: "album",  label: "📁 Créer un album",  color: C_ALBUM },
          ].map((m) => {
            const active = activeMode === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => { setActiveMode(m.key); setRandomFiftyActive(false); }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 11,
                  alignItems: "center",
                  backgroundColor: active ? m.color : "transparent",
                }}
              >
                <Text style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: active ? "#fff" : C.textMuted,
                }}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── CTA ─────────────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={handleCTA}
          disabled={libraryLoading || albumFiltering || queue.length === 0}
          style={{
            backgroundColor: modeColor,
            borderRadius: 18,
            padding: 18,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 10,
            opacity: libraryLoading || albumFiltering || queue.length === 0 ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>
            {ctaLabel()}
          </Text>
          {!libraryLoading && !albumFiltering && queue.length > 0 && (
            <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 3 }}>
              {isMenage
                ? `${libraryPhotos.length - triees} restantes à trier`
                : "Toutes tes photos sauf les supprimées"}
            </Text>
          )}
        </TouchableOpacity>

        {/* ── Ligne 1 : filtres date ───────────────────────────────────── */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {ROW1_FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(f)}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99,
                borderWidth: 1.5,
                borderColor: activeFilter === f ? modeColor : C.border,
                backgroundColor: activeFilter === f ? modeColor : C.bgCard,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: activeFilter === f ? "#fff" : C.textMuted }}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Ligne 2 : dossier + (ménage only) aléatoire + screenshots── */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12, alignItems: "center" }}>
          <TouchableOpacity
            onPress={openAlbumPicker}
            style={{
              flexDirection: "row", alignItems: "center", gap: 5,
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99,
              borderWidth: 1.5,
              borderColor: selectedAlbum ? modeColor : C.border,
              backgroundColor: selectedAlbum ? `${modeColor}18` : C.bgCard,
            }}
          >
            <Text style={{ fontSize: 12 }}>📁</Text>
            <Text style={{ fontSize: 11, fontWeight: "700", color: selectedAlbum ? modeColor : C.textMuted, maxWidth: 80 }} numberOfLines={1}>
              {selectedAlbum ? selectedAlbum.title : "Dossiers"}
            </Text>
            {selectedAlbum
              ? <TouchableOpacity onPress={clearAlbum} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={{ fontSize: 10, color: C.textMuted }}>✕</Text></TouchableOpacity>
              : <Text style={{ fontSize: 10, color: C.textMuted }}>▾</Text>}
          </TouchableOpacity>

          {isMenage && (
            <TouchableOpacity
              onPress={() => toggleRandomFifty(filteredPool)}
              style={{
                flexDirection: "row", alignItems: "center", gap: 5,
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99,
                borderWidth: 1.5,
                borderColor: randomFiftyActive ? C.accent : C.border,
                backgroundColor: randomFiftyActive ? C.accent : C.bgCard,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: randomFiftyActive ? "#fff" : C.textMuted }}>
                🎲 Aléatoire {randomCount}
              </Text>
            </TouchableOpacity>
          )}

          {isMenage && (
            <TouchableOpacity
              onPress={() => setActiveFilter(activeFilter === "Screenshots" ? "Toutes" : "Screenshots")}
              style={{
                flexDirection: "row", alignItems: "center", gap: 5,
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99,
                borderWidth: 1.5,
                borderColor: activeFilter === "Screenshots" ? modeColor : C.border,
                backgroundColor: activeFilter === "Screenshots" ? modeColor : C.bgCard,
              }}
            >
              <Text style={{ fontSize: 12 }}>📸</Text>
              <Text style={{ fontSize: 11, fontWeight: "700", color: activeFilter === "Screenshots" ? "#fff" : C.textMuted }}>
                Screenshots
              </Text>
            </TouchableOpacity>
          )}

          {albumFiltering && <ActivityIndicator size="small" color={modeColor} />}
        </View>

        {/* ── Grille 2×2 ──────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 10 }}>
          {gridItems.map((t) => (
            <View key={t.label} style={{ width: "50%", padding: 4 }}>
              <TouchableOpacity
                onPress={t.onPress}
                style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 10, borderWidth: 1, borderColor: C.border, alignItems: "center" }}
              >
                <Text style={{ fontSize: 20, marginBottom: 4 }}>{t.emoji}</Text>
                <Text style={{ fontWeight: "700", fontSize: 12, color: C.text, textAlign: "center" }}>{t.label}</Text>
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 1, textAlign: "center" }}>{t.desc}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* ── Mode ALBUM : produits d'impression + coups de cœur ─────── */}
        {!isMenage && (
          <>
            {/* Titre section */}
            <Text style={{ fontWeight: "800", fontSize: 12, color: C_ALBUM, marginBottom: 8, letterSpacing: 0.5 }}>
              🎁 IMPRIMER TES SOUVENIRS
            </Text>

            {/* Scroll horizontal des produits */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -14, marginBottom: 12 }}
              contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}
            >
              {PRODUCTS.map((prod) => (
                <TouchableOpacity
                  key={prod.key}
                  onPress={() => { setSelectedProduct(prod); setPrintModalVisible(true); }}
                  style={{
                    width: 108,
                    backgroundColor: prod.bg,
                    borderRadius: 16,
                    padding: 14,
                    alignItems: "center",
                    borderWidth: 1.5,
                    borderColor: prod.color + "40",
                  }}
                >
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>{prod.emoji}</Text>
                  <Text style={{ fontWeight: "800", fontSize: 12, color: prod.color, textAlign: "center" }}>{prod.label}</Text>
                  <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3, textAlign: "center" }}>{prod.desc}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Bande coups de cœur */}
            <TouchableOpacity
              onPress={() => navigation.navigate("Gallery", { section: "kept" })}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#fff0f5",
                borderRadius: 14,
                padding: 12,
                borderWidth: 1.5,
                borderColor: "#f4a5c0",
                marginBottom: 10,
              }}
            >
              <Text style={{ fontSize: 26, marginRight: 10 }}>❤️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", fontSize: 13, color: "#e8637a" }}>
                  Coups de cœur · {kept.length} photos
                </Text>
                <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                  Tes meilleures photos, parfaites pour imprimer
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: "#e8637a", fontWeight: "800" }}>→</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Stats + avancement ──────────────────────────────────────── */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: C.border, marginBottom: 10 }}>
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
                <Text style={{ fontSize: 15, fontWeight: "800", color: s.color }}>{s.val}</Text>
                {s.subval && <Text style={{ fontSize: 9, fontWeight: "700", color: s.color, opacity: 0.7, marginTop: 1 }}>{s.subval}</Text>}
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {libraryPhotos.length > 0 && (
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: C.textMuted }}>
                  {progressPct >= 100 ? "🎉 Tout est trié !" : "Avancement du tri"}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: "900", color: C.accent }}>{Math.round(progressPct)}%</Text>
              </View>
              <View style={{ height: 5, backgroundColor: C.border, borderRadius: 3, overflow: "hidden" }}>
                <View style={{ height: 5, width: `${progressPct}%`, backgroundColor: C.accent, borderRadius: 3 }} />
              </View>
              <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
                {triees} sur {libraryPhotos.length} photos triées
                {libraryTotalCount > libraryPhotos.length && ` · ${libraryTotalCount - libraryPhotos.length} non chargées`}
              </Text>
            </View>
          )}
        </View>

        {/* ── 3 sections côte à côte ───────────────────────────────────── */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {bottomCards.map((s) => (
            <TouchableOpacity
              key={s.key}
              onPress={s.nav}
              style={{
                flex: 1, backgroundColor: C.bgCard, borderRadius: S.radius,
                padding: 10, borderWidth: 1, borderColor: C.border, alignItems: "center",
              }}
            >
              <View style={{ width: 38, height: 38, backgroundColor: s.bg, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                <Text style={{ fontSize: 18 }}>{s.emoji}</Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: "900", color: s.color }}>{s.count}</Text>
              <Text style={{ fontSize: 10, fontWeight: "700", color: C.text, marginTop: 2 }}>{s.label}</Text>
              <Text style={{ fontSize: 9, color: C.textMuted, marginTop: 1 }}>{s.sub}</Text>
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
              <View style={{ alignItems: "center", paddingTop: 12, marginBottom: 4 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
              </View>
              <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                <Text style={{ fontWeight: "800", fontSize: 17, color: C.text }}>Choisir un dossier</Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                  Seules les photos de ce dossier seront dans ta session.
                </Text>
              </View>
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

      {/* ── Modal Impression & Partenaires ─────────────────────────── */}
      <Modal
        visible={printModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPrintModalVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setPrintModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingBottom: 36, maxHeight: "88%" }}>

              {/* Poignée */}
              <View style={{ alignItems: "center", paddingTop: 12, marginBottom: 4 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>

                {/* — Vue PRODUIT UNIQUE ————————————————————————————————— */}
                {selectedProduct ? (
                  <>
                    {/* En-tête produit */}
                    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
                      <TouchableOpacity
                        onPress={() => setSelectedProduct(null)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}
                      >
                        <Text style={{ fontSize: 12, color: C_ALBUM, fontWeight: "700" }}>← Tous les produits</Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 36, marginBottom: 8 }}>{selectedProduct.emoji}</Text>
                      <Text style={{ fontWeight: "900", fontSize: 20, color: "#1a1a1a", marginBottom: 4 }}>{selectedProduct.label}</Text>
                      <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 19 }}>{selectedProduct.longDesc}</Text>
                    </View>

                    {/* Code promo */}
                    <View style={{
                      marginHorizontal: 20, marginBottom: 16,
                      backgroundColor: `${C_ALBUM}12`, borderRadius: 14,
                      padding: 14, borderWidth: 1.5, borderColor: `${C_ALBUM}40`,
                      flexDirection: "row", alignItems: "center", gap: 12,
                    }}>
                      <Text style={{ fontSize: 22 }}>🎟</Text>
                      <View>
                        <Text style={{ fontSize: 11, color: C.textMuted }}>Ton code exclusif</Text>
                        <Text style={{ fontWeight: "900", fontSize: 20, color: C_ALBUM, letterSpacing: 1.5 }}>PHOTOTRI15</Text>
                      </View>
                      <Text style={{ flex: 1, textAlign: "right", fontSize: 12, color: C_ALBUM, fontWeight: "800" }}>–15%</Text>
                    </View>

                    {/* Comparateur partenaires */}
                    <Text style={{ paddingHorizontal: 20, fontWeight: "800", fontSize: 13, color: "#1a1a1a", marginBottom: 10 }}>
                      Comparer les prix
                    </Text>
                    {selectedProduct.partners.map((partner, i) => (
                      <TouchableOpacity
                        key={partner.name}
                        onPress={() => Linking.openURL(partner.url).catch(() =>
                          Alert.alert("Erreur", `Impossible d'ouvrir ${partner.name}`)
                        )}
                        style={{
                          flexDirection: "row", alignItems: "center",
                          paddingHorizontal: 20, paddingVertical: 14,
                          borderTopWidth: 1, borderTopColor: C.border,
                          backgroundColor: partner.best ? "#f6fff8" : "transparent",
                        }}
                      >
                        <Text style={{ fontSize: 22, marginRight: 12 }}>{partner.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                            <Text style={{ fontWeight: "800", fontSize: 14, color: "#1a1a1a" }}>{partner.name}</Text>
                            {partner.best && (
                              <View style={{ backgroundColor: "#4CAF50", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                <Text style={{ fontSize: 9, color: "#fff", fontWeight: "900" }}>MEILLEUR PRIX</Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ fontSize: 12, color: C.textMuted }}>{partner.desc}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ fontWeight: "900", fontSize: 16, color: partner.best ? "#4CAF50" : "#1a1a1a" }}>{partner.price}</Text>
                          <Text style={{ fontSize: 10, color: C_ALBUM, fontWeight: "700" }}>Voir →</Text>
                        </View>
                      </TouchableOpacity>
                    ))}

                    {/* Conseil qualité */}
                    <View style={{ margin: 20, backgroundColor: "#fff8e1", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#ffe082" }}>
                      <Text style={{ fontSize: 12, color: "#f57f17", lineHeight: 18 }}>
                        💡 <Text style={{ fontWeight: "800" }}>Conseil qualité :</Text> Utilise de préférence des photos prises avec l'appareil principal (évite les captures d'écran et les zooms excessifs) pour un rendu net à l'impression.
                      </Text>
                    </View>
                  </>
                ) : (
                  /* — Vue TOUS LES PRODUITS ————————————————————————————— */
                  <>
                    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
                      <Text style={{ fontWeight: "900", fontSize: 20, color: "#1a1a1a", marginBottom: 4 }}>🎁 Nos partenaires impression</Text>
                      <Text style={{ fontSize: 13, color: C.textMuted }}>
                        Imprime tes souvenirs avec –15% grâce au code <Text style={{ fontWeight: "800", color: C_ALBUM }}>PHOTOTRI15</Text>
                      </Text>
                    </View>
                    {PRODUCTS.map((prod) => (
                      <TouchableOpacity
                        key={prod.key}
                        onPress={() => setSelectedProduct(prod)}
                        style={{
                          flexDirection: "row", alignItems: "center",
                          paddingHorizontal: 20, paddingVertical: 14,
                          borderTopWidth: 1, borderTopColor: C.border,
                        }}
                      >
                        <View style={{
                          width: 46, height: 46, borderRadius: 14,
                          backgroundColor: prod.bg,
                          alignItems: "center", justifyContent: "center",
                          marginRight: 14,
                        }}>
                          <Text style={{ fontSize: 22 }}>{prod.emoji}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: "800", fontSize: 15, color: "#1a1a1a" }}>{prod.label}</Text>
                          <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{prod.desc}</Text>
                        </View>
                        <Text style={{ fontSize: 13, color: C_ALBUM, fontWeight: "700" }}>→</Text>
                      </TouchableOpacity>
                    ))}
                    <View style={{ height: 10 }} />
                  </>
                )}

              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

export default HomeScreen;
