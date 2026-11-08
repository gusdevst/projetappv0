// components/SubscriptionRow.js
// Une ligne « abonnement en cours » de la Galerie (maquette validée le 8 nov.) :
// vignette (magnets ou tirages avec les vrais coups de cœur) · « Magnets · pour moi » · prix · pastille d'état · « ··· ».
// `st` = résultat de subStatus() (services/printSelection.js).
// `dark` = style CHAMBRE NOIRE (maquette validée le 9 nov., mélange B + D) : brique brun-rouge pleine comme les bacs de la
// guirlande, liseré lumineux à gauche selon l'état (rouge = à valider, vert = validée, gris = pause / à venir),
// et l'ACTION à faire (« À valider ») en pastille rouge vive ; les autres états sont de simples textes colorés.

import { View, TouchableOpacity } from "react-native";
import Text from "./AppText";
import { MagnetTile, PrintTile } from "./ProductArt";
import { SHADOW } from "./home/ui";
import { C, DARKROOM as D } from "../constants/theme";
import { priceLabelFor, productOf, dayLabel } from "../constants/subscription";
import { STAGES } from "../services/printSelection";

function Thumb({ magnets, urls, dark }) {
  return (
    <View style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: dark ? D.glow[2] : C.bgMuted, overflow: "hidden" }}>
      {magnets ? (
        <>
          <MagnetTile uri={urls[0]} index={0} size={26} style={{ position: "absolute", left: 4, top: 20, transform: [{ rotate: "-9deg" }] }} />
          <MagnetTile uri={urls[1]} index={1} size={28} style={{ position: "absolute", left: 20, top: 6, zIndex: 2, transform: [{ rotate: "5deg" }] }} />
          <MagnetTile uri={urls[2]} index={2} size={24} style={{ position: "absolute", left: 26, top: 28, zIndex: 3, transform: [{ rotate: "-4deg" }] }} />
        </>
      ) : (
        <>
          <PrintTile uri={urls[0]} index={0} width={34} style={{ position: "absolute", left: 5, top: 10, transform: [{ rotate: "-6deg" }] }} />
          <PrintTile uri={urls[1]} index={1} width={34} style={{ position: "absolute", left: 15, top: 20, zIndex: 2, transform: [{ rotate: "4deg" }] }} />
        </>
      )}
    </View>
  );
}

// Texte et style de la pastille d'état.
function chipOf(st) {
  if (st.kind === "paused") return { text: "En pause", tone: "off" };
  if (st.kind === "validated") {
    return { text: st.stageIdx === 0 ? "✓ Validée · en préparation" : `✓ ${STAGES[st.stageIdx].label}`, tone: "ok" };
  }
  if (st.kind === "soon") return { text: `Prochaine sélection le ${dayLabel(st.selectionDay)} ${st.monthShort}`, tone: "off" };
  return { text: `À valider avant le ${st.sendDay} ${st.monthShort}`, tone: "todo" };
}

export default function SubscriptionRow({ sub, st, urls = [], onPress, onMenu, hideMenu = false, dark = false }) {
  const magnets = sub.product === "magnets";
  const product = productOf(sub);
  const chip = chipOf(st);
  const price = priceLabelFor(sub.count, product.key);
  const onTone = chip.tone !== "off";

  // ── Chambre noire : brique sombre + liseré lumineux ──
  if (dark) {
    const glow = chip.tone === "todo" ? D.todoGlow : chip.tone === "ok" ? C.sage3 : C.textMuted;
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}
        style={{ flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: D.tray, borderWidth: 1, borderColor: D.trayEdge, borderRadius: 16, paddingVertical: 10, paddingLeft: 16, paddingRight: 6 }}>
        {/* Liseré lumineux : l'état d'un coup d'œil */}
        <View style={{ position: "absolute", left: 0, top: 11, bottom: 11, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: glow,
          ...(chip.tone === "todo" ? { shadowColor: D.todoGlow, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } } : null) }} />
        <Thumb magnets={magnets} urls={urls} dark />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: D.paper }} numberOfLines={1}>
            {magnets ? "Magnets" : "Tirages"} · {sub.kind === "self" ? "pour moi" : sub.name}
          </Text>
          <Text style={{ fontSize: 11, color: D.halo, opacity: 0.8, marginTop: 1 }} numberOfLines={1}>
            {sub.count} {product.units}{price ? ` · ${price} / mois` : ""}
          </Text>
          {chip.tone === "todo" ? (
            // L'action à faire : pastille rouge vive
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", marginTop: 6, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3.5, backgroundColor: D.todoBg }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: D.halo }} />
              <Text style={{ fontSize: 10.5, fontWeight: "700", color: D.paper }} numberOfLines={1}>{chip.text}</Text>
            </View>
          ) : (
            <Text style={{ fontSize: 11, fontWeight: "600", marginTop: 5, color: chip.tone === "ok" ? C.sage3 : D.halo, opacity: chip.tone === "ok" ? 1 : 0.65 }} numberOfLines={1}>{chip.text}</Text>
          )}
        </View>
        {hideMenu ? <View style={{ width: 6 }} /> : (
          <TouchableOpacity onPress={onMenu} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
            <Text style={{ fontSize: 17, fontWeight: "600", color: D.halo, letterSpacing: 1 }}>···</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}
      style={[{ flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: C.bgCard, borderRadius: 16, paddingVertical: 10, paddingLeft: 12, paddingRight: 6 }, SHADOW]}>
      <Thumb magnets={magnets} urls={urls} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }} numberOfLines={1}>
          {magnets ? "Magnets" : "Tirages"} · {sub.kind === "self" ? "pour moi" : sub.name}
        </Text>
        <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }} numberOfLines={1}>
          {sub.count} {product.units}{price ? ` · ${price} / mois` : ""}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", marginTop: 5, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: onTone ? C.sage : C.bgMuted }}>
          {chip.tone === "todo" && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.album }} />}
          <Text style={{ fontSize: 10.5, fontWeight: "700", color: onTone ? C.accent : C.textMuted }} numberOfLines={1}>{chip.text}</Text>
        </View>
      </View>
      {hideMenu ? <View style={{ width: 6 }} /> : (
        <TouchableOpacity onPress={onMenu} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
          <Text style={{ fontSize: 17, fontWeight: "600", color: C.textMuted, letterSpacing: 1 }}>···</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}
