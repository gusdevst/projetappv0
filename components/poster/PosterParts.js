// components/poster/PosterParts.js
// Petits morceaux visuels du poster photo (maquette `maquette-poster.html`) :
//   PosterFrame     : un poster (cadre blanc, photo recadrée au centre en « cover »)
//   PosterWall      : bloc « Posters » de la Chambre noire = 3 cadres accrochés à un fil, teintés de rouge
//   PosterHeroScene : scène claire de la page de présentation (poster + tube + pastille « 250 g »)

import { View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Text from "../AppText";
import { C, DARKROOM as D } from "../../constants/theme";
import { CroppedImage } from "../book/CroppedImage";
import { DEFAULT_CROP } from "../../services/photoBook";
import { POSTER_FORMATS } from "../../services/posterProducts";

// Rapport hauteur / largeur d'un poster de la série A.
export const POSTER_RATIO = 297 / 210;

// Poster : `width` = largeur totale (bord blanc compris). `landscape` = poster horizontal (feuille tournée à 90°).
// Sans photo : aplat sauge. `crop` : recadrage choisi ({ scale, x, y }) ; `editable` + `onCropChange` : glisser / pincer pour le régler.
export function PosterFrame({ uri, width, tint = 0, border = 3, landscape = false, crop, editable = false, onCropChange, style }) {
  const inner = width - border * 2;
  return (
    <View style={[{
      width, height: (landscape ? inner / POSTER_RATIO : inner * POSTER_RATIO) + border * 2, backgroundColor: "#fff", padding: border,
      shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.28, shadowRadius: 5,
    }, style]}>
      <View style={{ flex: 1, backgroundColor: C.sage2, overflow: "hidden" }}>
        {!!uri && (crop || editable
          ? <CroppedImage url={uri} crop={{ ...DEFAULT_CROP, ...crop }} editable={editable} onChange={onCropChange} />
          : <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />)}
        {tint > 0 && <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: D.tint, opacity: tint }} />}
      </View>
    </View>
  );
}

// Largeurs des 3 cadres du fil (A4 < A3 < A2, à peu près à l'échelle) et leur inclinaison.
const WALL = [
  { fmt: "a4", w: 54, rot: "-2deg", left: 0.06 },
  { fmt: "a3", w: 72, rot: "1.5deg", left: 0.31 },
  { fmt: "a2", w: 92, rot: "-1deg", left: 0.6 },
];

export function PosterWall({ urls = [], width, height = 156, radius = 16 }) {
  return (
    <View style={{ width, height, borderRadius: radius, overflow: "hidden" }}>
      <LinearGradient colors={["#5a1f1a", "#3a1411"]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      {/* lueur de l'ampoule, en haut à droite */}
      <View pointerEvents="none" style={{ position: "absolute", right: -40, top: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: D.glow[0], opacity: 0.22 }} />
      {/* le fil */}
      <View style={{ position: "absolute", left: 0, right: 0, top: 14, height: 1.5, backgroundColor: D.wire }} />
      {WALL.map((p, i) => (
        <View key={p.fmt} style={{ position: "absolute", top: 14, left: p.left * width, transform: [{ rotate: p.rot }] }}>
          {/* pince */}
          <View style={{ position: "absolute", left: "50%", top: -6, width: 4, height: 10, marginLeft: -2, backgroundColor: D.clip, borderRadius: 1, zIndex: 2 }} />
          <PosterFrame uri={urls[i]} width={p.w} tint={0.12} border={4} style={{ backgroundColor: D.paper }} />
          <Text style={{ textAlign: "center", marginTop: 3, fontSize: 9, fontWeight: "700", letterSpacing: 0.6, color: D.halo }}>{POSTER_FORMATS[p.fmt].name}</Text>
        </View>
      ))}
    </View>
  );
}

// Scène de la page de présentation : mur clair, poster accroché, tube de livraison, pastille « 250 g ».
export function PosterHeroScene({ uri, width, height = 190 }) {
  return (
    <View style={{ width, height, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      <LinearGradient colors={[C.bgMuted, C.border]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <PosterFrame uri={uri} width={104} border={4} style={{ transform: [{ rotate: "-1.5deg" }] }} />
      {/* tube de livraison */}
      <View style={{ position: "absolute", right: width * 0.12, bottom: 22, width: 18, height: 128, borderRadius: 9, backgroundColor: "#d9b98f", transform: [{ rotate: "16deg" }], borderWidth: 1, borderColor: "#b8956c" }} />
      <View style={{ position: "absolute", left: 14, top: 14, backgroundColor: C.album, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>250 g</Text>
      </View>
    </View>
  );
}
