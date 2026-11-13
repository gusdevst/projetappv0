// components/poster/CollagePoster.js
// Un poster « pêle-mêle » : plusieurs photos disposées selon un style (services/posterCollage.js).
// `width` = largeur à l'écran ; tout le reste en découle (le même composant servira à dessiner le fichier d'impression hors écran).
//   photos : [{ id, url, … }] dans l'ordre choisi · order : collagePhotoOrder · crops : { [photoId]: { scale, x, y } }
//   onCellPress(index) : rend les photos touchables (aperçu de composition) ; sans lui, simple affichage.
// Le titre utilise les MÊMES polices que le livre (COVER_STYLE.font : Moderne, Manuscrite, Affiche, Calligraphie) : l'écran appelant doit avoir chargé useBookFonts().

import { View, TouchableOpacity } from "react-native";
import Text from "../AppText";
import { CroppedImage } from "../book/CroppedImage";
import { COVER_STYLE } from "../book/BookPage";
import { DEFAULT_CROP } from "../../services/photoBook";
import { COLLAGE_RATIO, TITLE_BAND, cellPhotoRect, collageBgColor, collageTitleColor } from "../../services/posterCollage";

export default function CollagePoster({ width, photos, cells, order, crops = {}, bg, title = "", titleFont = "manuscrite", onCellPress, style }) {
  const height = width * COLLAGE_RATIO;
  return (
    <View style={[{
      width, height, backgroundColor: collageBgColor(bg), overflow: "hidden",
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 6, elevation: 3,
    }, style]}>
      {cells.map((cell, i) => {
        const photo = photos[order[i]];
        if (!photo) return null;
        const rect = cellPhotoRect(cell);
        const framed = !!cell.pad;
        const body = (
          <View style={{ position: "absolute", left: rect.x * width, top: rect.y * width, width: rect.w * width, height: rect.h * width, overflow: "hidden", backgroundColor: "#d9d3c6" }}>
            <CroppedImage url={photo.url} crop={{ ...DEFAULT_CROP, ...crops[photo.id] }} editable={false} />
          </View>
        );
        const box = {
          position: "absolute", left: cell.x * width, top: cell.y * width, width: cell.w * width, height: cell.h * width,
          transform: [{ rotate: `${cell.rot}deg` }],
          ...(framed ? { backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 3 } : {}),
        };
        return onCellPress
          ? <TouchableOpacity key={photo.id} activeOpacity={0.85} onPress={() => onCellPress(i)} style={box}>{body}</TouchableOpacity>
          : <View key={photo.id} style={box}>{body}</View>;
      })}

      {!!title.trim() && (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: TITLE_BAND * width, alignItems: "center", justifyContent: "center" }}>
          <Text numberOfLines={1} adjustsFontSizeToFit
            style={{ fontFamily: (COVER_STYLE.font[titleFont] ?? COVER_STYLE.font.manuscrite).family, fontWeight: (COVER_STYLE.font[titleFont] ?? COVER_STYLE.font.manuscrite).weight, fontSize: width * 0.085, color: collageTitleColor(bg), paddingHorizontal: width * 0.06 }}>
            {title.trim()}
          </Text>
        </View>
      )}
    </View>
  );
}
