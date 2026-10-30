// components/home/TriHero.js
// Mode Tri : illustration, « Ta galerie est triée dans ≈ X jours »,
// pastille du nombre de photos par session (10 → 50), barre d'avancement,
// puis bouton 🔀 aléatoire (façon Spotify) + « Lancer un tri ».

import { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Ellipse, Rect, Path, G, Circle } from "react-native-svg";
import Text from "../AppText";
import Icon from "../Icons";
import { C } from "../../constants/theme";

const SESSION_CHOICES = [10, 20, 30, 40, 50];

const SHADOW = {
  shadowColor: "#3c3c28", shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
};

// Illustration : une photo qui tombe dans un bac (maquette sauge).
function TubIllustration() {
  return (
    <Svg width={150} height={104} viewBox="0 0 170 120">
      <Defs>
        <LinearGradient id="tub" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#f1f1ec" /><Stop offset="1" stopColor="#d9d9d1" />
        </LinearGradient>
        <LinearGradient id="card" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={C.sage} /><Stop offset="1" stopColor={C.sage3} />
        </LinearGradient>
      </Defs>
      <Ellipse cx="85" cy="112" rx="58" ry="6" fill="#000" opacity={0.06} />
      <Rect x="22" y="44" width="30" height="34" rx="5" fill={C.sage} transform="rotate(-12 37 61)" />
      <Rect x="118" y="44" width="30" height="34" rx="5" fill={C.sage} transform="rotate(12 133 61)" />
      <Path d="M30 66 h110 l-10 42 a6 6 0 0 1 -6 4 H46 a6 6 0 0 1 -6 -4z" fill="url(#tub)" />
      <Ellipse cx="85" cy="66" rx="55" ry="9" fill="#e9e9e3" stroke="#d3d3cb" />
      <G transform="rotate(-6 85 46)">
        <Rect x="56" y="12" width="58" height="58" rx="11" fill="url(#card)" />
        <Rect x="68" y="26" width="34" height="26" rx="4" fill="#fff" opacity={0.55} />
        <Circle cx="93" cy="33" r="3.5" fill={C.accent} />
        <Path d="M68 50 L79 38 L87 45 L93 40 L102 50Z" fill={C.accent} />
      </G>
    </Svg>
  );
}

export default function TriHero({
  allSorted, dureeVal, dureeUnit, rhythmLabel, progressPct, triees, trieesSizeLabel,
  randomCount, onChangeRandomCount,
  shuffleOn, onToggleShuffle,
  ctaTitle, ctaSub, ctaDisabled, onLaunch,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const choices = SESSION_CHOICES.includes(randomCount)
    ? SESSION_CHOICES
    : [...SESSION_CHOICES, randomCount].sort((a, b) => a - b); // valeur réglée ailleurs (ex. 70) : on l'affiche aussi

  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ alignItems: "center" }}>
        <TubIllustration />

        {allSorted ? (
          <Text style={{ fontSize: 24, fontWeight: "600", color: C.accent, marginTop: 6 }}>🎉 Tout est trié !</Text>
        ) : (
          <>
            <Text style={{ fontSize: 17, fontWeight: "500", color: C.text, marginTop: 4 }}>Ta galerie est triée dans</Text>
            <Text style={{ color: C.accent, marginTop: 2 }}>
              <Text style={{ fontSize: 38, fontWeight: "600" }}>≈ {dureeVal} </Text>
              <Text style={{ fontSize: 20, fontWeight: "600" }}>{dureeUnit}</Text>
            </Text>

            {/* Phrase + pastille touchable du nombre de photos par session */}
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
              <Text style={{ fontSize: 12.5, color: C.textMuted }}>à raison d'une session de </Text>
              <TouchableOpacity
                onPress={() => setPickerOpen((o) => !o)}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                style={{ backgroundColor: C.sage, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 1 }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: C.green }}>
                  {randomCount} {pickerOpen ? "▴" : "▾"}
                </Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 12.5, color: C.textMuted }}> photos {rhythmLabel}</Text>
            </View>
          </>
        )}
      </View>

      {/* Choix du nombre de photos par session (s'ouvre sous la phrase) */}
      {pickerOpen && !allSorted && (
        <View style={[{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, marginTop: 12 }, SHADOW]}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: C.text, textAlign: "center" }}>Photos par session</Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
            {choices.map((n) => {
              const on = n === randomCount;
              return (
                <TouchableOpacity
                  key={n}
                  onPress={() => onChangeRandomCount(n)}
                  style={{ flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 11, backgroundColor: on ? C.accent : C.bgMuted }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: on ? "#fff" : C.textMid }}>{n}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Barre d'avancement */}
      <View style={{ height: 8, borderRadius: 5, backgroundColor: C.bgMuted, overflow: "hidden", marginTop: 12, marginHorizontal: 30 }}>
        <View style={{ height: 8, width: `${progressPct}%`, backgroundColor: C.accent, borderRadius: 5 }} />
      </View>
      <Text style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 6 }}>
        <Text style={{ fontWeight: "600", color: C.text }}>{Math.round(progressPct)} %</Text>
        {" · "}{triees} triées · <Text style={{ fontWeight: "600", color: C.text }}>{trieesSizeLabel}</Text> triés
      </Text>

      {/* Bouton 🔀 aléatoire + bouton principal */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <TouchableOpacity
          onPress={onToggleShuffle}
          accessibilityRole="switch"
          accessibilityState={{ checked: shuffleOn }}
          accessibilityLabel="Tri aléatoire"
          style={[
            { width: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: shuffleOn ? C.sage : C.bgCard },
            shuffleOn ? { borderWidth: 2, borderColor: C.accent } : SHADOW,
          ]}
        >
          <Icon name="shuffle" size={22} color={shuffleOn ? C.accent : C.textMuted} strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onLaunch}
          disabled={ctaDisabled}
          style={{
            flex: 1, backgroundColor: C.accent, borderRadius: 16, paddingVertical: 11, alignItems: "center",
            opacity: ctaDisabled ? 0.6 : 1,
            shadowColor: C.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 4,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }} numberOfLines={1}>{ctaTitle}</Text>
          {!!ctaSub && <Text style={{ fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.85)", marginTop: 1 }}>{ctaSub}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
