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
  Image,
} from "react-native";

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
  // mode : "menage" | "album"
  const mode      = route.params?.mode      ?? "menage";
  const albumId   = route.params?.albumId   ?? null;
  const albumName = route.params?.albumName ?? null;

  const isMenage = mode === "menage";
  const isAlbum  = mode === "album";

  const [idx, setIdx] = useState(0);
  const {
    addKept, addDeleted, addPrinted, addSkipped, addHesitated, undoLast,
    albums, createAlbum, addPhotoToAlbum,
    swipeMappingsMenage, swipeMappingsAlbum,
    libraryPhotos,
  } = usePhotoStore();

  // Bon mapping selon le mode
  const swipeMappings = isAlbum ? swipeMappingsAlbum : swipeMappingsMenage;

  // Retrouve la direction de swipe configurée par l'user pour une action donnée.
  // Les flèches affichées au-dessus des boutons suivent ainsi le paramétrage.
  // Priorité haut > droite > gauche > bas si plusieurs directions ont la même action.
  const dirFor = (action) => ["up", "right", "left", "down"].find((d) => swipeMappings?.[d] === action) || null;
  const keepDir   = dirFor("skip");   // conserver la photo (mode ménage)
  const deleteDir = dirFor("delete"); // supprimer
  const albumDir  = dirFor("album");  // ajouter à l'album (mode album)
  const DIR_LABEL = { up: "↑ haut", down: "↓ bas", left: "← gauche", right: "→ droite" };

  const [history, setHistory]     = useState([]);

  // ── Compteurs locaux de session ─────────────────────────────────────────
  // Ces compteurs ne voient que CE tri, pas les sessions précédentes.
  // On les passe à Summary via route.params.
  const [sessionKept,          setSessionKept]          = useState([]);   // photos gardées ❤️
  const [sessionDeleted,       setSessionDeleted]        = useState([]);   // photos supprimées 🗑
  const [sessionHesitated,     setSessionHesitated]      = useState([]);   // photos hésitées 🤔
  const [sessionAlbumPhotos,   setSessionAlbumPhotos]    = useState([]);   // photos ajoutées à l'album 📁
  const [sessionConserved,     setSessionConserved]      = useState([]);   // photos conservées (ménage) 💚

  const [aiPanel, setAiPanel]     = useState(false);
  const [aiMode, setAiMode]       = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [advice, setAdvice]       = useState(null);
  const [enhanced, setEnhanced]   = useState(null);

  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [newAlbumName, setNewAlbumName]       = useState("");
  const [heartedThisPhoto, setHeartedThisPhoto] = useState(false);

  // Aperçu du contenu de l'album courant (sans quitter la session)
  const [showAlbumPreview, setShowAlbumPreview] = useState(false);
  // Photos actuellement dans l'album = ids stockés, résolus en objets {url} via
  // les photos de cette session, la file de tri et la photothèque chargée.
  const currentAlbum = albums.find((a) => a.id === albumId) || null;
  const albumPreviewPhotos = (() => {
    if (!currentAlbum) return sessionAlbumPhotos;
    const lookup = new Map();
    [...libraryPhotos, ...queue, ...sessionAlbumPhotos].forEach((p) => {
      if (p && !lookup.has(p.id)) lookup.set(p.id, p);
    });
    return currentAlbum.photoIds.map((id) => lookup.get(id)).filter(Boolean);
  })();

  const zoomableRef = useRef(null);

  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const [feedbackColor, setFeedbackColor] = useState("rgba(232,99,122,0.7)");
  const [feedbackEdge, setFeedbackEdge]   = useState(null);

  useEffect(() => {
    if (Platform.OS === "android") {
      StatusBar.setHidden(true, "fade");
      if (NavigationBar) NavigationBar.setVisibilityAsync("hidden").catch(() => {});
    }
    // Pas de cleanup : on veut la barre cachée sur toute l'app (géré globalement dans App.js)
  }, []);

  useEffect(() => { setHeartedThisPhoto(false); }, [idx]);

  const flashFeedback = (color, edge) => {
    setFeedbackColor(color);
    setFeedbackEdge(edge);
    Animated.sequence([
      Animated.timing(feedbackOpacity, { toValue: 1, duration: 120, useNativeDriver: false }),
      Animated.timing(feedbackOpacity, { toValue: 0, duration: 450, useNativeDriver: false }),
    ]).start();
  };

  const photo = queue[idx] || null;

  // ── Fin de tri anticipée ─────────────────────────────────────────────────
  const handleFinDeTri = () => {
    // Mode ménage sans aucun swipe → rien à montrer, on retourne directement à l'accueil
    const totalSession =
      sessionKept.length + sessionDeleted.length +
      sessionHesitated.length + sessionConserved.length + sessionAlbumPhotos.length;
    if (isMenage && totalSession === 0) {
      navigation.popToTop();
      return;
    }
    navigation.navigate("Summary", {
      albumId,
      albumName,
      mode,
      sessionKept,
      sessionDeleted,
      sessionHesitated,
      sessionAlbumPhotos,
      sessionConserved,
    });
  };

  // ── Actions de tri ────────────────────────────────────────────────────────
  const performAction = (actionKey, animDir) => {
    if (!photo) return;
    setAiPanel(false); setAdvice(null); setEnhanced(null); setAiMode(null);
    if (actionKey === "none") return;

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

    if (actionKey === "delete")            flashFeedback("rgba(232,99,122,0.7)",  animDir);
    // "skip" en album = "ne pas envoyer" → pas de halo (feedback serait trompeur)
    if (actionKey === "skip" && isMenage) flashFeedback("rgba(92,184,122,0.7)",  animDir);
    if (actionKey === "hesitate")         flashFeedback("rgba(255,165,0,0.65)",  animDir);
    if (actionKey === "album")    flashFeedback("rgba(176,122,216,0.7)", animDir);
    if (actionKey === "favorite") flashFeedback("rgba(92,184,122,0.7)", animDir);

    if (actionKey === "delete")   { addDeleted(photo);   setSessionDeleted((p) => [...p, photo]); }
    if (actionKey === "album")    {
      addPrinted(photo);
      setSessionAlbumPhotos((p) => [...p, photo]);
      if (albumId) addPhotoToAlbum(albumId, photo.id);
    }
    if (actionKey === "favorite") {
      addKept(photo);
      setSessionKept((p) => [...p, photo]);
    }
    // "skip" a deux sens selon le mode :
    //  - MÉNAGE : "Conserver la photo" → décision DÉFINITIVE. On l'ajoute à "skipped"
    //    (pile persistée, jamais réinitialisée) pour qu'elle ne revienne jamais.
    //  - ALBUM : "Ne pas envoyer dans l'album" → on n'enregistre RIEN : la photo reste
    //    non triée et pourra revenir dans un prochain album.
    if (actionKey === "skip" && isMenage) { addSkipped(photo); setSessionConserved((p) => [...p, photo]); }
    if (actionKey === "hesitate") { addHesitated(photo); setSessionHesitated((p) => [...p, photo]); }

    if (idx >= queue.length - 1) {
      navigation.navigate("Summary", {
        albumId,
        albumName,
        mode,
        // Stats de CETTE session uniquement
        sessionKept:        [...sessionKept,        ...(actionKey === "favorite" ? [photo] : [])],
        sessionDeleted:     [...sessionDeleted,     ...(actionKey === "delete"   ? [photo] : [])],
        sessionHesitated:   [...sessionHesitated,   ...(actionKey === "hesitate" ? [photo] : [])],
        sessionAlbumPhotos: [...sessionAlbumPhotos, ...(actionKey === "album"    ? [photo] : [])],
        sessionConserved:   [...sessionConserved,   ...(actionKey === "skip" && isMenage ? [photo] : [])],
      });
    } else {
      setIdx((i) => i + 1);
    }
  };

  const swipe = (dir) => {
    const actionKey = swipeMappings?.[dir] || "none";
    performAction(actionKey, dir);
  };

  const handleTrashPress = () => {
    const d = deleteDir || "down";
    zoomableRef.current?.flyOff(d, () => performAction("delete", d));
  };
  // Cœur = coup de cœur (favoris) + on conserve la photo et on passe à la suivante.
  // performAction("favorite") gère l'ajout aux favoris, l'historique (undo) et l'avance.
  const handleHeartPress = () => {
    if (!photo) return;
    setHeartedThisPhoto(true);
    performAction("favorite", null);
  };
  // Bouton "conserver" (mode ménage) : même action que le swipe qui conserve.
  const handleKeepPress = () => {
    if (!keepDir) return;
    zoomableRef.current?.flyOff(keepDir, () => performAction("skip", keepDir));
  };
  const handleAlbumPress = () => {
    const d = albumDir || "up";
    zoomableRef.current?.flyOff(d, () => performAction("album", d));
  };

  const undo = () => {
    if (!history.length) return;
    const last = history[history.length - 1];
    undoLast(last.keptSnap, last.deletedSnap, last.printedSnap, last.skippedSnap, last.hesitatedSnap);
    setHistory((h) => h.slice(0, -1));
    setIdx((i) => Math.max(0, i - 1));
  };

  const handlePickAlbum = (id) => {
    if (!photo) return;
    addPhotoToAlbum(id, photo.id);
    setShowAlbumPicker(false);
    setNewAlbumName("");
    zoomableRef.current?.flyOff("up", () => swipe("up"));
  };

  const handleCreateAndAdd = () => {
    if (!photo) return;
    const trimmed = newAlbumName.trim();
    if (!trimmed) return;
    createAlbum(trimmed);
    const fresh = usePhotoStore.getState().albums;
    const newId = fresh[fresh.length - 1]?.id;
    if (newId) addPhotoToAlbum(newId, photo.id);
    setShowAlbumPicker(false);
    setNewAlbumName("");
    zoomableRef.current?.flyOff("up", () => swipe("up"));
  };

  if (!photo) return null;

  const pct = Math.round((idx / queue.length) * 100);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar hidden={true} />

      {/* Halo de feedback */}
      {feedbackEdge && (
        <Animated.View
          pointerEvents="none"
          style={[getEdgeContainerStyle(feedbackEdge), { opacity: feedbackOpacity, zIndex: 25 }]}
        >
          <LinearGradient {...getEdgeGradient(feedbackEdge, feedbackColor)} style={{ flex: 1 }} />
        </Animated.View>
      )}

      {/* Barre de progression */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 20, backgroundColor: "#333" }}>
        <View style={{ height: 3, width: `${pct}%`, backgroundColor: isAlbum ? C.album : C.accent }} />
      </View>

      {/* Header */}
      <View style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 15,
        paddingTop: Platform.OS === "android" ? 24 : 52,
      }}>
        <View style={{
          flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          paddingHorizontal: 16, paddingBottom: 8,
        }}>
          {/* Bouton gauche : placeholder vide en mode ménage, "← Retour" en mode album */}
          {isMenage ? (
            <View style={{ width: 40 }} />
          ) : (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{
                backgroundColor: "rgba(255,255,255,0.2)", borderRadius: S.radiusFull,
                paddingHorizontal: 14, paddingVertical: 8,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>← Retour</Text>
            </TouchableOpacity>
          )}

          <View style={{ alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{photo.location}</Text>
            <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 11 }}>{photo.year}</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* Compteur (ménage) ou badge album cliquable (album) */}
            {isAlbum ? (
              <TouchableOpacity
                onPress={() => setShowAlbumPreview(true)}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 5,
                  paddingHorizontal: 12, paddingVertical: 8,
                  backgroundColor: `${C.album}59`,
                  borderRadius: S.radiusFull, maxWidth: 150,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }} numberOfLines={1}>
                  📁 {albumName}
                </Text>
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", opacity: 0.85 }}>
                  {albumPreviewPhotos.length} ›
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{
                paddingHorizontal: 12, paddingVertical: 8,
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: S.radiusFull, maxWidth: 110,
              }}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                  {idx + 1} / {queue.length}
                </Text>
              </View>
            )}

            {/* ⚙️ Paramètres — ouvre la section swipe du mode courant */}
            <TouchableOpacity
              onPress={() => navigation.navigate("Settings", { focusSection: mode })}
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: S.radiusFull,
                width: 34, height: 34,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 15 }}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Photo principale */}
      <ZoomableImage
        ref={zoomableRef}
        uri={photo.url}
        onSwipeLeft={() => swipe("left")}
        onSwipeRight={() => swipe("right")}
        onSwipeUp={() => swipe("up")}
        onSwipeDown={() => swipe("down")}
      />

      {/* ── Boutons d'action ── */}
      <View style={{
        position: "absolute", bottom: 32, left: 0, right: 0,
        flexDirection: "row", justifyContent: "center",
        alignItems: "center", gap: 14, zIndex: 10,
      }}>

        {/* 🗑 Supprimer — la flèche suit la direction configurée ; masqué si "supprimer" n'est mappé sur aucun swipe */}
        {deleteDir && (
          <View style={{ alignItems: "center", gap: 5 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: "rgba(232,99,122,0.9)", letterSpacing: 0.3 }}>{DIR_LABEL[deleteDir]}</Text>
            <TouchableOpacity
              onPress={handleTrashPress}
              style={{
                backgroundColor: "rgba(232,99,122,0.2)", borderWidth: 2, borderColor: "rgba(232,99,122,.5)",
                borderRadius: S.radiusFull, padding: 18,
              }}
            >
              <Text style={{ fontSize: 20 }}>🗑</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ↩ Annuler */}
        <View style={{ alignItems: "center", gap: 5 }}>
          <Text style={{ fontSize: 10, opacity: 0 }}>_</Text>
          <TouchableOpacity
            onPress={undo}
            disabled={!history.length}
            style={{
              backgroundColor: history.length ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.4)",
              borderWidth: 2, borderColor: "rgba(0,0,0,0.08)",
              borderRadius: S.radiusFull, padding: 14,
              shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.35, shadowRadius: 6, elevation: 6,
            }}
          >
            <Text style={{ fontSize: 20, color: "#222", fontWeight: "800" }}>↩</Text>
          </TouchableOpacity>
        </View>

        {/* Mode MÉNAGE : ✅ conserver — repère du swipe qui garde la photo (contraire de 🗑) */}
        {isMenage && keepDir && (
          <View style={{ alignItems: "center", gap: 5 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: "rgba(92,184,122,0.9)", letterSpacing: 0.3 }}>{DIR_LABEL[keepDir]}</Text>
            <TouchableOpacity
              onPress={handleKeepPress}
              style={{
                backgroundColor: "rgba(92,184,122,0.2)", borderWidth: 2, borderColor: "rgba(92,184,122,.5)",
                borderRadius: S.radiusFull, padding: 18,
              }}
            >
              <Text style={{ fontSize: 20 }}>✅</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Mode MÉNAGE : ❤️ coup de cœur (favoris + passe à la suivante) */}
        {isMenage && (
          <View style={{ alignItems: "center", gap: 5 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: "rgba(92,184,122,0.9)", letterSpacing: 0.3 }}>appui</Text>
            <TouchableOpacity
              onPress={handleHeartPress}
              style={{
                backgroundColor: heartedThisPhoto ? "rgba(92,184,122,0.85)" : "rgba(92,184,122,0.2)",
                borderWidth: 2,
                borderColor: heartedThisPhoto ? "#5cb87a" : "rgba(92,184,122,.5)",
                borderRadius: S.radiusFull, padding: 18,
              }}
            >
              <Text style={{ fontSize: 20 }}>{heartedThisPhoto ? "❤️✓" : "❤️"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Mode ALBUM : 📁 ajouter à l'album — la flèche suit la direction configurée */}
        {isAlbum && albumDir && (
          <View style={{ alignItems: "center", gap: 5 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: "rgba(176,122,216,0.9)", letterSpacing: 0.3 }}>{DIR_LABEL[albumDir]}</Text>
            <TouchableOpacity
              onPress={handleAlbumPress}
              onLongPress={() => setShowAlbumPicker(true)}
              delayLongPress={350}
              style={{
                backgroundColor: "rgba(176,122,216,0.2)", borderWidth: 2, borderColor: "rgba(176,122,216,.5)",
                borderRadius: S.radiusFull, padding: 18,
              }}
            >
              <Text style={{ fontSize: 20 }}>📁</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Mode ALBUM : ⏭️ ne pas envoyer dans l'album — photo conservée, pourra revenir */}
        {isAlbum && keepDir && (
          <View style={{ alignItems: "center", gap: 5 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.8)", letterSpacing: 0.3 }}>{DIR_LABEL[keepDir]}</Text>
            <TouchableOpacity
              onPress={handleKeepPress}
              style={{
                backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 2, borderColor: "rgba(255,255,255,0.35)",
                borderRadius: S.radiusFull, padding: 18,
              }}
            >
              <Text style={{ fontSize: 20 }}>⏭️</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ❤️ coup de cœur retiré du mode album : en mode album l'objectif
            est de choisir les photos à mettre dans l'album, pas de créer des favoris. */}

      </View>

      {/* 🚪 Fin de tri — discret, bas gauche (ménage et album) */}
      <TouchableOpacity
          onPress={handleFinDeTri}
          style={{
            position: "absolute", bottom: 16, left: 20, zIndex: 15,
            backgroundColor: "rgba(255,255,255,0.12)",
            borderRadius: S.radiusFull,
            padding: 10,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.15)",
          }}
        >
          <Text style={{ fontSize: 22 }}>🚪</Text>
        </TouchableOpacity>

      {/* Modal picker d'album (long-press sur 📁) */}
      <Modal
        visible={showAlbumPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAlbumPicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: C.bg,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 22, paddingBottom: 36, maxHeight: SH * 0.75,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: C.text }}>Ajouter à un album</Text>
              <TouchableOpacity onPress={() => setShowAlbumPicker(false)}>
                <Text style={{ fontSize: 22, color: C.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>
              La photo sera ajoutée à l'album choisi.
            </Text>

            <ScrollView style={{ maxHeight: SH * 0.35 }}>
              {albums.length === 0 ? (
                <Text style={{ fontSize: 13, color: C.textMuted, fontStyle: "italic", textAlign: "center", paddingVertical: 16 }}>
                  Aucun album pour l'instant.
                </Text>
              ) : (
                albums.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => handlePickAlbum(a.id)}
                    style={{
                      backgroundColor: C.bgCard, borderRadius: 14, padding: 14,
                      borderWidth: 1, borderColor: C.border, marginBottom: 8,
                      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{a.name}</Text>
                      <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                        {a.photoIds.length} photo{a.photoIds.length > 1 ? "s" : ""}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 18, color: C.album }}>＋</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                Nouvel album
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  value={newAlbumName}
                  onChangeText={setNewAlbumName}
                  placeholder="Ex. Vacances 2026"
                  placeholderTextColor={C.textMuted}
                  style={{
                    flex: 1, backgroundColor: C.bgCard, borderRadius: 12,
                    borderWidth: 1, borderColor: C.border,
                    paddingHorizontal: 14, paddingVertical: 10,
                    fontSize: 14, color: C.text,
                  }}
                />
                <TouchableOpacity
                  onPress={handleCreateAndAdd}
                  disabled={!newAlbumName.trim()}
                  style={{
                    backgroundColor: C.album, borderRadius: 12,
                    paddingHorizontal: 16, justifyContent: "center",
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

      {/* Modal aperçu de l'album — ne quitte pas la session de tri */}
      <Modal
        visible={showAlbumPreview}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAlbumPreview(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: C.bg,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 22, paddingBottom: 36, maxHeight: SH * 0.8,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: C.text }} numberOfLines={1}>
                📁 {albumName}
              </Text>
              <TouchableOpacity onPress={() => setShowAlbumPreview(false)}>
                <Text style={{ fontSize: 22, color: C.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>
              {albumPreviewPhotos.length} photo{albumPreviewPhotos.length > 1 ? "s" : ""} dans cet album
            </Text>

            {albumPreviewPhotos.length === 0 ? (
              <Text style={{ fontSize: 13, color: C.textMuted, fontStyle: "italic", textAlign: "center", paddingVertical: 30 }}>
                Aucune photo dans l'album pour l'instant.{"\n"}Swipe vers le haut pour en ajouter.
              </Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {albumPreviewPhotos.map((p) => (
                    <Image
                      key={p.id}
                      source={{ uri: p.url }}
                      style={{ width: (SW - 44 - 12) / 3, height: (SW - 44 - 12) / 3, borderRadius: 10 }}
                    />
                  ))}
                </View>
              </ScrollView>
            )}

            <TouchableOpacity
              onPress={() => setShowAlbumPreview(false)}
              style={{
                marginTop: 18, backgroundColor: C.album, borderRadius: 14,
                padding: 15, alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Continuer le tri →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
