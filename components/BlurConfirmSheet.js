// Feuille de confirmation « Mettre N photos à la corbeille ? » (écran Photos floues).
// Maquette : Claude outputs/maquette-recherche-flou.html, écran C.
import { View, Modal, TouchableOpacity, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Text from "./AppText";
import Icon from "./Icons";
import { C } from "../constants/theme";

function Line({ icon, iconColor, iconBg, children }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={19} color={iconColor} />
      </View>
      <Text style={{ flex: 1, fontSize: 13, color: C.textMid, lineHeight: 18 }}>{children}</Text>
    </View>
  );
}

/**
 * @param count      photos qui partent à la corbeille
 * @param sizeLabel  poids à libérer, déjà formaté (« 404 Mo »)
 * @param keptCount  photos décochées = gardées (0 → la ligne n'apparaît pas)
 */
export default function BlurConfirmSheet({ visible, count, sizeLabel, keptCount, onCancel, onConfirm }) {
  const insets = useSafeAreaInsets();
  const one = count === 1;
  const bold = { fontWeight: "700", color: C.text };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable onPress={onCancel} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
        {/* Pressable intérieur : toucher la feuille ne la ferme pas */}
        <Pressable
          onPress={() => {}}
          style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 14) + 8 }}
        >
          <View style={{ alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 14 }} />
          <Text style={{ fontSize: 17, fontWeight: "600", color: C.text }}>
            {`Mettre ${count.toLocaleString("fr-FR")} photo${one ? "" : "s"} à la corbeille ?`}
          </Text>
          <Text style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4, lineHeight: 18 }}>
            {one
              ? "Elle reste dans la corbeille de Pellicule tant que tu ne la vides pas. Tu peux encore la restaurer."
              : "Elles restent dans la corbeille de Pellicule tant que tu ne la vides pas. Tu peux encore les restaurer."}
          </Text>

          <Line icon="trash" iconColor={C.red} iconBg={C.redSoft}>
            <Text style={bold}>{`${count.toLocaleString("fr-FR")} photo${one ? "" : "s"}`}</Text>
            {` · ${sizeLabel} à libérer\nquand tu videras la corbeille`}
          </Line>

          {keptCount > 0 && (
            <Line icon="check" iconColor={C.accent} iconBg={C.sage}>
              <Text style={bold}>{`${keptCount.toLocaleString("fr-FR")} photo${keptCount > 1 ? "s" : ""} gardée${keptCount > 1 ? "s" : ""}`}</Text>
              {keptCount > 1
                ? " : elles ne seront plus proposées comme floues"
                : " : elle ne sera plus proposée comme floue"}
            </Line>
          )}

          <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
            <TouchableOpacity
              onPress={onCancel}
              style={{ flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: "center", backgroundColor: C.bgMuted, borderWidth: 1, borderColor: C.border }}
            >
              <Text style={{ fontSize: 14.5, fontWeight: "600", color: C.text }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={{ flex: 1.3, paddingVertical: 13, borderRadius: 14, alignItems: "center", backgroundColor: C.red }}
            >
              <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#fff" }}>Mettre à la corbeille</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
