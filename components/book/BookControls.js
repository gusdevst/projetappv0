// components/book/BookControls.js
// Petites briques partagées par l'aperçu du livre et l'éditeur de page :
// ligne de réglage, pastille, flèche, choix de mise en page.

import { View, TouchableOpacity } from "react-native";
import Text from "../AppText";
import { BookPage } from "./BookPage";
import { SHADOW } from "../home/ui";
import { C } from "../../constants/theme";
import { BOOK_LAYOUTS } from "../../services/photoBook";

export const sectionStyle = { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: C.textMuted, marginTop: 20, marginBottom: 8 };

// Ligne « Titre / Police / Taille… » : libellé à gauche, réglages à droite.
export function EditRow({ label, last, children }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.border }}>
      <Text style={{ width: 62, fontSize: 13, color: C.text, fontWeight: "500" }}>{label}</Text>
      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 5 }}>{children}</View>
    </View>
  );
}

export function Chip({ on, onPress, disabled, textStyle, children }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled}
      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: on ? C.album : C.bgMuted, opacity: disabled ? 0.35 : 1 }}>
      <Text style={[{ fontSize: 13, color: on ? "#fff" : C.textMid }, textStyle]}>{children}</Text>
    </TouchableOpacity>
  );
}

export function NavArrow({ label, disabled, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled}
      style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.bgCard, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1, ...SHADOW }}>
      <Text style={{ fontSize: 18, color: C.text }}>{label}</Text>
    </TouchableOpacity>
  );
}

// 4 boutons « 1 photo · 2 photos · 3 photos · 4 photos ». Les mini-pages suivent l'orientation du livre.
export function LayoutPicker({ value, onChange, landscape }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {BOOK_LAYOUTS.map((n) => {
        const on = value === n;
        return (
          <TouchableOpacity key={n} onPress={() => onChange(n)}
            style={{ flex: 1, alignItems: "center", paddingTop: 8, paddingBottom: 6, borderRadius: 14,
              backgroundColor: on ? C.albumSoft : C.bgCard, borderWidth: 2, borderColor: on ? C.album : C.bgCard }}>
            <BookPage page={{ layout: n, slots: Array(n).fill(null) }} size={landscape ? 44 : 32}
              ratio={landscape ? 3 / 4 : 4 / 3} urlById={{}} />
            <Text style={{ fontSize: 11, marginTop: 4, color: on ? C.album : C.textMuted, fontWeight: on ? "600" : "500" }}>
              {n} photo{n > 1 ? "s" : ""}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
