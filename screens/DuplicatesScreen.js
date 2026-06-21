// screens/DuplicatesScreen.js
import { useMemo, useState, useRef, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  Image, StatusBar, Dimensions, Modal, FlatList, Platform, Animated,
} from "react-native";
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

export function DuplicatesScreen({ navigation }) {
  const libraryPhotos       = usePhotoStore((s) => s.libraryPhotos);
  const deleted             = usePhotoStore((s) => s.deleted);
  const skipped             = usePhotoStore((s) => s.skipped);
  const kept                = usePhotoStore((s) => s.kept);
  const addDeleted          = usePhotoStore((s) => s.addDeleted);
  const addSkipped          = usePhotoStore((s) => s.addSkipped);
  const addKept             = usePhotoStore((s) => s.addKept);
  const undoLast            = usePhotoStore((s) => s.undoLast);
  const swipeMappingsMenage = usePhotoStore((s) => s.swipeMappingsMenage);

  const [selectedGroupIdx, setSelectedGroupIdx] = useState(null);
  const [fullscreen, setFullscreen]             = useState(null);
  // Historique pour le undo (snapshots du store avant chaque action)
  const [history, setHistory]                   = useState([]);

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

  const groups = useMemo(() => findDuplicates(activePhotos), [activePhotos]);
  const totalDuplicates = groups.reduce((a, g) => a + g.photos.length, 0);

  // ── Halo de feedback (identique à SwipeScreen) ─────────────────────────────
  function flashFeedback(color, edge) {
    setFeedbackColor(color);
    setFeedbackEdge(edge);
    Animated.sequence([
      Animated.timing(feedbackOpacity, { toValue: 1, duration: 120, useNativeDriver: false }),
      Animated.timing(feedbackOpacity, { toValue: 0, duration: 450, useNativeDriver: false }),
    ]).start();
  }

  function openFullscreen(group, photoIdx) {
    setHistory([]); // reset undo à chaque groupe
    setFullscreen({ photos: [...group.photos], idx: photoIdx });
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
      setFullscreen(null);
      setSelectedGroupIdx(null);
    } else {
      const newIdx = Math.min(fullscreen.idx, remaining.length - 1);
      setFullscreen({ photos: remaining, idx: newIdx });
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

  // Mappe la direction swipe config ménage → action dans les doublons
  function getSwipeHandler(direction) {
    if (!currentPhoto) return undefined;
    const action = swipeMappingsMenage[direction];
    if (action === "delete")
      return () => advanceAfterAction(currentPhoto, addDeleted, direction);
    if (["favorite", "skip", "hesitate"].includes(action))
      return () => advanceAfterAction(currentPhoto, addSkipped, direction);
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <BackButton onPress={() => navigation.goBack()} />
        <View>
          <Text style={{ fontWeight: "800", fontSize: 18, color: C.text }}>Doublons probables</Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            {groups.length === 0
              ? "Aucun doublon détecté"
              : `${groups.length} groupe(s) · ${totalDuplicates} photos`}
          </Text>
        </View>
      </View>

      {/* ── État vide ── */}
      {groups.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
          <Text style={{ fontSize: 56, marginBottom: 12 }}>🪞</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text, textAlign: "center" }}>
            Pas de doublons détectés
          </Text>
          <Text style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 8, lineHeight: 18 }}>
            On détecte les photos prises à moins de 2 secondes d'écart avec les mêmes dimensions (mode rafale, double appui…).
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1, paddingHorizontal: S.pad }}>
          {groups.map((g, idx) => {
            const isSelected = idx === selectedGroupIdx;
            const first      = g.photos[0];
            const dateStr    = new Date(first.creationTime).toLocaleDateString("fr-FR", {
              day: "numeric", month: "long", year: "numeric",
            });
            return (
              <TouchableOpacity
                key={idx}
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
                        onPress={() => openFullscreen(g, pIdx)}
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
          })}
        </ScrollView>
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

          {/* ── Top bar — compteur seulement, 🚪 déplacé en bas à gauche ── */}
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
              />

              {/* ── Boutons action ── */}
              <View style={{ paddingHorizontal: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 14 }}>

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

              {/* 🚪 Fermer le plein écran — bas gauche */}
              <View style={{ paddingHorizontal: 16, paddingTop: 10, alignItems: "flex-start" }}>
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
            </View>
          )}
        </GestureHandlerRootView>
      </Modal>
    </SafeAreaView>
  );
}

export default DuplicatesScreen;
