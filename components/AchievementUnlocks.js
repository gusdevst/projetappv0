// Animation de déblocage d'un galon.
//
//   <RankUnlockModal />    grande fenêtre "Nouveau galon" (maquette 5). À poser dans les écrans
//                          de FIN de session (Bilan, accueil) : jamais en plein swipe.
//
// Elle lit la file pendingUnlocks du store et n'agit que si son écran est au premier plan
// (useIsFocused) → pas de doublon quand plusieurs écrans sont empilés.
// Elle déclenche aussi la vérification (checkAchievements) quand le nombre de photos triées bouge.
import { useEffect, useRef, useState } from "react";
import { Animated, Modal, View, TouchableOpacity } from "react-native";
import Text from "./AppText";
import { useIsFocused } from "@react-navigation/native";
import { C } from "../constants/theme";
import { usePhotoStore, dayKey } from "../store/usePhotoStore";
import { RANKS } from "../services/achievements";
import { RankShield, METALS } from "./RankShield";

const isRank = (id) => id.startsWith("rank-");

// Relance la vérification quand le nombre de photos triées change.
function useAchievementWatcher(active) {
  const sortedToday = usePhotoStore((s) => s.dailyLog?.[dayKey()]?.sorted || 0);
  const check       = usePhotoStore((s) => s.checkAchievements);
  useEffect(() => { if (active) check(); }, [active, sortedToday]);
}

// ─── Fenêtre nouveau galon ─────────────────────────────────────────────────
export function RankUnlockModal() {
  const focused = useIsFocused();
  useAchievementWatcher(focused);
  const pending = usePhotoStore((s) => s.pendingUnlocks);
  const consume = usePhotoStore((s) => s.consumeUnlocks);
  const [rank, setRank] = useState(null);
  const pop   = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;

  const rankIds = focused && !rank ? pending.filter(isRank) : [];

  useEffect(() => {
    if (rankIds.length === 0) return;
    // Plusieurs galons d'un coup → on n'affiche que le plus haut.
    const best = RANKS.filter((r) => rankIds.includes(r.id)).pop();
    consume(rankIds);
    if (!best) return;
    setRank(best);
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 4, tension: 60 }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(shine, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(shine, { toValue: 0, duration: 800, useNativeDriver: true }),
    ])).start();
  }, [rankIds.join(",")]);

  if (!rank) return null;
  const idx  = RANKS.findIndex((r) => r.id === rank.id);
  const next = RANKS[idx + 1];
  const metal = METALS[rank.metal];

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => { shine.stopAnimation(); setRank(null); }}>
      <View style={{ flex: 1, backgroundColor: "rgba(35,39,31,0.55)", alignItems: "center", justifyContent: "center", padding: 28 }}>
        <View style={{ backgroundColor: C.bgCard, borderRadius: 24, padding: 22, width: "100%", maxWidth: 320, alignItems: "center" }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: metal.text, letterSpacing: 1 }}>NOUVEAU GALON</Text>

          <View style={{ marginVertical: 18, alignItems: "center", justifyContent: "center" }}>
            {/* Halo qui pulse derrière l'écusson */}
            <Animated.View style={{
              position: "absolute", width: 110, height: 110, borderRadius: 55, backgroundColor: metal.light,
              opacity: shine.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
              transform: [{ scale: shine.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] }) }],
            }} />
            <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
              <RankShield metal={rank.metal} chevrons={rank.chevrons} size={72} />
            </Animated.View>
          </View>

          <Text style={{ fontSize: 22, fontWeight: "600", color: C.text, textAlign: "center" }}>{rank.name}</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, textAlign: "center", marginTop: 4 }}>
            {rank.min.toLocaleString("fr-FR")} photos triées.
            {next ? ` Prochain grade : ${next.name} (${next.min.toLocaleString("fr-FR")}).` : " Grade maximum atteint ⭐"}
          </Text>

          <TouchableOpacity
            onPress={() => { shine.stopAnimation(); setRank(null); }}
            style={{ backgroundColor: C.accent, borderRadius: 14, paddingVertical: 13, alignSelf: "stretch", alignItems: "center", marginTop: 18 }}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Continuer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
