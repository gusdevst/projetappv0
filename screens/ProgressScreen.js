// screens/ProgressScreen.js
// Détail de la progression (maquette 1) : barres par jour (Semaine) ou par
// semaine (Mois), navigation ‹ › dans les périodes passées, 2 chiffres clés.
// Données : carnet de bord dailyLog du store. Barres = simples View.
import { useState, useMemo, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, TouchableOpacity, StatusBar, ScrollView, Switch, Alert } from "react-native";
import { useNotificationReminder } from "../hooks/useNotificationReminder";
import { cancelReminders } from "../services/notificationService";
import Text from "../components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Stop, Ellipse, Path } from "react-native-svg";
import Icon from "../components/Icons";
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

// Style de carte sauge : fond clair, ombre douce, pas de bordure.
const CARD = {
  backgroundColor: C.bgCard, borderRadius: 18, padding: 14,
  shadowColor: "#3c3c28", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
};

// Titre de section : « AUJOURD'HUI », « TES CHIFFRES », « TES RÉCOMPENSES ».
function SectionLabel({ children }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: "600", color: C.textMuted, letterSpacing: 1.2, marginTop: 18, marginBottom: 8, marginHorizontal: 2 }}>
      {children}
    </Text>
  );
}

const SEP = { height: 1, backgroundColor: C.border, marginVertical: 12 };

// Flamme sauge (remplace l'émoji 🔥 en grand). Grisée tant que la série est à 0.
function FlameIllustration({ dim, size = 110 }) {
  return (
    <Svg width={size} height={size * 0.8} viewBox="0 0 120 96" opacity={dim ? 0.4 : 1}>
      <Defs>
        <LinearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={C.sage2} /><Stop offset="1" stopColor={C.sage3} /></LinearGradient>
        <LinearGradient id="fl2" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={C.bgCard} /><Stop offset="1" stopColor={C.sage} /></LinearGradient>
      </Defs>
      <Ellipse cx="60" cy="90" rx="34" ry="5" fill="#000" opacity={0.06} />
      <Path d="M60 6 C72 24 88 34 88 58 A28 28 0 0 1 32 58 C32 44 40 36 46 28 C48 38 52 42 56 44 C54 30 56 18 60 6Z" fill="url(#fl)" />
      <Path d="M60 40 C66 50 74 54 74 66 A14 14 0 0 1 46 66 C46 58 52 54 54 48 C56 54 58 56 60 57 C59 51 59 46 60 40Z" fill="url(#fl2)" />
    </Svg>
  );
}

