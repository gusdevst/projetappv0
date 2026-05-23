import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  PanResponder,
  ActivityIndicator,
  Dimensions,
  Platform,
  StatusBar,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";

// Import défensif : si le module natif n'est pas dans le dev build (build pré-installation),
// on continue sans planter. Une fois le dev build rebuild, la fonctionnalité s'active toute seule.
let NavigationBar = null;
try {
  NavigationBar = require("expo-navigation-bar");
} catch (e) {
  // Module absent du build natif — on tournera sans nav bar hiding
}

import { C, S } from "../constants/theme";
import { getPhotoAdvice, enhancePhoto } from "../services/aiService";
import { usePhotoStore } from "../store/usePhotoStore";
const { width: SW, height: SH } = Dimensions.get("window");

export function SwipeScreen({ navigation, route }) {
  const queue = route.params?.queue ?? [];
  const [idx, setIdx] = useState(0);
 const { addKept, addDeleted, addPrinted, undoLast, albums, createAlbum, addPhotoToAlbum } = usePhotoStore();

  const [history, setHistory] = useState([]);
  const [showTip, setShowTip] = useState(true);

  const [aiPanel, setAiPanel] = useState(false);
  const [aiMode, setAiMode] = useState(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [advice, setAdvice] = useState(null);
  const [enhanced, setEnhanced] = useState(null);

  // Picker d'album déclenché par appui long sur l'icône 🖨 (album souvenirs)
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");

  // Sur Android : on cache la nav bar pendant le swipe pour une expérience immersive.
  // "overlay-swipe" permet à l'utilisateur de la faire réapparaître en glissant depuis le bas.
  // Skip si NavigationBar est null (module pas dans le dev build).
  useEffect(() => {
    if (Platform.OS === "android" && NavigationBar) {
      NavigationBar.setVisibilityAsync("hidden").catch(() => {});
      NavigationBar.setBehaviorAsync("overlay-swipe").catch(() => {});
    }
    return () => {
      if (Platform.OS === "android" && NavigationBar) {
        NavigationBar.setVisibilityAsync("visible").catch(() => {});
      }
    };
  }, []);

  const pan = useRef(new Animated.ValueXY()).current;

  const rotate = pan.x.interpolate({
    inputRange: [-SW / 2, 0, SW / 2],
    outputRange: ["-15deg", "0deg", "15deg"],
  });

  const photo = queue[idx] || null;

  const similarPhotos = photo
    ? queue.filter(
        (p) =>
          p.id !== photo.id &&
          (
            p.year === photo.year ||
            p.faces?.some((f) => photo.faces?.includes(f))
          )
      )
    : [];

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,

    onPanResponderMove: Animated.event(
      [null, { dx: pan.x, dy: pan.y }],
      { useNativeDriver: false }
    ),

    onPanResponderRelease: (_, g) => {
      if (g.dx > 100) {
        swipe("right");
      } else if (g.dx < -100) {
        swipe("left");
      } else if (g.dy < -100) {
        swipe("up");
      } else {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      }
    },
  });

const swipe = (dir) => {
    if (!photo) return;
    setAiPanel(false); setAdvice(null); setEnhanced(null); setAiMode(null);

    // Avant de modifier le store, on snapshot l'état actuel pour permettre l'undo.
    const stateNow = usePhotoStore.getState();
    setHistory((h) => [
      ...h,
      {
        keptSnap:    stateNow.kept,
        deletedSnap: stateNow.deleted,
        printedSnap: stateNow.printed,
      },
    ]);

    const toX = dir === "left" ? -SW * 1.5 : dir === "right" ? SW * 1.5 : 0;
    const toY = dir === "up" ? -SH : 0;
    Animated.timing(pan, { toValue: { x: toX, y: toY }, duration: 300, useNativeDriver: false }).start(() => {
      if (dir === "right") addKept(photo);
      if (dir === "left")  addDeleted(photo);
      if (dir === "up")    addPrinted(photo);
      pan.setValue({ x: 0, y: 0 });
      if (idx >= queue.length - 1) navigation.navigate("Summary");
      else setIdx(i => i + 1);
    });
  };

