// screens/SwipeScreen.js
import { useState, useRef } from "react";
import { View, Text, Image, TouchableOpacity, Animated, PanResponder, ActivityIndicator, Dimensions, Platform, StatusBar } from "react-native";
import { C, S } from "../constants/theme";
import { useAndroidBack } from "../hooks/useAndroidBack";
import { getPhotoAdvice, enhancePhoto } from "../services/aiService";

const { width: SW, height: SH } = Dimensions.get("window");

export function SwipeScreen({ queue, onDone, onBack }) {
  const [idx, setIdx]         = useState(0);
  const [kept, setKept]       = useState([]);
  const [deleted, setDeleted] = useState([]);
  const [printed, setPrinted] = useState([]);
  const [history, setHistory] = useState([]);
  const [showTip, setShowTip] = useState(true);
  const [aiPanel, setAiPanel] = useState(false);
  const [aiMode, setAiMode]   = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [advice, setAdvice]   = useState(null);
  const [enhanced, setEnhanced] = useState(null);

  useAndroidBack(onBack);

  const pan = useRef(new Animated.ValueXY()).current;
  const rotate = pan.x.interpolate({ inputRange: [-SW / 2, 0, SW / 2], outputRange: ["-15deg", "0deg", "15deg"] });
  const photo = queue[idx] || null;
  const similarPhotos = photo
    ? queue.filter(p => p.id !== photo.id && (p.year === photo.year || p.faces?.some(f => photo.faces?.includes(f))))
    : [];

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      if (g.dx > 100) swipe("right");
      else if (g.dx < -100) swipe("left");
      else if (g.dy < -100) swipe("up");
      else Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
  });

  const swipe = (dir) => {
    if (!photo) return;
    setAiPanel(false); setAdvice(null); setEnhanced(null); setAiMode(null);
    const toX = dir === "left" ? -SW * 1.5 : dir === "right" ? SW * 1.5 : 0;
    const toY = dir === "up" ? -SH : 0;
    Animated.timing(pan, { toValue: { x: toX, y: toY }, duration: 300, useNativeDriver: false }).start(() => {
      const nk = dir === "right" ? [...kept, photo]   : kept;
      const nd = dir === "left"  ? [...deleted, photo] : deleted;
      const np = dir === "up"    ? [...printed, photo] : printed;
      setHistory(h => [...h, { photo, dir, keptSnap: kept, deletedSnap: deleted, printedSnap: printed }]);
      setKept(nk); setDeleted(nd); setPrinted(np);
      pan.setValue({ x: 0, y: 0 });
      if (idx >= queue.length - 1) onDone({ kept: nk, deleted: nd, printed: np });
      else setIdx(i => i + 1);
    });
  };

  const undo = () => {
    if (!history.length) return;
    const last = history[history.length - 1];
    setKept(last.keptSnap); setDeleted(last.deletedSnap); setPrinted(last.printedSnap);
    setHistory(h => h.slice(0, -1));
    setIdx(i => Math.max(0, i - 1));
  };

  const doAdvice = async () => {
    setAiLoading(true); setAiMode("advice"); setAdvice(null);
    const result = await getPhotoAdvice(photo, similarPhotos.length);
    setAdvice(result);
    setAiLoading(false);
  };

  const doEnhance = async () => {
    setAiLoading(true); setAiMode("enhance"); setEnhanced(null);
    const result = await enhancePhoto(photo);
    setEnhanced(result);
    setAiLoading(false);
  };

  if (!photo) return null;
  const pct = Math.round((idx / queue.length) * 100);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Barre de progression */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 20, backgroundColor: "#333" }}>
        <View style={{ height: 3, width: `${pct}%`, backgroundColor: C.accent }} />
      </View>

      {/* Header */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 15, paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 8 : 52 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={onBack} style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: S.radiusFull, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>← Retour</Text>
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{photo.location}</Text>
            <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 11 }}>{photo.year}</Text>
          </View>
          <TouchableOpacity onPress={() => { setAiPanel(!aiPanel); setAdvice(null); setEnhanced(null); setAiMode(null); }} style={{ backgroundColor: "rgba(244,132,95,0.4)", borderRadius: S.radiusFull, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(244,132,95,.6)" }}>
            <Text style={{ color: "#ffc8a8", fontWeight: "700", fontSize: 12 }}>✨ IA</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Carte swipeable */}
      <Animated.View {...panResponder.panHandlers} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] }}>
        <Image source={{ uri: photo.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        <Animated.View style={{ position: "absolute", top: "40%", left: 20, opacity: pan.x.interpolate({ inputRange: [-50, 0], outputRange: [1, 0], extrapolate: "clamp" }) }}>
          <View style={{ backgroundColor: "rgba(232,99,122,0.9)", borderRadius: 8, padding: 8, borderWidth: 2, borderColor: C.red }}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 20 }}>SUPPR.</Text>
          </View>
        </Animated.View>
        <Animated.View style={{ position: "absolute", top: "40%", right: 20, opacity: pan.x.interpolate({ inputRange: [0, 50], outputRange: [0, 1], extrapolate: "clamp" }) }}>
          <View style={{ backgroundColor: "rgba(92,184,122,0.9)", borderRadius: 8, padding: 8, borderWidth: 2, borderColor: C.green }}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 20 }}>GARDER</Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Compteur */}
      <View style={{ position: "absolute", bottom: 130, right: 20, backgroundColor: "rgba(253,246,240,0.8)", borderRadius: S.radiusFull, paddingHorizontal: 12, paddingVertical: 4, zIndex: 10 }}>
        <Text style={{ color: C.textMid, fontWeight: "600", fontSize: 12 }}>{idx + 1}/{queue.length}</Text>
      </View>

      {/* Tip premier lancement */}
      {showTip && idx === 0 && (
        <TouchableOpacity onPress={() => setShowTip(false)} style={{ position: "absolute", top: "45%", alignSelf: "center", zIndex: 20, backgroundColor: "rgba(253,246,240,0.95)", borderRadius: S.radius, padding: 20, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.textMid, fontSize: 13, lineHeight: 24, textAlign: "center" }}>{"← Supprimer\n↑ Imprimer\n→ Garder\n\nTouche pour fermer"}</Text>
        </TouchableOpacity>
      )}

      {/* Panneau IA */}
      {aiPanel && (
        <View style={{ position: "absolute", bottom: 105, left: 12, right: 12, zIndex: 30, backgroundColor: "rgba(253,246,240,0.97)", borderRadius: 22, padding: 16, borderWidth: 1, borderColor: C.border, elevation: 8 }}>
          {!aiMode && (
            <View style={{ gap: 10 }}>
              <Text style={{ textAlign: "center", fontWeight: "700", fontSize: 11, color: C.textMuted, letterSpacing: 1, marginBottom: 4 }}>ASSISTANT IA</Text>
              <TouchableOpacity onPress={doEnhance} style={{ backgroundColor: "#f0e8ff", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text style={{ fontSize: 24 }}>✨</Text>
                <View>
                  <Text style={{ fontWeight: "800", fontSize: 14, color: C.purple }}>Améliorer la photo</Text>
                  <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Couleurs, lumière, contraste</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={doAdvice} style={{ backgroundColor: "#fff5f0", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text style={{ fontSize: 24 }}>🧠</Text>
                <View>
                  <Text style={{ fontWeight: "800", fontSize: 14, color: C.accent }}>Conseil IA</Text>
                  <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Garder · Supprimer · Imprimer</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
          {aiLoading && (
            <View style={{ alignItems: "center", padding: 16 }}>
              <ActivityIndicator color={C.accent} size="large" />
              <Text style={{ marginTop: 12, fontWeight: "700", color: C.accent }}>{aiMode === "advice" ? "Analyse en cours…" : "Amélioration en cours…"}</Text>
            </View>
          )}
          {enhanced && !aiLoading && (
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Text style={{ fontSize: 20 }}>✨</Text>
                <Text style={{ fontWeight: "800", fontSize: 14, color: C.purple, flex: 1 }}>Photo améliorée</Text>
                <TouchableOpacity onPress={() => { setEnhanced(null); setAiMode(null); }}><Text style={{ fontSize: 18, color: C.textMuted }}>✕</Text></TouchableOpacity>
              </View>
              <View style={{ backgroundColor: "#f0e8ff", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: C.purple, fontWeight: "600" }}>{enhanced}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={() => swipe("right")} style={{ flex: 1, backgroundColor: C.green, borderRadius: 12, padding: 11, alignItems: "center" }}><Text style={{ color: "#fff", fontWeight: "700" }}>❤️ Garder</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => swipe("up")} style={{ flex: 1, backgroundColor: C.purple, borderRadius: 12, padding: 11, alignItems: "center" }}><Text style={{ color: "#fff", fontWeight: "700" }}>🖨 Imprimer</Text></TouchableOpacity>
              </View>
            </View>
          )}
          {advice && !aiLoading && (
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Text style={{ fontSize: 20 }}>🧠</Text>
                <Text style={{ fontWeight: "800", fontSize: 14, color: C.accent, flex: 1 }}>Conseil IA</Text>
                <TouchableOpacity onPress={() => { setAdvice(null); setAiMode(null); }}><Text style={{ fontSize: 18, color: C.textMuted }}>✕</Text></TouchableOpacity>
              </View>
              <View style={{ backgroundColor: advice.decision === "Garder" ? "#e8f8ee" : advice.decision === "Supprimer" ? "#ffe8e8" : "#f0e8ff", borderRadius: 14, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 28 }}>{advice.decision === "Garder" ? "❤️" : advice.decision === "Supprimer" ? "🗑" : "🖨"}</Text>
                <View>
                  <Text style={{ fontWeight: "900", fontSize: 16, color: advice.decision === "Garder" ? C.green : advice.decision === "Supprimer" ? C.red : C.purple }}>{advice.decision}</Text>
                  <Text style={{ fontSize: 11, color: C.textMuted }}>Score : {advice.score}/10</Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: C.textMid, marginBottom: 8, lineHeight: 18 }}>{advice.raison}</Text>
              <View style={{ backgroundColor: similarPhotos.length > 0 ? "#fff8e0" : "#f0fff4", borderRadius: 12, padding: 10, marginBottom: 12, flexDirection: "row", gap: 8 }}>
                <Text style={{ fontSize: 14 }}>{similarPhotos.length > 0 ? "⚠️" : "✅"}</Text>
                <Text style={{ fontSize: 12, color: C.textMid, flex: 1, lineHeight: 18 }}>{advice.similaires}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity onPress={() => swipe("left")} style={{ flex: 1, backgroundColor: "#ffe8e8", borderRadius: 12, padding: 10, alignItems: "center" }}><Text style={{ color: C.red, fontWeight: "700", fontSize: 12 }}>🗑 Suppr.</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => swipe("right")} style={{ flex: 1, backgroundColor: "#e8f8ee", borderRadius: 12, padding: 10, alignItems: "center" }}><Text style={{ color: C.green, fontWeight: "700", fontSize: 12 }}>❤️ Garder</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => swipe("up")} style={{ flex: 1, backgroundColor: "#f0e8ff", borderRadius: 12, padding: 10, alignItems: "center" }}><Text style={{ color: C.purple, fontWeight: "700", fontSize: 12 }}>🖨 Impr.</Text></TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Boutons bas */}
      <View style={{ position: "absolute", bottom: 32, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 14, zIndex: 10 }}>
        <TouchableOpacity onPress={() => swipe("left")} style={{ backgroundColor: "rgba(232,99,122,0.2)", borderWidth: 2, borderColor: "rgba(232,99,122,.5)", borderRadius: S.radiusFull, padding: 18 }}><Text style={{ fontSize: 22 }}>🗑</Text></TouchableOpacity>
        <TouchableOpacity onPress={undo} disabled={!history.length} style={{ backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 2, borderColor: "rgba(255,255,255,.2)", borderRadius: S.radiusFull, padding: 12, opacity: history.length ? 1 : 0.3 }}><Text style={{ fontSize: 18 }}>↩</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => swipe("up")} style={{ backgroundColor: "rgba(176,122,216,0.2)", borderWidth: 2, borderColor: "rgba(176,122,216,.5)", borderRadius: S.radiusFull, padding: 18 }}><Text style={{ fontSize: 22 }}>🖨</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => swipe("right")} style={{ backgroundColor: "rgba(92,184,122,0.2)", borderWidth: 2, borderColor: "rgba(92,184,122,.5)", borderRadius: S.radiusFull, padding: 18 }}><Text style={{ fontSize: 22 }}>❤️</Text></TouchableOpacity>
      </View>
    </View>
  );
}