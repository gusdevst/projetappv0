// components/home/ui.js
// Petites briques visuelles partagées par l'accueil (style sauge) :
// ombre douce, titre de section, ligne de liste à vignette.

import { View, TouchableOpacity } from "react-native";
import Text from "../AppText";
import Icon from "../Icons";
import { C } from "../../constants/theme";

export const SHADOW = {
  shadowColor: "#3c3c28", shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
};

// Titre de section : « Trier autrement », « Mes albums »… + liens optionnels à droite.
export function SectionTitle({ title, right }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 22, marginBottom: 10, marginHorizontal: 2 }}>
      <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>{title}</Text>
      {right}
    </View>
  );
}

// Ligne de liste : vignette (icône ou contenu libre) · titre · sous-titre · droite.
// right : "chevron" (défaut) | "close" (avec onClear) | élément React.
export function ListRow({ icon, iconColor = C.accent, iconBg = C.sage, thumb, title, sub, subColor, count, right = "chevron", onClear, active, activeColor = C.accent, onPress, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.bgCard, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, opacity: disabled ? 0.5 : 1 },
        SHADOW,
        active && { borderWidth: 2, borderColor: activeColor, paddingVertical: 8, paddingHorizontal: 10 },
      ]}
    >
      {thumb ?? (
        <View style={{ width: 44, height: 44, borderRadius: 11, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={23} color={iconColor} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14.5, fontWeight: "500", color: C.text }} numberOfLines={1}>{title}</Text>
        {!!sub && (
          <Text style={{ fontSize: 11.5, color: subColor ?? C.textMuted, fontWeight: subColor ? "600" : "400", marginTop: 1 }} numberOfLines={2}>{sub}</Text>
        )}
      </View>
      {count != null && <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>{count}</Text>}
      {right === "chevron" && <Icon name="chevronRight" size={16} color={C.textMuted} />}
      {right === "close" && (
        <TouchableOpacity
          onPress={onClear}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="close" size={12} color={activeColor} strokeWidth={2.6} />
        </TouchableOpacity>
      )}
      {typeof right === "object" && right}
    </TouchableOpacity>
  );
}
