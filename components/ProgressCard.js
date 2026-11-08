// Carte "Ta progression" (accueil, mode Tri) — maquette 5.
// Lit le carnet de bord dailyLog du store et affiche :
//   - photos triées + espace libéré depuis lundi,
//   - l'évolution vs la même période la semaine dernière,
//   - une mini-tendance des 7 derniers jours (petites barres),
//   - l'état du rappel (activé + heure, modifiable depuis l'accueil).
// Pas de librairie de graphe : les barres sont de simples View.
// Pied de carte : la corbeille (« 12 dans la corbeille · 340 Mo · Vider »), seulement s'il y a des photos à supprimer.
import { View, TouchableOpacity, ActivityIndicator } from "react-native";
import Text from "./AppText";
import { C } from "../constants/theme";
import { dayKey, usePhotoStore } from "../store/usePhotoStore";
import Icon from "./Icons";
import { RankShield } from "./RankShield";
import { rankInfo } from "../services/achievements";
import { formatSize, sumRange, computeStreak } from "../services/progressStats";

export function ProgressCard({ dailyLog, onPress, reminderOn = false, reminderLabel, onReminderPress, trashCount = 0, trashSizeLabel, onOpenTrash, onEmptyTrash, emptying }) {
  const today = new Date();
  today.setHours(12, 0, 0, 0); // midi : évite les pièges du changement d'heure

  // Lundi de cette semaine
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  // Même période la semaine dernière (lundi → même jour de la semaine)
  const lastMonday = new Date(monday); lastMonday.setDate(monday.getDate() - 7);
  const lastToday  = new Date(today);  lastToday.setDate(today.getDate() - 7);

  const week = sumRange(dailyLog, monday, today);
  const last = sumRange(dailyLog, lastMonday, lastToday);
  const pct  = last.sorted > 0 ? Math.round(((week.sorted - last.sorted) / last.sorted) * 100) : null;

  // 7 derniers jours (de J-6 à aujourd'hui) pour la mini-tendance
  const spark = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - 6 + i);
    return dailyLog?.[dayKey(d)]?.sorted || 0;
  });
  const max = Math.max(1, ...spark);

  const streak = computeStreak(dailyLog); // série 🔥
  // Galon actuel (null avant 25 photos triées) → petit écusson avant « Cette semaine ».
  const lifetimeSorted = usePhotoStore((s) => s.lifetimeSorted);
  const rank = rankInfo(lifetimeSorted ?? 0).current;

  const isEmpty = week.sorted === 0 && week.freedMo === 0 && last.sorted === 0;

  return (
    <View style={{
      backgroundColor: C.bgCard, borderRadius: 16,
      shadowColor: "#3c3c28", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
    }}>
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {rank && <RankShield metal={rank.metal} chevrons={rank.chevrons} size={16} />}
          <Text style={{ fontSize: 10.5, fontWeight: "600", color: C.textMuted, letterSpacing: 0.6 }}>CETTE SEMAINE</Text>
          {/* Série : flamme dessinée, orange quand la journée est validée, grise sinon */}
          {streak.current > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: streak.todayDone ? "#fdeee2" : C.bg, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2 }}>
              <Icon name="flame" size={11} filled strokeWidth={1} color={streak.todayDone ? "#d9641e" : C.textMuted} />
              <Text style={{ fontSize: 10.5, fontWeight: "600", color: streak.todayDone ? "#d9641e" : C.textMuted }}>
                {streak.current} j
              </Text>
            </View>
          )}
        </View>
        {isEmpty ? (
          <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
            Trie tes premières photos pour suivre ta progression.
          </Text>
        ) : (
          <>
            <Text style={{ fontSize: 17, fontWeight: "600", color: C.text, marginVertical: 2 }}>
              {week.sorted} photo{week.sorted > 1 ? "s" : ""} · {formatSize(week.freedMo)}
            </Text>
            {pct !== null ? (
              <Text style={{ fontSize: 11.5, color: C.textMuted }}>
                <Text style={{ fontWeight: "600", color: pct >= 0 ? C.accent : C.textMuted }}>
                  {pct >= 0 ? "▲" : "▼"} {pct >= 0 ? "+" : ""}{pct} %
                </Text>
                {"  "}vs semaine dernière
              </Text>
            ) : (
              <Text style={{ fontSize: 11.5, color: C.textMuted }}>triées · libérés</Text>
            )}
          </>
        )}

        {/* Rappel : activé + heure de la notification (toucher = la modifier) */}
        <TouchableOpacity onPress={onReminderPress} disabled={!onReminderPress} activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 12 }}
          style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5, alignSelf: "flex-start" }}>
          <Icon name="bell" size={12} color={reminderOn ? C.accent : C.textMuted} strokeWidth={2} />
          {reminderOn ? (
            <Text style={{ fontSize: 11.5, color: C.textMuted }}>
              Rappel activé · <Text style={{ fontWeight: "600", color: C.text }}>{reminderLabel}</Text>
            </Text>
          ) : (
            <Text style={{ fontSize: 11.5, color: C.textMuted }}>Rappel désactivé · <Text style={{ fontWeight: "600", color: C.accent }}>Activer</Text></Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Mini-tendance : 7 barres, aujourd'hui en foncé */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 36 }}>
        {spark.map((v, i) => (
          <View
            key={i}
            style={{
              width: 8, borderRadius: 3,
              height: Math.max(3, (v / max) * 36),
              backgroundColor: i === 6 ? C.accent : C.sage2,
            }}
          />
        ))}
      </View>

      {onPress && <Text style={{ color: C.textMuted, fontSize: 18 }}>›</Text>}
    </TouchableOpacity>

    {/* Corbeille : en pied de carte, seulement s'il y a des photos à supprimer */}
    {trashCount > 0 && (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 9, paddingHorizontal: 14 }}>
        <TouchableOpacity onPress={onOpenTrash} activeOpacity={0.8} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="trash" size={15} color={C.red} strokeWidth={2} />
          <Text style={{ fontSize: 12, color: C.textMid }}>
            <Text style={{ fontWeight: "600", color: C.text }}>{trashCount}</Text> dans la corbeille · {trashSizeLabel}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onEmptyTrash}
          disabled={emptying}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
          style={{ backgroundColor: C.redSoft, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 4 }}
        >
          {emptying
            ? <ActivityIndicator size="small" color={C.red} />
            : <Text style={{ fontSize: 12, fontWeight: "600", color: C.red }}>Vider</Text>}
        </TouchableOpacity>
      </View>
    )}
    </View>
  );
}
