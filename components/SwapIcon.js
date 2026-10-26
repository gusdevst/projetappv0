// Icône "échange" ⇄ dessinée avec de simples View (comme ExitIcon).
// Pourquoi pas le caractère ⇄ ? Un caractère de police a des marges invisibles
// différentes sur iOS et Android → il n'est jamais parfaitement centré.
// Ici chaque trait est placé au pixel près, donc l'icône est centrée partout.
import { View } from "react-native";

export function SwapIcon({ size = 14, color = "#fff" }) {
  const k = size / 14;  // dessin sur une base 14×14, mis à l'échelle
  const t = 1.6 * k;    // épaisseur du trait
  const a = 4 * k;      // taille de la pointe (carré tourné de 45°)
  const d = a * 0.707;  // distance centre → pointe une fois le carré tourné

  // Flèche du haut → (y = 4.5) ; flèche du bas ← (y = 9.5). Milieu = 7 = centre exact.
  const yTop = 4.5 * k;
  const yBot = 9.5 * k;

  return (
    <View style={{ width: size, height: size }}>
      {/* Flèche du haut, vers la droite */}
      <View style={{ position: "absolute", left: 1.5 * k, top: yTop - t / 2, width: 10.5 * k, height: t, backgroundColor: color, borderRadius: t / 2 }} />
      <View style={{
        position: "absolute", left: 12.5 * k - d - a / 2, top: yTop - a / 2, width: a, height: a,
        borderTopWidth: t, borderRightWidth: t, borderColor: color, transform: [{ rotate: "45deg" }],
      }} />

      {/* Flèche du bas, vers la gauche */}
      <View style={{ position: "absolute", left: 2 * k, top: yBot - t / 2, width: 10.5 * k, height: t, backgroundColor: color, borderRadius: t / 2 }} />
      <View style={{
        position: "absolute", left: 1.5 * k + d - a / 2, top: yBot - a / 2, width: a, height: a,
        borderBottomWidth: t, borderLeftWidth: t, borderColor: color, transform: [{ rotate: "45deg" }],
      }} />
    </View>
  );
}
