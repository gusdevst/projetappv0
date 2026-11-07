// components/SubscriptionRow.js
// Une ligne « abonnement en cours » de la Galerie (maquette validée le 8 nov.) :
// vignette (magnets ou tirages avec les vrais coups de cœur) · « Magnets · pour moi » · prix · pastille d'état · « ··· ».
// `st` = résultat de subStatus() (services/printSelection.js).

import { View, TouchableOpacity } from "react-native";
import Text from "./AppText";
import { MagnetTile, PrintTile } from "./ProductArt";
import { SHADOW } from "./home/ui";
import { C } from "../constants/theme";
import { priceLabelFor, productOf, dayLabel } from "../constants/subscription";
import { STAGES } from "../services/printSelection";

function Thumb({ magnets, urls }) {
  return (
    <View style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: C.bgMuted, overflow: "hidden" }}>
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

export default function SubscriptionRow({ sub, st, urls = [], onPress, onMenu }) {
  const magnets = sub.product === "magnets";
  const product = productOf(sub);
  const chip = chipOf(st);
  const price = priceLabelFor(sub.count, product.key);
  const onTone = chip.tone !== "off";

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
      <TouchableOpacity onPress={onMenu} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
        <Text style={{ fontSize: 17, fontWeight: "600", color: C.textMuted, letterSpacing: 1 }}>···</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
