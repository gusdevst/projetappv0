// Badges de l'écran Progression, rangés par FONCTION (maquette « piste C », 14 nov. 2026) :
//   1. trois anneaux : Tri · Album · Labo (toucher = ne montrer que cette fonction, retoucher = tout)
//   2. « Prochains badges » : les plus proches de tomber ; le meilleur du Labo en premier, avec son bouton vers le produit
//   3. « Tous les badges » : une grille de médailles par fonction ; toucher une médaille = son explication
//   4. Légende (le sommet : tous les badges Tri + Album)
// Couleurs : FN_COLORS (Tri vert · Album terracotta · Labo rouge). Nom du fichier gardé : BadgesGrid.
import { useMemo, useState } from "react";
import { View, TouchableOpacity, Modal, Pressable } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Text from "./AppText";
import { C, FN_COLORS } from "../constants/theme";
import { BADGES, FUNCTIONS, badgesOf } from "../services/achievements";
import { useBadgeGo } from "../hooks/useBadgeGo";

const fmtDate = (ts) => new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const pctOf = (b, ctx) => Math.max(0, Math.min(1, b.value(ctx) / b.goal));
const NEXT_COUNT = 4;

const Label = ({ children, style }) => (
  <Text style={[{ fontSize: 11, fontWeight: "700", color: C.textMuted, letterSpacing: 1.2, marginTop: 6, marginBottom: 9, marginLeft: 2 }, style]}>{children}</Text>
);

// ── Anneau d'une fonction ──────────────────────────────────────────────────
function RingCard({ fn, won, total, selected, onPress }) {
  const col = FN_COLORS[fn];
  const r = 22, circ = 2 * Math.PI * r;
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={{
      flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 15, backgroundColor: C.bgCard,
      borderWidth: selected ? 2 : 1, borderColor: selected ? col.main : C.border,
    }}>
      <View style={{ width: 54, height: 54, alignItems: "center", justifyContent: "center" }}>
        <Svg width={54} height={54} viewBox="0 0 54 54">
          <Circle cx={27} cy={27} r={r} fill="none" stroke={C.bgMuted} strokeWidth={6} />
          {won > 0 && (
            <Circle cx={27} cy={27} r={r} fill="none" stroke={col.main} strokeWidth={6} strokeLinecap="round"
              strokeDasharray={`${circ}`} strokeDashoffset={circ * (1 - won / total)} transform="rotate(-90 27 27)" />
          )}
        </Svg>
        <Text style={{ position: "absolute", fontSize: 14, fontWeight: "700", color: C.text }}>{won}</Text>
      </View>
      <Text style={{ fontSize: 12.5, fontWeight: "700", color: col.main, marginTop: 2 }}>{col.name}</Text>
      <Text style={{ fontSize: 10, color: C.textMuted }}>sur {total}</Text>
    </TouchableOpacity>
  );
}

