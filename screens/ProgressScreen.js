// screens/ProgressScreen.js
// Détail de la progression (maquette 1) : barres par jour (Semaine) ou par
// semaine (Mois), navigation ‹ › dans les périodes passées, 2 chiffres clés.
// Données : carnet de bord dailyLog du store. Barres = simples View.
import { useState, useMemo, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, TouchableOpacity, StatusBar, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { usePhotoStore, dayKey } from "../store/usePhotoStore";
import { formatSize, noon, addDays, mondayOf, dayStats, sumRange, avgFor20, computeStreak, STREAK_MIN } from "../services/progressStats";
import BackButton from "../components/BackButton";
import { RankCard } from "../components/RankCard";
import { BadgesGrid } from "../components/BadgesGrid";
import { buildContext } from "../services/achievements";

const CHART_H   = 150;        // hauteur max d'une barre
const BAR_LIGHT = C.sage2;  // barres passées
const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
const MAX_BACK  = { week: 52, month: 12 }; // on remonte 1 an max

// Construit les barres de la période affichée.
// mode "week"  → 7 barres (une par jour)
// mode "month" → 4 à 6 barres (une par semaine du mois, coupées aux bords du mois)
function buildPeriod(mode, offset, log) {
  const today = noon(new Date());

  if (mode === "week") {
    const start = addDays(mondayOf(today), offset * 7);
    const bars = DAY_LETTERS.map((label, i) => {
      const d = addDays(start, i);
      return { label, ...dayStats(log, d), isCurrent: dayKey(d) === dayKey(today), isFuture: d > today };
    });
    const title = offset === 0 ? "Cette semaine"
      : offset === -1 ? "Semaine dernière"
      : `Semaine du ${start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
    return { bars, title };
  }

  const first = noon(new Date(today.getFullYear(), today.getMonth() + offset, 1));
  const last  = noon(new Date(first.getFullYear(), first.getMonth() + 1, 0));
  const bars = [];
  for (let s = first; s <= last; ) {
    let e = addDays(mondayOf(s), 6);
    if (e > last) e = last;
    bars.push({
      label: s.getDate() === e.getDate() ? `${s.getDate()}` : `${s.getDate()}-${e.getDate()}`,
      ...sumRange(log, s, e),
      isCurrent: today >= s && today <= e,
      isFuture: s > today,
    });
    s = addDays(e, 1);
  }
  const m = first.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return { bars, title: m.charAt(0).toUpperCase() + m.slice(1) };
}

export function ProgressScreen({ navigation }) {
  const dailyLog = usePhotoStore((s) => s.dailyLog);
  const [mode, setMode]     = useState("week"); // "week" | "month"
  const [offset, setOffset] = useState(0);      // 0 = période actuelle, -1 = précédente…

  const { bars, title } = useMemo(() => buildPeriod(mode, offset, dailyLog), [mode, offset, dailyLog]);
  const total = bars.reduce((a, b) => ({
    sorted: a.sorted + b.sorted, freedMo: a.freedMo + b.freedMo,
    timedCount: a.timedCount + b.timedCount, activeMs: a.activeMs + b.activeMs,
  }), { sorted: 0, freedMo: 0, timedCount: 0, activeMs: 0 });
  const pace = avgFor20(total); // temps moyen pour 20 photos sur la période
  const streak = useMemo(() => computeStreak(dailyLog), [dailyLog]);

  // Galons & badges : on vérifie les déblocages à chaque ouverture de l'écran.
  const achievements      = usePhotoStore((s) => s.achievements);
  const checkAchievements = usePhotoStore((s) => s.checkAchievements);
  useFocusEffect(useCallback(() => { checkAchievements(); }, [checkAchievements]));
  // Mesures actuelles (photos triées, Go, coups de cœur…).
  // Calcul direct à chaque affichage (léger) : toujours à jour au retour sur l'écran.
  const ctx = buildContext(usePhotoStore.getState());
  const max   = Math.max(1, ...bars.map((b) => b.sorted));

  const switchMode = (m) => { setMode(m); setOffset(0); };
  const canPrev = offset > -MAX_BACK[mode];
  const canNext = offset < 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <BackButton mode="menage" onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "800", fontSize: 20, color: C.text }}>Ta progression</Text>
          <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>Photos triées et espace libéré</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.pad, paddingBottom: 30 }}>

        {/* ── Série 🔥 ── */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 34, opacity: streak.current > 0 ? 1 : 0.35 }}>🔥</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: "900", color: C.text }}>
                {streak.current} jour{streak.current > 1 ? "s" : ""} d'affilée
              </Text>
              <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>Record : {streak.best} jour{streak.best > 1 ? "s" : ""}</Text>
            </View>
          </View>

          {/* Objectif du jour */}
          <View style={{ marginTop: 12, backgroundColor: streak.todayDone ? `${C.green}15` : C.bg, borderRadius: 12, padding: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: streak.todayDone ? C.green : C.text }}>
              {streak.todayDone
                ? "✅ Journée validée"
                : `Encore ${streak.todayLeft} photo${streak.todayLeft > 1 ? "s" : ""} aujourd'hui pour valider ta journée`}
            </Text>
            {/* Barre d'avancement vers les STREAK_MIN photos du jour */}
            <View style={{ height: 6, borderRadius: 3, backgroundColor: C.border, marginTop: 8, overflow: "hidden" }}>
              <View style={{
                height: 6, borderRadius: 3,
                width: `${Math.round(((STREAK_MIN - streak.todayLeft) / STREAK_MIN) * 100)}%`,
                backgroundColor: streak.todayDone ? C.green : C.accent,
              }} />
            </View>
          </View>

          <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 10 }}>
            🃏 {streak.jokerUsedThisWeek
              ? "Joker utilisé cette semaine : ne rate pas un autre jour !"
              : "Joker dispo : un jour raté cette semaine ne cassera pas ta série."}
          </Text>
        </View>

        {/* ── Galon ── */}
        <RankCard totalSorted={ctx.totalSorted} achievements={achievements} />

        <View style={{ backgroundColor: C.bgCard, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 14 }}>

          {/* Bascule Semaine / Mois */}
          <View style={{ flexDirection: "row", backgroundColor: C.bg, borderRadius: 10, padding: 3, marginBottom: 14 }}>
            {[{ key: "week", label: "Semaine" }, { key: "month", label: "Mois" }].map((o) => {
              const on = mode === o.key;
              return (
                <TouchableOpacity
                  key={o.key}
                  onPress={() => switchMode(o.key)}
                  style={{ flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center", backgroundColor: on ? C.bgCard : "transparent" }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "800", color: on ? C.accent : C.textMuted }}>{o.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Navigation ‹ période › */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <TouchableOpacity onPress={() => setOffset(offset - 1)} disabled={!canPrev} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: canPrev ? C.accent : C.border }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 15, fontWeight: "800", color: C.text }}>{title}</Text>
            <TouchableOpacity onPress={() => setOffset(offset + 1)} disabled={!canNext} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: canNext ? C.accent : C.border }}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Graphe en barres */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", height: CHART_H + 22 }}>
            {bars.map((b, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
                {b.sorted > 0 && (
                  <Text style={{ fontSize: 10, fontWeight: "800", color: b.isCurrent ? C.accent : C.textMuted, marginBottom: 3 }}>
                    {b.sorted}
                  </Text>
                )}
                <View style={{
                  width: "62%", maxWidth: 30, borderRadius: 6,
                  height: b.sorted > 0 ? Math.max(4, (b.sorted / max) * CHART_H) : 3,
                  backgroundColor: b.isFuture ? C.bg : b.isCurrent ? C.accent : BAR_LIGHT,
                }} />
              </View>
            ))}
          </View>

          {/* Libellés sous les barres */}
          <View style={{ flexDirection: "row", marginTop: 6 }}>
            {bars.map((b, i) => (
              <Text key={i} style={{
                flex: 1, textAlign: "center", fontSize: 10.5,
                fontWeight: b.isCurrent ? "800" : "500",
                color: b.isCurrent ? C.accent : C.textMuted,
              }}>
                {b.label}
              </Text>
            ))}
          </View>

          {/* Chiffres clés de la période */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 10 }}>
              <Text style={{ fontSize: 20, fontWeight: "900", color: C.text }}>{total.sorted}</Text>
              <Text style={{ fontSize: 11, color: C.textMuted }}>photo{total.sorted > 1 ? "s" : ""} triée{total.sorted > 1 ? "s" : ""}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 10 }}>
              <Text style={{ fontSize: 20, fontWeight: "900", color: C.text }}>{formatSize(total.freedMo)}</Text>
              <Text style={{ fontSize: 11, color: C.textMuted }}>libérés</Text>
            </View>
          </View>

          {/* Rythme : temps moyen pour trier 20 photos ("j'hésite" inclus) */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.bg, borderRadius: 12, padding: 10, marginTop: 8 }}>
            <Text style={{ fontSize: 20 }}>⏱</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "900", color: C.text }}>{pace ?? "—"}</Text>
              <Text style={{ fontSize: 11, color: C.textMuted }}>
                {pace ? "en moyenne pour trier 20 photos" : "Trie encore quelques photos pour mesurer ton rythme"}
              </Text>
            </View>
          </View>

          {total.sorted === 0 && total.freedMo === 0 && (
            <Text style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 12 }}>
              {offset === 0 ? "Rien de trié pour l'instant sur cette période. Lance un tri !" : "Aucun tri sur cette période."}
            </Text>
          )}
        </View>

        {/* ── Badges ── */}
        <BadgesGrid ctx={ctx} achievements={achievements} />
      </ScrollView>
    </SafeAreaView>
  );
}
