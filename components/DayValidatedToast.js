// Bandeau "🔥 Journée validée !" affiché pendant le tri, au moment précis où
// l'user atteint STREAK_MIN photos triées dans la journée.
// Se pose dans un écran de tri (SwipeScreen, DuplicatesScreen) : il écoute le
// compteur du jour dans le store et réagit au passage du seuil.
// pointerEvents="none" : ne bloque jamais le swipe.
import { useEffect, useRef, useState } from "react";
import { Animated, Text, View, Platform } from "react-native";
import { usePhotoStore, dayKey } from "../store/usePhotoStore";
import { computeStreak, STREAK_MIN } from "../services/progressStats";

// Déjà affiché aujourd'hui ? (variable de module : survit au changement d'écran,
// évite de ré-afficher après un ↩ annuler puis re-trier)
let shownForDay = null;

export function DayValidatedToast() {
  const todaySorted = usePhotoStore((s) => s.dailyLog?.[dayKey()]?.sorted || 0);
  const prev = useRef(todaySorted);
  const anim = useRef(new Animated.Value(0)).current;
  const [streakDays, setStreakDays] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const before = prev.current;
    prev.current = todaySorted;
    const today = dayKey();
    // Passage du seuil pendant que l'écran est ouvert
    if (before < STREAK_MIN && todaySorted >= STREAK_MIN && shownForDay !== today) {
      shownForDay = today;
      setStreakDays(computeStreak(usePhotoStore.getState().dailyLog).current);
      setVisible(true);
      anim.setValue(0);
      Animated.sequence([
        Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 6 }),
        Animated.delay(2200),
        Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    }
  }, [todaySorted]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: Platform.OS === "android" ? 20 : 56, left: 16, right: 16, zIndex: 50, alignItems: "center" }}>
      <Animated.View style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
        ],
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "#1a2840", borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14,
        shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 10,
      }}>
        <Text style={{ fontSize: 26 }}>🔥</Text>
        <View>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>Journée validée !</Text>
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 1 }}>
            Série : {streakDays} jour{streakDays > 1 ? "s" : ""} d'affilée
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