const undo = () => {
  if (!history.length) return;

  const last = history[history.length - 1];

  undoLast(last.keptSnap, last.deletedSnap, last.printedSnap);

  setHistory((h) => h.slice(0, -1));
  setIdx((i) => Math.max(0, i - 1));
};

  const doAdvice = async () => {
    setAiLoading(true);

    setAiMode("advice");
    setAdvice(null);

    const result = await getPhotoAdvice(
      photo,
      similarPhotos.length
    );

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

  // Ajoute la photo courante à un album existant, puis déclenche le swipe vers le haut
  // (= ajout à "printed" + passage à la photo suivante).
  const handlePickAlbum = (albumId) => {
    if (!photo) return;
    addPhotoToAlbum(albumId, photo.id);
    setShowAlbumPicker(false);
    setNewAlbumName("");
    swipe("up");
  };

  // Crée un nouvel album avec la photo courante dedans, puis swipe up.
  const handleCreateAndAdd = () => {
    if (!photo) return;
    const trimmed = newAlbumName.trim();
    if (!trimmed) return;
    createAlbum(trimmed);
    // createAlbum push en fin de tableau — on récupère l'id du dernier album créé.
    const fresh = usePhotoStore.getState().albums;
    const newAlbumId = fresh[fresh.length - 1]?.id;
    if (newAlbumId) addPhotoToAlbum(newAlbumId, photo.id);
    setShowAlbumPicker(false);
    setNewAlbumName("");
    swipe("up");
  };

  if (!photo) {
    return null;
  }

  const pct = Math.round(
    (idx / queue.length) * 100
  );
const handleBack = () => {
  navigation.goBack();
};
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* Barre progression */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          zIndex: 20,
          backgroundColor: "#333",
        }}
      >
        <View
          style={{
            height: 3,
            width: `${pct}%`,
            backgroundColor: C.accent,
          }}
        />
      </View>

      {/* Header */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 15,
          paddingTop:
            Platform.OS === "android"
              ? StatusBar.currentHeight + 8
              : 52,
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
            <Text
              style={{
                color: "#fff",
                fontWeight: "700",
                fontSize: 13,
              }}
            >
              ← Retour
            </Text>
          </TouchableOpacity>

          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                color: "#fff",
                fontWeight: "700",
                fontSize: 13,
              }}
            >
              {photo.location}
            </Text>

            <Text
              style={{
                color: "rgba(255,255,255,.6)",
                fontSize: 11,
              }}
            >
              {photo.year}
            </Text>
          </View>

          {/* Bouton IA masqué pour le MVP — réactivation en Phase 4 quand le backend proxy sera en place */}
          <View style={{ width: 56 }} />
        </View>
      </View>

      {/* Image swipe */}
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { rotate },
          ],
        }}
      >
        <Image
          source={{ uri: photo.url }}
          style={{
            width: "100%",
            height: "100%",
          }}
          resizeMode="cover"
        />
      </Animated.View>

      {/* Boutons */}
      <View
        style={{
          position: "absolute",
          bottom: 32,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 14,
          zIndex: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => swipe("left")}
          style={{
            backgroundColor: "rgba(232,99,122,0.2)",
            borderWidth: 2,
            borderColor: "rgba(232,99,122,.5)",
            borderRadius: S.radiusFull,
            padding: 18,
          }}
        >
          <Text style={{ fontSize: 22 }}>
            🗑
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={undo}
          disabled={!history.length}
          style={{
            backgroundColor: "rgba(255,255,255,0.15)",
            borderWidth: 2,
            borderColor: "rgba(255,255,255,.2)",
            borderRadius: S.radiusFull,
            padding: 12,
            opacity: history.length ? 1 : 0.3,
          }}
        >
          <Text style={{ fontSize: 18 }}>
            ↩
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => swipe("up")}
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
          <Text style={{ fontSize: 22 }}>
            🖨
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => swipe("right")}
          style={{
            backgroundColor: "rgba(92,184,122,0.2)",
            borderWidth: 2,
            borderColor: "rgba(92,184,122,.5)",
            borderRadius: S.radiusFull,
            padding: 18,
          }}
        >
          <Text style={{ fontSize: 22 }}>
            ❤️
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal : picker d'album (déclenché par long-press sur 🖨) */}
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

            <Text
              style={{
                fontSize: 12,
                color: C.textMuted,
                marginBottom: 16,
              }}
            >
              La photo sera ajoutée à l'album souvenirs et à l'album choisi.
            </Text>

            {/* Liste des albums existants */}
            <ScrollView style={{ maxHeight: SH * 0.35 }}>
              {albums.length === 0 ? (
                <Text
                  style={{
                    fontSize: 13,
                    color: C.textMuted,
                    fontStyle: "italic",
                    textAlign: "center",
                    paddingVertical: 16,
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
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: C.text,
                        }}
                      >
                        {a.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: C.textMuted,
                          marginTop: 2,
                        }}
                      >
                        {a.photoIds.length} photo{a.photoIds.length > 1 ? "s" : ""}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 18, color: C.accent }}>＋</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {/* Création d'un nouvel album */}
            <View
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTopWidth: 1,
                borderTopColor: C.border,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: C.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 10,
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
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
                    Créer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
