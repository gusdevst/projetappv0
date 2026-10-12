// screens/HomeScreen.js
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ScrollView, StatusBar, View, Text, Image,
  TouchableOpacity, Alert, Modal, ActivityIndicator, Linking, PanResponder, Switch, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image as ExpoImage } from "expo-image";

import { C, S, FILTERS } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { getAlbums, getAlbumAssetIds } from "../services/photoLibrary";
import { AlbumFiltersBar } from "../components/AlbumFiltersBar";
import { RangeCalendarPicker, dateLabel } from "../components/RangeCalendarPicker";
import { useNotificationReminder } from "../hooks/useNotificationReminder";
import { cancelReminders } from "../services/notificationService";

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

// Rose des Coups de cœur.
const C_PINK = "#c4466a";

// "aujourd'hui", "hier", "il y a 3 j", "il y a 2 sem.", "il y a 4 mois"
function timeAgo(ts) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return "modifié aujourd'hui";
  if (days === 1) return "modifié hier";
  if (days < 7) return `il y a ${days} j`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  return `il y a ${Math.max(1, Math.floor(days / 30))} mois`;
}

// Ligne d'album : couverture + nom + sous-titre + menu "···".
function AlbumRow({ cover, title, badge, sub, onPress, onMenu }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderBottomWidth: 1, borderBottomColor: C.bgMuted }}
    >
      {cover
        ? <ExpoImage source={{ uri: cover }} contentFit="cover" style={{ width: 44, height: 44, borderRadius: 10 }} />
        : <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: C.bgMuted, alignItems: "center", justifyContent: "center" }}><Text>🖼</Text></View>}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: C.text }} numberOfLines={1}>{title}</Text>
          {badge && (
            <Text style={{ fontSize: 9, fontWeight: "800", color: C_PINK, backgroundColor: "#fbe9ef", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, overflow: "hidden" }}>{badge}</Text>
          )}
        </View>
        <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }} numberOfLines={1}>{sub}</Text>
      </View>
      <TouchableOpacity onPress={onMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: C.textMuted, letterSpacing: 1 }}>···</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// Titre de la ligne "rappel" selon la fréquence.
