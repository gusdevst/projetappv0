// components/RowSetting.js
// Ligne de réglage réutilisable dans les paramètres
// Usage : <RowSetting emoji="🔔" label="Notifs" desc="..." right={<Toggle />} />

import { TouchableOpacity, View, Text } from "react-native";
import { C, S } from "../constants/theme";

export function RowSetting({ emoji, label, desc, right, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress || null}
      activeOpacity={onPress ? 0.7 : 1}
      style={{
        backgroundColor: C.bgCard, borderRadius: S.radius,
        padding: 16, flexDirection: "row", alignItems: "center",
        gap: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border,
      }}
    >
      <View style={{
        width: 40, height: 40, backgroundColor: C.bgMuted,
        borderRadius: S.radiusSm, alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "700", fontSize: 14, color: C.text }}>{label}</Text>
        {desc && <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{desc}</Text>}
      </View>
      {right}
    </TouchableOpacity>
  );
}