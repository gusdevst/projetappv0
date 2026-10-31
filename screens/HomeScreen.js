// screens/HomeScreen.js
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ScrollView,
  StatusBar,
  View,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Linking,
  PanResponder,
} from "react-native";
import Text from "../components/AppText";
import HomeHeader from "../components/home/HomeHeader";
import TriHero from "../components/home/TriHero";
import FolderSheet from "../components/home/FolderSheet";
import Icon from "../components/Icons";
import { SectionTitle, ListRow, SHADOW } from "../components/home/ui";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";

import { C, FONT } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { getAlbums, getAlbumAssetIds } from "../services/photoLibrary";
import { RangeCalendarPicker, dateLabel } from "../components/RangeCalendarPicker";
import { useNotificationReminder } from "../hooks/useNotificationReminder";
import { ProgressCard } from "../components/ProgressCard";
import { BadgeUnlockBanner, RankUnlockModal } from "../components/AchievementUnlocks";

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

// Nombre de sessions par jour selon la fréquence des rappels.
// Pas de rappel = 1 session = 1 jour.
const SESSIONS_PER_DAY = { off: 1, daily: 1, twice_daily: 2, every2days: 0.5, weekly: 1 / 7 };
const RHYTHM_LABEL = {
  off: "par jour", daily: "par jour", twice_daily: "2 fois par jour",
  every2days: "tous les 2 jours", weekly: "par semaine",
};


