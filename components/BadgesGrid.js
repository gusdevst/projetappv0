// Grille des badges de l'écran Progression (maquette 4).
// Gagnés : en couleur + date. À gagner : grisés + mini-barre + ce qu'il reste.
import { View } from "react-native";
import Text from "./AppText";
import { C } from "../constants/theme";
import { BADGES } from "../services/achievements";

const fmtDate = (ts) => new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

export function BadgesGrid({ ctx, achievements }) {
  const won = BADGES.filter((b) => achievements?.[b.id]).length;
  return (
    <View style={{ backgroundColor: C.bgCard, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 14, marginTop: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: "800", color: C.text }}>Badges</Text>
        <Text style={{ fontSize: 11, color: C.textMuted }}>{won} / {BADGES.length}</Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
        {BADGES.map((b) => {
          const at = achievements?.[b.id];
          const v = b.value(ctx);
          const pct = Math.max(0, Math.min(1, v / b.goal));
          return (
            <View key={b.id} style={{ width: "25%", padding: 4 }}>
              <View style={{
                flex: 1, minHeight: 104, borderRadius: 14,
                paddingVertical: 10, paddingHorizontal: 4, alignItems: "center",
                backgroundColor: at ? C.bgCard : C.bg,
                borderColor: at ? C.green : C.border, borderWidth: at ? 1.5 : 1,
              }}>
                {/* Coche verte en haut à droite : badge obtenu */}
                {at && (
                  <View style={{
                    position: "absolute", top: 5, right: 5, width: 16, height: 16, borderRadius: 8,
                    backgroundColor: C.green, alignItems: "center", justifyContent: "center",
                  }}>
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900", lineHeight: 12 }}>✓</Text>
                  </View>
                )}
                <Text style={{ fontSize: 26, opacity: at ? 1 : 0.3 }}>{b.emoji}</Text>
                <Text numberOfLines={2} style={{ fontSize: 10.5, fontWeight: "800", textAlign: "center", marginTop: 3, color: at ? C.text : C.textMuted }}>
                  {b.name}
                </Text>
                {at ? (
                  <Text style={{ fontSize: 9.5, color: C.textMuted, marginTop: 2 }}>{fmtDate(at)}</Text>
                ) : (
                  <>
                    <View style={{ alignSelf: "stretch", height: 4, borderRadius: 2, backgroundColor: C.border, marginTop: 5, marginHorizontal: 6, overflow: "hidden" }}>
                      <View style={{ height: 4, width: `${Math.round(pct * 100)}%`, backgroundColor: C.accent }} />
                    </View>
                    <Text style={{ fontSize: 9.5, color: C.textMuted, marginTop: 2 }}>{b.fmt(v, b.goal)}</Text>
                  </>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
