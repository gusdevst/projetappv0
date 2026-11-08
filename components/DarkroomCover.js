// components/DarkroomCover.js
// Vignette « chambre noire » de la carte Coups de cœur (Galerie) :
// fond rouge, ampoule, fil avec des tirages pincés = les derniers Coups de cœur,
// teintés de rouge comme sous la lampe. Pas assez de photos → tirages vierges.
// Le dessin s'adapte au format : plus la carte est large, plus il y a de tirages (3 à 5).
// Usage : <DarkroomCover urls={[url1, url2, ...]} width={220} height={108} />

import { View } from "react-native";
import Svg, { Defs, RadialGradient, Stop, ClipPath, Rect, Circle, Line, Path, G, Image } from "react-native-svg";
import { DARKROOM as D } from "../constants/theme";

const INCLINE = [-6, 3, -3, 6, -4]; // inclinaison de chaque tirage (degrés)

// Nombre de tirages qui tiennent sur le fil selon la largeur du dessin.
// (tirages plus grands qu'avant pour qu'on voie bien les photos : 3 à 4 seulement)
export const printsFor = (width, height) => Math.max(3, Math.min(4, Math.round((width / height) * 1.7)));

export default function DarkroomCover({ urls = [], width = 100, height = 100, radius = 11 }) {
  // Repère : 100 de haut, largeur proportionnelle → rien n'est étiré.
  const W = (100 * width) / height;
  const n = printsFor(width, height);
  const xs = Array.from({ length: n }, (_, i) => (W * (i + 0.5)) / n);
  const sag = (x) => 30 + 10 * (1 - ((2 * x) / W - 1) ** 2); // hauteur du fil à l'abscisse x
  const bulbX = W * 0.74;

  return (
    // View arrondie autour du dessin : sur Android, Svg seul ne coupe pas les coins.
    <View style={{ width, height, borderRadius: radius, overflow: "hidden" }}>
      <Svg width={width} height={height} viewBox={`0 0 ${W} 100`}>
        <Defs>
          <RadialGradient id="dc-glow" cx="72%" cy="24%" r="60%">
            <Stop offset="0" stopColor={D.glow[0]} />
            <Stop offset="0.45" stopColor={D.glow[1]} />
            <Stop offset="1" stopColor={D.glow[2]} />
          </RadialGradient>
          <RadialGradient id="dc-bulb" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={D.bulb} />
            <Stop offset="0.5" stopColor={D.halo} stopOpacity="0.9" />
            <Stop offset="1" stopColor={D.halo} stopOpacity="0" />
          </RadialGradient>
          <ClipPath id="dc-photo">
            <Rect x="-15" y="2.5" width="30" height="31" />
          </ClipPath>
        </Defs>

        {/* Décor : fond, ampoule, fil */}
        <Rect width={W} height="100" fill="url(#dc-glow)" />
        <Circle cx={bulbX} cy="16" r="14" fill="url(#dc-bulb)" />
        <Circle cx={bulbX} cy="16" r="4" fill={D.bulb} />
        <Line x1={bulbX} y1="0" x2={bulbX} y2="12" stroke={D.wire} strokeWidth="1" />
        <Path d={`M-2,30 Q${W / 2},50 ${W + 2},30`} fill="none" stroke={D.wire} strokeWidth="1.2" />

        {/* Tirages pincés sur le fil */}
        {xs.map((x, i) => (
          <G key={i} transform={`translate(${x},${sag(x)}) rotate(${INCLINE[i]})`}>
            <Rect x="-17" y="0" width="34" height="42" rx="1.5" fill={D.paper} />
            {urls[i] && (
              <>
                <Image href={{ uri: urls[i] }} x="-15" y="2.5" width="30" height="31"
                  preserveAspectRatio="xMidYMid slice" clipPath="url(#dc-photo)" />
                <Rect x="-15" y="2.5" width="30" height="31" fill={D.tint} opacity="0.12" />
              </>
            )}
            <Rect x="-2" y="-4" width="4" height="8" rx="1" fill={D.clip} />
          </G>
        ))}

        {/* Bacs de développement */}
        <Rect x={W * 0.06} y="86" width={W * 0.34} height="10" rx="2" fill={D.tray} />
        <Rect x={W * 0.58} y="86" width={W * 0.34} height="10" rx="2" fill={D.tray} />
      </Svg>
    </View>
  );
}
