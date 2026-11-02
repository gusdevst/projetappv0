// components/book/CroppedImage.js
// Une photo dans un cadre du livre, avec son recadrage (zoom, décalage, rotation).
// - editable = false : simple affichage (aperçu, miniatures).
// - editable = true  : pincer = zoomer, glisser = déplacer. onChange(crop) au lâcher.
//
// Règle d'or : la photo couvre TOUJOURS tout le cadre (jamais de bord vide),
// même pivotée ou redressée. C'est le rôle de coverK() et des limites de décalage.
// La photo garde ses proportions : une photo en hauteur dans un cadre en largeur
// dépasse en haut et en bas → on peut la faire glisser pour choisir la partie visible.

import { useEffect, useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { MAX_ZOOM } from "../../services/photoBook";

// Zoom minimum pour qu'une photo penchée de « tilt » degrés couvre encore le cadre w×h.
function coverK(w, h, tilt) {
  "worklet";
  const t = (Math.abs(tilt) * Math.PI) / 180;
  return Math.cos(t) + (Math.max(w, h) / Math.min(w, h)) * Math.sin(t);
}
// Décalage max (en part du cadre) : ce qui dépasse du cadre, divisé par 2 (de chaque côté).
// extent = taille de la photo sur cet axe, frame = taille du cadre sur cet axe.
function clampShift(v, scale, extent, frame) {
  "worklet";
  const m = Math.max(0, (scale * extent - frame) / (2 * frame));
  return Math.min(m, Math.max(-m, v));
}

export function CroppedImage({ url, crop, editable, onChange }) {
  const [box, setBox] = useState(null);       // taille du cadre { w, h }, mesurée à l'affichage
  const [ratio, setRatio] = useState(null);   // proportions de la photo (largeur / hauteur), lues au chargement
  const turned = crop.rot % 180 !== 0;        // quart de tour → on échange largeur et hauteur

  const scale = useSharedValue(crop.scale);
  const x = useSharedValue(crop.x);
  const y = useSharedValue(crop.y);
  const start = useSharedValue({ scale: 1, x: 0, y: 0 });
  // Le store change (bouton Recentrer, autre photo…) → on recale l'affichage.
  useEffect(() => { scale.value = crop.scale; x.value = crop.x; y.value = crop.y; }, [crop.scale, crop.x, crop.y]);

  const w = box?.w ?? 1, h = box?.h ?? 1;
  const k = coverK(w, h, crop.tilt);
  const angle = crop.rot + crop.tilt;

  // Taille de la photo AVANT rotation : ses vraies proportions, juste assez grande pour couvrir le cadre.
  const a = ratio ?? (turned ? h / w : w / h); // tant que la photo n'est pas chargée : proportions du cadre
  let bh = turned ? Math.max(w, h / a) : Math.max(h, w / a);
  let bw = a * bh;
  // Ce qu'elle occupe une fois tournée, dans le sens du cadre.
  const ex = turned ? bh : bw, ey = turned ? bw : bh;

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value * w },
      { translateY: y.value * h },
      { rotate: `${angle}deg` },
      { scale: scale.value * k },
    ],
  }), [w, h, k, angle]);

  const commit = () => onChange?.({ scale: scale.value, x: x.value, y: y.value });

  const pinch = Gesture.Pinch()
    .onStart(() => { start.value = { scale: scale.value, x: x.value, y: y.value }; })
    .onUpdate((e) => {
      const s = Math.min(MAX_ZOOM, Math.max(1, start.value.scale * e.scale));
      scale.value = s;
      x.value = clampShift(x.value, s, ex, w);
      y.value = clampShift(y.value, s, ey, h);
    })
    .onEnd(() => { runOnJS(commit)(); });
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => { start.value = { scale: scale.value, x: x.value, y: y.value }; })
    .onUpdate((e) => {
      x.value = clampShift(start.value.x + e.translationX / w, scale.value, ex, w);
      y.value = clampShift(start.value.y + e.translationY / h, scale.value, ey, h);
    })
    .onEnd(() => { runOnJS(commit)(); });

  // La « boîte » de l'image, centrée dans le cadre (elle dépasse, le cadre coupe le surplus).
  const boxStyle = { position: "absolute", width: bw, height: bh, left: (w - bw) / 2, top: (h - bh) / 2 };

  const image = (
    <Animated.View style={[boxStyle, editable ? animStyle : {
      transform: [{ translateX: crop.x * w }, { translateY: crop.y * h }, { rotate: `${angle}deg` }, { scale: crop.scale * k }],
    }]}>
      <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} contentFit="cover"
        onLoad={(e) => { const { width, height } = e.source ?? {}; if (width && height) setRatio(width / height); }} />
    </Animated.View>
  );

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}
      onLayout={(e) => { const { width, height } = e.nativeEvent.layout; setBox({ w: width, h: height }); }}>
      {box && (editable
        ? <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}><View style={{ flex: 1 }}>{image}</View></GestureDetector>
        : image)}
    </View>
  );
}
