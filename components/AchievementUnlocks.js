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
import { Animated, Modal, View, TouchableOpacity, Platform } from "react-native";
import Text from "./AppText";
import { useIsFocused } from "@react-navigation/native";
import { C, FN_COLORS } from "../constants/theme";
import { usePhotoStore, dayKey } from "../store/usePhotoStore";
import { useSubscriptionStore } from "../store/useSubscriptionStore";
import { RANKS, BADGES } from "../services/achievements";
import { useBadgeGo } from "../hooks/useBadgeGo";
import { RankShield, METALS } from "./RankShield";

const isRank = (id) => id.startsWith("rank-");
// Badges du Labo qui ont une vraie fenêtre (texte `win` + bouton vers le produit) : pas de bandeau pour eux,
// ils attendent un écran de fin de session (Bilan, accueil).
const isLaboWindow = (id) => { const b = BADGES.find((x) => x.id === id); return !!(b && b.win && b.cta); };

// Relance la vérification quand une mesure utile change (photos triées, Go, ❤️, albums).
function useAchievementWatcher(active) {
  const sortedToday = usePhotoStore((s) => s.dailyLog?.[dayKey()]?.sorted || 0);
  const freedMo     = usePhotoStore((s) => s.freedMo);
  const keptCount   = usePhotoStore((s) => s.kept.length);
  const albumCount  = usePhotoStore((s) => s.albums.length);
  const check       = usePhotoStore((s) => s.checkAchievements);
  // Badges du Labo : livres, abonnements et photos imprimées.
  const bookCount   = usePhotoStore((s) => Object.keys(s.books).length);
  const subCount    = useSubscriptionStore((s) => s.subs.length);
  const printedCount = useSubscriptionStore((s) => Object.keys(s.printedPhotos).length);
  const selections  = useSubscriptionStore((s) => s.selections);
  useEffect(() => { if (active) check(); }, [active, sortedToday, freedMo, keptCount, albumCount, bookCount, subCount, printedCount, selections]);
}

// ─── Bandeau badge ─────────────────────────────────────────────────────────
export function BadgeUnlockBanner() {
  const focused = useIsFocused();
  useAchievementWatcher(focused);
  const pending = usePhotoStore((s) => s.pendingUnlocks);
  const consume = usePhotoStore((s) => s.consumeUnlocks);
  const [badge, setBadge] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;

  const nextId = focused && !badge ? pending.find((id) => !isRank(id) && !isLaboWindow(id)) : null;

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
// Sert aussi de fenêtre « Nouveau badge · Labo » (une seule fenêtre à la fois : le galon d'abord, puis le badge).
export function RankUnlockModal() {
  const focused = useIsFocused();
  useAchievementWatcher(focused);
  const pending = usePhotoStore((s) => s.pendingUnlocks);
  const consume = usePhotoStore((s) => s.consumeUnlocks);
  const goBadge = useBadgeGo();
  const [rank, setRank] = useState(null);
  const [laboBadge, setLaboBadge] = useState(null);

  // Badge du Labo : seulement quand aucun galon n'est affiché ni en attente.
  const laboId = focused && !rank && !laboBadge && !pending.some(isRank) ? pending.find(isLaboWindow) : null;
  useEffect(() => {
    if (!laboId) return;
    consume([laboId]);
    setLaboBadge(BADGES.find((b) => b.id === laboId) ?? null);
  }, [laboId]);
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

  if (!rank && laboBadge) {
    const col = FN_COLORS.labo;
    const close = () => setLaboBadge(null);
    return (
      <Modal transparent animationType="fade" visible onRequestClose={close}>
        <View style={{ flex: 1, backgroundColor: "rgba(35,39,31,0.55)", alignItems: "center", justifyContent: "center", padding: 28 }}>
          <View style={{ backgroundColor: C.bgCard, borderRadius: 24, padding: 22, width: "100%", maxWidth: 320, alignItems: "center" }}>
            <View style={{ width: 84, height: 84, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: col.soft, borderWidth: 2, borderColor: col.main }}>
              <Text style={{ fontSize: 44 }}>{laboBadge.emoji}</Text>
            </View>
            <Text style={{ fontSize: 10.5, fontWeight: "800", color: col.main, letterSpacing: 1.3, marginTop: 14 }}>NOUVEAU BADGE · LABO</Text>
            <Text style={{ fontSize: 21, fontWeight: "700", color: C.text, textAlign: "center", marginTop: 3 }}>{laboBadge.name}</Text>
            <Text style={{ fontSize: 13, color: C.textMid, textAlign: "center", marginTop: 7, lineHeight: 19 }}>{laboBadge.win}</Text>
            <TouchableOpacity
              onPress={() => { const to = laboBadge.cta.to; close(); goBadge(to); }}
              style={{ backgroundColor: col.main, borderRadius: 14, paddingVertical: 13, alignSelf: "stretch", alignItems: "center", marginTop: 18 }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{laboBadge.cta.label}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={close} style={{ marginTop: 11, padding: 4 }}>
              <Text style={{ fontSize: 12.5, color: C.textMuted }}>Plus tard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

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
