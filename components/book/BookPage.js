// components/book/BookPage.js
// Une page du livre photo, dessinée à n'importe quelle taille
// (grande dans la double page, minuscule dans la bande des miniatures).
//
// La mise en page = des LIGNES de cadres. Ex. 3 photos : 1 grand en haut, 2 en bas.
// Les nombres dans ROWS sont les numéros de cadre (0, 1, 2…).

import { View, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import Text from "../AppText";
import { C, FONT } from "../../constants/theme";
import { CroppedImage } from "./CroppedImage";
import { getCrop, getCoverCrop, coverBgHex, isLightHex } from "../../services/photoBook";

const ROWS = {
  1: [[0]],
  2: [[0], [1]],
  3: [[0], [1, 2]],
  4: [[0, 1], [2, 3]],
};
// Page horizontale : 2 photos côte à côte (une seule ligne). Le reste ne change pas.
const ROWS_LANDSCAPE = { ...ROWS, 2: [[0, 1]] };
const ROW_FLEX = { 3: [1.3, 1] }; // la ligne du haut un peu plus grande pour 3 photos

// Taille du titre de page, en part de la largeur de la page.
export const PAGE_TITLE_SIZE = { S: 0.045, M: 0.06, L: 0.08 };

// page : { layout, slots, title? } · urlById : { id: url }
// size = LARGEUR de la page · ratio = hauteur / largeur (voir pageRatio dans services/photoBook.js :
// 4/3 en vertical, 3/4 en horizontal). Sans ratio : page carrée.
// coverFont : police de la couverture = police du titre de page par défaut.
// onSlotPress(slotIndex) optionnel (éditeur) · selectedSlot : cadre entouré.
// editableSlot : cadre recadrable au doigt · onCropChange(slot, crop) · cropPreview : { slot, ...réglages } en direct.
// flat : pas de coins arrondis (rendu pour l'impression) · onImageLoad : appelée à chaque photo chargée.
export function BookPage({ page, size, ratio = 1, urlById, selected, onPress, onSlotPress, selectedSlot, coverFont, editableSlot, onCropChange, cropPreview, flat, onImageLoad }) {
  const mini = size < 60;
  const pad = mini ? 1.5 : size * 0.05;
  const gap = mini ? 1 : Math.max(3, size * 0.02);
  const layoutRows = ratio < 1 ? ROWS_LANDSCAPE : ROWS;

  // Lignes de photos…
  const rows = layoutRows[page.layout].map((row, ri) => (
    <View key={`r${ri}`} style={{ flex: ROW_FLEX[page.layout]?.[ri] ?? 1, flexDirection: "row", gap }}>
      {row.map((si) => {
        const id = page.slots[si];
        const url = id ? urlById[id] : null;
        const editable = editableSlot === si && !!url;
        const crop = { ...(id ? getCrop(page, id) : {}), ...(cropPreview?.slot === si ? cropPreview : {}) };
        // Cadre recadrable : pas de « bouton » autour, sinon il volerait les gestes.
        const Frame = onSlotPress && !editable ? TouchableOpacity : View;
        return (
          <Frame
            key={si}
            activeOpacity={0.8}
            onPress={onSlotPress ? () => onSlotPress(si) : undefined}
            style={{
              flex: 1, borderRadius: mini ? 1 : 3, overflow: "hidden",
              backgroundColor: url ? C.bgMuted : mini ? C.border : C.bgCard,
              borderWidth: url || mini ? 0 : 1.5, borderStyle: "dashed", borderColor: "#cfcdc4",
              alignItems: "center", justifyContent: "center",
            }}
          >
            {url
              ? <CroppedImage url={url} crop={crop} editable={editable} onChange={(c) => onCropChange?.(si, c)} onLoaded={onImageLoad} />
              : !mini && <Text style={{ color: "#b5b3a9", fontSize: Math.max(14, size * 0.06) }}>+</Text>}
            {selectedSlot === si && (
              <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: 3, borderColor: C.album, borderRadius: 3 }} />
            )}
          </Frame>
        );
      })}
    </View>
  ));

  // …et le titre de page, inséré en haut, au milieu (entre deux lignes) ou en bas.
  const t = page.title;
  if (t?.text) {
    const font = COVER_STYLE.font[t.font ?? coverFont] ?? COVER_STYLE.font.moderne;
    const fontSize = Math.round(size * (PAGE_TITLE_SIZE[t.size] ?? PAGE_TITLE_SIZE.M));
    const el = mini
      ? <View key="title" style={{ height: 2, marginHorizontal: "25%", backgroundColor: C.textMuted, borderRadius: 1 }} />
      : <Text key="title" numberOfLines={2} style={{ textAlign: "center", color: C.text, fontFamily: font.family, fontWeight: font.weight, fontSize, lineHeight: Math.round(fontSize * 1.2) }}>{t.text}</Text>;
    if (t.pos === "haut") rows.unshift(el);
    else if (t.pos === "milieu" && rows.length > 1) rows.splice(Math.ceil(rows.length / 2), 0, el);
    else rows.push(el);
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={!onPress}
      style={{
        width: size, height: Math.round(size * ratio), padding: pad,
        backgroundColor: "#ffffff", borderRadius: flat ? 0 : mini ? 2 : 6,
        borderWidth: selected ? (mini ? 1.5 : 2.5) : 0, borderColor: C.album,
      }}
    >
      <View style={{ flex: 1, gap }}>{rows}</View>
    </TouchableOpacity>
  );
}

