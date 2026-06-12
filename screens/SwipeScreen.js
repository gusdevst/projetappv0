import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Dimensions,
  Platform,
  StatusBar,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";

// Import défensif : si le module natif n'est pas dans le dev build,
// on continue sans planter. Une fois le dev build rebuild, ça s'active.
let NavigationBar = null;
try {
  NavigationBar = require("expo-navigation-bar");
} catch (e) {}

import { LinearGradient } from "expo-linear-gradient";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { C, S } from "../constants/theme";
import { getPhotoAdvice, enhancePhoto } from "../services/aiService";
import { usePhotoStore } from "../store/usePhotoStore";
import { ZoomableImage } from "../components/ZoomableImage";

// Helpers halo : position + orientation du dégradé selon la direction du swipe
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

const { width: SW, height: SH } = Dimensions.get("window");

export function SwipeScreen({ navigation, route }) {
  const queue     = route.params?.queue     ?? [];
  const albumMode = route.params?.albumMode ?? false;
  const albumId   = route.params?.albumId   ?? null;
  const albumName = route.params?.albumName ?? null;

  const [idx, setIdx] = useState(0);
  const { addKept, addDeleted, addPrinted, addSkipped, addHesitated, undoLast, albums, createAlbum, addPhotoToAlbum, swipeMappings } = usePhotoStore();

  const [history, setHistory] = useState([]);
  const [showTip, setShowTip] = useState(true);

  const [aiPanel, setAiPanel] = useState(false);
  const [aiMode, setAiMode] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [advice, setAdvice] = useState(null);
  const [enhanced, setEnhanced] = useState(null);

  // Picker d'album déclenché par appui long sur 🖨
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");

  // Indicateur visuel : la photo courante a-t-elle été marquée "coup de cœur" ?
  const [heartedThisPhoto, setHeartedThisPhoto] = useState(false);

  // Ref vers ZoomableImage pour déclencher les fly-off depuis les boutons
  const zoomableRef = useRef(null);

  // Halo de feedback
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const [feedbackColor, setFeedbackColor] = useState("rgba(232,99,122,0.7)");
  const [feedbackEdge, setFeedbackEdge]   = useState(null);

  // Cache la nav bar Android pendant le swipe (expérience immersive)
  useEffect(() => {
    if (Platform.OS === "android" && NavigationBar) {
      NavigationBar.setVisibilityAsync("hidden").catch(() => {});

    }
    return () => {
      if (Platform.OS === "android" && NavigationBar) {
        NavigationBar.setVisibilityAsync("visible").catch(() => {});
      }
    };
  }, []);

  // Reset "hearted" à chaque nouvelle photo
  useEffect(() => {
    setHeartedThisPhoto(false);
  }, [idx]);

  const flashFeedback = (color, edge) => {
    setFeedbackColor(color);
    setFeedbackEdge(edge);
    Animated.sequence([
      Animated.timing(feedbackOpacity, { toValue: 1, duration: 120, useNativeDriver: false }),
      Animated.timing(feedbackOpacity, { toValue: 0, duration: 450, useNativeDriver: false }),
    ]).start();
  };

  const photo = queue[idx] || null;

  const similarPhotos = photo
    ? queue.filter(
        (p) =>
          p.id !== photo.id &&
          (p.year === photo.year || p.faces?.some((f) => photo.faces?.includes(f)))
      )
    : [];

  // ── Actions de tri ─────────────────────────────────────────────────────────
  // Appelé APRÈS l'animation fly-off de ZoomableImage (ou depuis les boutons
  // via flyOff()). Ne gère plus d'animation — ZoomableImage s'en charge.
  const performAction = (actionKey, animDir) => {
    if (!photo) return;
    setAiPanel(false); setAdvice(null); setEnhanced(null); setAiMode(null);

    if (actionKey === "none") return;

    // Snapshot pour undo
    const stateNow = usePhotoStore.getState();
    setHistory((h) => [
      ...h,
      {
        keptSnap:      stateNow.kept,
        deletedSnap:   stateNow.deleted,
        printedSnap:   stateNow.printed,
        skippedSnap:   stateNow.skipped,
        hesitatedSnap: stateNow.hesitated,
      },
    ]);

    // Halo de feedback coloré sur l'edge du swipe
    if (actionKey === "delete")   flashFeedback("rgba(232,99,122,0.7)",  animDir); // rouge
    if (actionKey === "skip")     flashFeedback("rgba(92,184,122,0.7)",  animDir); // vert
    if (actionKey === "hesitate") flashFeedback("rgba(255,165,0,0.65)",  animDir); // orange

    if (actionKey === "delete")   addDeleted(photo);
    if (actionKey === "album")    addPrinted(photo);
    if (actionKey === "favorite") addKept(photo);
    if (actionKey === "skip")     addSkipped(photo);
    if (actionKey === "hesitate") addHesitated(photo);

    // Mode album : les actions positives (❤️ et 🖨) ajoutent aussi à l'album
    if (albumMode && albumId && (actionKey === "favorite" || actionKey === "album")) {
      addPhotoToAlbum(albumId, photo.id);
    }

    if (idx >= queue.length - 1) navigation.navigate("Summary", { albumId, albumName });
    else setIdx((i) => i + 1);
  };

  // Swipe gestuel : lit la config utilisateur dans le store
  const swipe = (dir) => {
    const actionKey = swipeMappings?.[dir] || "none";
    performAction(actionKey, dir);
  };

  // Boutons trash + album : déclenchent le fly-off via la ref, puis l'action
  const handleTrashPress = () => {
    zoomableRef.current?.flyOff("down", () => performAction("delete", "down"));
  };
  const handleAlbumPress = () => {
    zoomableRef.current?.flyOff("right", () => performAction("album", "right"));
  };

  // Bouton ❤️ : n'avance pas la file, marque juste la photo
  // En mode album, l'ajoute aussi à l'album en cours
  const handleHeartPress = () => {
    if (!photo) return;
    addKept(photo);
    if (albumMode && albumId) addPhotoToAlbum(albumId, photo.id);
    setHeartedThisPhoto(true);
  };

  const undo = () => {
    if (!history.length) return;
    const last = history[history.length - 1];
    undoLast(last.keptSnap, last.deletedSnap, last.printedSnap, last.skippedSnap, last.hesitatedSnap);
    setHistory((h) => h.slice(0, -1));
    setIdx((i) => Math.max(0, i - 1));
  };

  const doAdvice = async () => {
    setAiLoading(true);
    setAiMode("advice");
    setAdvice(null);
    const result = await getPhotoAdvice(photo, similarPhotos.length);
    setAdvice(result);
    setAiLoading(false);
  };

  const doEnhance = async () => {
    setAiLoading(true);
    setAiMode("enhance");
    setEnhanced(null);
    const result = await enhancePhoto(photo);
    setEnhanced(result);
    setAiLoading(false);
  };

  const handlePickAlbum = (albumId) => {
    if (!photo) return;
    addPhotoToAlbum(albumId, photo.id);
    setShowAlbumPicker(false);
    setNewAlbumName("");
    zoomableRef.current?.flyOff("right", () => swipe("up"));
  };

  const handleCreateAndAdd = () => {
    if (!photo) return;
    const trimmed = newAlbumName.trim();
    if (!trimmed) return;
    createAlbum(trimmed);
    const fresh = usePhotoStore.getState().albums;
    const newAlbumId = fresh[fresh.length - 1]?.id;
    if (newAlbumId) addPhotoToAlbum(newAlbumId, photo.id);
    setShowAlbumPicker(false);
    setNewAlbumName("");
    zoomableRef.current?.flyOff("right", () => swipe("up"));
  };

  if (!photo) return null;

  const pct = Math.round((idx / queue.length) * 100);

  const handleBack = () => navigation.goBack();

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Halo de feedback action */}
      {feedbackEdge && (
        <Animated.View
          pointerEvents="none"
          style={[
            getEdgeContainerStyle(feedbackEdge),
            { opacity: feedbackOpacity, zIndex: 25 },
          ]}
        >
          <LinearGradient
            {...getEdgeGradient(feedbackEdge, feedbackColor)}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}

      {/* Barre de progression */}
      <View
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 3, zIndex: 20,
          backgroundColor: "#333",
        }}
      >
        <View style={{ height: 3, width: `${pct}%`, backgroundColor: C.accent }} />
      </View>

      {/* Header */}
      <View
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          zIndex: 15,
          paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 8 : 52,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingBottom: 8,
          }}
        >
          <TouchableOpacity
            onPress={handleBack}
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              borderRadius: S.radiusFull,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>← Retour</Text>
          </TouchableOpacity>

          <View style={{ alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
              {photo.location}
            </Text>
            <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 11 }}>
              {photo.year}
            </Text>
          </View>

          {/* Badge : nom de l'album en mode album, compteur sinon */}
          <View style={{
            paddingHorizontal: 14, paddingVertical: 8,
            backgroundColor: albumMode ? "rgba(244,132,95,0.35)" : "rgba(255,255,255,0.2)",
            borderRadius: S.radiusFull,
            maxWidth: 130,
          }}>
            {albumMode ? (
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }} numberOfLines={1}>
                📁 {albumName}
              </Text>
            ) : (
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                {idx + 1} / {queue.length}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* ── Photo principale — pinch pour zoomer, swipe pour trier ── */}
      <ZoomableImage
        ref={zoomableRef}
        uri={photo.url}
        onSwipeLeft={() => swipe("left")}
        onSwipeRight={() => swipe("right")}
        onSwipeUp={() => swipe("up")}
        onSwipeDown={() => swipe("down")}
      />

      {/* Boutons d'action */}
      <View
        style={{
          position: "absolute",
          bottom: 32,
          left: 0, right: 0,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 14,
          zIndex: 10,
        }}
      >
        {/* 🗑 Supprimer — swipe vers le bas */}
        <View style={{ alignItems: "center", gap: 5 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: "rgba(232,99,122,0.9)", letterSpacing: 0.3 }}>
            ↓ bas
          </Text>
          <TouchableOpacity
            onPress={handleTrashPress}
            style={{
              backgroundColor: "rgba(232,99,122,0.2)",
              borderWidth: 2,
              borderColor: "rgba(232,99,122,.5)",
              borderRadius: S.radiusFull,
              padding: 18,
            }}
          >
            <Text style={{ fontSize: 22 }}>🗑</Text>
          </TouchableOpacity>
        </View>

        {/* ↩ Annuler — pas de swipe associé */}
        <View style={{ alignItems: "center", gap: 5 }}>
          {/* Espace invisible pour aligner avec les autres boutons qui ont un label */}
          <Text style={{ fontSize: 10, opacity: 0 }}>_</Text>
          <TouchableOpacity
            onPress={undo}
            disabled={!history.length}
            style={{
              backgroundColor: history.length ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.4)",
              borderWidth: 2,
              borderColor: "rgba(0,0,0,0.08)",
              borderRadius: S.radiusFull,
              padding: 14,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.35,
              shadowRadius: 6,
              elevation: 6,
            }}
          >
            <Text style={{ fontSize: 20, color: "#222", fontWeight: "800" }}>↩</Text>
          </TouchableOpacity>
        </View>

        {/* 🖨 Album — swipe vers la droite */}
        <View style={{ alignItems: "center", gap: 5 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: "rgba(176,122,216,0.9)", letterSpacing: 0.3 }}>
            → droite
          </Text>
          <TouchableOpacity
            onPress={handleAlbumPress}
            onLongPress={() => setShowAlbumPicker(true)}
            delayLongPress={350}
            style={{
              backgroundColor: "rgba(176,122,216,0.2)",
              borderWidth: 2,
              borderColor: "rgba(176,122,216,.5)",
              borderRadius: S.radiusFull,
              padding: 18,
            }}
          >
            <Text style={{ fontSize: 22 }}>🖨</Text>
          </TouchableOpacity>
        </View>

        {/* ❤️ Coup de cœur — appui direct */}
        <View style={{ alignItems: "center", gap: 5 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: "rgba(92,184,122,0.9)", letterSpacing: 0.3 }}>
            appui
          </Text>
          <TouchableOpacity
            onPress={handleHeartPress}
            style={{
              backgroundColor: heartedThisPhoto ? "rgba(92,184,122,0.85)" : "rgba(92,184,122,0.2)",
              borderWidth: 2,
              borderColor: heartedThisPhoto ? "#5cb87a" : "rgba(92,184,122,.5)",
              borderRadius: S.radiusFull,
              padding: 18,
            }}
          >
            <Text style={{ fontSize: 22 }}>{heartedThisPhoto ? "❤️✓" : "❤️"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal : picker d'album (long-press sur 🖨) */}
      <Modal
        visible={showAlbumPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAlbumPicker(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: C.bg,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 22,
              paddingBottom: 36,
              maxHeight: SH * 0.75,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "900", color: C.text }}>
                Ajouter à un album
              </Text>
              <TouchableOpacity onPress={() => setShowAlbumPicker(false)}>
                <Text style={{ fontSize: 22, color: C.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>
              La photo sera ajoutée à l'album souvenirs et à l'album choisi.
            </Text>

            <ScrollView style={{ maxHeight: SH * 0.35 }}>
              {albums.length === 0 ? (
                <Text
                  style={{
                    fontSize: 13, color: C.textMuted,
                    fontStyle: "italic", textAlign: "center", paddingVertical: 16,
                  }}
                >
                  Aucun album pour l'instant. Crée le premier ci-dessous.
                </Text>
              ) : (
                albums.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => handlePickAlbum(a.id)}
                    style={{
                      backgroundColor: C.bgCard,
                      borderRadius: 14,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: C.border,
                      marginBottom: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>
                        {a.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                        {a.photoIds.length} photo{a.photoIds.length > 1 ? "s" : ""}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 18, color: C.accent }}>＋</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View
              style={{
                marginTop: 16, paddingTop: 16,
                borderTopWidth: 1, borderTopColor: C.border,
              }}
            >
              <Text
                style={{
                  fontSize: 12, fontWeight: "700", color: C.textMuted,
                  textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
                }}
              >
                Nouvel album
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  value={newAlbumName}
                  onChangeText={setNewAlbumName}
                  placeholder="Ex. Vacances 2026"
                  placeholderTextColor={C.textMuted}
                  style={{
                    flex: 1,
                    backgroundColor: C.bgCard,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: C.border,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: C.text,
                  }}
                />
                <TouchableOpacity
                  onPress={handleCreateAndAdd}
                  disabled={!newAlbumName.trim()}
                  style={{
                    backgroundColor: C.accent,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    justifyContent: "center",
                    opacity: newAlbumName.trim() ? 1 : 0.4,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Créer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
