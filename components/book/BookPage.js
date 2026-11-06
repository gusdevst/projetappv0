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
import { getCrop } from "../../services/photoBook";

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

// Couverture : photo plein cadre + titre réglable.
// flat : pas de coins arrondis (rendu pour l'impression) · onImageLoad : appelée quand la photo est chargée.
export function BookCover({ cover, size, ratio = 1, urlById, onPress, flat, onImageLoad }) {
  const url = cover.photoId ? urlById[cover.photoId] : null;
  const mini = size < 60;
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} disabled={!onPress}
      style={{ width: size, height: Math.round(size * ratio), borderRadius: flat ? 0 : mini ? 2 : 8, overflow: "hidden", backgroundColor: C.albumSoft }}>
      {url && <Image source={{ uri: url }} style={{ position: "absolute", width: "100%", height: "100%" }} contentFit="cover" onLoad={onImageLoad} />}
      {onPress && !mini && (
        <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 10.5, fontWeight: "600", color: C.text }}>Changer la photo</Text>
        </View>
      )}
      {!mini && !!cover.title && (() => {
        const font = COVER_STYLE.font[cover.font] ?? COVER_STYLE.font.moderne;
        const fontSize = Math.round(size * (COVER_STYLE.size[cover.size] ?? 0.14));
        return (
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            paddingHorizontal: "8%", paddingVertical: "9%", justifyContent: (COVER_STYLE.pos[cover.pos] ?? COVER_STYLE.pos.bas).justify }}>
            <Text numberOfLines={2} style={{ textAlign: "center", fontFamily: font.family, fontWeight: font.weight,
              fontSize, lineHeight: Math.round(fontSize * 1.15), color: COVER_STYLE.color[cover.color] ?? "#ffffff",
              textShadowColor: "rgba(0,0,0,0.22)", textShadowRadius: 8 }}>
              {cover.title}
            </Text>
          </View>
        );
      })()}
    </TouchableOpacity>
  );
}