// Page vide hachurée : « Intérieur de couverture », « Fin du livre ».
export function BlankPage({ size, ratio = 1, label }) {
  return (
    <View style={{ width: size, height: Math.round(size * ratio), backgroundColor: "#f6f5f1", borderRadius: 6, alignItems: "center", justifyContent: "center", padding: 10 }}>
      <Text style={{ fontSize: 10.5, color: C.textMuted, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

// ─── Réglages du titre de couverture ────────────────────────────────────────
// Les clés (moderne, S, blanc, bas…) viennent de services/photoBook.js ; ici on
// les traduit en vraie police / taille / couleur.
// Polices chargées par components/book/bookFonts.js (même nom sur iOS et Android).
export const COVER_STYLE = {
  font: {
    moderne:      { label: "Moderne",      family: FONT,                          weight: "600" },
    elegante:     { label: "Élégante",     family: "PlayfairDisplay_600SemiBold", weight: "normal" },
    manuscrite:   { label: "Manuscrite",   family: "Caveat_600SemiBold",          weight: "normal" },
    affiche:      { label: "Affiche",      family: "BebasNeue_400Regular",        weight: "normal" },
    calligraphie: { label: "Calligraphie", family: "GreatVibes_400Regular",       weight: "normal" },
    ronde:        { label: "Ronde",        family: "Fredoka_600SemiBold",         weight: "normal" },
  },
  size:  { S: 0.10, M: 0.14, L: 0.20 }, // part de la largeur de la couverture
  color: { blanc: "#ffffff", noir: C.text, terracotta: C.album, sauge: C.sage },
  pos:   { haut: { label: "Haut", justify: "flex-start" }, milieu: { label: "Milieu", justify: "center" }, bas: { label: "Bas", justify: "flex-end" } },
};

// Couleur du titre de couverture. "auto" = lisible quel que soit le style et le fond :
// blanc sur la photo, sombre sur le cadre blanc du polaroïd, clair / sombre selon la couleur de fond sinon.
export function coverTitleColor(cover) {
  if (cover.color && cover.color !== "auto") return COVER_STYLE.color[cover.color] ?? "#ffffff";
  const style = cover.style ?? "pleine";
  if (style === "pleine" || style === "cadre") return "#ffffff";
  if (style === "polaroid") return C.text;
  return isLightHex(coverBgHex(cover.bg)) ? C.text : "#ffffff";
}

// Couverture (face avant), dessinée selon cover.style (voir COVER_STYLES dans services/photoBook.js) :
// pleine · centree · polaroid · bandeau · cadre · titre. cover.bg = couleur de fond.
// size = largeur · ratio = hauteur / largeur.
// bleed { l, t, r, b } (pixels, facultatif) : marge de fond perdu autour de la zone utile. Les styles sont
// dessinés dans la zone utile ; la photo « pleine page » (et le fond) vont jusqu'au bord de la marge.
// flat : pas de coins arrondis (rendu pour l'impression) · onImageLoad : appelée quand la photo est chargée.
// La photo suit son recadrage (cover.crop). editable : pincer / glisser pour recadrer (onCropChange(crop) au lâcher) ·
// cropPreview : réglages appliqués en direct pendant un glissé de curseur (ex. { tilt }).
export function BookCover({ cover, size, ratio = 1, urlById, onPress, flat, onImageLoad, bleed, editable, onCropChange, cropPreview }) {
  const url = cover.photoId ? urlById[cover.photoId] : null;
  const mini = size < 60;
  const style = cover.style ?? "pleine";
  const W = size, H = Math.round(size * ratio);

  // Zone utile (sans le fond perdu) + petite fonction qui place un rectangle en parts de cette zone.
  const cx = bleed?.l ?? 0, cy = bleed?.t ?? 0;
  const cW = W - cx - (bleed?.r ?? 0), cH = H - cy - (bleed?.b ?? 0);
  const Z = (l, t, w, h) => ({ l: cx + l * cW, t: cy + t * cH, w: w * cW, h: h * cH });

  // Zones en pixels : photo, titre, et « carte » blanche du polaroïd.
  let photo = null, titleZone = null, card = null;
  if (style === "pleine" || style === "cadre") photo = { l: 0, t: 0, w: W, h: H };
  else if (style === "centree") {
    photo = Z(0.14, 0.14, 0.72, 0.56);
    titleZone = Z(0, 0.70, 1, 0.30);
  } else if (style === "polaroid") {
    card = Z(0.10, 0.08, 0.80, 0.84);
    photo = Z(0.14, 0.115, 0.72, 0.64);
    titleZone = Z(0.10, 0.755, 0.80, 0.165);
  } else if (style === "bandeau") {
    photo = { l: 0, t: 0, w: W, h: cy + 0.68 * cH };
    titleZone = Z(0, 0.68, 1, 0.32);
  } else if (style === "titre") {
    titleZone = Z(0, 0, 1, 1);
  }

  const font = COVER_STYLE.font[cover.font] ?? COVER_STYLE.font.moderne;
  const fontSize = Math.round(cW * (COVER_STYLE.size[cover.size] ?? 0.14));
  const color = coverTitleColor(cover);
  const onPhoto = style === "pleine" || style === "cadre";
  const textStyle = { textAlign: "center", fontFamily: font.family, fontWeight: font.weight, fontSize,
    lineHeight: Math.round(fontSize * 1.15), color };

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} disabled={!onPress}
      style={{ width: W, height: H, borderRadius: flat ? 0 : mini ? 2 : 8, overflow: "hidden", backgroundColor: coverBgHex(cover.bg) }}>
      {card && (
        <View style={{ position: "absolute", left: card.l, top: card.t, width: card.w, height: card.h,
          backgroundColor: "#ffffff", borderWidth: mini ? 0 : 1, borderColor: "rgba(0,0,0,0.06)" }} />
      )}
      {url && photo && (
        <View style={{ position: "absolute", left: photo.l, top: photo.t, width: photo.w, height: photo.h, overflow: "hidden" }}>
          <CroppedImage url={url} crop={{ ...getCoverCrop(cover), ...cropPreview }} editable={editable}
            onChange={onCropChange} onLoaded={onImageLoad} />
        </View>
      )}
      {style === "cadre" && (
        <View pointerEvents="none" style={{ position: "absolute", left: cx + 0.07 * cW, top: cy + 0.07 * cH, width: 0.86 * cW, height: 0.86 * cH,
          borderWidth: mini ? 0.5 : Math.max(1, cW * 0.007), borderColor: "rgba(255,255,255,0.9)" }} />
      )}
      {onPress && !editable && !mini && photo && (
        <View style={{ position: "absolute", top: photo.t + 8, right: W - (photo.l + photo.w) + 8, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 10.5, fontWeight: "600", color: C.text }}>Changer la photo</Text>
        </View>
      )}
      {style === "titre" && !mini && (
        <View pointerEvents="none" style={{ position: "absolute", left: cx + 0.38 * cW, width: 0.24 * cW, top: cy + cH / 2 - fontSize * 1.5,
          height: Math.max(1, cW * 0.007), backgroundColor: color, opacity: 0.5 }} />
      )}
      {!mini && !!cover.title && (onPhoto ? (
        // Le titre est posé sur la photo : en haut, au milieu ou en bas selon le réglage « Position ».
        <View pointerEvents="none" style={{ position: "absolute", left: cx, top: cy, width: cW, height: cH,
          paddingHorizontal: cW * 0.08, paddingVertical: cH * 0.09, justifyContent: (COVER_STYLE.pos[cover.pos] ?? COVER_STYLE.pos.bas).justify }}>
          <Text numberOfLines={2} style={[textStyle, { textShadowColor: "rgba(0,0,0,0.22)", textShadowRadius: 8 }]}>
            {cover.title}
          </Text>
        </View>
      ) : titleZone && (
        // Le titre a sa zone (sous la photo, dans le bandeau, dans le cadre blanc…) : centré dedans.
        <View pointerEvents="none" style={{ position: "absolute", left: titleZone.l, top: titleZone.t, width: titleZone.w, height: titleZone.h,
          paddingHorizontal: titleZone.w * 0.07, justifyContent: "center" }}>
          <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.4} style={textStyle}>{cover.title}</Text>
        </View>
      ))}
    </TouchableOpacity>
  );
}
