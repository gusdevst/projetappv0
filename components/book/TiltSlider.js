// components/book/TiltSlider.js
// Curseur « Redresser » : de -15° à +15°, 0 au milieu.
// onChange(v) pendant le glissé (aperçu en direct), onEnd(v) au lâcher (enregistrement).

import { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Text from "../AppText";
import { C } from "../../constants/theme";
import { MAX_TILT } from "../../services/photoBook";

export function TiltSlider({ value, onChange, onEnd }) {
  const [trackW, setTrackW] = useState(0);
  const toValue = (px) => {
    "worklet";
    const v = Math.round(((px / Math.max(1, trackW)) * 2 - 1) * MAX_TILT);
    return Math.min(MAX_TILT, Math.max(-MAX_TILT, v));
  };
  const drag = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => { runOnJS(onChange)(toValue(e.x)); })
    .onUpdate((e) => { runOnJS(onChange)(toValue(e.x)); })
    .onFinalize((e) => { runOnJS(onEnd)(toValue(e.x)); });

  const knobLeft = ((value + MAX_TILT) / (MAX_TILT * 2)) * trackW;
  const step = (d) => { const v = Math.min(MAX_TILT, Math.max(-MAX_TILT, value + d)); onChange(v); onEnd(v); };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <StepBtn label="−" onPress={() => step(-1)} />
      <GestureDetector gesture={drag}>
        <View style={{ flex: 1, height: 34, justifyContent: "center" }} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: C.bgMuted }} />
          <View style={{ position: "absolute", left: trackW / 2 - 1, width: 2, height: 12, backgroundColor: C.textMuted, borderRadius: 1 }} />
          <View style={{ position: "absolute", left: knobLeft - 11, width: 22, height: 22, borderRadius: 11, backgroundColor: C.album,
            shadowColor: "#3c3c28", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 }} />
        </View>
      </GestureDetector>
      <StepBtn label="+" onPress={() => step(1)} />
      <Text style={{ width: 38, textAlign: "right", fontSize: 13, fontWeight: "600", color: value ? C.album : C.textMuted }}>{value > 0 ? `+${value}` : value}°</Text>
    </View>
  );
}

function StepBtn({ label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 16, color: C.text }}>{label}</Text>
    </TouchableOpacity>
  );
}
