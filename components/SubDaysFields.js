// components/SubDaysFields.js
// Choix des deux dates d'un abonnement « Coups de cœur » (jour du mois, 1 → 28) :
//   « Je reçois ma sélection le »  → jour de la notification
//   « Envoi à l'impression le »    → dernier jour pour valider, toujours après le jour de réception
// Toucher une ligne ouvre une grille de jours. Utilisé dans le réglage et dans « Mes abonnements ».
// <SubDaysFields selectionDay={1} sendDay={25} onChange={({ selectionDay, sendDay }) => …} />

import { useState } from "react";
import { View, TouchableOpacity, Modal, Pressable } from "react-native";
import Text from "./AppText";
import Icon from "./Icons";
import { SHADOW } from "./home/ui";
import { C } from "../constants/theme";
import { SUB_DAY_MAX, dayLabel } from "../constants/subscription";

function DayRow({ label, day, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}
      style={[{ flexDirection: "row", alignItems: "center", backgroundColor: C.bgCard, borderRadius: 13, paddingVertical: 9, paddingHorizontal: 13, marginTop: 8 }, SHADOW]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 10.5, color: C.textMuted, fontWeight: "500" }}>{label}</Text>
        <Text style={{ fontSize: 13.5, fontWeight: "500", color: C.text, marginTop: 1 }}>{dayLabel(day)} de chaque mois</Text>
      </View>
      <Icon name="chevronRight" size={16} color={C.textMuted} />
    </TouchableOpacity>
  );
}

// Grille 7 colonnes de 1 à 28 ; les jours hors [min, max] sont grisés.
function DaySheet({ visible, title, hint, value, min, max, onPick, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(35,39,31,0.42)" }} />
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30 }}>
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: 12 }} />
          <Text style={{ fontSize: 16, fontWeight: "600", color: C.text }}>{title}</Text>
          {!!hint && <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{hint}</Text>}
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 14, marginHorizontal: -3 }}>
            {Array.from({ length: SUB_DAY_MAX }, (_, i) => i + 1).map((d) => {
              const ok = d >= min && d <= max;
              const on = d === value;
              return (
                <View key={d} style={{ width: `${100 / 7}%`, padding: 3 }}>
                  <TouchableOpacity disabled={!ok} onPress={() => onPick(d)} activeOpacity={0.8}
                    style={{ height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: on ? C.album : C.bgCard, opacity: ok ? 1 : 0.3 }}>
                    <Text style={{ fontSize: 15, fontWeight: on ? "700" : "500", color: on ? "#fff" : C.text }}>{d}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function SubDaysFields({ selectionDay, sendDay, onChange }) {
  const [open, setOpen] = useState(null); // null | "selection" | "send"

  // Réception : 1 → 27. Si elle rattrape l'envoi, l'envoi est repoussé au lendemain.
  const pickSelection = (d) => {
    onChange({ selectionDay: d, sendDay: sendDay <= d ? Math.min(SUB_DAY_MAX, d + 1) : sendDay });
    setOpen(null);
  };
  // Envoi : après la réception, jusqu'au 28.
  const pickSend = (d) => { onChange({ selectionDay, sendDay: d }); setOpen(null); };

  return (
    <>
      <DayRow label="Je reçois ma sélection le" day={selectionDay} onPress={() => setOpen("selection")} />
      <DayRow label="Envoi à l'impression le" day={sendDay} onPress={() => setOpen("send")} />

      <DaySheet visible={open === "selection"} title="Je reçois ma sélection le"
        hint="Ce jour-là, à 9 h, une notification te prévient." value={selectionDay}
        min={1} max={SUB_DAY_MAX - 1} onPick={pickSelection} onClose={() => setOpen(null)} />
      <DaySheet visible={open === "send"} title="Envoi à l'impression le"
        hint="Dernier jour pour valider ta sélection : elle part ce jour-là." value={sendDay}
        min={selectionDay + 1} max={SUB_DAY_MAX} onPick={pickSend} onClose={() => setOpen(null)} />
    </>
  );
}
