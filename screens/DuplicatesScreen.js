// screens/DuplicatesScreen.js
import { useMemo, useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity,
  StatusBar, Dimensions, Modal, FlatList, Platform, Animated, ActivityIndicator, Alert,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { findDuplicates } from "../services/photoAnalysis";
import { ZoomableImage } from "../components/ZoomableImage";
import BackButton from "../components/BackButton";

let NavigationBar = null;
try { NavigationBar = require("expo-navigation-bar"); } catch (e) {}

const { width: SW, height: SH } = Dimensions.get("window");
const PHOTO_SIZE = (SW - S.pad * 2 - 28 - 28 - 8) / 2;
const THUMB_SIZE = 56;

// Helpers halo (identiques à SwipeScreen)
function getEdgeContainerStyle(edge) {
  if (edge === "up")    return { position: "absolute", top: 0,    left: 0, right: 0, height: 220 };
  if (edge === "down")  return { position: "absolute", bottom: 0, left: 0, right: 0, height: 220 };
  if (edge === "left")  return { position: "absolute", top: 0, bottom: 0, left: 0,  width: 200 };
  if (edge === "right") return { position: "absolute", top: 0, bottom: 0, right: 0, width: 200 };
  return null;
}
function getEdgeGradient(edge, color) {
  if (edge === "up")    return { colors: [color, "transparent"], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } };
  if (edge === "down")  return { colors: ["transparent", color], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } };
  if (edge === "left")  return { colors: [color, "transparent"], start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
  if (edge === "right") return { colors: ["transparent", color], start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
  return { colors: ["transparent", "transparent"] };
}

// Limite une liste de groupes à un nombre de regroupements donné.
function capGroups(groups, maxGroups) {
  if (!maxGroups) return groups;
  return groups.slice(0, maxGroups);
}

// Options de tri disponibles dans le menu des doublons.
const SORT_OPTIONS = [
  { key: "recent", label: "Plus récent", icon: "🕐" },
  { key: "old",    label: "Plus vieux",  icon: "📅" },
  { key: "count",  label: "Plus nombreux", icon: "🔢" },
];

// Trie une liste de groupes de doublons selon le mode choisi par l'utilisateur.
function sortGroups(groups, sortMode) {
  const sorted = [...groups];
  if (sortMode === "old") {
    sorted.sort((a, b) => a.photos[0].creationTime - b.photos[0].creationTime);
  } else if (sortMode === "count") {
    sorted.sort((a, b) => b.photos.length - a.photos.length);
  } else {
    sorted.sort((a, b) => b.photos[0].creationTime - a.photos[0].creationTime);
  }
  return sorted;
}

export function DuplicatesScreen({ navigation, route }) {
  // maxGroups : limite optionnelle (ex: batch de 5 regroupements depuis la notification quotidienne).
  // Absent quand l'écran est ouvert depuis le menu → tous les doublons sont affichés.
  const maxGroups           = route?.params?.maxGroups ?? null;
  const libraryPhotos       = usePhotoStore((s) => s.libraryPhotos);
  const deleted             = usePhotoStore((s) => s.deleted);
  const skipped             = usePhotoStore((s) => s.skipped);
  const kept                = usePhotoStore((s) => s.kept);
  const addDeleted          = usePhotoStore((s) => s.addDeleted);
  const addSkipped          = usePhotoStore((s) => s.addSkipped);
  const addKept             = usePhotoStore((s) => s.addKept);
  const undoLast            = usePhotoStore((s) => s.undoLast);

  const [rawGroups, setRawGroups]               = useState(null); // null = calcul en cours, groupes non triés
  const [sortMode, setSortMode]                 = useState("recent"); // "recent" | "old" | "count"
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(null);
  const [fullscreen, setFullscreen]             = useState(null);
  // Historique pour le undo (snapshots du store avant chaque action)
  const [history, setHistory]                   = useState([]);
  const [nextGroupToast, setNextGroupToast]     = useState(false);

  const flatListRef     = useRef(null);
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const [feedbackColor, setFeedbackColor] = useState("rgba(232,99,122,0.7)");
  const [feedbackEdge,  setFeedbackEdge]  = useState(null);

  // ── Masquer StatusBar + NavigationBar Android quand le modal est ouvert ───
  const hideAndroidBars = () => {
    if (Platform.OS !== "android") return;
    StatusBar.setHidden(true, "fade");
    if (NavigationBar) {
      NavigationBar.setBehaviorAsync("immersive-sticky").catch(() => {});
      NavigationBar.setVisibilityAsync("hidden").catch(() => {});
    }
  };
  const showAndroidBars = () => {
    if (Platform.OS !== "android") return;
    StatusBar.setHidden(false, "fade");
    if (NavigationBar) NavigationBar.setVisibilityAsync("visible").catch(() => {});
  };

  useEffect(() => {
    if (fullscreen !== null) hideAndroidBars();
    else showAndroidBars();
  }, [fullscreen]);

  const activePhotos = useMemo(() => {
    // On exclut : corbeille + conservées (ménage) + coups de cœur.
    // Une photo déjà traitée ne doit plus réapparaître dans la liste des doublons.
    const excludedIds = new Set([
      ...deleted.map((p) => p.id),
      ...skipped.map((p) => p.id),
      ...kept.map((p) => p.id),
    ]);
    return libraryPhotos.filter((p) => !excludedIds.has(p.id));
  }, [libraryPhotos, deleted, skipped, kept]);

  // Détection différée : l'écran s'affiche d'abord, le calcul suit au tick suivant.
  useEffect(() => {
    setRawGroups(null);
    const id = setTimeout(() => {
      setRawGroups(findDuplicates(activePhotos));
    }, 0);
    return () => clearTimeout(id);
  }, [activePhotos]);

  // Tri + limite appliqués à l'affichage, indépendamment du recalcul des doublons.
  const groups = useMemo(() => {
    if (rawGroups === null) return null;
    return capGroups(sortGroups(rawGroups, sortMode), maxGroups);
  }, [rawGroups, sortMode, maxGroups]);

  const totalDuplicates = groups ? groups.reduce((a, g) => a + g.photos.length, 0) : 0;

  // ── Halo de feedback (identique à SwipeScreen) ─────────────────────────────
  function flashFeedback(color, edge) {
    setFeedbackColor(color);
    setFeedbackEdge(edge);
    Animated.sequence([
      Animated.timing(feedbackOpacity, { toValue: 1, duration: 120, useNativeDriver: false }),
      Animated.timing(feedbackOpacity, { toValue: 0, duration: 450, useNativeDriver: false }),
    ]).start();
  }

  function openFullscreen(group, photoIdx, groupIdx) {
    setHistory([]); // reset undo à chaque groupe
    setFullscreen({ photos: [...group.photos], idx: photoIdx, groupIdx });
  }

  function goToPhoto(idx) {
    if (!fullscreen) return;
    const clamped = Math.max(0, Math.min(idx, fullscreen.photos.length - 1));
    setFullscreen({ ...fullscreen, idx: clamped });
    flatListRef.current?.scrollToIndex({ index: clamped, animated: true, viewPosition: 0.5 });
  }

  function advanceAfterAction(processedPhoto, storeAction, swipeDir) {
    // Snapshot avant action pour pouvoir annuler
    const stateNow = usePhotoStore.getState();
    setHistory((h) => [...h, {
      keptSnap:      stateNow.kept,
      deletedSnap:   stateNow.deleted,
      printedSnap:   stateNow.printed,
      skippedSnap:   stateNow.skipped,
      hesitatedSnap: stateNow.hesitated,
      fullscreenSnap: fullscreen,
    }]);

    // Flash halo selon direction
    if (storeAction === addDeleted)                      flashFeedback("rgba(232,99,122,0.7)", swipeDir || "down");
    if (storeAction === addSkipped || storeAction === addKept) flashFeedback("rgba(92,184,122,0.7)", swipeDir || "up");

    storeAction(processedPhoto);
    const remaining = fullscreen.photos.filter((p) => p.id !== processedPhoto.id);
    if (remaining.length === 0) {
      // Recalcule les groupes depuis le store mis à jour pour trouver le suivant
      const storeState = usePhotoStore.getState();
      const newExcludedIds = new Set([
        ...storeState.deleted.map((p) => p.id),
        ...storeState.skipped.map((p) => p.id),
        ...storeState.kept.map((p) => p.id),
      ]);
      const newActivePhotos = storeState.libraryPhotos.filter((p) => !newExcludedIds.has(p.id));
      const newRawGroups = findDuplicates(newActivePhotos);
      const newGroups = capGroups(sortGroups(newRawGroups, sortMode), maxGroups);
      setRawGroups(newRawGroups);
      // Le groupe courant a disparu, le même index pointe maintenant sur le suivant
      const nextGroup = newGroups[fullscreen.groupIdx];
      if (nextGroup) {
        setNextGroupToast(true);
        setTimeout(() => setNextGroupToast(false), 1200);
        setHistory([]);
        setFullscreen({ photos: [...nextGroup.photos], idx: 0, groupIdx: fullscreen.groupIdx });
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index: 0, animated: false, viewPosition: 0.5 });
        }, 50);
      } else {
        setFullscreen(null);
        setSelectedGroupIdx(null);
      }
    } else {
      const newIdx = Math.min(fullscreen.idx, remaining.length - 1);
      setFullscreen({ ...fullscreen, photos: remaining, idx: newIdx });
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: newIdx, animated: true, viewPosition: 0.5 });
      }, 50);
    }
  }

  // Undo : restaure le snapshot du store et de l'état fullscreen
  function undo() {
    if (!history.length) return;
    const last = history[history.length - 1];
    undoLast(last.keptSnap, last.deletedSnap, last.printedSnap, last.skippedSnap, last.hesitatedSnap);
    setFullscreen(last.fullscreenSnap);
    setHistory((h) => h.slice(0, -1));
  }

  // Directions fixes (indépendantes du mapping swipe personnalisé du mode ménage) :
  // elles doivent toujours correspondre aux boutons "↓ bas = supprimer" et
  // "↑ garder" affichés en bas de l'écran.
  function getSwipeHandler(direction) {
    if (!currentPhoto) return undefined;
    if (direction === "down") return () => advanceAfterAction(currentPhoto, addDeleted, "down");
    if (direction === "up")   return () => advanceAfterAction(currentPhoto, addSkipped, "up");
    return undefined;
  }

  const currentPhoto = fullscreen ? fullscreen.photos[fullscreen.idx] : null;
  const groupSize    = fullscreen ? fullscreen.photos.length : 0;

  function handleDeletePress() {
    if (!currentPhoto) return;
    advanceAfterAction(currentPhoto, addDeleted, "down");
  }
  // ❤️ = coup de cœur (addKept), identique au bouton ❤️ du mode ménage
  function handleKeepPress() {
    if (!currentPhoto) return;
    advanceAfterAction(currentPhoto, addKept, "up");
  }
  // ✅ = Conserver (addSkipped), identique au swipe "conserver" du mode ménage
  function handleConserverPress() {
    if (!currentPhoto) return;
    advanceAfterAction(currentPhoto, addSkipped, "up");
  }

  // 🗑 Tout supprimer : marque toutes les copies du groupe comme supprimées d'un coup,
  // puis passe au groupe suivant (même logique de fin de groupe qu'advanceAfterAction).
  function deleteWholeGroup() {
    if (!fullscreen || fullscreen.photos.length === 0) return;

    // Snapshot avant action → l'annulation restaure tout le groupe en une fois.
    const stateNow = usePhotoStore.getState();
    setHistory((h) => [...h, {
      keptSnap:      stateNow.kept,
      deletedSnap:   stateNow.deleted,
      printedSnap:   stateNow.printed,
      skippedSnap:   stateNow.skipped,
      hesitatedSnap: stateNow.hesitated,
      fullscreenSnap: fullscreen,
    }]);

    flashFeedback("rgba(232,99,122,0.7)", "down");
    fullscreen.photos.forEach((p) => addDeleted(p));

    // Groupe entièrement traité → on cherche le suivant
    const storeState = usePhotoStore.getState();
    const newExcludedIds = new Set([
      ...storeState.deleted.map((p) => p.id),
      ...storeState.skipped.map((p) => p.id),
      ...storeState.kept.map((p) => p.id),
    ]);
    const newActivePhotos = storeState.libraryPhotos.filter((p) => !newExcludedIds.has(p.id));
    const newRawGroups = findDuplicates(newActivePhotos);
    const newGroups = capGroups(sortGroups(newRawGroups, sortMode), maxGroups);
    setRawGroups(newRawGroups);

    const nextGroup = newGroups[fullscreen.groupIdx];
    if (nextGroup) {
      setNextGroupToast(true);
      setTimeout(() => setNextGroupToast(false), 1200);
      setHistory([]);
      setFullscreen({ photos: [...nextGroup.photos], idx: 0, groupIdx: fullscreen.groupIdx });
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: 0, animated: false, viewPosition: 0.5 });
      }, 50);
    } else {
      setFullscreen(null);
      setSelectedGroupIdx(null);
    }
  }

  // Confirmation avant suppression massive (action plus impactante qu'un swipe).
  function handleDeleteAllGroup() {
    if (!fullscreen || fullscreen.photos.length === 0) return;
    const count = fullscreen.photos.length;
    Alert.alert(
      "Tout supprimer ?",
      `Les ${count} photos de ce groupe seront supprimées.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Tout supprimer", style: "destructive", onPress: deleteWholeGroup },
      ]
    );
  }

  // Échelle responsive de la barre de boutons (référence 390 px → scale = 1 = tailles actuelles).
  const uiScale = Math.min(1, SW / 390);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <BackButton mode="menage" onPress={() => navigation.goBack()} />
        <View>
          <Text style={{ fontWeight: "800", fontSize: 18, color: C.text }}>
            {maxGroups ? "Doublons du jour" : "Doublons probables"}
          </Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            {groups === null
              ? "Analyse en cours…"
              : groups.length === 0
              ? "Aucun doublon détecté"
              : `${groups.length} groupe(s) · ${totalDuplicates} photos`}
          </Text>
        </View>
      </View>

      {/* ── Sélecteur de tri ── */}
      {groups !== null && groups.length > 0 && (
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: S.pad, paddingBottom: 12 }}>
          {SORT_OPTIONS.map((opt) => {
            const isActive = sortMode === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setSortMode(opt.key)}
                activeOpacity={0.8}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 5,
                  paddingHorizontal: 12, paddingVertical: 7,
                  borderRadius: S.radiusFull,
                  backgroundColor: isActive ? C.accent : C.bgCard,
                  borderWidth: 1, borderColor: isActive ? C.accent : C.border,
                }}
              >
                <Text style={{ fontSize: 12 }}>{opt.icon}</Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: isActive ? "#fff" : C.textMuted }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Calcul en cours ── */}
      {groups === null ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.accent} />
          <Text style={{ color: C.textMuted, marginTop: 12 }}>Détection des doublons…</Text>
        </View>

      /* ── État vide ── */
      ) : groups.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
          <Text style={{ fontSize: 56, marginBottom: 12 }}>🪞</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text, textAlign: "center" }}>
            Pas de doublons détectés
          </Text>
          <Text style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 8, lineHeight: 18 }}>
            On détecte les photos prises à moins de 5 secondes d'écart avec les mêmes dimensions (mode rafale, double appui…).
          </Text>
        </View>

      /* ── Liste des groupes (virtualisée) ── */
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(_, idx) => String(idx)}
          contentContainerStyle={{ paddingHorizontal: S.pad, paddingBottom: 24 }}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          renderItem={({ item: g, index: idx }) => {
            const isSelected = idx === selectedGroupIdx;
            const first      = g.photos[0];
            const dateStr    = new Date(first.creationTime).toLocaleDateString("fr-FR", {
              day: "numeric", month: "long", year: "numeric",
            });
            return (
              <TouchableOpacity
                onPress={() => setSelectedGroupIdx(isSelected ? null : idx)}
                activeOpacity={isSelected ? 1 : 0.75}
                style={{
                  backgroundColor: isSelected ? `${C.accent}10` : C.bgCard,
                  borderRadius: S.radius, padding: 14, marginBottom: 10,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? C.accent : C.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: isSelected ? C.accent : C.border }}>
                    <Image source={{ uri: first.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", fontSize: 14, color: C.text }}>
                      {g.photos.length} photos quasi identiques
                    </Text>
                    <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{dateStr}</Text>
                  </View>
                  <Text style={{ color: isSelected ? C.accent : C.textMuted, fontSize: 18, fontWeight: "800" }}>
                    {isSelected ? "▾" : "›"}
                  </Text>
                </View>

                {isSelected && (
                  <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {g.photos.map((p, pIdx) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => openFullscreen(g, pIdx, idx)}
                        activeOpacity={0.85}
                        style={{ borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: C.border }}
                      >
                        <Image source={{ uri: p.url }} style={{ width: PHOTO_SIZE, height: PHOTO_SIZE }} resizeMode="cover" />
                        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.4)", paddingVertical: 5, alignItems: "center" }}>
                          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>Voir en plein écran</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── Modal plein écran ── */}
      <Modal
        visible={fullscreen !== null}
        transparent={false}
        animationType="fade"
        onShow={hideAndroidBars}
        onRequestClose={() => { showAndroidBars(); setFullscreen(null); }}
      >
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>

          {/* Halo de feedback (même que SwipeScreen) */}
          {feedbackEdge && (
            <Animated.View
              pointerEvents="none"
              style={[getEdgeContainerStyle(feedbackEdge), { opacity: feedbackOpacity, zIndex: 25 }]}
            >
              <LinearGradient {...getEdgeGradient(feedbackEdge, feedbackColor)} style={{ flex: 1 }} />
            </Animated.View>
          )}

          {/* Photo principale avec swipe gestures */}
          {currentPhoto && (
            <ZoomableImage
              key={currentPhoto.id}
              uri={currentPhoto.url}
              onSwipeLeft={fullscreen && fullscreen.idx < groupSize - 1
                ? () => goToPhoto(fullscreen.idx + 1) : undefined}
              onSwipeRight={fullscreen && fullscreen.idx > 0
                ? () => goToPhoto(fullscreen.idx - 1) : undefined}
              onSwipeUp={getSwipeHandler("up")}
              onSwipeDown={getSwipeHandler("down")}
            />
          )}

          {/* Flèches latérales semi-transparentes : indiquent qu'on peut balayer
              de gauche à droite pour voir les autres copies du doublon */}
          {fullscreen && groupSize > 1 && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 8,
                flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                paddingHorizontal: 14,
              }}
            >
              <Text style={{ fontSize: 46, fontWeight: "300", color: "rgba(255,255,255,0.4)" }}>
                {fullscreen.idx > 0 ? "‹" : ""}
              </Text>
              <Text style={{ fontSize: 46, fontWeight: "300", color: "rgba(255,255,255,0.4)" }}>
                {fullscreen.idx < groupSize - 1 ? "›" : ""}
              </Text>
            </View>
          )}

          {/* ── Top bar — compteur seulement (🚪 est dans la rangée de boutons) ── */}
          {fullscreen && (
            <View style={{
              position: "absolute", top: Platform.OS === "android" ? 16 : 52,
              left: 0, right: 0, zIndex: 10,
              alignItems: "center",
            }}>
              <View style={{ backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                  {fullscreen.idx + 1} / {groupSize}
                </Text>
              </View>
            </View>
          )}

          {/* Toast groupe suivant */}
          {nextGroupToast && (
            <View style={{
              position: "absolute", top: "45%", left: 0, right: 0,
              alignItems: "center", zIndex: 30, pointerEvents: "none",
            }}>
              <View style={{
                backgroundColor: "rgba(255,255,255,0.92)",
                borderRadius: 20, paddingHorizontal: 22, paddingVertical: 12,
                shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25, shadowRadius: 10, elevation: 10,
              }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#111" }}>
                  Groupe suivant →
                </Text>
              </View>
            </View>
          )}

          {/* Indication navigation swipe */}
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 155, alignItems: "center", zIndex: 10, pointerEvents: "none" }}>
            <View style={{ backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>← → Naviguer entre les copies</Text>
            </View>
          </View>

          {/* ── Barre basse : miniatures + undo ── */}
          {fullscreen && (
            <View style={{
              position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10,
              backgroundColor: "rgba(0,0,0,0.72)",
              paddingTop: 12, paddingBottom: 36,
              borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)",
            }}>
              {/* Miniatures */}
              <FlatList
                ref={flatListRef}
                data={fullscreen.photos}
                horizontal
                keyExtractor={(p) => p.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                style={{ marginBottom: 12 }}
                getItemLayout={(_, index) => ({ length: THUMB_SIZE + 8, offset: (THUMB_SIZE + 8) * index, index })}
                renderItem={({ item: p, index }) => {
                  const isActive = index === fullscreen.idx;
                  return (
                    <TouchableOpacity
                      onPress={() => goToPhoto(index)}
                      activeOpacity={0.8}
                      style={{ width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 10, overflow: "hidden", borderWidth: isActive ? 2.5 : 1.5, borderColor: isActive ? "#fff" : "rgba(255,255,255,0.25)", opacity: isActive ? 1 : 0.55 }}
                    >
                      <Image source={{ uri: p.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    </TouchableOpacity>
                  );
                }}
                // CTA après la dernière miniature : supprimer tout le groupe d'un coup
                ListFooterComponent={
                  <TouchableOpacity
                    onPress={handleDeleteAllGroup}
                    activeOpacity={0.85}
                    style={{
                      height: THUMB_SIZE, borderRadius: 10, paddingHorizontal: 14,
                      flexDirection: "row", alignItems: "center", gap: 6,
                      backgroundColor: "rgba(232,99,122,0.25)",
                      borderWidth: 1.5, borderColor: "rgba(232,99,122,0.7)",
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>🗑</Text>
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>Tout supprimer</Text>
                  </TouchableOpacity>
                }
              />

              {/* ── Boutons action ── */}
              <View style={{ paddingHorizontal: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 14, transform: [{ scale: uiScale }] }}>

                {/* 🚪 Fermer le plein écran — même ligne que les CTA (label invisible pour aligner) */}
                <View style={{ alignItems: "center", gap: 5 }}>
                  <Text style={{ fontSize: 10, opacity: 0 }}>_</Text>
                  <TouchableOpacity
                    onPress={() => { showAndroidBars(); setFullscreen(null); }}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.12)",
                      borderRadius: S.radiusFull, padding: 10,
                      borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>🚪</Text>
                  </TouchableOpacity>
                </View>

                {/* 🗑 Supprimer */}
                <View style={{ alignItems: "center", gap: 5 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "rgba(232,99,122,0.9)", letterSpacing: 0.3 }}>↓ bas</Text>
                  <TouchableOpacity
                    onPress={handleDeletePress}
                    style={{ backgroundColor: "rgba(232,99,122,0.2)", borderWidth: 2, borderColor: "rgba(232,99,122,.5)", borderRadius: S.radiusFull, padding: 18 }}
                  >
                    <Text style={{ fontSize: 22 }}>🗑</Text>
                  </TouchableOpacity>
                </View>

                {/* ↩ Annuler */}
                <View style={{ alignItems: "center", gap: 5 }}>
                  <Text style={{ fontSize: 10, opacity: 0 }}>_</Text>
                  <TouchableOpacity
                    onPress={undo}
                    disabled={!history.length}
                    style={{
                      backgroundColor: history.length ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.25)",
                      borderWidth: 2, borderColor: "rgba(0,0,0,0.08)",
                      borderRadius: S.radiusFull, padding: 14,
                      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: history.length ? 0.35 : 0, shadowRadius: 6, elevation: history.length ? 6 : 0,
                    }}
                  >
                    <Text style={{ fontSize: 20, fontWeight: "800", color: history.length ? "#222" : "rgba(255,255,255,0.4)" }}>↩</Text>
                  </TouchableOpacity>
                </View>

                {/* ✅ Garder (addSkipped) — swipe vers le haut */}
                <View style={{ alignItems: "center", gap: 5 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "rgba(92,184,122,0.9)", letterSpacing: 0.3 }}>↑ garder</Text>
                  <TouchableOpacity
                    onPress={handleConserverPress}
                    style={{ backgroundColor: "rgba(92,184,122,0.2)", borderWidth: 2, borderColor: "rgba(92,184,122,.5)", borderRadius: S.radiusFull, padding: 18 }}
                  >
                    <Text style={{ fontSize: 22 }}>✅</Text>
                  </TouchableOpacity>
                </View>

                {/* ❤️ Coup de cœur */}
                <View style={{ alignItems: "center", gap: 5 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "rgba(92,184,122,0.9)", letterSpacing: 0.3 }}>coup de cœur</Text>
                  <TouchableOpacity
                    onPress={handleKeepPress}
                    style={{ backgroundColor: "rgba(92,184,122,0.2)", borderWidth: 2, borderColor: "rgba(92,184,122,.5)", borderRadius: S.radiusFull, padding: 18 }}
                  >
                    <Text style={{ fontSize: 22 }}>❤️</Text>
                  </TouchableOpacity>
                </View>

              </View>
            </View>
          )}
        </GestureHandlerRootView>
      </Modal>
    </SafeAreaView>
  );
}

export default DuplicatesScreen;
