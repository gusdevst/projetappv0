// screens/HomeScreen.js
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ScrollView, StatusBar, View, Text, Image,
  TouchableOpacity, Alert, Modal, ActivityIndicator, Linking, PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { C, S, FILTERS } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { getAlbums, getAlbumAssetIds } from "../services/photoLibrary";
import { AlbumFiltersBar } from "../components/AlbumFiltersBar";
import { useNotificationReminder } from "../hooks/useNotificationReminder";

// C_ALBUM utilise désormais la valeur centralisée dans theme.js
const C_ALBUM = C.album;

// ── Données statiques : produits et partenaires d'impression ─────────────────
const PRODUCTS = [
  {
    key: "livre",
    emoji: "📖",
    label: "Livre photo",
    desc: "20 à 100 pages",
    longDesc: "Raconte une histoire avec tes plus belles photos. Parfait pour un voyage ou une année en famille.",
    bg: "#e6f4f2",
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
    bg: "#e8edf4",
    color: C.accent,
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

// Filtres date affichés selon le mode :
// - Ménage : toutes les périodes
// - Album  : seulement "Toutes" et l'année en cours (ligne unique avec "Dossiers")
const MENAGE_DATE_FILTERS = FILTERS.filter((f) => f !== "Screenshots");
const ALBUM_DATE_FILTERS  = ["Toutes", "2026", "2025"];

export function HomeScreen({ navigation, route }) {
  const kept              = usePhotoStore((state) => state.kept);
  const deleted           = usePhotoStore((state) => state.deleted);
  const printed           = usePhotoStore((state) => state.printed);
  const skipped           = usePhotoStore((state) => state.skipped);
  const libraryPhotos     = usePhotoStore((state) => state.libraryPhotos);
  const libraryTotalCount = usePhotoStore((state) => state.libraryTotalCount);
  const libraryLoading    = usePhotoStore((state) => state.libraryLoading);
  const randomCount            = usePhotoStore((state) => state.randomCount);
  const albums                 = usePhotoStore((state) => state.albums);
  const notificationFrequency  = usePhotoStore((state) => state.notificationFrequency);
  const albumFilters      = usePhotoStore((state) => state.albumFilters);
  const removeAlbumFilter = usePhotoStore((state) => state.removeAlbumFilter);
  const clearAlbumFilters = usePhotoStore((state) => state.clearAlbumFilters);
  const addAlbumFilter    = usePhotoStore((state) => state.addAlbumFilter);

  // ── Mode actif : ménage (orange) ou album (violet) ──────────────────────
  const [activeMode, setActiveMode] = useState("menage");
  const isMenage = activeMode === "menage";
  const modeColor = isMenage ? C.accent : C_ALBUM;

  const [activeFilter, setActiveFilter] = useState("Toutes");

  // Filtres date proposés selon le mode actif
  const dateFilters = isMenage ? MENAGE_DATE_FILTERS : ALBUM_DATE_FILTERS;

  // Bascule de mode : réinitialise le filtre s'il n'existe pas dans le nouveau mode
  function switchMode(key) {
    setActiveMode(key);
    setRandomFiftyActive(false);
    const allowed = key === "menage" ? MENAGE_DATE_FILTERS : ALBUM_DATE_FILTERS;
    setActiveFilter((f) => (allowed.includes(f) ? f : "Toutes"));
  }

  const screenPan = useRef(
    PanResponder.create({
      // S'active uniquement sur les gestes franchement horizontaux pour ne pas
      // interférer avec le scroll vertical de la ScrollView
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 40 && Math.abs(g.dx) > Math.abs(g.dy) * 3,
      onPanResponderRelease: (_, g) => {
        if (g.dx > 60)  switchMode("album");
        if (g.dx < -60) switchMode("menage");
      },
    })
  ).current;

  // Ouverture directe sur le mode album (ex. CTA depuis le bilan de tri).
  useEffect(() => {
    if (route?.params?.startMode === "album") {
      switchMode("album");
      navigation.setParams({ startMode: undefined }); // évite de rebasculer au prochain focus
    }
  }, [route?.params?.startMode]);

  // ── Aléatoire ────────────────────────────────────────────────────────────
  const [randomFiftyActive, setRandomFiftyActive] = useState(false);
  const [randomQueue,       setRandomQueue]       = useState([]);

  // Rappels push : proposés une seule fois au 1er usage du mode aléatoire.
  const { notificationsEnabled, notifPromptSeen, markPromptSeen, enableReminders } =
    useNotificationReminder();

  // Demande à l'utilisateur s'il veut activer les rappels (1re activation aléatoire).
  function maybePromptNotifications() {
    if (notificationsEnabled || notifPromptSeen) return;
    markPromptSeen(); // on ne reposera plus la question
    Alert.alert(
      "Activer les rappels ? 🔔",
      "On t'enverra un rappel chaque jour à 9h pour penser à trier tes photos. Tu pourras changer l'heure (et la fréquence) à tout moment dans les Réglages.",
      [
        { text: "Non merci", style: "cancel" },
        {
          text: "Activer",
          onPress: async () => {
            const result = await enableReminders(); // quotidien à 9h par défaut
            if (!result.success && result.reason === "permission_denied") {
              Alert.alert(
                "Permission refusée",
                "Pour recevoir des rappels, active les notifications pour Pellicule dans tes Réglages."
              );
            }
          },
        },
      ]
    );
  }

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

  // Filtre "coups de cœur" : raccourci pour ajouter/retirer les favoris des filtres combinés.
  const coeurActive = albumFilters.some((f) => f.id === "coeur");
  function toggleCoeurFilter() {
    if (coeurActive) removeAlbumFilter("coeur");
    else addAlbumFilter({ id: "coeur", type: "coeur", label: "Coups de cœur", photoIds: kept.map((p) => p.id) });
  }

  function toggleRandomFifty(filteredPool) {
    if (randomFiftyActive) {
      setRandomFiftyActive(false);
    } else {
      const shuffled = [...filteredPool].sort(() => Math.random() - 0.5).slice(0, randomCount);
      setRandomQueue(shuffled);
      setRandomFiftyActive(true);
      maybePromptNotifications(); // 1er usage : propose d'activer les rappels
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

  // En mode album, on exclut SEULEMENT la corbeille.
  // Les photos conservées (skipped) doivent apparaître — elles sont de bonnes
  // candidates pour un album. Une photo peut appartenir à plusieurs albums.
  const albumExcludedIds = new Set([
    ...deleted.map((x) => x.id),
  ]);

  const excludedIds = isMenage ? menageExcludedIds : albumExcludedIds;

  const triees      = menageExcludedIds.size;
  const progressPct = libraryPhotos.length > 0
    ? Math.min(100, (triees / libraryPhotos.length) * 100) : 0;

  // Filtres combinés (mode album, intersection ET) : on précalcule un Set d'ids par filtre.
  const albumFilterSets = useMemo(
    () => albumFilters.map((f) => new Set(f.photoIds)),
    [albumFilters]
  );

  let remaining = libraryPhotos.filter((p) => !excludedIds.has(p.id));
  if (albumPhotoIds) remaining = remaining.filter((p) => albumPhotoIds.has(p.id));
  // En mode album, une photo doit appartenir à TOUS les filtres actifs.
  if (!isMenage && albumFilterSets.length > 0) {
    remaining = remaining.filter((p) => albumFilterSets.every((s) => s.has(p.id)));
  }
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
    if (isMenage) return `🔀 Faire le tri · ${queue.length} photos`;
    return `📚 Créer un album · ${queue.length} photos`;
  };

  // ── Grille 2×2 : 4e item selon le mode ──────────────────────────────────
  const gridItems = [
    { emoji: "📅", label: "Par moment", desc: "Soirée, voyage…",    onPress: () => navigation.navigate("Moments", { mode: activeMode }) },
    { emoji: "🗺",  label: "Par lieu",   desc: "Carte interactive",  onPress: () => navigation.navigate("Map",     { mode: activeMode }) },
    { emoji: "👤", label: "Par visage", desc: "Bientôt disponible", disabled: true, onPress: () => Alert.alert("Bientôt disponible", "La reconnaissance des visages arrive prochainement 🌸") },
    isMenage
      ? { emoji: "🪞", label: "Doublons",      desc: "Photos similaires", onPress: () => navigation.navigate("Duplicates") }
      : { emoji: "❤️", label: "Coup de cœur",  desc: coeurActive ? "✓ Dans les filtres" : "Photos aimées", onPress: toggleCoeurFilter, active: coeurActive },
  ];

  // ── Cartes du bas : 3e carte selon le mode ───────────────────────────────
  const bottomCards = [
    isMenage
      ? {
          key: "deleted",
          emoji: "🗑",  label: "Corbeille",  count: deleted.length,
          sub: `${deletedSize.toFixed(0)} Mo`, bg: "#f5e8e8", color: C.red,
          nav: () => navigation.navigate("Gallery", { section: "deleted" }),
        }
      : {
          key: "partners",
          emoji: "🤝", label: "Partenaires", count: 3,
          sub: "bientôt", bg: "#eef0f4", color: C.textMuted, disabled: true,
          nav: () => Alert.alert("Bientôt disponible", "L'impression de tes souvenirs arrive bientôt 🌸"),
        },
    isMenage
      ? {
          key: "rappels",
          emoji: "🔔", label: "Rappels",
          count: notificationFrequency !== "off" ? "ACTIF" : "INACTIF",
          sub: {
            off:         "désactivé",
            daily:       "quotidien",
            twice_daily: "2 fois / jour",
            every2days:  "tous les 2 jours",
            weekly:      "hebdomadaire",
          }[notificationFrequency] ?? "désactivé",
          bg: "#f0f0ff",
          color: notificationFrequency !== "off" ? C.accent : C.textMuted,
          nav: () => navigation.navigate("Rappels"),
        }
      : {
          key: "album",
          emoji: "🗂️", label: "Mes albums", count: albums.length,
          sub: `album${albums.length > 1 ? "s" : ""}`, bg: "#e6f4f2", color: C_ALBUM,
          nav: () => navigation.navigate("Gallery", { section: "album" }),
        },
    isMenage
      ? {
          key: "kept",
          emoji: "❤️", label: "Coup de ❤️", count: kept.length,
          sub: `${kept.length} photo${kept.length > 1 ? "s" : ""}`, bg: "#e6f0ea", color: C.green,
          nav: () => navigation.navigate("Gallery", { section: "kept" }),
        }
      : {
          key: "kept",
          emoji: "❤️", label: "Coups de cœur", count: kept.length,
          sub: `${kept.length} photo${kept.length > 1 ? "s" : ""}`, bg: "#e6f0ea", color: C.green,
          nav: () => navigation.navigate("Gallery", { section: "kept" }),
        },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} {...screenPan.panHandlers}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 33, fontWeight: "900", color: C.accent }}>Pellicule</Text>
              <Image source={require("../assets/icon.png")} style={{ width: 36, height: 36, borderRadius: 8 }} />
            </View>
            <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>Tes souvenirs méritent mieux</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("Settings")}
            style={{ backgroundColor: C.bgCard, borderRadius: 14, padding: 11, borderWidth: 1, borderColor: C.border }}
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
            { key: "menage", label: "🔀 Tri",            color: C.accent },
            { key: "album",  label: "📔 Créer un album",  color: C_ALBUM },
          ].map((m) => {
            const active = activeMode === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => switchMode(m.key)}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 11,
                  alignItems: "center",
                  backgroundColor: active ? m.color : "transparent",
                }}
              >
                <Text style={{
                  fontSize: 14,
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
            marginBottom: 12,
            opacity: libraryLoading || albumFiltering || queue.length === 0 ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>
            {ctaLabel()}
          </Text>
          {!libraryLoading && !albumFiltering && queue.length > 0 && (
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 3 }}>
              {isMenage
                ? `${libraryPhotos.length - triees} restantes à trier`
                : "Toutes tes photos sauf les supprimées"}
            </Text>
          )}
        </TouchableOpacity>

        {/* ── Filtres : compacts et centrés sous le CTA (2 lignes max) ──── */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginBottom: 12, alignItems: "center" }}>
          {/* En mode album, les chips ci-dessous sont des filtres : on l'indique avec un entonnoir */}
          {!isMenage && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 2 }}>
              <Text style={{ fontSize: 13, color: C_ALBUM }}>🔻</Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: C_ALBUM }}>Filtres</Text>
            </View>
          )}
          {dateFilters.map((f) => (
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
              <Text style={{ fontSize: 12, fontWeight: "700", color: activeFilter === f ? "#fff" : C.textMuted }}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}

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
            <Text style={{ fontSize: 12, fontWeight: "700", color: selectedAlbum ? modeColor : C.textMuted, maxWidth: 90 }} numberOfLines={1}>
              {selectedAlbum ? selectedAlbum.title : "Dossiers"}
            </Text>
            {selectedAlbum
              ? <TouchableOpacity onPress={clearAlbum} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={{ fontSize: 11, color: C.textMuted }}>✕</Text></TouchableOpacity>
              : <Text style={{ fontSize: 11, color: C.textMuted }}>▾</Text>}
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
              <Text style={{ fontSize: 12, fontWeight: "700", color: randomFiftyActive ? "#fff" : C.textMuted }}>
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
              <Text style={{ fontSize: 12, fontWeight: "700", color: activeFilter === "Screenshots" ? "#fff" : C.textMuted }}>
                Screenshots
              </Text>
            </TouchableOpacity>
          )}

          {albumFiltering && <ActivityIndicator size="small" color={modeColor} />}
        </View>

        {/* ── Barre des filtres combinés (mode album) ──────────────────── */}
        {!isMenage && (
          <AlbumFiltersBar
            filters={albumFilters}
            matchCount={queue.length}
            onRemove={removeAlbumFilter}
            onClear={clearAlbumFilters}
          />
        )}

        {/* ── Grille 2×2 ──────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 10 }}>
          {gridItems.map((t) => (
            <View key={t.label} style={{ width: "50%", padding: 4 }}>
              <TouchableOpacity
                onPress={t.onPress}
                style={{
                  backgroundColor: t.active ? `${modeColor}15` : C.bgCard,
                  borderRadius: 16, padding: 12, alignItems: "center",
                  borderWidth: t.active ? 1.5 : 1,
                  borderColor: t.active ? modeColor : C.border,
                  opacity: t.disabled ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 22, marginBottom: 4 }}>{t.emoji}</Text>
                <Text style={{ fontWeight: "700", fontSize: 13, color: C.text, textAlign: "center" }}>{t.label}</Text>
                <Text style={{ fontSize: 11, color: t.active ? modeColor : C.textMuted, marginTop: 1, textAlign: "center" }}>{t.desc}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* ── Mode ALBUM : produits d'impression ─────────────────────── */}
        {!isMenage && (
          <>
            {/* Titre section */}
            <Text style={{ fontWeight: "800", fontSize: 12, color: C_ALBUM, marginBottom: 8, letterSpacing: 0.5 }}>
              🎁 IMPRIMER TES SOUVENIRS · BIENTÔT
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
                  onPress={() => Alert.alert("Bientôt disponible", "L'impression de tes souvenirs arrive bientôt 🌸")}
                  style={{
                    width: 108,
                    backgroundColor: prod.bg,
                    borderRadius: 16,
                    padding: 14,
                    alignItems: "center",
                    borderWidth: 1.5,
                    borderColor: prod.color + "40",
                    opacity: 0.5,
                  }}
                >
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>{prod.emoji}</Text>
                  <Text style={{ fontWeight: "800", fontSize: 12, color: prod.color, textAlign: "center" }}>{prod.label}</Text>
                  <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3, textAlign: "center" }}>{prod.desc}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Stats + avancement (mode ménage uniquement) ─────────────── */}
        {isMenage && (
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

              {/* Estimation du nombre de sessions avant le tri complet */}
              {progressPct < 100 && (() => {
                const reste    = libraryPhotos.length - triees;
                const sessions = Math.ceil(reste / randomCount);
                return (
                  <Text style={{ fontSize: 11, fontWeight: "700", color: C.accent, marginTop: 6 }}>
                    ≈ {sessions} session{sessions > 1 ? "s" : ""} de {randomCount} photos avant le tri complet
                  </Text>
                );
              })()}
            </View>
          )}
        </View>
        )}

        {/* ── 3 sections côte à côte ───────────────────────────────────── */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {bottomCards.map((s) => (
            <TouchableOpacity
              key={s.key}
              onPress={s.nav}
              style={{
                flex: 1, backgroundColor: C.bgCard, borderRadius: S.radius,
                padding: 11, borderWidth: 1, borderColor: C.border, alignItems: "center",
                opacity: s.disabled ? 0.5 : 1,
              }}
            >
              <View style={{ width: 40, height: 40, backgroundColor: s.bg, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                <Text style={{ fontSize: 18 }}>{s.emoji}</Text>
              </View>
              <Text style={{ fontSize: 19, fontWeight: "900", color: s.color }}>{s.count}</Text>
              <Text style={{ fontSize: 11, fontWeight: "700", color: C.text, marginTop: 2 }}>{s.label}</Text>
              <Text style={{ fontSize: 9, color: C.textMuted, marginTop: 1, textAlign: "center" }}>{s.sub}</Text>
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
