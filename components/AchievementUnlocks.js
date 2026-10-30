// Animations de déblocage des galons et badges.
//
//   <BadgeUnlockBanner />  bandeau discret en haut, 2,5 s, ne bloque rien (maquette 6).
//                          À poser dans les écrans où l'on gagne des badges (tri, accueil, galerie).
//   <RankUnlockModal />    grande fenêtre "Nouveau galon" (maquette 5). À poser dans les écrans
//                          de FIN de session (Bilan, accueil) : jamais en plein swipe.
//
// Les deux lisent la file pendingUnlocks du store et n'agissent que si leur écran
// est au premier plan (useIsFocused) → pas de doublon quand plusieurs écrans sont empilés.
// Ils déclenchent aussi la vérification (checkAchievements) quand les chiffres bougent.
import { useEffect, useRef, useState } from "react";
import { Animated, Modal, View, Text, TouchableOpacity, Platform } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { C } from "../constants/theme";
import { usePhotoStore, dayKey } from "../store/usePhotoStore";
import { RANKS, BADGES } from "../services/achievements";
import { RankShield, METALS } from "./RankShield";

const isRank = (id) => id.startsWith("rank-");

// Relance la vérification quand une mesure utile change (photos triées, Go, ❤️, albums).
function useAchievementWatcher(active) {
  const sortedToday = usePhotoStore((s) => s.dailyLog?.[dayKey()]?.sorted || 0);
  const freedMo     = usePhotoStore((s) => s.freedMo);
  const keptCount   = usePhotoStore((s) => s.kept.length);
  const albumCount  = usePhotoStore((s) => s.albums.length);
  const check       = usePhotoStore((s) => s.checkAchievements);
  useEffect(() => { if (active) check(); }, [active, sortedToday, freedMo, keptCount, albumCount]);
}

// ─── Bandeau badge ─────────────────────────────────────────────────────────
export function BadgeUnlockBanner() {
  const focused = useIsFocused();
  useAchievementWatcher(focused);
  const pending = usePhotoStore((s) => s.pendingUnlocks);
  const consume = usePhotoStore((s) => s.consumeUnlocks);
  const [badge, setBadge] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;

  const nextId = focused && !badge ? pending.find((id) => !isRank(id)) : null;

  useEffect(() => {
    if (!nextId) return;
    const b = BADGES.find((x) => x.id === nextId);
    consume([nextId]);
    if (!b) return;
    setBadge(b);
    anim.setValue(0);
    Animated.sequence([
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.delay(2300),
      Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setBadge(null)); // libère la place → badge suivant s'il y en a
  }, [nextId]);

  if (!badge) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: Platform.OS === "android" ? 88 : 124, left: 16, right: 16, zIndex: 60, alignItems: "center" }}>
      <Animated.View style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
        ],
        flexDirection: "row", alignItems: "center", gap: 10, maxWidth: "100%",
        backgroundColor: C.text, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14,
        shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 12,
      }}>
        <Text style={{ fontSize: 26 }}>{badge.emoji}</Text>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10.5, fontWeight: "800", letterSpacing: 0.5 }}>NOUVEAU BADGE</Text>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }} numberOfLines={1}>{badge.name} · {badge.desc}</Text>
        </View>
      </Animated.View>
    </View>
  );
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
      <View style={{ flex: 1, backgroundColor: "rgba(26,40,64,0.6)", alignItems: "center", justifyContent: "center", padding: 28 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 22, padding: 22, width: "100%", maxWidth: 320, alignItems: "center" }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: metal.text, letterSpacing: 0.6 }}>NOUVEAU GALON</Text>

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

          <Text style={{ fontSize: 22, fontWeight: "900", color: C.text, textAlign: "center" }}>{rank.name}</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, textAlign: "center", marginTop: 4 }}>
            {rank.min.toLocaleString("fr-FR")} photos triées.
            {next ? ` Prochain grade : ${next.name} (${next.min.toLocaleString("fr-FR")}).` : " Grade maximum atteint ⭐"}
          </Text>

          <TouchableOpacity
            onPress={() => { shine.stopAnimation(); setRank(null); }}
            style={{ backgroundColor: C.accent, borderRadius: 12, paddingVertical: 12, alignSelf: "stretch", alignItems: "center", marginTop: 18 }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Continuer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
