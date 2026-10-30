// components/home/HomeHeader.js
// Haut de l'accueil : logo + « Pellicule » à gauche, ⚙️ à droite,
// puis la bascule Tri / Créer un album avec la pastille ⇄ au centre.

import { View, TouchableOpacity } from "react-native";
import Logo from "../Logo";
import Text from "../AppText";
import Icon from "../Icons";
import { C } from "../../constants/theme";

const SHADOW = {
  shadowColor: "#3c3c28", shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
};

export default function HomeHeader({ activeMode, onSwitchMode, onOpenSettings }) {
  const isMenage = activeMode === "menage";
  const modeColor = isMenage ? C.accent : C.album;

  const MODES = [
    { key: "menage", label: "Tri",            icon: "tri",   color: C.accent },
    { key: "album",  label: "Créer un album", icon: "album", color: C.album },
  ];

  return (
    <View>
      {/* ── Logo + nom (gauche) · Réglages (droite) ── */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
        <Logo size={34} />
        <Text style={{ flex: 1, marginLeft: 10, fontSize: 22, fontWeight: "600", color: C.text }}>Pellicule</Text>
        <TouchableOpacity
          onPress={onOpenSettings}
          accessibilityLabel="Réglages"
          style={[{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.bgCard, alignItems: "center", justifyContent: "center" }, SHADOW]}
        >
          <Icon name="gear" size={20} color={C.textMid} />
        </TouchableOpacity>
      </View>

      {/* ── Bascule Tri / Créer un album ── */}
      <View style={{ flexDirection: "row", backgroundColor: C.bgMuted, borderRadius: 16, padding: 4, marginBottom: 12 }}>
        {MODES.map((m) => {
          const active = activeMode === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              onPress={() => onSwitchMode(m.key)}
              style={[
                { flex: 1, flexDirection: "row", gap: 6, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
                active && { backgroundColor: C.bgCard, ...SHADOW },
              ]}
            >
              <Icon name={m.icon} size={16} color={active ? m.color : C.textMuted} strokeWidth={active ? 2.2 : 1.9} />
              <Text style={{ fontSize: 14, fontWeight: active ? "600" : "500", color: active ? C.text : C.textMuted }}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Pastille ⇄ à cheval entre les 2 modes : un tap bascule vers l'autre mode. */}
        <TouchableOpacity
          onPress={() => onSwitchMode(isMenage ? "album" : "menage")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={isMenage ? "Passer en mode Créer un album" : "Passer en mode Tri"}
          style={[{
            position: "absolute", left: "50%", top: "50%",
            width: 28, height: 28, marginLeft: -14, marginTop: -14,
            borderRadius: 14, alignItems: "center", justifyContent: "center",
            backgroundColor: "#fff", zIndex: 2,
          }, SHADOW]}
        >
          <Icon name="swap" size={13} color={modeColor} strokeWidth={2.6} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
