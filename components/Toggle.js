// components/Toggle.js
// Interrupteur on/off réutilisable
// Usage : <Toggle value={true} onToggle={() => setState(v => !v)} />

import { TouchableOpacity, View } from "react-native";
import { C } from "../constants/theme";

export function Toggle({ value, onToggle }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={{
        width: 46, height: 26, borderRadius: 13,
        backgroundColor: value ? C.accent : C.border,
        justifyContent: "center", paddingHorizontal: 2,
      }}
    >
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: "#fff",
        alignSelf: value ? "flex-end" : "flex-start",
        elevation: 2,
        shadowColor: "#000", shadowOpacity: .15,
        shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
      }} />
    </TouchableOpacity>
  );
}