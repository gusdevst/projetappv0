// components/poster/PosterScale.js
// « À l'échelle » : le poster choisi dessiné à sa vraie proportion avec, à côté, un objet que l'utilisateur connaît,
// pour se rendre compte de la taille (A3, A2, A1 : difficile à imaginer sans les mesures). Demande d'Augustin, 11 nov. 2026.
// Deux comparaisons au choix (idées 1 et 2 de `Claude outputs/maquette-poster-echelle.html`, validées) :
//   · un iPhone (14,7 × 7,2 cm) · · une feuille A4 (21 × 29,7 cm : « A3 = 2 feuilles, A2 = 4, A1 = 8 »).
// Le poster remplit toujours la même hauteur à l'écran ; l'objet est dessiné à la MÊME échelle.
// (Le « Voir chez moi » en réalité augmentée, idée 5, est une autre fonction : pas ici.)

import { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import Text from "../AppText";
import { C } from "../../constants/theme";
import { SHADOW } from "../home/ui";

export const IPHONE_MM = { w: 72, h: 147 }; // iPhone 15 : 147,6 × 71,6 mm
export const A4_MM = { w: 210, h: 297 };

const fr = (n, d = 1) => n.toFixed(d).replace(".", ",");

// format = { name, sizeLabel, widthMm, heightMm } (POSTER_FORMATS[key]) · uri = photo montrée sur le poster (facultative)
export default function PosterScale({ format, uri, width, height = 210 }) {
  const [ref, setRef] = useState("iphone"); // "iphone" | "a4"
  const k = height / format.heightMm;               // pixels par millimètre
  const pw = Math.round(format.widthMm * k), ph = Math.round(format.heightMm * k);
  const obj = ref === "a4" ? A4_MM : IPHONE_MM;
  const ow = Math.max(6, Math.round(obj.w * k)), oh = Math.max(12, Math.round(obj.h * k));
  const sheets = Math.round((format.widthMm * format.heightMm) / (A4_MM.w * A4_MM.h)); // A4 = 1, A3 = 2, A2 = 4, A1 = 8
  return (
    <View style={{ width, backgroundColor: C.bgCard, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 12, alignItems: "center", ...SHADOW }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 14, height }}>
        {/* Le poster */}
        <View style={{ width: pw, height: ph, backgroundColor: C.sage2, borderWidth: 3, borderColor: "#ffffff", shadowColor: "#3c3c28", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}>
          {!!uri && <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
        </View>
        {/* L'objet de comparaison, à la même échelle */}
        {ref === "a4" ? (
          <View style={{ width: ow, height: oh, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#cfcdc4" }} />
        ) : (
          <View style={{ width: ow, height: oh, borderRadius: Math.max(2, ow * 0.16), backgroundColor: "#1e1f1c", padding: Math.max(1, ow * 0.06) }}>
            <View style={{ flex: 1, borderRadius: Math.max(1.5, ow * 0.12), backgroundColor: "#3b3f38" }} />
          </View>
        )}
      </View>
      <Text style={{ fontSize: 13.5, fontWeight: "700", color: C.text, marginTop: 12 }}>{format.name} · {format.sizeLabel}</Text>
      <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2, textAlign: "center" }}>
        {ref === "a4"
          ? `À côté : une feuille A4 (21 × 29,7 cm). Ce poster = ${sheets} feuille${sheets > 1 ? "s" : ""} A4.`
          : `À côté : un iPhone (${fr(IPHONE_MM.h / 10)} cm de haut). Le poster fait ${fr(format.heightMm / IPHONE_MM.h)} fois sa hauteur.`}
      </Text>
      {/* Choix de la comparaison */}
      <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
        {[["iphone", "iPhone"], ["a4", "Feuille A4"]].map(([key, label]) => (
          <TouchableOpacity key={key} onPress={() => setRef(key)}
            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: ref === key ? C.album : C.bgMuted }}>
            <Text style={{ fontSize: 12.5, fontWeight: "600", color: ref === key ? "#fff" : C.textMid }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
