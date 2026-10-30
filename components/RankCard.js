// Bloc "Ton galon" de l'écran Progression (maquette 2) + échelle des 10 grades
// dépliable (maquette 3).
import { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import Text from "./AppText";
import { C } from "../constants/theme";
import { RankShield, METALS } from "./RankShield";
import { RANKS, rankInfo } from "../services/achievements";

const fmtDate = (ts) => new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const fmtNum  = (n) => n.toLocaleString("fr-FR");

export function RankCard({ totalSorted, achievements }) {
  const [open, setOpen] = useState(false);
  const { current, next, level, left, progress } = rankInfo(totalSorted);
  const nextMetal = next ? METALS[next.metal] : null;

  return (
    <View style={{ backgroundColor: C.bgCard, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {current
          ? <RankShield metal={current.metal} chevrons={current.chevrons} size={44} />
          : <RankShield metal="bronze" chevrons={1} size={44} locked />}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: C.textMuted, letterSpacing: 0.4 }}>
            TON GALON · {level}/{RANKS.length}
          </Text>
          <Text style={{ fontSize: 20, fontWeight: "900", color: C.text }}>{current ? current.name : "Pas encore de galon"}</Text>
          <Text style={{ fontSize: 12, color: C.textMuted }}>{fmtNum(totalSorted)} photo{totalSorted > 1 ? "s" : ""} triée{totalSorted > 1 ? "s" : ""}</Text>
        </View>
      </View>

      {/* Barre vers le grade suivant */}
      {next ? (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: C.text }}>Encore {fmtNum(left)} photo{left > 1 ? "s" : ""}</Text>
            <Text style={{ fontSize: 12, color: C.textMuted }}>→ {next.name}</Text>
          </View>
          <View style={{ height: 7, borderRadius: 4, backgroundColor: C.border, marginTop: 6, overflow: "hidden" }}>
            <View style={{ height: 7, borderRadius: 4, width: `${Math.round(progress * 100)}%`, backgroundColor: nextMetal.text }} />
          </View>
        </>
      ) : (
        <Text style={{ fontSize: 12, fontWeight: "800", color: METALS.gold.text, marginTop: 12 }}>Grade maximum atteint ⭐</Text>
      )}

      {/* Échelle des grades (dépliable) */}
      <TouchableOpacity onPress={() => setOpen(!open)} style={{ alignItems: "center", marginTop: 12 }} hitSlop={{ top: 8, bottom: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: "800", color: C.accent }}>{open ? "Masquer les grades ▴" : "Voir tous les grades ▾"}</Text>
      </TouchableOpacity>

      {open && (
        <View style={{ marginTop: 8 }}>
          {RANKS.map((r) => {
            const got = !!achievements?.[r.id];
            const isCurrent = current?.id === r.id;
            return (
              <View key={r.id} style={{
                flexDirection: "row", alignItems: "center", gap: 10,
                paddingVertical: 7, paddingHorizontal: isCurrent ? 8 : 0,
                backgroundColor: isCurrent ? C.sage : "transparent", borderRadius: 10,
                opacity: got || isCurrent ? 1 : 0.45,
              }}>
                <RankShield metal={r.metal} chevrons={r.chevrons} size={24} locked={!got && !isCurrent} />
                <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: C.text }}>
                  {r.name}{isCurrent ? <Text style={{ fontSize: 10, color: C.accent }}>  · actuel</Text> : null}
                </Text>
                <Text style={{ fontSize: 11, color: C.textMuted }}>
                  {fmtNum(r.min)}{got ? ` · ${fmtDate(achievements[r.id])}` : ""}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
