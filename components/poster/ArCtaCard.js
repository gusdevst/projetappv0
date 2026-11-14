// components/poster/ArCtaCard.js
// Carte « Voir ce poster chez toi » (maquette `maquette-poster-voir-chez-moi-v2.html`), posée SOUS le choix du format
// dans « Cadre ton poster » et dans le « Format du poster » du pêle-mêle. Ouvre l'écran de réalité augmentée.

import { View, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Text from "../AppText";
import { C } from "../../constants/theme";

// Mini-scène : un mur, un canapé, un poster accroché (dessinés avec des vues).
function Thumb() {
  return (
    <View style={{ width: 62, height: 62, borderRadius: 12, overflow: "hidden", backgroundColor: "#dfd6c8" }}>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 20, backgroundColor: "#a8896a" }} />
      <View style={{ position: "absolute", left: 9, right: 9, bottom: 7, height: 15, borderRadius: 4, backgroundColor: "#8d7b6a" }} />
      <View style={{ position: "absolute", left: 21, top: 11, width: 20, height: 28, backgroundColor: C.sage2, borderWidth: 1.5, borderColor: "#fff" }} />
    </View>
  );
}

export default function ArCtaCard({ onPress, subtitle = "Pose-le sur ton mur en réalité augmentée, à la vraie taille." }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ marginTop: 18 }}>
      <LinearGradient colors={[C.albumSoft, "#f8ece4"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1.5, borderColor: "#e6c4b1", padding: 10, paddingRight: 12 }}>
        <Thumb />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14.5, fontWeight: "700", color: C.text }}>Voir ce poster chez toi</Text>
          <Text style={{ fontSize: 11.5, color: C.textMid, marginTop: 3, lineHeight: 15 }}>{subtitle}</Text>
        </View>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700", lineHeight: 20 }}>›</Text>
        </View>
        <View style={{ position: "absolute", top: -8, right: 12, backgroundColor: C.album, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff", letterSpacing: 0.4 }}>NOUVEAU</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}
