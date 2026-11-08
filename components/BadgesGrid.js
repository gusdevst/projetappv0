// Liste des badges de l'écran Progression : UN badge par ligne.
// Ligne 1 : emoji · nom · (gagné : coche + date) ou (à gagner : avancement).
// Ligne 2 : l'explication pour décrocher le badge (`desc`).
// À gagner : emoji grisé + mini-barre d'avancement. (Nom du composant gardé : BadgesGrid.)
import { View } from "react-native";
import Text from "./AppText";
import { C } from "../constants/theme";
import { BADGES } from "../services/achievements";

const fmtDate = (ts) => new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

export function BadgesGrid({ ctx, achievements }) {
  const won = BADGES.filter((b) => achievements?.[b.id]).length;
  return (
    <View style={{ backgroundColor: C.bgCard, borderRadius: 18, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4, marginTop: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <Text style={{ fontSize: 14, fontWeight: "800", color: C.text }}>Badges</Text>
        <Text style={{ fontSize: 11, color: C.textMuted }}>{won} / {BADGES.length}</Text>
      </View>

      {BADGES.map((b, i) => {
        const at = achievements?.[b.id];
        const v = b.value(ctx);
        const pct = Math.max(0, Math.min(1, v / b.goal));
        return (
          <View key={b.id} style={{
            flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11,
            borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.border,
          }}>
            {/* Pastille emoji : en couleur si gagné, grisée sinon */}
            <View style={{
              width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center",
              backgroundColor: at ? C.sage : C.bg, borderWidth: at ? 1.5 : 1, borderColor: at ? C.green : C.border,
            }}>
              <Text style={{ fontSize: 24, opacity: at ? 1 : 0.3 }}>{b.emoji}</Text>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, fontWeight: "800", color: at ? C.text : C.textMid }}>{b.name}</Text>
                {at ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.green, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900", lineHeight: 12 }}>✓</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: C.textMuted }}>{fmtDate(at)}</Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 11, color: C.textMuted }}>{b.fmt(v, b.goal)}</Text>
                )}
              </View>
              {/* Ligne 2 : comment décrocher ce badge */}
              <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2, lineHeight: 16 }}>{b.desc}</Text>
              {!at && (
                <View style={{ height: 4, borderRadius: 2, backgroundColor: C.border, marginTop: 6, overflow: "hidden" }}>
                  <View style={{ height: 4, width: `${Math.round(pct * 100)}%`, backgroundColor: C.accent }} />
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
