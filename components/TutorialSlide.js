// components/TutorialSlide.js
// Une page du tuto : visuel + titre + texte. Partagé par l'onboarding (premier lancement)
// et par Réglages → « Tutoriel ». Les pages viennent de constants/tutorialSlides.js.
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Text from "./AppText";
import Logo from "./Logo";
import Icon from "./Icons";
import { SwipeDemo } from "./SwipeDemo";
import { SHADOW } from "./home/ui";
import { C, DARKROOM as D } from "../constants/theme";

// Tuile illustrée : icône au trait sur fond doux + quelques confettis (+ pastille d'icône facultative).
export function SlideTile({ icon, bg, color, filled, badge }) {
  const dot = (size, style, op) => (
    <View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: op }, style]} />
  );
  return (
    <View style={{ width: 130, height: 130, borderRadius: 38, backgroundColor: bg, alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
      {dot(11, { top: 16, right: 20 }, 0.25)}
      {dot(8, { bottom: 20, left: 18 }, 0.2)}
      {dot(6, { top: 28, left: 24 }, 0.3)}
      <Icon name={icon} size={62} color={color} strokeWidth={1.8} filled={filled} />
      {badge && (
        <View style={{ position: "absolute", right: -8, bottom: -8, width: 48, height: 48, borderRadius: 24, backgroundColor: badge.bg, borderWidth: 3, borderColor: C.bg, alignItems: "center", justifyContent: "center" }}>
          <Icon name={badge.icon} size={26} color={badge.color} filled={badge.filled} strokeWidth={1.8} />
        </View>
      )}
    </View>
  );
}

function ModePill({ bg, color, label }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
      <Text style={{ fontSize: 11.5, fontWeight: "600", color }}>{label}</Text>
    </View>
  );
}

// La barre du bas et son bouton central ⇄ (Tri ⇄ Album).
function BarVisual() {
  const sq = (k) => <View key={k} style={{ width: 18, height: 18, borderRadius: 6, backgroundColor: C.border }} />;
  return (
    <View style={{ alignItems: "center", marginBottom: 26 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ModePill bg={C.sage} color={C.accent} label="Mode Tri" />
        <Icon name="swap" size={20} color={C.textMuted} />
        <ModePill bg={C.albumSoft} color={C.album} label="Mode Album" />
      </View>
      <View
        style={[
          { marginTop: 40, width: 206, height: 54, borderRadius: 18, backgroundColor: C.bgCard, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 },
          SHADOW,
        ]}
      >
        {sq(1)}{sq(2)}
        <View style={{ width: 58 }} />
        {sq(3)}{sq(4)}
        <View style={{ position: "absolute", left: 206 / 2 - 29, top: -22, width: 58, height: 58, borderRadius: 29, backgroundColor: C.accent, borderWidth: 5, borderColor: C.bg, alignItems: "center", justifyContent: "center" }}>
          <Icon name="swap" size={24} color="#fff" strokeWidth={2.2} />
        </View>
      </View>
    </View>
  );
}

// La guirlande de tirages de la Chambre noire (lumière rouge, tirages accrochés à un fil).
const PRINTS = [
  { left: 14, rot: "-5deg", colors: ["#a5cdea", "#ead6a4"] },
  { left: 58, rot: "3deg",  colors: ["#f6e4d4", "#c97a5a"] },
  { left: 102, rot: "-3deg", colors: ["#d3e6c4", "#6e9d56"] },
  { left: 146, rot: "5deg",  colors: ["#f5a77a", "#6d4f8e"] },
];
function DarkroomVisual() {
  return (
    <View style={{ width: 206, height: 118, borderRadius: 20, overflow: "hidden", marginBottom: 22 }}>
      <LinearGradient colors={D.glow} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={{ position: "absolute", left: -10, right: -10, top: 26, height: 2, backgroundColor: D.wire, transform: [{ rotate: "-2deg" }] }} />
      {[22, 92, 164].map((x) => (
        <View key={x} style={{ position: "absolute", left: x - 14, top: 4, width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>
          <View style={{ position: "absolute", width: 28, height: 28, borderRadius: 14, backgroundColor: D.halo, opacity: 0.35 }} />
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: D.bulb }} />
        </View>
      ))}
      {PRINTS.map((p) => (
        <View key={p.left} style={{ position: "absolute", left: p.left, top: 38, width: 38, height: 48, borderRadius: 3, padding: 3, backgroundColor: D.paper, transform: [{ rotate: p.rot }] }}>
          <LinearGradient colors={p.colors} style={{ width: 32, height: 36, borderRadius: 2 }} />
          <View style={{ position: "absolute", top: 3, left: 3, width: 32, height: 36, borderRadius: 2, backgroundColor: D.tint, opacity: 0.12 }} />
        </View>
      ))}
    </View>
  );
}

function SlideVisual({ kind }) {
  switch (kind) {
    case "logo":     return <View style={{ marginBottom: 24 }}><Logo size={110} /></View>;
    case "swipe":    return <SwipeDemo style={{ marginBottom: 24 }} />;
    case "bell":     return <SlideTile icon="bell" bg={C.sage} color={C.accent} badge={{ icon: "flame", bg: "#fbe9da", color: "#c4621c", filled: true }} />;
    case "bar":      return <BarVisual />;
    case "heart":    return <SlideTile icon="heart" bg={C.redSoft} color={C.red} filled />;
    case "darkroom": return <DarkroomVisual />;
    case "user":     return <SlideTile icon="user" bg={C.sage} color={C.accent} />;
    case "lock":     return <SlideTile icon="lock" bg={C.sage} color={C.accent} />;
    default:         return null;
  }
}

// Texte d'un bloc : **gras** ; {{pastille}} en fin de bloc.
function parseBlock(str) {
  let pill = null;
  const m = str.match(/\s*\{\{(.*?)\}\}\s*$/);
  if (m) {
    pill = m[1];
    str = str.slice(0, m.index);
  }
  return { parts: str.split(/(\*\*.*?\*\*)/).filter(Boolean), pill };
}

function RichText({ str, style }) {
  const { parts, pill } = parseBlock(str);
  const text = (
    <Text style={style}>
      {parts.map((p, i) =>
        p.startsWith("**")
          ? <Text key={i} style={{ fontWeight: "700", color: C.text }}>{p.slice(2, -2)}</Text>
          : p
      )}
    </Text>
  );
  if (!pill) return text;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      {text}
      <View style={{ backgroundColor: "#fbe9da", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 }}>
        <Text style={{ fontSize: 10.5, fontWeight: "700", color: "#c4621c" }}>{pill}</Text>
      </View>
    </View>
  );
}

/**
 * @param slide    une entrée de TUTORIAL_SLIDES
 * @param compact  true = version réduite (fenêtre Réglages → Tutoriel)
 */
export function SlideContent({ slide, compact = false }) {
  const textStyle = { fontSize: compact ? 14 : 15, lineHeight: compact ? 21 : 22, color: C.textMuted };
  return (
    <View style={{ alignItems: "center", width: "100%" }}>
      <SlideVisual kind={slide.visual} />
      <Text style={{ fontSize: compact ? 20 : 26, fontWeight: "600", color: C.text, textAlign: "center", marginBottom: 10 }}>
        {slide.title}
      </Text>
      {slide.list ? (
        <View style={{ alignSelf: "stretch", gap: 10 }}>
          {slide.body.map((b, i) => <RichText key={i} str={b} style={textStyle} />)}
        </View>
      ) : (
        <Text style={[textStyle, { textAlign: "center" }]}>{slide.body.join("\n")}</Text>
      )}
    </View>
  );
}
