import { useState, useRef, useEffect } from "react";
import {
  View,
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
  Alert,
} from "react-native";
import Text from "../components/AppText";

let NavigationBar = null;
try {
  NavigationBar = require("expo-navigation-bar");
} catch (e) {}

import { LinearGradient } from "expo-linear-gradient";
import { C, S, FONT } from "../constants/theme";
import Icon from "../components/Icons";
import { usePhotoStore } from "../store/usePhotoStore";
import { ZoomableImage } from "../components/ZoomableImage";
import { SessionTutoOverlay } from "../components/SessionTutoOverlay";
import { SwipeEdgeHints } from "../components/SwipeEdgeHints";
import { DayValidatedToast } from "../components/DayValidatedToast";
import { BadgeUnlockBanner } from "../components/AchievementUnlocks";
import { sharePhoto, getShareableUri } from "../services/photoShare";

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

// "#4c7a2b" + 0.7 → "rgba(76,122,43,0.7)" : les halos suivent la palette du thème.
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
// Couleur du flash au moment du swipe, par action.
const HALO = {
  keep:     rgba(C.accent2, 0.75), // garder / coup de cœur
  delete:   rgba(C.red, 0.72),
  hesitate: "rgba(224,160,58,0.7)", // ambre (neutre, hors palette)
  album:    rgba(C.album, 0.72),
  share:    "rgba(125,155,179,0.7)", // bleu-gris (neutre, hors palette)
};