export function ProgressScreen({ navigation, route }) {
  const inTab = !!route?.params?.inTab; // onglet de la barre du bas → pas de bouton retour
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

  // ── Rappel (même logique qu'avant sur l'accueil) ──
  const notificationHour         = usePhotoStore((s) => s.notificationHour);
  const notificationMinute       = usePhotoStore((s) => s.notificationMinute);
  const setNotificationFrequency = usePhotoStore((s) => s.setNotificationFrequency);
  const { notificationsEnabled, enableReminders } = useNotificationReminder();
  // ON = rappel quotidien (heure des Réglages), OFF = tout annuler.
  async function toggleReminder(on) {
    if (on) {
      const result = await enableReminders("daily");
      if (!result?.success) {
        Alert.alert("Notifications bloquées", "Pour recevoir des rappels, autorise les notifications de Pellicule dans les Réglages de ton téléphone.");
      }
    } else {
      await cancelReminders();
      setNotificationFrequency("off");
    }
  }

  // Semaine en cours (lundi → dimanche) pour la rangée de pastilles.
  const weekDays = useMemo(() => {
    const today = noon(new Date());
    const monday = mondayOf(today);
    return DAY_LETTERS.map((letter, i) => {
      const d = addDays(monday, i);
      const k = dayKey(d);
      const sorted = dayStats(dailyLog, d).sorted;
      let status = "miss";
      if (k === dayKey(today)) status = sorted >= STREAK_MIN ? "ok" : "today";
      else if (d > today) status = "future";
      else if (sorted >= STREAK_MIN) status = "ok";
      else if (streak.jokerDays.includes(k)) status = "joker";
      return { letter, sorted, status };
    });
  }, [dailyLog, streak]);

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
    <SafeAreaView edges={inTab ? ["top", "left", "right"] : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        {!inTab && <BackButton mode="menage" onPress={() => navigation.goBack()} />}
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "600", fontSize: 20, color: C.text }}>Ta progression</Text>
          <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>Photos triées et espace libéré</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.pad, paddingBottom: 30 }}>

        {/* ══ AUJOURD'HUI : série, objectif du jour, semaine, joker, rappel ══ */}
        <SectionLabel>AUJOURD'HUI</SectionLabel>
        <View style={CARD}>
          {/* Série 🔥 (compacte) */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <FlameIllustration dim={streak.current === 0} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text }}>
                <Text style={{ fontSize: 32, fontWeight: "600", color: C.accent }}>{streak.current}</Text>
                <Text style={{ fontSize: 15, fontWeight: "500" }}> jour{streak.current > 1 ? "s" : ""} d'affilée</Text>
              </Text>
              <Text style={{ fontSize: 12, color: C.textMuted }}>Record : {streak.best} jour{streak.best > 1 ? "s" : ""}</Text>
            </View>
          </View>

          <View style={SEP} />

          <Text style={{ fontSize: 13.5, fontWeight: "600", color: streak.todayDone ? C.accent : C.text }}>
            {streak.todayDone
              ? "✅ Journée validée"
              : `Encore ${streak.todayLeft} photo${streak.todayLeft > 1 ? "s" : ""} aujourd'hui pour valider ta journée`}
          </Text>
          {/* Barre d'avancement vers les STREAK_MIN photos du jour */}
          <View style={{ height: 8, borderRadius: 5, backgroundColor: C.bgMuted, marginTop: 10, overflow: "hidden" }}>
            <View style={{ height: 8, borderRadius: 5, backgroundColor: C.accent,
              width: `${Math.round(((STREAK_MIN - streak.todayLeft) / STREAK_MIN) * 100)}%` }} />
          </View>

          {/* Semaine : ✓ journée validée · 🃏 joker · chiffre = photos triées aujourd'hui */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}>
            {weekDays.map((d, i) => (
              <View key={i} style={{ alignItems: "center", gap: 4 }}>
                <View style={{
                  width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
                  backgroundColor: d.status === "ok" ? C.accent : d.status === "joker" ? C.sage : C.bgMuted,
                  borderWidth: d.status === "today" ? 2 : 0, borderColor: C.accent,
                }}>
                  {d.status === "ok" && <Icon name="check" size={15} color="#fff" strokeWidth={2.8} />}
                  {d.status === "joker" && <Text style={{ fontSize: 14 }}>🃏</Text>}
                  {d.status === "today" && <Text style={{ fontSize: 13, fontWeight: "600", color: C.accent }}>{d.sorted}</Text>}
                </View>
                <Text style={{ fontSize: 11, fontWeight: d.status === "today" ? "600" : "400", color: d.status === "today" ? C.accent : C.textMuted }}>{d.letter}</Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 12, backgroundColor: C.bg, borderRadius: 12, padding: 10 }}>
            <Text style={{ fontSize: 13 }}>🃏</Text>
            <Text style={{ flex: 1, fontSize: 11.5, color: C.textMuted }}>
              {streak.jokerUsedThisWeek
                ? "Joker utilisé cette semaine : ne rate pas un autre jour !"
                : "Joker dispo : un jour raté cette semaine ne cassera pas ta série."}
            </Text>
          </View>

          <View style={SEP} />

          {/* Rappel quotidien : tap = réglages des rappels, interrupteur = on/off */}
          <TouchableOpacity onPress={() => navigation.navigate("Rappels")} activeOpacity={0.8}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}>
              <Icon name="bell" size={16} color={C.accent} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "500", color: C.text }}>Rappel quotidien</Text>
              <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 1 }}>
                {notificationsEnabled ? `${notificationHour}:${String(notificationMinute).padStart(2, "0")}` : "Désactivé"}
              </Text>
            </View>
            <Switch value={notificationsEnabled} onValueChange={toggleReminder} trackColor={{ true: C.accent, false: C.border }} thumbColor="#fff" />
          </TouchableOpacity>
        </View>

        {/* ══ TES CHIFFRES : graphe semaine / mois, totaux, chrono ══ */}
        <SectionLabel>TES CHIFFRES</SectionLabel>
        <View style={CARD}>

          {/* Bascule Semaine / Mois */}
          <View style={{ flexDirection: "row", backgroundColor: C.bgMuted, borderRadius: 12, padding: 3, marginBottom: 14 }}>
            {[{ key: "week", label: "Semaine" }, { key: "month", label: "Mois" }].map((o) => {
              const on = mode === o.key;
              return (
                <TouchableOpacity
                  key={o.key}
                  onPress={() => switchMode(o.key)}
                  style={{ flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: "center", backgroundColor: on ? C.bgCard : "transparent" }}
                >
                  <Text style={{ fontSize: 13, fontWeight: on ? "600" : "500", color: on ? C.text : C.textMuted }}>{o.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Navigation ‹ période › */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <TouchableOpacity onPress={() => setOffset(offset - 1)} disabled={!canPrev} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: 22, fontWeight: "500", color: canPrev ? C.accent : C.border }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>{title}</Text>
            <TouchableOpacity onPress={() => setOffset(offset + 1)} disabled={!canNext} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: 22, fontWeight: "500", color: canNext ? C.accent : C.border }}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Graphe en barres */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", height: CHART_H + 22 }}>
            {bars.map((b, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
                {b.sorted > 0 && (
                  <Text style={{ fontSize: 10.5, fontWeight: "600", color: b.isCurrent ? C.accent : C.textMuted, marginBottom: 3 }}>
                    {b.sorted}
                  </Text>
                )}
                <View style={{
                  width: "62%", maxWidth: 30, borderRadius: 6,
                  height: b.sorted > 0 ? Math.max(4, (b.sorted / max) * CHART_H) : 3,
                  backgroundColor: b.isFuture ? C.bgMuted : b.isCurrent ? C.accent : BAR_LIGHT,
                }} />
              </View>
            ))}
          </View>

          {/* Libellés sous les barres */}
          <View style={{ flexDirection: "row", marginTop: 6 }}>
            {bars.map((b, i) => (
              <Text key={i} style={{
                flex: 1, textAlign: "center", fontSize: 10.5,
                fontWeight: b.isCurrent ? "600" : "400",
                color: b.isCurrent ? C.accent : C.textMuted,
              }}>
                {b.label}
              </Text>
            ))}
          </View>

          {/* Chiffres clés de la période */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 10 }}>
              <Text style={{ fontSize: 20, fontWeight: "600", color: C.text }}>{total.sorted}</Text>
              <Text style={{ fontSize: 11, color: C.textMuted }}>photo{total.sorted > 1 ? "s" : ""} triée{total.sorted > 1 ? "s" : ""}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 10 }}>
              <Text style={{ fontSize: 20, fontWeight: "600", color: C.accent }}>{formatSize(total.freedMo)}</Text>
              <Text style={{ fontSize: 11, color: C.textMuted }}>libérés</Text>
            </View>
          </View>

          {/* Rythme : temps moyen pour trier 20 photos ("j'hésite" inclus) */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.bg, borderRadius: 12, padding: 10, marginTop: 8 }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}><Icon name="timer" size={18} color={C.accent} strokeWidth={2} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: C.text }}>{pace ?? "—"}</Text>
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

        {/* ══ TES RÉCOMPENSES : galon + badges (couleurs des badges inchangées) ══ */}
        <SectionLabel>TES RÉCOMPENSES</SectionLabel>
        <RankCard totalSorted={ctx.totalSorted} achievements={achievements} />
        <BadgesGrid ctx={ctx} achievements={achievements} />
      </ScrollView>
    </SafeAreaView>
  );
}