const REMINDER_TITLE = {
  off: "Rappels désactivés", daily: "Rappel quotidien", twice_daily: "Rappel 2 fois par jour",
  every2days: "Rappel tous les 2 jours", weekly: "Rappel hebdomadaire",
};
// Style commun des lignes corbeille / rappel.
const rowStyle = {
  flexDirection: "row", alignItems: "center", gap: 11,
  backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: C.border,
  paddingVertical: 11, paddingHorizontal: 12,
};
const iconBox = { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" };

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
  const emptyTrash        = usePhotoStore((state) => state.emptyTrash);
  const renameAlbum       = usePhotoStore((state) => state.renameAlbum);
  const deleteAlbum       = usePhotoStore((state) => state.deleteAlbum);
  const freedMo           = usePhotoStore((state) => state.freedMo);
  const notificationHour   = usePhotoStore((state) => state.notificationHour);
  const notificationMinute = usePhotoStore((state) => state.notificationMinute);
  const setNotificationFrequency = usePhotoStore((state) => state.setNotificationFrequency);

  // ── Mode actif : ménage (orange) ou album (violet) ──────────────────────
  const [activeMode, setActiveMode] = useState("menage");
  const isMenage = activeMode === "menage";
  const modeColor = isMenage ? C.accent : C_ALBUM;

  const [activeFilter, setActiveFilter] = useState("Toutes");

  // Brique "Par date" : période choisie au calendrier (mode Tri), ouverte depuis l'accueil.
  const [dateRange, setDateRange]       = useState(null); // { from: Date, to: Date|null } | null
  const [showCalendar, setShowCalendar] = useState(false);

  // Filtres date proposés selon le mode actif
  const dateFilters = isMenage ? MENAGE_DATE_FILTERS : ALBUM_DATE_FILTERS;

  // Bascule de mode : réinitialise le filtre s'il n'existe pas dans le nouveau mode
  function switchMode(key) {
    setActiveMode(key);
    setRandomFiftyActive(false);
    setDateRange(null);
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

  // ── Carte "objectif" du mode Tri ─────────────────────────────────────────
  const resteATrier = Math.max(0, libraryPhotos.length - triees);
  const trieesSize  = libraryPhotos.reduce((a, p) => (menageExcludedIds.has(p.id) ? a + p.size : a), 0);
  const sessionsRestantes = Math.ceil(resteATrier / randomCount);
  const joursRestants = Math.ceil(sessionsRestantes / (SESSIONS_PER_DAY[notificationFrequency] ?? 1));
  const duree = formatDuration(joursRestants);

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

  // ── Grille : 2 briques (Par date + 2e brique selon le mode) ──────────────────────────────────
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

  // Interrupteur du rappel : ON = rappel quotidien (heure des Réglages), OFF = tout annuler.
  async function toggleReminder(on) {
    if (on) {
      const result = await enableReminders("daily");
      if (!result?.success) {
        Alert.alert("Notifications bloquées", "Pour recevoir des rappels, autorise les notifications de Pellicule dans les Réglages de ton téléphone.");
      }
    } else {
      await cancelReminders();
      setNotificationFrequency("off");
    }
  }

  // ── Mes albums (mode Album) ──────────────────────────────────────────────
  const photoById = useMemo(() => new Map(libraryPhotos.map((p) => [p.id, p])), [libraryPhotos]);
  // Couverture = dernière photo ajoutée encore présente dans la photothèque.
  const albumCover = (a) => {
    for (let k = a.photoIds.length - 1; k >= 0; k--) {
      const p = photoById.get(a.photoIds[k]);
      if (p) return p.url;
    }
    return null;
  };
  // Date de modif : updatedAt, sinon la date de création cachée dans l'id ("album-<timestamp>").
  const albumTime = (a) => a.updatedAt || Number(String(a.id).replace("album-", "")) || 0;
  const recentAlbums = [...albums].sort((x, y) => albumTime(y) - albumTime(x)).slice(0, 3);

  const [renameTarget, setRenameTarget] = useState(null); // album en cours de renommage
  const [renameText, setRenameText]     = useState("");

  // Menu "···" d'un album. album = null → Coups de cœur (ni renommable, ni supprimable).
  function openAlbumMenu(album) {
    const soon = () => Alert.alert("Bientôt disponible", "L'impression de tes albums arrive bientôt 🌸");
    if (!album) {
      Alert.alert("Coups de cœur", "Album automatique : il se remplit quand tu touches ❤️ pendant le tri.", [
        { text: "Ouvrir", onPress: () => navigation.navigate("Gallery", { section: "kept" }) },
        { text: "Imprimer (bientôt)", onPress: soon },
        { text: "Fermer", style: "cancel" },
      ]);
      return;
    }
    Alert.alert(album.name, `${album.photoIds.length} photo${album.photoIds.length > 1 ? "s" : ""}`, [
      { text: "Renommer", onPress: () => { setRenameText(album.name); setRenameTarget(album); } },
      { text: "Imprimer (bientôt)", onPress: soon },
      {
        text: "Supprimer", style: "destructive",
        onPress: () => Alert.alert(
          "Supprimer l'album ?",
          `« ${album.name} » sera supprimé. Les photos restent sur ton téléphone.`,
          [{ text: "Annuler", style: "cancel" }, { text: "Supprimer", style: "destructive", onPress: () => deleteAlbum(album.id) }]
        ),
      },
      { text: "Annuler", style: "cancel" },
    ]);
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

  const rangeLabel = (r) => `${dateLabel(r.from)}${r.to ? ` → ${dateLabel(r.to)}` : " → auj."}`;

  function handleCalendarConfirm(from, to) {
    setShowCalendar(false);
    const range = { from, to: to || null };
    if (isMenage) {
      // TRI : la période devient le filtre actif → le gros bouton trie cette période.
      setDateRange(range);
      setActiveFilter("Toutes");
      setRandomFiftyActive(false);
    } else {
      // ALBUM : la période s'ajoute aux filtres combinés (comme avant depuis l'écran Moments).
      const deletedIds = new Set(deleted.map((p) => p.id));
      const photos = inDateRange(libraryPhotos.filter((p) => !deletedIds.has(p.id)), range);
      if (photos.length === 0) {
        Alert.alert("Aucune photo", "Aucune photo n'a été prise sur cette période.");
        return;
      }
      addAlbumFilter({
        id: `date-${from.getTime()}_${to ? to.getTime() : "now"}`,
        type: "date",
        label: rangeLabel(range),
        photoIds: photos.map((p) => p.id),
      });
    }
  }

  const gridItems = [
    {
      emoji: "📅", label: "Par date",
      desc: dateRange ? rangeLabel(dateRange) : "Choisis une période",
      active: !!dateRange,
      onClear: dateRange ? () => setDateRange(null) : null,
      onPress: () => setShowCalendar(true),
    },
    isMenage
      ? { emoji: "📷", label: "Même instant",  desc: "Prises à quelques secondes", onPress: () => navigation.navigate("Duplicates") }
      // Mode Album : "Par lieu" (le filtre ❤️ est une pastille dans la ligne des filtres)
      : { emoji: "🌍", label: "Par lieu", desc: "Choisis sur la carte", onPress: () => navigation.navigate("Map", { mode: "album" }) },
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

        {/* ── Mode TRI : carte objectif (avancement + jours restants + bouton) ── */}
        {isMenage && (
          <LinearGradient
            colors={C.accentGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderRadius: 22, padding: 18, marginBottom: 12 }}
          >
            {progressPct >= 100 ? (
              <Text style={{ fontSize: 26, fontWeight: "900", color: "#fff", marginBottom: 12 }}>🎉 Tout est trié !</Text>
            ) : (
              <>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.8)", letterSpacing: 0.6 }}>
                  PHOTOTHÈQUE TRIÉE DANS
                </Text>
                <Text style={{ color: "#fff", marginTop: 2 }}>
                  <Text style={{ fontSize: 40, fontWeight: "900" }}>≈ {duree.val} </Text>
                  <Text style={{ fontSize: 17, fontWeight: "800" }}>{duree.unit}</Text>
                </Text>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginBottom: 12 }}>
                  à raison d'une session de {randomCount} photos {RHYTHM_LABEL[notificationFrequency] ?? "par jour"}
                </Text>
              </>
            )}

            {/* Barre d'avancement */}
            <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
              <View style={{ height: 6, width: `${progressPct}%`, backgroundColor: "#fff", borderRadius: 3 }} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginBottom: 14 }}>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
                <Text style={{ fontWeight: "900" }}>{Math.round(progressPct)} %</Text> · {triees} triées
              </Text>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
                <Text style={{ fontWeight: "900" }}>{formatSize(trieesSize)}</Text> triés
              </Text>
            </View>

            {/* Bouton principal */}
            <TouchableOpacity
              onPress={handleCTA}
              disabled={libraryLoading || albumFiltering || queue.length === 0}
              style={{
                backgroundColor: "#fff", borderRadius: 16, paddingVertical: 15,
                alignItems: "center",
                opacity: libraryLoading || albumFiltering || queue.length === 0 ? 0.6 : 1,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "900", color: C.accent }}>
                {libraryLoading || albumFiltering
                  ? "Chargement de tes photos…"
                  : queue.length === 0
                  ? "Rien à trier ici"
                  : `▶ Faire le tri · ${queue.length} photo${queue.length > 1 ? "s" : ""}`}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        )}

        {/* ── Mode ALBUM : carte "Ton prochain album" (aperçu + bouton) ── */}
        {!isMenage && (() => {
          const busy = libraryLoading || albumFiltering;
          const preview = queue.slice(0, 5);
          const extra = Math.max(0, queue.length - 4);
          // Résumé des filtres actifs : filtres combinés + année + dossier
          const filterParts = [
            ...albumFilters.map((f) => f.label),
            ...(activeFilter !== "Toutes" ? [activeFilter] : []),
            ...(selectedAlbum ? [selectedAlbum.title] : []),
          ];
          const filterSummary = filterParts.length ? filterParts.join(" · ") : "Toutes tes photos";
          const thumb = (p, style) => (
            <ExpoImage key={p.id} source={{ uri: p.url }} contentFit="cover"
              style={[{ borderRadius: 8, backgroundColor: "rgba(255,255,255,0.18)" }, style]} />
          );
          return (
            <LinearGradient
              colors={[C_ALBUM, "#2f9488"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ borderRadius: 22, padding: 16, marginBottom: 12 }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.8)", letterSpacing: 0.6 }}>
                TON PROCHAIN ALBUM
              </Text>

              {/* Mosaïque : 1 grande photo + 4 petites (la dernière affiche "+N") */}
              {preview.length > 0 ? (
                <View style={{ flexDirection: "row", gap: 4, height: 96, marginTop: 10, marginBottom: 10 }}>
                  {thumb(preview[0], { flex: 2, height: 96 })}
                  <View style={{ flex: 2, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                    {preview.slice(1, 5).map((p, k) => (
                      <View key={p.id} style={{ width: "48%", height: 46 }}>
                        {thumb(p, { width: "100%", height: 46 })}
                        {k === 3 && extra > 0 && (
                          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 8,
                            backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>+{extra}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={{ height: 96, marginTop: 10, marginBottom: 10, borderRadius: 10,
                  backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>
                    {busy ? "Chargement de tes photos…" : "Aucune photo avec ces filtres"}
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
                <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.95)" }}>
                  <Text style={{ fontWeight: "900" }}>{queue.length} photo{queue.length > 1 ? "s" : ""}</Text> sélectionnée{queue.length > 1 ? "s" : ""}
                </Text>
                <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", flexShrink: 1, textAlign: "right" }} numberOfLines={1}>
                  {filterSummary}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleCTA}
                disabled={busy || queue.length === 0}
                style={{ backgroundColor: "#fff", borderRadius: 16, paddingVertical: 15, alignItems: "center",
                  opacity: busy || queue.length === 0 ? 0.6 : 1 }}
              >
                <Text style={{ fontSize: 16, fontWeight: "900", color: C_ALBUM }}>
                  {busy ? "Chargement…" : queue.length === 0 ? "Ajuste tes filtres" : `📔 Créer l'album · ${queue.length} photo${queue.length > 1 ? "s" : ""}`}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          );
        })()}

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
              onPress={() => { setActiveFilter(f); setDateRange(null); }}
              style={{
                paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99,
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

          {/* Mode Album : filtre Coups de cœur (on pioche dans l'album Coups de cœur) */}
          {!isMenage && (
            <TouchableOpacity
              onPress={toggleCoeurFilter}
              style={{
                flexDirection: "row", alignItems: "center", gap: 5,
                paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99,
                borderWidth: 1.5,
                borderColor: coeurActive ? C_PINK : C.border,
                backgroundColor: coeurActive ? C_PINK : C.bgCard,
              }}
            >
              <Text style={{ fontSize: 12 }}>❤️</Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: coeurActive ? "#fff" : C.textMuted }}>Coups de cœur</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={openAlbumPicker}
            style={{
              flexDirection: "row", alignItems: "center", gap: 5,
              paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99,
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
                paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99,
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
                paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99,
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

        {/* ── Grille des briques ──────────────────────────────────────────────── */}
        {/* Même taille de brique dans les 2 modes (50 %) ; seule, elle est centrée. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginHorizontal: -4, marginBottom: 10 }}>
          {gridItems.filter(Boolean).map((t) => (
            <View key={t.label} style={{ width: "50%", padding: 4 }}>
              <TouchableOpacity
                onPress={t.onPress}
                style={{
                  backgroundColor: t.active ? `${modeColor}15` : C.bgCard,
                  borderRadius: 20, paddingVertical: 20, paddingHorizontal: 12,
                  minHeight: 128, alignItems: "center", justifyContent: "center",
                  borderWidth: t.active ? 1.5 : 1,
                  borderColor: t.active ? modeColor : C.border,
                  opacity: t.disabled ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 34, marginBottom: 8 }}>{t.emoji}</Text>
                <Text style={{ fontWeight: "800", fontSize: 16, color: C.text, textAlign: "center" }}>{t.label}</Text>
                <Text style={{ fontSize: 12, color: t.active ? modeColor : C.textMuted, marginTop: 3, textAlign: "center" }} numberOfLines={2}>{t.desc}</Text>
                {/* Croix pour effacer la période choisie */}
                {t.onClear && (
                  <TouchableOpacity
                    onPress={t.onClear}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ position: "absolute", top: 8, right: 10 }}
                  >
                    <Text style={{ fontSize: 14, color: modeColor, fontWeight: "800" }}>✕</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* ── Mode TRI : corbeille + rappel (2 lignes d'action) ──────────── */}
        {isMenage && (
          <View style={{ gap: 8 }}>
            {/* Corbeille */}
            <TouchableOpacity
              onPress={() => navigation.navigate("Gallery", { section: "deleted" })}
              style={rowStyle}
            >
              <View style={[iconBox, { backgroundColor: "#f5e8e8" }]}><Text style={{ fontSize: 17 }}>🗑</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: C.text }}>
                  {deleted.length > 0
                    ? `${deleted.length} photo${deleted.length > 1 ? "s" : ""} à supprimer`
                    : "Corbeille vide"}
                </Text>
                {deleted.length > 0 && (
                  <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{formatSize(deletedSize)} à libérer</Text>
                )}
                {freedMo > 0 && (
                  <Text style={{ fontSize: 11, color: C.green, fontWeight: "700", marginTop: 2 }}>
                    💾 ≈ {formatSize(freedMo)} déjà libérés grâce à Pellicule
                  </Text>
                )}
              </View>
              {deleted.length > 0 && (
                <TouchableOpacity
                  onPress={handleEmptyTrash}
                  disabled={emptying}
                  style={{ backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9, opacity: emptying ? 0.6 : 1 }}
                >
                  {emptying
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>Vider</Text>}
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Rappel */}
            <TouchableOpacity onPress={() => navigation.navigate("Rappels")} style={rowStyle}>
              <View style={[iconBox, { backgroundColor: "#eaf0f8" }]}><Text style={{ fontSize: 17 }}>🔔</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: C.text }}>{REMINDER_TITLE[notificationFrequency] ?? "Rappels désactivés"}</Text>
                <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                  {notificationsEnabled ? "Pour garder le rythme" : "Active-les pour garder le rythme"}
                </Text>
              </View>
              {notificationsEnabled && (
                <View style={{ backgroundColor: "#eaf0f8", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 }}>
                  <Text style={{ color: C.accent, fontWeight: "800", fontSize: 12 }}>
                    {notificationHour}:{String(notificationMinute).padStart(2, "0")}
                  </Text>
                </View>
              )}
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleReminder}
                trackColor={{ true: C.green, false: C.border }}
                thumbColor="#fff"
              />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Mode ALBUM : liste "Mes albums" (Coups de cœur = album auto) ── */}
        {!isMenage && (
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginHorizontal: 3, marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: C.textMid, letterSpacing: 0.4 }}>
                MES ALBUMS · {albums.length + 1}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Gallery", { section: "album" })}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: C_ALBUM }}>Tout voir ›</Text>
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
              {/* Coups de cœur : toujours en premier, automatique */}
              <AlbumRow
                cover={kept[kept.length - 1]?.url}
                title="Coups de cœur"
                badge="AUTO"
                sub={`${kept.length} photo${kept.length > 1 ? "s" : ""} · rempli avec le ❤️`}
                onPress={() => navigation.navigate("Gallery", { section: "kept" })}
                onMenu={() => openAlbumMenu(null)}
              />
              {/* Albums créés, les plus récemment modifiés d'abord (3 max) */}
              {recentAlbums.map((a) => (
                <AlbumRow
                  key={a.id}
                  cover={albumCover(a)}
                  title={a.name}
                  sub={`${a.photoIds.length} photo${a.photoIds.length > 1 ? "s" : ""}${a.updatedAt ? ` · ${timeAgo(a.updatedAt)}` : ""}`}
                  onPress={() => navigation.navigate("Gallery", { section: "album", albumId: a.id })}
                  onMenu={() => openAlbumMenu(a)}
                />
              ))}
              {/* Nouvel album = créer un album à partir de la sélection actuelle */}
              <TouchableOpacity
                onPress={() => (queue.length > 0
                  ? handleCTA()
                  : Alert.alert("Aucune photo sélectionnée", "Choisis d'abord des photos avec les filtres au-dessus."))}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderTopWidth: 1, borderTopColor: C.bgMuted }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: C_ALBUM, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 20, color: C_ALBUM }}>＋</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "800", color: C_ALBUM }}>Nouvel album</Text>
              </TouchableOpacity>
            </View>

            {/* Partenaires d'impression : bandeau discret */}
            <TouchableOpacity
              onPress={() => Alert.alert("Bientôt disponible", "L'impression de tes albums arrive bientôt 🌸")}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, paddingVertical: 9, paddingHorizontal: 12,
                borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: C.border }}
            >
              <Text style={{ fontSize: 13 }}>🎁</Text>
              <Text style={{ flex: 1, fontSize: 12, fontWeight: "700", color: C.textMid }}>Imprimer tes albums</Text>
              <Text style={{ fontSize: 10, fontWeight: "800", color: C.textMuted, backgroundColor: C.bgMuted, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: "hidden" }}>BIENTÔT</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* ── Renommer un album ─────────────────────────────────────── */}
      <Modal visible={!!renameTarget} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: C.text, marginBottom: 12 }}>Renommer l'album</Text>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              placeholder="Nom de l'album"
              style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 15, color: C.text }}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity onPress={() => setRenameTarget(null)}
                style={{ flex: 1, padding: 13, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, alignItems: "center" }}>
                <Text style={{ color: C.textMuted, fontWeight: "700" }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { renameAlbum(renameTarget.id, renameText); setRenameTarget(null); }}
                style={{ flex: 1, padding: 13, borderRadius: 12, backgroundColor: C_ALBUM, alignItems: "center" }}>
                <Text style={{ color: "#fff", fontWeight: "800" }}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Calendrier de la brique "Par date" ──────────────────────── */}
      <RangeCalendarPicker
        visible={showCalendar}
        initialFrom={dateRange?.from ?? null}
        initialTo={dateRange?.to ?? null}
        accent={modeColor}
        minYear={minYear}
        onConfirm={handleCalendarConfirm}
        onCancel={() => setShowCalendar(false)}
      />

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
