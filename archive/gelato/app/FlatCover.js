// components/book/FlatCover.js
// Couverture À PLAT d'un livre : 4ᵉ de couverture · dos · face avant, côte à côte, comme elle sera imprimée.
// Sert à l'aperçu (petite) et au PDF (grande, dessinée hors écran).
//
// dims : voir normalizeCover() dans services/gelato.js (millimètres, origine en haut à gauche).
// width : largeur en pixels de toute la couverture à plat (la hauteur suit les proportions de Gelato).
//
// • Face avant : le style choisi (BookCover) dans la zone utile `dims.front` ; la photo « pleine page »
//   va jusqu'au bord (charnière, rabat et fond perdu compris).
// • 4ᵉ de couverture : la couleur de fond (la zone du code-barres reste libre).
// • Dos : la couleur de fond + le titre à la verticale (lisible de haut en bas).
// guides : traits fins aux plis du dos (aperçu seulement).

import { View } from "react-native";
import Text from "../AppText";
import { BookCover, COVER_STYLE } from "./BookPage";
import { coverBgHex, isLightHex } from "../../services/photoBook";
import { C } from "../../constants/theme";

export function FlatCover({ cover, dims, width, urlById, flat, guides, onImageLoad }) {
  const s = width / dims.total.w;            // pixels par millimètre
  const height = Math.round(dims.total.h * s);
  const bg = coverBgHex(cover.bg);
  const inkOnBg = isLightHex(bg) ? C.text : "#ffffff";

  // Face avant : du début de la charnière jusqu'au bord droit.
  const frontLeft = dims.jointFront.x * s;
  const frontW = width - frontLeft;
  const bleed = {
    l: dims.front.x * s - frontLeft,                       // charnière
    t: dims.front.y * s,
    r: width - (dims.front.x + dims.front.w) * s,          // marge + rabat à droite
    b: height - (dims.front.y + dims.front.h) * s,
  };

  // Dos : on écrit le titre dans un rectangle couché (longueur = hauteur du dos), tourné d'un quart de tour.
  const sp = { l: dims.spine.x * s, t: dims.spine.y * s, w: dims.spine.w * s, h: dims.spine.h * s };
  const spineFont = COVER_STYLE.font[cover.font] ?? COVER_STYLE.font.moderne;
  const spineFontSize = Math.max(4, Math.round(sp.w * 0.5));

  return (
    <View style={{ width, height, backgroundColor: bg, overflow: "hidden" }}>
      <View style={{ position: "absolute", left: frontLeft, top: 0, width: frontW, height }}>
        <BookCover cover={cover} size={frontW} ratio={height / frontW} bleed={bleed}
          urlById={urlById} flat onImageLoad={onImageLoad} />
      </View>

      {!!cover.title && (
        <View pointerEvents="none" style={{
          position: "absolute", width: sp.h, height: sp.w,
          left: sp.l + sp.w / 2 - sp.h / 2, top: sp.t + sp.h / 2 - sp.w / 2,
          transform: [{ rotate: "90deg" }], alignItems: "center", justifyContent: "center", paddingHorizontal: sp.h * 0.08,
        }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}
            style={{ fontFamily: spineFont.family, fontWeight: spineFont.weight, fontSize: spineFontSize, color: inkOnBg }}>
            {cover.title}
          </Text>
        </View>
      )}

      {guides && [sp.l, sp.l + sp.w].map((x, i) => (
        <View key={i} pointerEvents="none" style={{ position: "absolute", left: x, top: 0, width: 1, height, backgroundColor: "rgba(0,0,0,0.12)" }} />
      ))}
    </View>
  );
}
