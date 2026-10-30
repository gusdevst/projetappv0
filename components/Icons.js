// components/Icons.js
// Boîte à icônes au trait (maquettes sauge). Dessinées avec react-native-svg.
// Usage : <Icon name="shuffle" size={22} color={C.accent} />
// Ajouter une icône = ajouter une entrée dans ICONS (dessin sur une grille 24×24).

import Svg, { Path, Rect, Circle } from "react-native-svg";
import { C } from "../constants/theme";

// Chaque icône reçoit la couleur `c` et renvoie ses traits.
const ICONS = {
  gear: (c) => (<>
    <Circle cx="12" cy="12" r="3.2" />
    <Path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
  </>),
  tri: (c) => <Path d="M14 4l6 6M4 20l9-9M11 13l-4 1-3 6 6-3 1-4" />,
  album: (c) => (<>
    <Path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
    <Path d="M5 17a3 3 0 0 1 3-3h11" />
  </>),
  swap: (c) => <Path d="M4 8h14l-4-4M20 16H6l4 4" />,
  shuffle: (c) => (<>
    <Path d="M3 7h3c2 0 3 1 4 3l3 5c1 1.6 2 2 4 2h4" />
    <Path d="M3 17h3c1.4 0 2.2-.5 3-1.5" />
    <Path d="M14.5 8.5c.8-1 1.6-1.5 3-1.5H21" />
    <Path d="M18 4l3 3-3 3M18 14l3 3-3 3" />
  </>),
  sameInstant: (c) => (<>
    <Rect x="7" y="4" width="13" height="13" rx="2.5" />
    <Rect x="4" y="7" width="13" height="13" rx="2.5" fill={C.bgCard} />
    <Circle cx="10.5" cy="13.5" r="2.4" />
  </>),
  calendar: (c) => (<>
    <Rect x="4" y="5" width="16" height="15" rx="3" />
    <Path d="M4 10h16M9 3v4M15 3v4" />
  </>),
  folder: (c) => <Path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18" />,
  screenshot: (c) => (<>
    <Rect x="6" y="2.5" width="12" height="19" rx="3" />
    <Path d="M10 18h4" />
  </>),
  pin: (c) => (<>
    <Path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
    <Circle cx="12" cy="11" r="2.2" />
  </>),
  trash: (c) => <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  bell: (c) => <Path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />,
  heart: (c) => <Path d="M12 20s-7-4.4-9.2-8.8A5.2 5.2 0 0 1 12 6.4a5.2 5.2 0 0 1 9.2 4.8C19 15.6 12 20 12 20z" />,
  printer: (c) => (<>
    <Path d="M6 9V3h12v6M6 18H4v-7h16v7h-2" />
    <Rect x="6" y="14" width="12" height="7" />
  </>),
  grid: (c) => (<>
    <Rect x="3" y="3" width="8" height="8" rx="2" /><Rect x="13" y="3" width="8" height="8" rx="2" />
    <Rect x="3" y="13" width="8" height="8" rx="2" /><Rect x="13" y="13" width="8" height="8" rx="2" />
  </>),
  filter: (c) => <Path d="M4 5h16l-6 8v6l-4-2v-4z" />,
  chevronRight: (c) => <Path d="M9 5l7 7-7 7" />,
  close: (c) => <Path d="M6 6l12 12M18 6L6 18" />,
  check: (c) => <Path d="M5 12.5l4.5 4.5L19 7.5" />,
};

export const ICON_NAMES = Object.keys(ICONS);

export default function Icon({ name, size = 22, color = C.text, strokeWidth = 1.9, filled = false }) {
  const draw = ICONS[name];
  if (!draw) return null; // nom inconnu : rien plutôt qu'un plantage
  return (
    <Svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? color : "none"} stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    >
      {draw(color)}
    </Svg>
  );
}