// ── Une ligne de badge (comme avant : pastille · nom · date ou avancement · explication · barre) ──
function BadgeRow({ b, at, ctx, first, onGo, showChip }) {
  const col = FN_COLORS[b.fn] ?? FN_COLORS.tri;
  const v = b.value(ctx);
  const pct = pctOf(b, ctx);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderTopColor: C.border }}>
      <View style={{
        width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center",
        backgroundColor: at ? col.soft : C.bg, borderWidth: at ? 1.5 : 1, borderColor: at ? col.main : C.border,
      }}>
        <Text style={{ fontSize: 22, opacity: at ? 1 : 0.3 }}>{b.emoji}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, fontWeight: "800", color: at ? C.text : C.textMid }}>{b.name}</Text>
          {at ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: col.main, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900", lineHeight: 12 }}>✓</Text>
              </View>
              <Text style={{ fontSize: 11, color: C.textMuted }}>{fmtDate(at)}</Text>
            </View>
          ) : (
            <Text style={{ fontSize: 11, color: C.textMuted }}>{b.fmt(v, b.goal, ctx)}</Text>
          )}
        </View>
        <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2, lineHeight: 16 }}>
          {showChip && <Text style={{ fontSize: 9.5, fontWeight: "800", color: col.main, letterSpacing: 0.5 }}>{col.name.toUpperCase()}  </Text>}
          {b.desc}
        </Text>
        {!at && (
          <View style={{ height: 4, borderRadius: 2, backgroundColor: C.border, marginTop: 6, overflow: "hidden" }}>
            <View style={{ height: 4, width: `${Math.round(pct * 100)}%`, backgroundColor: col.main }} />
          </View>
        )}
        {!at && b.cta && onGo && (
          <TouchableOpacity activeOpacity={0.85} onPress={() => onGo(b.cta.to)} style={{
            alignSelf: "flex-start", marginTop: 7, backgroundColor: col.main, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 11,
          }}>
            <Text style={{ color: "#fff", fontSize: 11.5, fontWeight: "700" }}>{b.cta.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Choix des « prochains badges » ─────────────────────────────────────────
// Sans filtre : le meilleur du Labo en tête (c'est lui qui mène à une commande), puis le meilleur de chaque
// autre fonction, puis on complète avec les plus avancés. Avec un filtre : les plus avancés de cette fonction.
function pickNext(ctx, achievements, filter) {
  const todo = (fn) => badgesOf(fn).filter((b) => !achievements?.[b.id]);
  const best = (list) => list.reduce((m, b) => (!m || pctOf(b, ctx) > pctOf(m, ctx) ? b : m), null); // égalité : le 1er de la liste
  if (filter) return [...todo(filter)].sort((a, b) => pctOf(b, ctx) - pctOf(a, ctx)).slice(0, NEXT_COUNT);
  const out = [];
  ["labo", "tri", "album"].forEach((fn) => { const b = best(todo(fn)); if (b) out.push(b); });
  const rest = FUNCTIONS.flatMap(todo).filter((b) => !out.includes(b)).sort((a, b) => pctOf(b, ctx) - pctOf(a, ctx));
  const fillers = rest.slice(0, Math.max(0, NEXT_COUNT - out.length));
  return [...out.slice(0, 1), ...[...out.slice(1), ...fillers].sort((a, b) => pctOf(b, ctx) - pctOf(a, ctx))];
}

// ── Écran ──────────────────────────────────────────────────────────────────
export function BadgesGrid({ ctx, achievements }) {
  const go = useBadgeGo();
  const [filter, setFilter] = useState(null);   // null | "tri" | "album" | "labo"
  const [detail, setDetail] = useState(null);   // badge ouvert dans la fenêtre d'explication

  const counts = useMemo(() => Object.fromEntries(FUNCTIONS.map((fn) => {
    const list = badgesOf(fn);
    return [fn, { total: list.length, won: list.filter((b) => achievements?.[b.id]).length }];
  })), [achievements]);
  const next = pickNext(ctx, achievements, filter);
  const shown = filter ? [filter] : FUNCTIONS;
  const legend = BADGES.find((b) => b.fn === "all");

  const card = { backgroundColor: C.bgCard, borderRadius: 18, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, marginBottom: 10 };

  return (
    <View style={{ marginTop: 10 }}>
      {/* 1. Anneaux */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {FUNCTIONS.map((fn) => (
          <RingCard key={fn} fn={fn} won={counts[fn].won} total={counts[fn].total} selected={filter === fn}
            onPress={() => setFilter((f) => (f === fn ? null : fn))} />
        ))}
      </View>

      {/* 2. Prochains badges */}
      <Label>{filter ? `PROCHAINS BADGES · ${FN_COLORS[filter].name.toUpperCase()}` : "PROCHAINS BADGES"}</Label>
      <View style={card}>
        {next.length === 0 && (
          <Text style={{ fontSize: 12.5, color: C.textMuted, textAlign: "center", paddingVertical: 16 }}>{filter ? `Tous les badges ${FN_COLORS[filter].name} sont gagnés. Bravo !` : "Tous les badges sont gagnés. Bravo !"}</Text>
        )}
        {next.map((b, i) => (
          <BadgeRow key={b.id} b={b} at={null} ctx={ctx} first={i === 0} showChip={!filter} onGo={go} />
        ))}
      </View>

      {/* 3. Tous les badges : médailles par fonction */}
      <Label style={{ marginTop: 8 }}>TOUS LES BADGES</Label>
      <View style={{ ...card, paddingVertical: 12 }}>
        {shown.map((fn, k) => {
          const col = FN_COLORS[fn];
          return (
            <View key={fn} style={{ marginTop: k === 0 ? 0 : 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 7 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.9, color: col.main }}>{col.name.toUpperCase()}</Text>
                <Text style={{ fontSize: 11, color: C.textMuted }}>{counts[fn].won} / {counts[fn].total}</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {badgesOf(fn).map((b, i) => {
                  const at = achievements?.[b.id];
                  const pct = pctOf(b, ctx);
                  const pctTxt = Math.min(99, Math.floor(pct * 100)); // jamais « 100 % » tant que le badge n'est pas gagné
                  return (
                    <TouchableOpacity key={b.id} activeOpacity={0.8} onPress={() => setDetail(b)} style={{
                      width: "18.2%", aspectRatio: 1, marginRight: i % 5 === 4 ? 0 : "2.25%", marginBottom: 7, borderRadius: 12,
                      alignItems: "center", justifyContent: "center", paddingBottom: 6,
                      backgroundColor: at ? col.soft : C.bg, borderWidth: at ? 1.5 : 1, borderColor: at ? col.main : C.border,
                    }}>
                      <Text style={{ fontSize: 20, opacity: at ? 1 : 0.28 }}>{b.emoji}</Text>
                      {/* Où j'en suis : ✓ si gagné, sinon le pourcentage + une fine barre */}
                      <Text style={{ fontSize: 9.5, fontWeight: "700", color: at ? col.main : C.textMuted, marginTop: 1 }}>{at ? "✓" : `${pctTxt} %`}</Text>
                      {!at && (
                        <View style={{ position: "absolute", left: 7, right: 7, bottom: 5, height: 3, borderRadius: 2, backgroundColor: C.border, overflow: "hidden" }}>
                          <View style={{ height: 3, width: `${Math.round(pct * 100)}%`, backgroundColor: col.main }} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

      {/* 4. Légende : le sommet */}
      {legend && !filter && (
        <View style={card}>
          <BadgeRow b={{ ...legend, fn: "tri" }} at={achievements?.[legend.id]} ctx={ctx} first />
        </View>
      )}

      {/* Explication d'une médaille */}
      <Modal visible={!!detail} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setDetail(null)}>
        <Pressable onPress={() => setDetail(null)} style={{ flex: 1, backgroundColor: "rgba(35,39,31,0.55)", alignItems: "center", justifyContent: "center", padding: 28 }}>
          {detail && (() => {
            const col = FN_COLORS[detail.fn] ?? FN_COLORS.tri;
            const at = achievements?.[detail.id];
            return (
              <Pressable style={{ width: "100%", backgroundColor: C.bgCard, borderRadius: 22, padding: 20, alignItems: "center" }}>
                <View style={{ width: 76, height: 76, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: at ? col.soft : C.bg, borderWidth: 2, borderColor: at ? col.main : C.border }}>
                  <Text style={{ fontSize: 40, opacity: at ? 1 : 0.35 }}>{detail.emoji}</Text>
                </View>
                <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1.2, color: col.main, marginTop: 12 }}>
                  {col.name.toUpperCase()}{detail.tag ? ` · ${detail.tag}` : ""}
                </Text>
                <Text style={{ fontSize: 19, fontWeight: "700", color: C.text, marginTop: 3, textAlign: "center" }}>{detail.name}</Text>
                <Text style={{ fontSize: 13, color: C.textMid, marginTop: 6, textAlign: "center", lineHeight: 19 }}>{detail.desc}</Text>
                <Text style={{ fontSize: 12, fontWeight: "600", color: at ? col.main : C.textMuted, marginTop: 10 }}>
                  {at ? `✓ Gagné le ${fmtDate(at)}` : detail.fmt(detail.value(ctx), detail.goal, ctx)}
                </Text>
                {!at && detail.cta && (
                  <TouchableOpacity activeOpacity={0.85} onPress={() => { const to = detail.cta.to; setDetail(null); go(to); }}
                    style={{ alignSelf: "stretch", marginTop: 14, backgroundColor: col.main, borderRadius: 14, paddingVertical: 11, alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>{detail.cta.label}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setDetail(null)} style={{ marginTop: 12, padding: 4 }}>
                  <Text style={{ fontSize: 12.5, color: C.textMuted }}>Fermer</Text>
                </TouchableOpacity>
              </Pressable>
            );
          })()}
        </Pressable>
      </Modal>
    </View>
  );
}
