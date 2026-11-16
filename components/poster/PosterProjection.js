// components/poster/PosterProjection.js
// L'image de la page de présentation du poster : UN format à la fois (celui touché sous l'encart orange), dessiné avec des iPhone
// EMPILÉS EN HAUTEUR à côté (A2 ≈ 4 iPhone) pour se rendre compte de la taille. L'image se met à jour quand on touche un autre format.
// Le poster remplit toujours la même hauteur à l'écran ; les iPhone sont dessinés à la MÊME échelle que lui (plus le format est grand, plus la pile est haute).
// Modèle de référence : iPhone 15 (147,6 × 71,6 mm), écrit sous l'image.
// Pour montrer qu'on peut mettre plusieurs photos, certains formats montrent un PÊLE-MÊLE (tirages alignés en lignes et colonnes) :
// A4 et A2 = une photo, A3 = pêle-mêle de 6 photos, A1 = pêle-mêle de 16 photos.
// Plus de pastille sur l'image (12 nov. : « Livré sous 3 à 7 jours » puis « Impression haute définition » retirées à la demande d'Augustin).
// À venir (quand ce sera développé) : « Voir chez moi », la projection du poster sur le mur en réalité augmentée, à cet endroit.

import { View } from "react-native";
import { Image } from "expo-image";
import Text from "../AppText";
import { C } from "../../constants/theme";
import { COLLAGE_RATIO, collageLayout, cellPhotoRect, collageBgColor } from "../../services/posterCollage";

// Modèle pris pour les mesures : iPhone 15 (fiche Apple : 147,6 × 71,6 mm). Affiché sous l'image (IPHONE_MODEL).
export const IPHONE_MODEL = "iPhone 15";
export const IPHONE_MM = { w: 71.6, h: 147.6 };

// 1,5 → « 1,5 » · 2 → « 2 » (une décimale au plus, virgule française).
const fr1 = (x) => String(Math.round(x * 10) / 10).replace(".", ",");

// Pile d'iPhone, du bas vers le haut, de la hauteur exacte du poster : N iPhone entiers + un dernier coupé par le haut du poster.
// Chaque iPhone garde un liseré de 0,5 px dans SA case, donc la pile mesure exactement la hauteur du poster.
function PhoneStack({ h, pw, ph, n }) {
  const full = Math.floor(n + 0.02);               // 2,01 → 2 (pas de sliver)
  const frac = n - full;
  const partial = frac > 0.08 ? Math.round(ph * frac) : 0;
  const phone = {
    position: "absolute", left: 0, bottom: 0, width: pw, height: ph - 1,
    borderRadius: Math.max(2, pw * 0.16), backgroundColor: "#1e1f1c", padding: Math.max(1, pw * 0.06),
  };
  const screen = { flex: 1, borderRadius: Math.max(1.5, pw * 0.12), backgroundColor: "#3b3f38" };
  return (
    <View style={{ width: pw, height: h, flexDirection: "column-reverse", overflow: "hidden" }}>
      {Array.from({ length: full }).map((_, i) => (
        <View key={i} style={{ width: pw, height: ph, paddingVertical: 0.5 }}>
          <View style={[phone, { bottom: 0.5 }]}><View style={screen} /></View>
        </View>
      ))}
      {partial > 0 && (
        <View style={{ width: pw, height: partial, overflow: "hidden" }}>
          <View style={[phone, { bottom: 0.5 }]}><View style={screen} /></View>
        </View>
      )}
    </View>
  );
}

// Ce que montre chaque format : null = une seule photo, nombre = pêle-mêle de N photos.
const CONTENT = { a4: null, a3: 6, a2: null, a1: 16 };
const FALLBACKS = [C.sage2, C.albumSoft, "#cfe0ef", "#f0c9a0", "#e9c6d6", "#b9d4ee"]; // aplats si l'utilisateur n'a pas (encore) de coups de cœur

function Tile({ uri, i, style }) {
  return uri
    ? <Image source={{ uri }} contentFit="cover" style={[{ backgroundColor: FALLBACKS[i % FALLBACKS.length] }, style]} />
    : <View style={[{ backgroundColor: FALLBACKS[i % FALLBACKS.length] }, style]} />;
}

// Un poster de largeur w : une photo, ou un pêle-mêle de n tirages alignés.
function MiniPoster({ w, h, n, urls }) {
  const url = (i) => (urls.length ? urls[i % urls.length] : null);
  const shadow = { shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 };
  if (!n) {
    const b = Math.max(3, w * 0.035); // bord blanc
    return (
      <View style={[{ width: w, height: h, backgroundColor: "#fff", padding: b }, shadow]}>
        <Tile uri={url(0)} i={0} style={{ flex: 1 }} />
      </View>
    );
  }
  const cells = collageLayout("pelemele", n);
  return (
    <View style={[{ width: w, height: h, backgroundColor: collageBgColor("creme"), overflow: "hidden" }, shadow]}>
      {cells.map((c, i) => {
        const r = cellPhotoRect(c);
        return (
          <View key={i} style={{ position: "absolute", left: c.x * w, top: c.y * w, width: c.w * w, height: c.h * w, backgroundColor: "#fff" }}>
            <Tile uri={url(i)} i={i} style={{ position: "absolute", left: r.x * w, top: r.y * w, width: r.w * w, height: r.h * w }} />
          </View>
        );
      })}
    </View>
  );
}

// format = POSTER_FORMATS[clé] · urls = photos à montrer (coups de cœur) · width = largeur de l'image · height = hauteur du poster dessiné
export default function PosterProjection({ format, urls = [], width, height = 200 }) {
  const h = height;
  const w = Math.round(h / COLLAGE_RATIO);
  const k = h / format.heightMm; // pixels par millimètre, même échelle pour le poster et l'iPhone
  const pw = Math.max(8, Math.round(IPHONE_MM.w * k));
  const ph = IPHONE_MM.h * k;
  const nPhones = format.heightMm / IPHONE_MM.h; // combien d'iPhone empilés font la hauteur du poster

  return (
    <View style={{ width, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.55)", paddingTop: 16, paddingBottom: 14, alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 14, height: h }}>
        <MiniPoster w={w} h={h} n={CONTENT[format.key]} urls={urls} />
        {/* iPhone empilés en hauteur, à côté, à la même échelle */}
        <PhoneStack h={h} pw={pw} ph={ph} n={nPhones} />
      </View>

      <Text style={{ fontSize: 13.5, fontWeight: "700", color: C.text, marginTop: 12 }}>{format.name} · {format.sizeLabel}</Text>
      <Text style={{ fontSize: 13, fontWeight: "600", color: C.text, marginTop: 3 }}>
        ≈ {fr1(nPhones)} iPhone empilés en hauteur
      </Text>
      <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2, textAlign: "center" }}>
        {CONTENT[format.key] ? `Ici : un pêle-mêle de ${CONTENT[format.key]} photos · ` : ""}
        Mesuré avec un {IPHONE_MODEL} ({fr1(IPHONE_MM.h / 10)} × {fr1(IPHONE_MM.w / 10)} cm)
      </Text>
    </View>
  );
}