const iconBox = { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" };

// Période couverte par une sélection : « du 3 juin au 28 août 2026 »,
// « en août 2026 » (même mois), « le 14 juillet 2026 » (même jour).
function periodLabel(photos) {
  let min = Infinity, max = -Infinity;
  for (const p of photos) {
    const t = p.creationTime;
    if (!t) continue;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  if (!isFinite(min)) return "";
  const a = new Date(min), b = new Date(max);
  const fmt = (d, opts) => d.toLocaleDateString("fr-FR", opts);
  const dayMonth = (d) => (d.getDate() === 1 ? "1er " : `${d.getDate()} `) + fmt(d, { month: "long" });
  if (a.toDateString() === b.toDateString()) return `le ${dayMonth(a)} ${a.getFullYear()}`;
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return `en ${fmt(a, { month: "long", year: "numeric" })}`;
  if (a.getFullYear() === b.getFullYear()) return `du ${dayMonth(a)} au ${dayMonth(b)} ${b.getFullYear()}`;
  return `du ${dayMonth(a)} ${a.getFullYear()} au ${dayMonth(b)} ${b.getFullYear()}`;
}

// Durée lisible : en jours jusqu'à 179, en mois à partir de 180.
function formatDuration(days) {
  if (days >= 180) return { val: Math.round(days / 30), unit: "mois" };
  return { val: days, unit: days > 1 ? "jours" : "jour" };
}

// Garde les photos prises entre deux dates (journées entières incluses).
// to absent = jusqu'à aujourd'hui.
function inDateRange(photos, range) {
  if (!range) return photos;
  const f = range.from;
  const from = new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
  const to = range.to
    ? new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate(), 23, 59, 59, 999).getTime()
    : Infinity;
  return photos.filter((p) => p.creationTime >= from && p.creationTime <= to);
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

// Filtres autorisés selon le mode :
// - Tri   : pas de pastilles (dates → calendrier « Par date »), seulement Screenshots via « Dossiers »
// - Album : "Toutes" et l'année en cours, en pastilles
const MENAGE_FILTERS = ["Toutes", "Screenshots"];
const ALBUM_DATE_FILTERS  = ["Toutes"]; // plus de pastilles en mode Album (30 oct.)

export function HomeScreen({ navigation, route }) {
  const kept              = usePhotoStore((state) => state.kept);
  const deleted           = usePhotoStore((state) => state.deleted);
  const printed           = usePhotoStore((state) => state.printed);
  const skipped           = usePhotoStore((state) => state.skipped);
  const libraryPhotos     = usePhotoStore((state) => state.libraryPhotos);
  const libraryTotalCount = usePhotoStore((state) => state.libraryTotalCount);
  const libraryLoading    = usePhotoStore((state) => state.libraryLoading);
  const randomCount            = usePhotoStore((state) => state.randomCount);
  const setRandomCount         = usePhotoStore((state) => state.setRandomCount);
  const shuffleOn              = usePhotoStore((state) => state.shuffleOn);
  const setShuffleOn           = usePhotoStore((state) => state.setShuffleOn);
  const albums                 = usePhotoStore((state) => state.albums);
  const notificationFrequency  = usePhotoStore((state) => state.notificationFrequency);
  const albumFilters      = usePhotoStore((state) => state.albumFilters);
  const removeAlbumFilter = usePhotoStore((state) => state.removeAlbumFilter);
  const clearAlbumFilters = usePhotoStore((state) => state.clearAlbumFilters);
  const addAlbumFilter    = usePhotoStore((state) => state.addAlbumFilter);
  const emptyTrash        = usePhotoStore((state) => state.emptyTrash);
  const dailyLog          = usePhotoStore((state) => state.dailyLog); // carnet de bord → carte progression

  // ── Mode actif : ménage (orange) ou album (violet) ──────────────────────
  const activeMode  = usePhotoStore((state) => state.homeMode);
  const setHomeMode = usePhotoStore((state) => state.setHomeMode);
  const isMenage = activeMode === "menage";
  const modeColor = isMenage ? C.accent : C_ALBUM;

  const [activeFilter, setActiveFilter] = useState("Toutes");

  // Brique "Par date" : période choisie au calendrier (mode Tri), ouverte depuis l'accueil.
  const [dateRange, setDateRange]       = useState(null); // { from: Date, to: Date|null } | null
  const [showCalendar, setShowCalendar] = useState(false);

  // Filtres date proposés selon le mode actif

  // Bascule de mode : réinitialise le filtre s'il n'existe pas dans le nouveau mode
  function switchMode(key) {
    setHomeMode(key);
  }

  // Quand le mode change (ici ou depuis le bouton central de la barre du bas) :
  // on efface la période et on remet un filtre valide pour ce mode.
  useEffect(() => {
    setDateRange(null);
    const allowed = activeMode === "menage" ? MENAGE_FILTERS : ALBUM_DATE_FILTERS;
    setActiveFilter((f) => (allowed.includes(f) ? f : "Toutes"));
  }, [activeMode]);

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


  // Bouton 🔀 (mode Tri) : allumé = « Lancer un tri » pioche randomCount photos au hasard.
  function toggleShuffle() {
    const next = !shuffleOn;
    setShuffleOn(next);
    if (next) maybePromptNotifications(); // 1er usage : propose d'activer les rappels
  }

  // ── Queues ───────────────────────────────────────────────────────────────
  const deletedSize = deleted.reduce((a, p) => a + p.size, 0);

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

  // Les photos supprimées pour de bon (corbeille vidée) ont quitté la photothèque :
  // on les compte quand même comme triées, sinon le % baisserait après « Vider ».
  const purgedCount = usePhotoStore((state) => state.purgedCount) || 0;
  const triees      = menageExcludedIds.size + purgedCount;
  const totalGalerie = libraryPhotos.length + purgedCount;
  const progressPct = totalGalerie > 0
    ? Math.min(100, (triees / totalGalerie) * 100) : 0;

  // ── Carte "objectif" du mode Tri ─────────────────────────────────────────
  const resteATrier = Math.max(0, totalGalerie - triees);
  const sessionsRestantes = Math.ceil(resteATrier / randomCount);
  const joursRestants = Math.ceil(sessionsRestantes / (SESSIONS_PER_DAY[notificationFrequency] ?? 1));
  const duree = formatDuration(joursRestants);

  // Filtres du mode Album, rangés par ligne : lieux (« Par lieu ») et le reste = périodes (« Par date »).
  const placeFilters = albumFilters.filter((f) => f.type === "lieu");
  const dateFilters  = albumFilters.filter((f) => f.type !== "lieu");

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
  const filteredPool = inDateRange(applyFilter(remaining, activeFilter), dateRange);
  const queue = filteredPool;

  // ── Navigation CTA ───────────────────────────────────────────────────────
  function handleCTA() {
    if (queue.length === 0) return;
    if (isMenage) {
      // En mode ménage on va directement au swipe, sans passer par la question
      const q = shuffleOn
        ? [...filteredPool].sort(() => Math.random() - 0.5).slice(0, randomCount)
        : queue;
      if (shuffleOn) usePhotoStore.getState().bumpShuffleLaunch(); // badge « Joueur »
      navigation.navigate("Swipe", { queue: q, mode: "menage" });
    } else {
      navigation.navigate("TriMode", { preQueue: queue, skipToAlbum: true });
    }
  }

  // ── Corbeille + rappel (mode Tri) ────────────────────────────────────────
  const [emptying, setEmptying] = useState(false);

  // Vider la corbeille : toujours une confirmation avant la suppression définitive.
  function handleEmptyTrash() {
    Alert.alert(
      "Vider la corbeille",
      `Supprimer définitivement ${deleted.length} photo${deleted.length > 1 ? "s" : ""} ? Sur iPhone, elles restent récupérables 30 jours dans « Supprimés récemment ».`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer", style: "destructive",
          onPress: async () => {
            setEmptying(true);
            const ok = await emptyTrash();
            setEmptying(false);
            if (!ok) Alert.alert("Erreur", "La suppression a échoué. Vérifie que Pellicule a le droit de supprimer des photos.");
          },
        },
      ]
    );
  }

  // ── Calendrier "Par date" ────────────────────────────────────────────────
  // Année de la plus vieille photo → borne basse du sélecteur d'année.
  const minYear = useMemo(() => {
    let min = new Date().getFullYear();
    for (const p of libraryPhotos) {
      const y = new Date(p.creationTime).getFullYear();
      if (y < min) min = y;
    }
    return min;
  }, [libraryPhotos]);

  const rangeLabel = (r) => r.label || `${dateLabel(r.from)}${r.to ? ` → ${dateLabel(r.to)}` : " → auj."}`;

  // Raccourcis du calendrier « Par date » (remplacent les anciens filtres du mode Tri).
  const dateShortcuts = useMemo(() => {
    const t = new Date();
    const today0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    return [
      { label: "7 derniers jours", from: new Date(t.getFullYear(), t.getMonth(), t.getDate() - 6), to: today0 },
      { label: "Mois dernier",     from: new Date(t.getFullYear(), t.getMonth() - 1, 1),        to: new Date(t.getFullYear(), t.getMonth(), 0) },
      { label: String(t.getFullYear()), from: new Date(t.getFullYear(), 0, 1),                  to: today0 },
    ];
  }, []);

  function handleCalendarConfirm(from, to, label) {
    setShowCalendar(false);
    const range = { from, to: to || null, label: label || null };
    if (isMenage) {
      // TRI : la période devient le filtre actif → le gros bouton trie cette période.
      setDateRange(range);
    } else {
      // ALBUM : la période s'ajoute aux filtres combinés (comme avant depuis l'écran Moments).
      const deletedIds = new Set(deleted.map((p) => p.id));
      const photos = inDateRange(libraryPhotos.filter((p) => !deletedIds.has(p.id)), range);
      if (photos.length === 0) {
        Alert.alert("Aucune photo", "Aucune photo n'a été prise sur cette période.");
        return;
      }
      // Une seule période à la fois (la ✕ de « Par date » l'efface) : on remplace l'ancienne.
      albumFilters.filter((f) => f.type !== "lieu").forEach((f) => removeAlbumFilter(f.id));
      addAlbumFilter({
        id: `date-${from.getTime()}_${to ? to.getTime() : "now"}`,
        type: "date",
        label: rangeLabel(range),
        photoIds: photos.map((p) => p.id),
      });
    }
  }


  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg }} {...screenPan.panHandlers}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── En-tête : logo + pastille du mode (la bascule est dans la barre du bas) ── */}
        <HomeHeader activeMode={activeMode} onSwitchMode={switchMode} />

        {/* ── Mode TRI : héros (jours restants, session, 🔀, Lancer un tri) ── */}
        {isMenage && (() => {
          const loading = libraryLoading || albumFiltering;
          const count = shuffleOn ? Math.min(randomCount, filteredPool.length) : queue.length;
          return (
            <TriHero
              allSorted={progressPct >= 100}
              dureeVal={duree.val}
              dureeUnit={duree.unit}
              rhythmLabel={RHYTHM_LABEL[notificationFrequency] ?? "par jour"}
              progressPct={progressPct}
              triees={triees}
              totalGalerie={totalGalerie}
              randomCount={randomCount}
              onChangeRandomCount={setRandomCount}
              shuffleOn={shuffleOn}
              onToggleShuffle={toggleShuffle}
              ctaTitle={loading ? "Chargement de tes photos…"
                : count === 0 ? "Rien à trier ici"
                : shuffleOn ? "Lancer un tri aléatoire" : "Lancer un tri"}
              ctaSub={loading || count === 0 ? null
                : shuffleOn ? `${count} photo${count > 1 ? "s" : ""} au hasard`
                : `${count} photo${count > 1 ? "s" : ""}`}
              ctaDisabled={loading || count === 0}
              onLaunch={handleCTA}
              trashCount={deleted.length}
              trashSizeLabel={formatSize(deletedSize)}
              onOpenTrash={() => navigation.navigate("Gallery", { section: "deleted" })}
              onEmptyTrash={handleEmptyTrash}
              emptying={emptying}
            />
          );
        })()}

        {/* ── Mode ALBUM : héros « Ton prochain album » (filtres, mosaïque, bouton) ── */}
        {!isMenage && (() => {
          const busy = libraryLoading || albumFiltering;
          const preview = queue.slice(0, 3);
          const extra = Math.max(0, queue.length - 3);
          const tile = (p, style) => p
            ? <ExpoImage key={p.id} source={{ uri: p.url }} contentFit="cover" style={[{ borderRadius: 16, backgroundColor: C.albumSoft }, style]} />
            : <View style={[{ borderRadius: 16, backgroundColor: C.albumSoft }, style]} />;
          return (
            <View>
              <View style={{ alignItems: "center", marginTop: 6 }}>
                <Text style={{ color: C.album }}>
                  <Text style={{ fontSize: 38, fontWeight: "600" }}>{queue.length} </Text>
                  <Text style={{ fontSize: 20, fontWeight: "600" }}>photo{queue.length > 1 ? "s" : ""}</Text>
                </Text>
                {/* Poids de la sélection (Mo / Go) + période couverte */}
                {queue.length > 0 && (
                  <>
                    <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 1 }}>
                      {formatSize(queue.reduce((t, p) => t + (p.size || 0), 0))}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <Icon name="calendar" size={14} color={C.album} />
                      <Text style={{ fontSize: 13, color: C.text }}>{periodLabel(queue)}</Text>
                    </View>
                  </>
                )}
              </View>


              {/* Mosaïque : 1 grande photo + 2 petites (la dernière affiche "+N") */}
              {preview.length > 0 ? (
                <View style={{ flexDirection: "row", gap: 7, height: 175, marginTop: 10 }}>
                  {tile(preview[0], { flex: 1.6, height: 175 })}
                  <View style={{ flex: 1, gap: 7 }}>
                    {tile(preview[1], { flex: 1 })}
                    <View style={{ flex: 1 }}>
                      {tile(preview[2], { flex: 1 })}
                      {extra > 0 && (
                        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16, backgroundColor: "rgba(35,39,31,0.42)", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>+{extra}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ) : (
                <View style={{ height: 120, marginTop: 10, borderRadius: 16, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: C.textMid, fontSize: 12.5 }}>{busy ? "Chargement de tes photos…" : "Aucune photo avec ces filtres"}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleCTA}
                disabled={busy || queue.length === 0}
                style={{ marginTop: 16, backgroundColor: C.album, borderRadius: 16, paddingVertical: 11, alignItems: "center",
                  opacity: busy || queue.length === 0 ? 0.6 : 1,
                  shadowColor: C.album, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 4 }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>
                  {busy ? "Chargement…" : queue.length === 0 ? "Ajuste tes filtres" : "Créer l'album"}
                </Text>
                {!busy && queue.length > 0 && (
                  <Text style={{ fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.85)", marginTop: 1 }}>
                    {queue.length} photo{queue.length > 1 ? "s" : ""}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Affiner la sélection */}
              <SectionTitle title="Affiner la sélection" />
              <View style={{ gap: 9 }}>
                {/* Filtres actifs affichés dans leur ligne, avec ✕ (comme en mode Tri) */}
                <ListRow
                  icon="calendar" iconColor={C.album} iconBg={C.albumSoft} title="Par date"
                  sub={dateFilters.length ? dateFilters.map((f) => f.label).join(" · ") : "Choisis une période"}
                  subColor={dateFilters.length ? C.album : undefined}
                  active={dateFilters.length > 0} activeColor={C.album}
                  right={dateFilters.length ? "close" : "chevron"}
                  onClear={() => dateFilters.forEach((f) => removeAlbumFilter(f.id))}
                  onPress={() => setShowCalendar(true)}
                />
                <ListRow
                  icon="pin" iconColor={C.album} iconBg={C.albumSoft} title="Par lieu"
                  sub={placeFilters.length ? placeFilters.map((f) => f.label).join(" · ") : "Choisis sur la carte"}
                  subColor={placeFilters.length ? C.album : undefined}
                  active={placeFilters.length > 0} activeColor={C.album}
                  right={placeFilters.length ? "close" : "chevron"}
                  onClear={() => placeFilters.forEach((f) => removeAlbumFilter(f.id))}
                  onPress={() => navigation.navigate("Map", { mode: "album" })}
                />
                <ListRow
                  icon="folder" iconColor={C.album} iconBg={C.albumSoft} title="Dossiers"
                  sub={selectedAlbum ? selectedAlbum.title : "Dossiers du téléphone"}
                  subColor={selectedAlbum ? C.album : undefined}
                  active={!!selectedAlbum} activeColor={C.album}
                  right={selectedAlbum ? "close" : (albumFiltering ? <ActivityIndicator size="small" color={C.album} /> : "chevron")}
                  onClear={clearAlbum}
                  onPress={openAlbumPicker}
                />
              </View>
            </View>
          );
        })()}

        {/* ── Mode TRI : Trier autrement ───────────────────────────────── */}
        {isMenage && (() => {
          const screenshotsOn = activeFilter === "Screenshots";
          const folderOn = !!selectedAlbum || screenshotsOn;
          return (
            <View>
              <SectionTitle title="Trier autrement" />
              <View style={{ gap: 9 }}>
                <ListRow icon="sameInstant" title="Même instant" sub="Prises à quelques secondes" onPress={() => navigation.navigate("Duplicates")} />
                <ListRow
                  icon="calendar" title="Par date"
                  sub={dateRange ? rangeLabel(dateRange) : "Choisis une période"}
                  subColor={dateRange ? C.accent : undefined}
                  active={!!dateRange}
                  right={dateRange ? "close" : "chevron"}
                  onClear={() => setDateRange(null)}
                  onPress={() => setShowCalendar(true)}
                />
                <ListRow
                  icon="folder" title="Dossiers"
                  sub={screenshotsOn ? "Screenshots" : selectedAlbum ? selectedAlbum.title : "Screenshots et dossiers du téléphone"}
                  subColor={folderOn ? C.accent : undefined}
                  active={folderOn}
                  right={folderOn ? "close" : (albumFiltering ? <ActivityIndicator size="small" color={C.accent} /> : "chevron")}
                  onClear={() => { clearAlbum(); setActiveFilter("Toutes"); }}
                  onPress={openAlbumPicker}
                />
              </View>

              {/* Progression de la semaine. Tap → écran Progression. */}
              <View style={{ marginTop: 14 }}>
                <ProgressCard dailyLog={dailyLog} onPress={() => navigation.navigate("ProgressTab")} />
              </View>
            </View>
          );
        })()}

      </ScrollView>


      {/* ── Calendrier de la brique "Par date" ──────────────────────── */}
      <RangeCalendarPicker
        visible={showCalendar}
        initialFrom={dateRange?.from ?? null}
        initialTo={dateRange?.to ?? null}
        accent={modeColor}
        minYear={minYear}
        shortcuts={dateShortcuts}
        onConfirm={handleCalendarConfirm}
        onCancel={() => setShowCalendar(false)}
      />

      {/* ── Feuille « Choisir un dossier » ─────────────────────────── */}
      <FolderSheet
        visible={showAlbumModal}
        onClose={() => setShowAlbumModal(false)}
        color={modeColor}
        libraryCount={libraryPhotos.length}
        showScreenshots={isMenage}
        screenshotCount={libraryPhotos.filter((p) => p.isScreenshot && !excludedIds.has(p.id)).length}
        screenshotsActive={activeFilter === "Screenshots"}
        onPickScreenshots={() => { clearAlbum(); setActiveFilter("Screenshots"); setShowAlbumModal(false); }}
        folders={availableAlbums}
        loading={albumsLoading}
        selectedFolderId={selectedAlbum?.id ?? null}
        onPickAll={() => { clearAlbum(); setActiveFilter("Toutes"); setShowAlbumModal(false); }}
        onPickFolder={(f) => { if (activeFilter === "Screenshots") setActiveFilter("Toutes"); selectAlbum(f); }}
      />

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


      {/* Galons & badges : bandeau badge + fenêtre nouveau galon */}
      <BadgeUnlockBanner />
      <RankUnlockModal />
    </SafeAreaView>
  );
}

export default HomeScreen;
