// components/Logo.js
// Logo Pellicule dessiné (piste B « Doux ») : fond pâle, perforations en points,
// cœur coupé en deux = moitié gauche couleur du Tri, moitié droite couleur de l'Album.
// Les couleurs viennent du thème → changer de palette change le logo partout.
// (L'icône de l'app sur l'écran du téléphone reste une image : à régénérer au build.)

import Svg, { Rect, Circle, Path } from "react-native-svg";
import { C } from "../constants/theme";

const HEART_L = "M50 76 C34 68 22 56 22 40 A12 12 0 0 1 34 28 C41 28 46 32 50 36 Z";
const HEART_R = "M50 76 C66 68 78 56 78 40 A12 12 0 0 0 66 28 C59 28 54 32 50 36 Z";
const DOTS_X = [21, 32.6, 44.2, 55.8, 67.4, 79];

export default function Logo({ size = 34 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect width="100" height="100" rx="22" fill={C.sage} />
      {DOTS_X.map((x) => <Circle key={`t${x}`} cx={x} cy="17" r="3" fill={C.sage2} />)}
      {DOTS_X.map((x) => <Circle key={`b${x}`} cx={x} cy="83" r="3" fill={C.sage2} />)}
      <Path d={HEART_L} fill={C.accent} />
      <Path d={HEART_R} fill={C.album} />
    </Svg>
  );
}