// Bouton rond « verre dépoli » posé sur la photo.
const GLASS = { backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" };

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
    swipeTutoSeen, setSwipeTutoSeen,
    albumTutoSeen, setAlbumTutoSeen,
  } = usePhotoStore();

  // ── Tuto 1re session ───────────────────────────────────────────────────
  // On affiche l'overlay explicatif une seule fois par mode.
  const tutoAlreadySeen = isAlbum ? albumTutoSeen : swipeTutoSeen;
  const [showTuto, setShowTuto] = useState(!tutoAlreadySeen);
  const closeTuto = () => {
    setShowTuto(false);
    if (isAlbum) setAlbumTutoSeen(true);
    else         setSwipeTutoSeen(true);
  };

  // Bon mapping selon le mode
  const swipeMappings = isAlbum ? swipeMappingsAlbum : swipeMappingsMenage;

  // Retrouve la direction de swipe configurée par l'user pour une action donnée.
  // Les flèches affichées au-dessus des boutons suivent ainsi le paramétrage.
  // Priorité haut > droite > gauche > bas si plusieurs directions ont la même action.
  const dirFor = (action) => ["up", "right", "left", "down"].find((d) => swipeMappings?.[d] === action) || null;
  const albumDir  = dirFor("album");  // ajouter à l'album (mode album)

  const [history, setHistory]     = useState([]);

  // ── Compteurs locaux de session ─────────────────────────────────────────
  // Ces compteurs ne voient que CE tri, pas les sessions précédentes.
  // On les passe à Summary via route.params.
  const [sessionKept,          setSessionKept]          = useState([]);   // photos gardées ❤️
  const [sessionDeleted,       setSessionDeleted]        = useState([]);   // photos supprimées 🗑
  const [sessionHesitated,     setSessionHesitated]      = useState([]);   // photos hésitées 🤔
  const [sessionAlbumPhotos,   setSessionAlbumPhotos]    = useState([]);   // photos ajoutées à l'album 📕
  const [sessionConserved,     setSessionConserved]      = useState([]);   // photos conservées (ménage) 💚

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
  const [feedbackColor, setFeedbackColor] = useState(HALO.delete);
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

  // ── Partage par swipe ─────────────────────────────────────────────────────
  // Directions réglées sur "Partager" : la photo rebondit au lieu de s'envoler.
  const shareDirs = ["up", "down", "left", "right"].filter((d) => swipeMappings?.[d] === "share");
  const sharingRef = useRef(false); // évite d'ouvrir 2 feuilles de partage d'affilée

  // Préchargement : on prépare le fichier HD dès que la photo s'affiche,
  // comme un colis emballé avant l'arrivée du livreur → feuille instantanée.
  useEffect(() => {
    if (photo && shareDirs.length) getShareableUri(photo.id).catch(() => {});
  }, [photo?.id, shareDirs.length]);

  const handleShare = async (dir) => {
    if (!photo || sharingRef.current) return;
    sharingRef.current = true;
    flashFeedback(HALO.share, dir);
    const ok = await sharePhoto(photo.id);
    sharingRef.current = false;
    if (!ok) Alert.alert("Partage impossible", "Cette photo n'a pas pu être préparée pour le partage.");
  };

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

    if (actionKey === "delete")            flashFeedback(HALO.delete, animDir);
    // "skip" en album = "ne pas envoyer" → pas de halo (feedback serait trompeur)
    if (actionKey === "skip" && isMenage) flashFeedback(HALO.keep, animDir);
    if (actionKey === "hesitate")         flashFeedback(HALO.hesitate, animDir);
    if (actionKey === "album")    flashFeedback(HALO.album, animDir);
    if (actionKey === "favorite") flashFeedback(HALO.keep, animDir);

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
    if (actionKey === "share") { handleShare(dir); return; } // pas une décision de tri
    performAction(actionKey, dir);
  };

  // Appui sur un bord = même effet que le swipe dans cette direction.
  // La photo s'envole d'abord (comme un vrai swipe), puis l'action s'applique.
  const handleEdgePress = (dir) => {
    const actionKey = swipeMappings?.[dir] || "none";
    if (actionKey === "none") return;
    if (actionKey === "share") { handleShare(dir); return; } // partage : la photo reste
    zoomableRef.current?.flyOff(dir, () => performAction(actionKey, dir));
  };
  // Appui long sur le bord "album" = choisir l'album (comme l'appui long sur 📕).
  const handleEdgeLongPress = (dir) => {
    if (isAlbum && swipeMappings?.[dir] === "album") setShowAlbumPicker(true);
  };
  // Cœur = coup de cœur (favoris) + on conserve la photo et on passe à la suivante.
  // performAction("favorite") gère l'ajout aux favoris, l'historique (undo) et l'avance.
  const handleHeartPress = () => {
    if (!photo) return;
    setHeartedThisPhoto(true);
    performAction("favorite", null);
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

  // Échelle responsive de la barre de boutons.
  // Référence 390 px (largeur d'un iPhone standard) → scale = 1 = tailles actuelles.
  // Écran plus étroit → on réduit proportionnellement pour tout garder sur une ligne.
  const uiScale = Math.min(1, SW / 390);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar hidden={true} />

      {/* Tuto affiché une seule fois à la 1re session du mode courant */}
      <SessionTutoOverlay visible={showTuto} mode={mode} onClose={closeTuto} />

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
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 20, backgroundColor: "rgba(255,255,255,0.18)" }}>
        <View style={{ height: 3, width: `${pct}%`, backgroundColor: isAlbum ? C.albumSoft : C.sage2 }} />
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
              style={[GLASS, { borderRadius: S.radiusFull, paddingHorizontal: 12, paddingVertical: 7 }]}
            >
              <Text style={{ color: "#fff", fontWeight: "500", fontSize: 12.5 }}>← Retour</Text>
            </TouchableOpacity>
          )}

          <View style={{ alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13, textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 4 }}>{photo.location}</Text>
            <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 11, textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 4 }}>{photo.year}</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* Compteur (ménage) ou badge album cliquable (album) */}
            {isAlbum ? (
              <TouchableOpacity
                onPress={() => setShowAlbumPreview(true)}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 5,
                  paddingHorizontal: 11, paddingVertical: 7,
                  backgroundColor: rgba(C.album, 0.55), borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
                  borderRadius: S.radiusFull, maxWidth: 150,
                }}
              >
                <Icon name="album" size={13} color="#fff" strokeWidth={2.2} />
                <Text style={{ color: "#fff", fontSize: 11.5, fontWeight: "500", flexShrink: 1 }} numberOfLines={1}>
                  {albumName}
                </Text>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600", opacity: 0.85 }}>
                  {albumPreviewPhotos.length} ›
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[GLASS, { paddingHorizontal: 12, paddingVertical: 7, borderRadius: S.radiusFull, maxWidth: 110 }]}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "500" }}>
                  {idx + 1} / {queue.length}
                </Text>
              </View>
            )}

            {/* ⚙️ Paramètres — ouvre la section swipe du mode courant */}
            <TouchableOpacity
              onPress={() => navigation.navigate("Settings", { focusSection: mode })}
              style={[GLASS, { borderRadius: S.radiusFull, width: 34, height: 34, alignItems: "center", justifyContent: "center" }]}
            >
              <Icon name="gear" size={17} color="#fff" />
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
        bounceDirs={shareDirs}
      />

      {/* Filigranes des actions sur les 4 bords */}
      <SwipeEdgeHints
        mappings={swipeMappings}
        isMenage={isMenage}
        onPress={handleEdgePress}
        onLongPress={handleEdgeLongPress}
      />

      {/* ── Boutons d'action ── */}
      <View style={{
        position: "absolute", bottom: 32, left: 0, right: 0,
        flexDirection: "row", justifyContent: "center",
        alignItems: "center", gap: 28, zIndex: 10,
        transform: [{ scale: uiScale }],
      }}>

        {/* Fin de tri (icône sortie) */}
        <View style={{ alignItems: "center", gap: 5 }}>
          <TouchableOpacity
            onPress={handleFinDeTri}
            style={[GLASS, { borderRadius: S.radiusFull, width: 46, height: 46, alignItems: "center", justifyContent: "center" }]}
          >
            <Icon name="exit" size={21} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ↩ Annuler */}
        <View style={{ alignItems: "center", gap: 5 }}>
          <TouchableOpacity
            onPress={undo}
            disabled={!history.length}
            style={{
              backgroundColor: history.length ? rgba(C.bgCard, 0.96) : rgba(C.bgCard, 0.45),
              borderRadius: S.radiusFull, width: 54, height: 54,
              alignItems: "center", justifyContent: "center",
              shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
            }}
          >
            <Icon name="undo" size={22} color={C.text} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {/* Mode MÉNAGE : ❤️ coup de cœur (favoris + passe à la suivante) */}
        {isMenage && (
          <View style={{ alignItems: "center", gap: 5 }}>
            <TouchableOpacity
              onPress={handleHeartPress}
              style={{
                backgroundColor: heartedThisPhoto ? C.accent : rgba(C.accent, 0.28),
                borderWidth: 2,
                borderColor: heartedThisPhoto ? C.sage2 : rgba(C.sage3, 0.75),
                borderRadius: S.radiusFull, width: 62, height: 62,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Icon name="heart" size={26} color="#fff" strokeWidth={2} filled={heartedThisPhoto} />
            </TouchableOpacity>
          </View>
        )}

        {/* Mode ALBUM : 📕 ajouter à l'album (appui long = choisir l'album) */}
        {isAlbum && albumDir && (
          <View style={{ alignItems: "center", gap: 5 }}>
            <TouchableOpacity
              onPress={handleAlbumPress}
              onLongPress={() => setShowAlbumPicker(true)}
              delayLongPress={350}
              style={{
                backgroundColor: rgba(C.album, 0.3), borderWidth: 2, borderColor: rgba(C.albumSoft, 0.7),
                borderRadius: S.radiusFull, width: 62, height: 62,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Icon name="album" size={25} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}

        {/* ❤️ coup de cœur retiré du mode album : en mode album l'objectif
            est de choisir les photos à mettre dans l'album, pas de créer des favoris. */}

      </View>

      {/* Modal picker d'album (long-press sur 📕) */}
      <Modal
        visible={showAlbumPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAlbumPicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(35,39,31,0.55)", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: C.bg,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 22, paddingBottom: 36, maxHeight: SH * 0.75,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ fontSize: 18, fontWeight: "600", color: C.text }}>Ajouter à un album</Text>
              <TouchableOpacity onPress={() => setShowAlbumPicker(false)}>
                <Icon name="close" size={20} color={C.textMuted} />
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
                      backgroundColor: C.bgCard, borderRadius: 14, padding: 14, marginBottom: 8,
                      shadowColor: "#3c3c28", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
                      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "500", color: C.text }}>{a.name}</Text>
                      <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                        {a.photoIds.length} photo{a.photoIds.length > 1 ? "s" : ""}
                      </Text>
                    </View>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 17, color: C.album }}>＋</Text></View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
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
                    fontSize: 14, color: C.text, fontFamily: FONT,
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
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Créer</Text>
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
        <View style={{ flex: 1, backgroundColor: "rgba(35,39,31,0.55)", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: C.bg,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 22, paddingBottom: 36, maxHeight: SH * 0.8,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <Icon name="album" size={19} color={C.album} />
                <Text style={{ fontSize: 18, fontWeight: "600", color: C.text, flexShrink: 1 }} numberOfLines={1}>{albumName}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAlbumPreview(false)}>
                <Icon name="close" size={20} color={C.textMuted} />
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
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Continuer le tri →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bandeau "🔥 Journée validée !" au passage des 10 photos du jour.
          Placé en dernier = dessiné au-dessus de tout le reste. */}
      <DayValidatedToast />

      {/* Bandeau "Nouveau badge" (le nouveau galon, lui, attend le Bilan) */}
      <BadgeUnlockBanner />
    </View>
  );
}
