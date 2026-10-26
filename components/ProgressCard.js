// Carte "Ta progression" (accueil, mode Tri) — maquette 5.
// Lit le carnet de bord dailyLog du store et affiche :
//   - photos triées + espace libéré depuis lundi,
//   - l'évolution vs la même période la semaine dernière,
//   - une mini-tendance des 7 derniers jours (petites barres).
// Pas de librairie de graphe : les barres sont de simples View.
import { View, Text, TouchableOpacity } from "react-native";
import { C } from "../constants/theme";
import { dayKey } from "../store/usePhotoStore";

// Même format que l'accueil (Mo / Go)
function formatSize(mo) {
  if (mo < 1) return "0 Mo";
  if (mo < 1024) return `${mo.toFixed(0)} Mo`;
  return `${(mo / 1024).toFixed(1)} Go`;
}

// Additionne sorted + freedMo entre deux dates incluses.
function sumRange(log, from, to) {
  let sorted = 0, freedMo = 0;
  const d = new Date(from);
  while (d <= to) {
    const day = log?.[dayKey(d)];
    if (day) { sorted += day.sorted || 0; freedMo += day.freedMo || 0; }
    d.setDate(d.getDate() + 1);
  }
  return { sorted, freedMo };
}

export function ProgressCard({ dailyLog, onPress }) {
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

  const isEmpty = week.sorted === 0 && week.freedMo === 0 && last.sorted === 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      style={{
        backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: C.border,
        padding: 14, flexDirection: "row", alignItems: "center", gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: "800", color: C.textMuted, letterSpacing: 0.4 }}>CETTE SEMAINE</Text>
        {isEmpty ? (
          <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
            Trie tes premières photos pour suivre ta progression.
          </Text>
        ) : (
          <>
            <Text style={{ fontSize: 18, fontWeight: "900", color: C.text, marginVertical: 2 }}>
              {week.sorted} photo{week.sorted > 1 ? "s" : ""} · {formatSize(week.freedMo)}
            </Text>
            {pct !== null ? (
              <Text style={{ fontSize: 11.5, color: C.textMuted }}>
                <Text style={{ fontWeight: "800", color: pct >= 0 ? C.green : C.textMuted }}>
                  {pct >= 0 ? "▲" : "▼"} {pct >= 0 ? "+" : ""}{pct} %
                </Text>
                {"  "}vs semaine dernière
              </Text>
            ) : (
              <Text style={{ fontSize: 11.5, color: C.textMuted }}>triées · libérés</Text>
            )}
          </>
        )}
      </View>

      {/* Mini-tendance : 7 barres, aujourd'hui en foncé */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 36 }}>
        {spark.map((v, i) => (
          <View
            key={i}
            style={{
              width: 7, borderRadius: 2,
              height: Math.max(3, (v / max) * 36),
              backgroundColor: i === 6 ? C.accent : "#b9c8de",
            }}
          />
        ))}
      </View>

      {onPress && <Text style={{ color: C.textMuted, fontSize: 18, fontWeight: "800" }}>›</Text>}
    </TouchableOpacity>
  );
}
