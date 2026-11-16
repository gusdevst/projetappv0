// components/book/BookControls.js
// Petites briques partagées par l'aperçu du livre et l'éditeur de page :
// ligne de réglage, pastille, flèche, choix de mise en page.

import { View, TouchableOpacity } from "react-native";
import Text from "../AppText";
import { BookPage, DoublePage } from "./BookPage";
import { SHADOW } from "../home/ui";
import { C } from "../../constants/theme";
import { BOOK_LAYOUTS, PELE_LAYOUT } from "../../services/photoBook";
import { PELE_MIN, PELE_MAX, PELE_DEFAULT } from "../../services/pageCollage";

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

// Bouton d'outil de recadrage (icône + libellé) : Pivoter, Recentrer, Changer, Terminé… accent = en couleur album.
export function ToolButton({ icon, label, accent, onPress }) {
  return (
    <TouchableOpacity onPress={onPress}
      style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: accent ? C.albumSoft : C.bgCard, ...SHADOW }}>
      <Text style={{ fontSize: 19, color: accent ? C.album : C.text }}>{icon}</Text>
      <Text style={{ fontSize: 11.5, marginTop: 2, color: accent ? C.album : C.text, fontWeight: accent ? "700" : "500" }}>{label}</Text>
    </TouchableOpacity>
  );
}

// 4 boutons « 1 photo · 2 photos · 3 photos · 4 photos » + « Pêle-mêle » (3 à 9 tirages, jamais superposés) + « Double page »
// (une photo sur 2 pages face à face). Les mini-pages suivent l'orientation du livre.
// doubleState : "off" | "on" | "disabled" (page seule face à la couverture / à la fin) · onDouble : touché. Sans onDouble,
// le bouton « Double page » n'est pas affiché (ex. éditeur d'une seule page).
// Pêle-mêle choisi : une ligne « Nombre de photos − N + » apparaît dessous (onPeleCount(n), peleCount = nombre actuel).
export function LayoutPicker({ value, onChange, landscape, doubleState = "off", onDouble, peleCount, onPeleCount }) {
  const ratio = landscape ? 3 / 4 : 4 / 3;
  const miniSize = landscape ? 34 : 30;
  const peleOn = value === PELE_LAYOUT;
  const n = peleCount ?? PELE_DEFAULT;
  const wide = (on, disabled) => ({ flex: 1.35, alignItems: "center", paddingTop: 8, paddingBottom: 6, borderRadius: 14, opacity: disabled ? 0.4 : 1,
    backgroundColor: on ? C.albumSoft : C.bgCard, borderWidth: 2, borderColor: on ? C.album : C.bgCard });
  const label = (on) => ({ fontSize: 10.5, marginTop: 4, color: on ? C.album : C.textMuted, fontWeight: on ? "600" : "500" });
  return (
    <View>
      <View style={{ flexDirection: "row", gap: 7 }}>
        {BOOK_LAYOUTS.map((k) => {
          const on = value === k;
          return (
            <TouchableOpacity key={k} onPress={() => onChange(k)}
              style={{ flex: 1, alignItems: "center", paddingTop: 8, paddingBottom: 6, borderRadius: 14,
                backgroundColor: on ? C.albumSoft : C.bgCard, borderWidth: 2, borderColor: on ? C.album : C.bgCard }}>
              <BookPage page={{ layout: k, slots: Array(k).fill(null) }} size={miniSize} ratio={ratio} urlById={{}} />
              <Text style={label(on)}>{k} photo{k > 1 ? "s" : ""}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={() => onChange(PELE_LAYOUT)} accessibilityLabel="Pêle-mêle : plusieurs tirages sur la page" style={wide(peleOn)}>
          <BookPage page={{ layout: PELE_LAYOUT, slots: Array(PELE_DEFAULT).fill(null) }} size={miniSize} ratio={ratio} urlById={{}} />
          <Text style={label(peleOn)}>Pêle-mêle</Text>
        </TouchableOpacity>
        {onDouble && (
          <TouchableOpacity onPress={onDouble} accessibilityLabel="Double page : une photo sur deux pages" style={wide(doubleState === "on", doubleState === "disabled")}>
            <DoublePage size={landscape ? 22 : 16} ratio={ratio} url={null} />
            <Text style={label(doubleState === "on")}>Double page</Text>
          </TouchableOpacity>
        )}
      </View>
      {peleOn && onPeleCount && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, paddingHorizontal: 4 }}>
          <Text style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: "500" }}>Nombre de photos sur la page</Text>
          <NavArrow label="−" disabled={n <= PELE_MIN} onPress={() => onPeleCount(n - 1)} />
          <Text style={{ width: 22, textAlign: "center", fontSize: 16, fontWeight: "700", color: C.text }}>{n}</Text>
          <NavArrow label="+" disabled={n >= PELE_MAX} onPress={() => onPeleCount(n + 1)} />
        </View>
      )}
    </View>
  );
}
