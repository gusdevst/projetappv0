// Icône "sortie" (flèche ← qui sort d'un cadre), dessinée avec de simples View.
// Pas de librairie d'icônes à installer.
import { View } from "react-native";

export function ExitIcon({ size = 22, color = "#fff" }) {
  const k = size / 22; // tout est dessiné sur une base 22×22 puis mis à l'échelle
  const t = 2 * k;     // épaisseur du trait
  return (
    <View style={{ width: size, height: size }}>
      {/* Cadre (la porte), ouvert à gauche */}
      <View style={{
        position: "absolute", right: 2 * k, top: 3 * k, width: 7 * k, height: 16 * k,
        borderTopWidth: t, borderRightWidth: t, borderBottomWidth: t, borderColor: color,
        borderTopRightRadius: 2 * k, borderBottomRightRadius: 2 * k,
      }} />
      {/* Tige de la flèche */}
      <View style={{
        position: "absolute", left: 3 * k, top: 10 * k, width: 11 * k, height: t,
        backgroundColor: color, borderRadius: t / 2,
      }} />
      {/* Pointe de la flèche : un coin de carré tourné de 45° */}
      <View style={{
        position: "absolute", left: 4 * k, top: 7 * k, width: 8 * k, height: 8 * k,
        borderLeftWidth: t, borderBottomWidth: t, borderColor: color,
        transform: [{ rotate: "45deg" }],
      }} />
    </View>
  );
}
