// components/IconsBoard.js
// Planche de toutes les icônes — visible uniquement en développement (__DEV__).
// Affichée en bas de Réglages. À retirer avant la mise en production.

import { View } from "react-native";
import Text from "./AppText";
import Icon, { ICON_NAMES } from "./Icons";
import { C } from "../constants/theme";

export default function IconsBoard() {
  if (!__DEV__) return null;
  return (
    <View style={{ marginTop: 24, backgroundColor: C.bgCard, borderRadius: 16, padding: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: C.textMuted, marginBottom: 10 }}>
        DEV · PLANCHE D'ICÔNES
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {ICON_NAMES.map((n) => (
          <View key={n} style={{ width: "25%", alignItems: "center", marginBottom: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}>
              <Icon name={n} color={C.accent} />
            </View>
            <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{n}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
