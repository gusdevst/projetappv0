// screens/PosterFormatScreen.js
// Choisir le format du poster (maquette `maquette-poster.html`, écran 5) : les 4 formats à l'échelle, chacun avec son prix
// et un indicateur de qualité calculé sur la photo choisie (voir posterQuality dans services/posterProducts.js).
// La photo est recadrée AU CENTRE pour remplir le poster (le « Ajuster » de la maquette n'est pas encore codé).

import { useState, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { SHADOW } from "../components/home/ui";
import { C } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { formatEuro } from "../constants/subscription";
import {
  POSTER_FORMATS, POSTER_FORMAT_KEYS, POSTER_CROP_WARN_PCT,
  posterIsLandscape, posterDims, posterSizeLabel, posterQuality, posterQualityLevel, bestPosterFormat, posterPriceCents,
} from "../services/posterProducts";

const TONES = {
  good: { bg: C.sage, fg: C.green },
  ok:   { bg: C.sage, fg: C.green },
  warn: { bg: "#fbe9d6", fg: C.yellow },
  bad:  { bg: C.redSoft, fg: C.red },
};
const ICON = { good: "✓", ok: "✓", warn: "⚠", bad: "⚠" };

export function PosterFormatScreen({ navigation, route }) {
  const { width: SW } = useWindowDimensions();
  const { photoId } = route.params ?? {};
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const kept = usePhotoStore((s) => s.kept);
  const photo = useMemo(
    () => libraryPhotos.find((p) => p.id === photoId) ?? kept.find((p) => p.id === photoId) ?? null,
    [libraryPhotos, kept, photoId],
  );
  const [fmt, setFmt] = useState(() => bestPosterFormat(photo));

  // Échelle de la frise : les 4 posters côte à côte tiennent dans la largeur (même échelle pour tous).
  const stageW = SW - 32;
  const GAPS = 10;
  const landscape = posterIsLandscape(photo); // poster horizontal si la photo l'est
  const dims = (k) => posterDims(k, landscape);
  const totalMm = POSTER_FORMAT_KEYS.reduce((s, k) => s + dims(k).widthMm, 0);
  const scale = (stageW - 28 - GAPS * 3) / totalMm; // px par mm
  const stageH = dims("a1").heightMm * scale + 52;

  const q = photo ? posterQuality(photo, fmt) : null;
  const crop = q?.lossPct ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BackButton onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>Format du poster</Text>
            <Text style={{ fontSize: 12, color: C.textMuted }}>
              {photo?.width ? `Photo de ${photo.width} × ${photo.height} px` : "Taille de la photo inconnue"}
            </Text>
          </View>
        </View>

        {/* Frise : les 4 formats à l'échelle, posés sur le sol d'une pièce */}
        <View style={{ marginTop: 14, height: stageH, borderRadius: 18, backgroundColor: C.bgMuted, overflow: "hidden", flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: GAPS, paddingBottom: 30 }}>
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 24, backgroundColor: C.border }} />
          {POSTER_FORMAT_KEYS.map((k) => {
            const f = POSTER_FORMATS[k];
            const sel = k === fmt;
            return (
              <TouchableOpacity key={k} activeOpacity={0.85} onPress={() => setFmt(k)} style={{ alignItems: "center" }}>
                <View style={{ width: dims(k).widthMm * scale, height: dims(k).heightMm * scale, backgroundColor: "#fff", padding: 2, opacity: sel ? 1 : 0.55, borderWidth: sel ? 2.5 : 0, borderColor: C.album, ...SHADOW }}>
                  <View style={{ flex: 1, backgroundColor: C.sage2, overflow: "hidden" }}>
                    {!!photo?.url && <Image source={{ uri: photo.url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
                  </View>
                </View>
                <Text style={{ position: "absolute", bottom: -20, fontSize: 10, fontWeight: "700", color: sel ? C.text : C.textMuted }}>{f.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ gap: 8, marginTop: 14 }}>
          {POSTER_FORMAT_KEYS.map((k) => {
            const f = POSTER_FORMATS[k];
            const sel = k === fmt;
            const pq = photo ? posterQuality(photo, k) : null;
            const lvl = posterQualityLevel(pq?.dpi ?? null);
            const tone = TONES[lvl.tone];
            return (
              <TouchableOpacity key={k} activeOpacity={0.85} onPress={() => setFmt(k)}
                style={[{ flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: sel ? "#fbf3ee" : C.bgCard, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1.5, borderColor: sel ? C.album : "transparent" }, SHADOW]}>
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: sel ? 5 : 1.8, borderColor: sel ? C.album : "#c8c6bc" }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{f.name} · {posterSizeLabel(k, landscape)}</Text>
                  <View style={{ alignSelf: "flex-start", backgroundColor: tone.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1.5, marginTop: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: tone.fg }}>{ICON[lvl.tone]} {lvl.label}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{formatEuro(f.saleCents)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontSize: 11.5, lineHeight: 16, color: crop >= POSTER_CROP_WARN_PCT ? C.yellow : C.textMuted, marginTop: 12 }}>
          {crop >= POSTER_CROP_WARN_PCT
            ? `✂ Environ ${crop} % de ta photo sera coupé pour remplir le poster (recadrage au centre).`
            : crop > 0 ? "✂ Recadré au centre pour remplir le poster." : ""}
          {landscape ? "\nPoster horizontal, comme ta photo." : ""}
        </Text>
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 26, borderTopWidth: 1, borderTopColor: C.border }}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate("PosterRecap", { photoId, format: fmt })}
          style={[{ height: 54, borderRadius: 27, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }, SHADOW]}>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Continuer</Text>
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 11 }}>{POSTER_FORMATS[fmt].name} · {formatEuro(posterPriceCents(fmt))} · livraison comprise</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
