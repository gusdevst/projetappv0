// components/TimePickerSheet.js
// Feuille du bas « choisir une heure » (deux molettes : heures · minutes par 5).
// Utilisée sur l'accueil pour régler l'heure du rappel (la carte « Cette semaine »).
// <TimePickerSheet visible title subtitle hour minute busy onCancel onConfirm={(h, m) => …} />

import { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, Modal, Pressable, ActivityIndicator } from "react-native";
import Text from "./AppText";
import { C } from "../constants/theme";

const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function Drum({ values, selected, onChange }) {
  return (
    <ScrollView style={{ height: 160, width: 64 }} showsVerticalScrollIndicator={false} snapToInterval={48} decelerationRate="fast"
      contentOffset={{ x: 0, y: Math.max(0, values.indexOf(selected)) * 48 }}>
      {values.map((v) => (
        <TouchableOpacity key={v} onPress={() => onChange(v)}
          style={{ height: 48, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: v === selected ? `${C.accent}18` : "transparent" }}>
          <Text style={{ fontSize: v === selected ? 26 : 18, fontWeight: v === selected ? "900" : "400", color: v === selected ? C.accent : C.textMuted }}>
            {String(v).padStart(2, "0")}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

export default function TimePickerSheet({ visible, title, subtitle, hour, minute, busy, confirmLabel = "Confirmer", onCancel, onConfirm }) {
  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);
  // À chaque ouverture, on repart de l'heure actuelle.
  useEffect(() => { if (visible) { setH(hour); setM(minute); } }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable onPress={onCancel} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(35,39,31,0.45)" }} />
        <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: C.text }}>{title}</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 4, marginBottom: 18 }}>
            {subtitle ?? `Tu recevras ce rappel à ${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 22 }}>
            <Drum values={HOURS} selected={h} onChange={setH} />
            <Text style={{ fontSize: 28, fontWeight: "600", color: C.text }}>:</Text>
            <Drum values={MINUTES} selected={m} onChange={setM} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity onPress={onCancel} style={{ flex: 1, backgroundColor: C.bgMuted, borderRadius: 14, padding: 14, alignItems: "center" }}>
              <Text style={{ color: C.textMuted, fontWeight: "600" }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onConfirm(h, m)} disabled={busy}
              style={{ flex: 1, backgroundColor: C.accent, borderRadius: 14, padding: 14, alignItems: "center" }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
