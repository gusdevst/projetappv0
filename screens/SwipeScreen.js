import { useState, useRef } from "react";
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
} from "react-native";

import { C, S } from "../constants/theme";
import { getPhotoAdvice, enhancePhoto } from "../services/aiService";
import { usePhotoStore } from "../store/usePhotoStore";
const { width: SW, height: SH } = Dimensions.get("window");

export function SwipeScreen({ navigation, route }) {
  const queue = route.params?.queue ?? [];
  const [idx, setIdx] = useState(0);
 const { addKept, addDeleted, addPrinted, undoLast } = usePhotoStore();

  const [history, setHistory] = useState([]);
  const [showTip, setShowTip] = useState(true);

  const [aiPanel, setAiPanel] = useState(false);
  const [aiMode, setAiMode] = useState(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [advice, setAdvice] = useState(null);
  const [enhanced, setEnhanced] = useState(null);

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

          <TouchableOpacity
            onPress={() => {
              setAiPanel(!aiPanel);
              setAdvice(null);
              setEnhanced(null);
              setAiMode(null);
            }}
            style={{
              backgroundColor: "rgba(244,132,95,0.4)",
              borderRadius: S.radiusFull,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: "rgba(244,132,95,.6)",
            }}
          >
            <Text
              style={{
                color: "#ffc8a8",
                fontWeight: "700",
                fontSize: 12,
              }}
            >
              ✨ IA
            </Text>
          </TouchableOpacity>
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
    </View>
  );
}
