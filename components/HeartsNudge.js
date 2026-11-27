// Ligne de relance du Bilan de tri : quand la session a ajouté des coups de cœur, dit où on en est vers un lot de tirages.
// (maquette `maquette-badges-labo.html`, scène « Après un tri »).
import { View, TouchableOpacity } from "react-native";
import Text from "./AppText";
import { FN_COLORS } from "../constants/theme";
import { SUB_PHOTOS } from "../constants/subscription";

export default function HeartsNudge({ keptToPrint, onSeeHearts, onPrint }) {
  const col = FN_COLORS.labo;
  const left = SUB_PHOTOS - keptToPrint;
  const full = left <= 0;
  const title = full
    ? `${keptToPrint} coups de cœur à imprimer`
    : `Encore ${left} ❤️ et tu as un lot de ${SUB_PHOTOS} tirages`;
  const sub = full
    ? `De quoi remplir un lot de ${SUB_PHOTOS} tirages 10 × 15 cm.`
    : "Pour ton prochain lot de tirages.";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: col.soft, borderRadius: 14, padding: 11, marginBottom: 12 }}>
      <Text style={{ fontSize: 24 }}>🎞️</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#23271f" }}>{title}</Text>
        <Text style={{ fontSize: 11.5, color: "#4b5045", lineHeight: 16, marginTop: 1 }}>{sub}</Text>
        <TouchableOpacity onPress={full ? onPrint : onSeeHearts} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: col.main }}>{full ? "Choisir mes tirages ›" : "Voir mes coups de cœur ›"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
