// screens/PosterFormatScreen.js
// « Cadre ton poster » : on règle le CADRAGE puis on choisit le FORMAT.
//   · grand aperçu du poster avec la photo : glisser = déplacer, pincer = zoomer (même composant que le livre : CroppedImage),
//     boutons − / ＋ / Recentrer ;
//   · 4 pastilles de format (A4 → A1) avec, pour chacune, la qualité de CETTE photo à CE zoom (dpi) ;
//   · le prix reste discret (une ligne au-dessus du bouton), il n'est plus sur chaque format.
// Le recadrage choisi voyage jusqu'au récapitulatif (route.params.crop) : `{ scale, x, y }` en parts du cadre.

import { useState, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { PosterFrame, POSTER_RATIO } from "../components/poster/PosterParts";
import { SHADOW } from "../components/home/ui";
import { C } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { formatEuro } from "../constants/subscription";
import { DEFAULT_CROP, MAX_ZOOM } from "../services/photoBook";
import {
  POSTER_FORMATS, POSTER_FORMAT_KEYS,
  posterIsLandscape, posterSizeLabel, posterQuality, posterQualityLevel, bestPosterFormat, posterPriceCents,
} from "../services/posterProducts";

const TONES = {
  good: { bg: C.sage, fg: C.green },
  ok:   { bg: C.sage, fg: C.green },
  warn: { bg: "#fbe9d6", fg: C.yellow },
  bad:  { bg: C.redSoft, fg: C.red },
};
const ICON = { good: "✓", ok: "✓", warn: "⚠", bad: "⚠" };
const ZOOM_STEP = 0.25;

export function PosterFormatScreen({ navigation, route }) {
  const { width: SW, height: SH } = useWindowDimensions();
  const { photoId } = route.params ?? {};
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const kept = usePhotoStore((s) => s.kept);
  const photo = useMemo(
    () => libraryPhotos.find((p) => p.id === photoId) ?? kept.find((p) => p.id === photoId) ?? null,
    [libraryPhotos, kept, photoId],
  );
  const [fmt, setFmt] = useState(() => bestPosterFormat(photo));
  const [crop, setCrop] = useState(DEFAULT_CROP);
  const landscape = posterIsLandscape(photo); // poster horizontal si la photo l'est

  // Taille de l'aperçu : le plus grand poster qui tient (largeur de l'écran, ~40 % de sa hauteur).
  const maxH = Math.min(360, SH * 0.4);
  const previewW = landscape ? Math.min(SW - 64, maxH * POSTER_RATIO) : Math.min(SW - 64, maxH / POSTER_RATIO);

  const patchCrop = (patch) => setCrop((c) => ({ ...c, ...patch }));
  const zoomBy = (d) => setCrop((c) => {
    const scale = Math.min(MAX_ZOOM, Math.max(1, Math.round((c.scale + d) * 100) / 100));
    // En dézoomant on recentre (sinon la photo pourrait laisser un bord vide) ; en zoomant on garde la position.
    return d < 0 ? { ...c, scale, x: 0, y: 0 } : { ...c, scale };
  });
  const moved = crop.scale !== 1 || crop.x !== 0 || crop.y !== 0;

  const q = photo ? posterQuality(photo, fmt, crop.scale) : null;
  const lvl = posterQualityLevel(q?.dpi ?? null);
  const tone = TONES[lvl.tone];
  const hint = lvl.key === "tight" ? "Un peu juste : vu de près, l'image sera moins nette."
    : lvl.key === "low" ? "Trop petite pour ce format : choisis un format plus petit ou dézoome."
    : "";

  const roundBtn = (label, onPress, disabled) => (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}
      style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.bgCard, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1, ...SHADOW }}>
      <Text style={{ fontSize: 20, lineHeight: 22, color: C.album, fontWeight: "700" }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BackButton onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>Cadre ton poster</Text>
            <Text style={{ fontSize: 12, color: C.textMuted }}>
              {photo?.width ? `Photo de ${photo.width} × ${photo.height} px` : "Taille de la photo inconnue"}
            </Text>
          </View>
        </View>

        {/* Aperçu : glisser pour déplacer, pincer pour zoomer */}
        <View style={{ alignItems: "center", marginTop: 16, paddingVertical: 18, borderRadius: 20, backgroundColor: C.bgMuted }}>
          <PosterFrame uri={photo?.url} width={previewW} border={4} landscape={landscape} crop={crop} editable onCropChange={patchCrop} />
          <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 12 }}>Glisse pour déplacer · pince pour zoomer</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 }}>
            {roundBtn("−", () => zoomBy(-ZOOM_STEP), crop.scale <= 1)}
            <Text style={{ fontSize: 13, fontWeight: "700", color: C.text, minWidth: 40, textAlign: "center" }}>{`${Math.round(crop.scale * 100)} %`}</Text>
            {roundBtn("＋", () => zoomBy(ZOOM_STEP), crop.scale >= MAX_ZOOM)}
            <TouchableOpacity onPress={() => setCrop(DEFAULT_CROP)} disabled={!moved} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginLeft: 6, opacity: moved ? 1 : 0.4 }}>
              <Text style={{ fontSize: 12.5, fontWeight: "600", color: C.album }}>⌖ Recentrer</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Format : 4 pastilles, chacune avec la qualité de cette photo */}
        <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: C.textMuted, marginTop: 20, marginBottom: 8 }}>FORMAT</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {POSTER_FORMAT_KEYS.map((k) => {
            const f = POSTER_FORMATS[k];
            const sel = k === fmt;
            const pq = photo ? posterQuality(photo, k, crop.scale) : null;
            const l = posterQualityLevel(pq?.dpi ?? null);
            const t = TONES[l.tone];
            return (
              <TouchableOpacity key={k} activeOpacity={0.85} onPress={() => setFmt(k)}
                style={[{ flex: 1, alignItems: "center", backgroundColor: sel ? "#fbf3ee" : C.bgCard, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 2, borderWidth: 1.5, borderColor: sel ? C.album : "transparent" }, SHADOW]}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{f.name}</Text>
                <Text style={{ fontSize: 9.5, color: C.textMuted, marginTop: 1 }}>{posterSizeLabel(k, landscape).replace(" cm", "")}</Text>
                <View style={{ backgroundColor: t.bg, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1.5, marginTop: 6 }}>
                  <Text style={{ fontSize: 9, fontWeight: "700", color: t.fg }}>{ICON[l.tone]} {l.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Détail de la qualité du format choisi */}
        <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ backgroundColor: tone.bg, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: tone.fg }}>{ICON[lvl.tone]} {lvl.label}</Text>
          </View>
          <Text style={{ fontSize: 12, color: C.textMid }}>
            {q ? `${posterSizeLabel(fmt, landscape)} · ${q.dpi} dpi` : posterSizeLabel(fmt, landscape)}
          </Text>
        </View>
        {!!hint && <Text style={{ fontSize: 11.5, lineHeight: 16, color: C.yellow, marginTop: 6 }}>{hint}</Text>}
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 26, borderTopWidth: 1, borderTopColor: C.border }}>
        <Text style={{ fontSize: 11.5, color: C.textMuted, textAlign: "center", marginBottom: 8 }}>
          {POSTER_FORMATS[fmt].name} · {formatEuro(posterPriceCents(fmt))} TTC, livraison comprise
        </Text>
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate("PosterRecap", { photoId, format: fmt, crop: { scale: crop.scale, x: crop.x, y: crop.y } })}
          style={[{ height: 50, borderRadius: 25, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }, SHADOW]}>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Continuer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
