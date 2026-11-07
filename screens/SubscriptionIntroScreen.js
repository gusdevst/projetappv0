// screens/SubscriptionIntroScreen.js
// Présentation de l'abonnement mensuel « Coups de cœur » (maquette validée, écran 2).
// Ouvert depuis la carte « Abonnement » de la Galerie.
// Le bouton « Démarrer l'abonnement » mène au réglage (SubscriptionSetupScreen).

import { View, ScrollView, TouchableOpacity, StatusBar, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { SHADOW } from "../components/home/ui";
import { C } from "../constants/theme";
import { SUB_PRICE_LABEL, SUB_PHOTOS } from "../constants/subscription";
import { usePhotoStore } from "../store/usePhotoStore";

const POLA_W = 104;
const POLA_H = 122;

// Un polaroïd : cadre blanc, photo (ou aplat sauge à défaut), bas plus épais.
function Polaroid({ uri, fallback, left, top, rotate, z = 1 }) {
  return (
    <View style={[{
      position: "absolute", left, top, zIndex: z, width: POLA_W, height: POLA_H,
      backgroundColor: "#fff", borderRadius: 6, padding: 7, paddingBottom: 24,
      transform: [{ rotate }],
    }, SHADOW]}>
      {uri
        ? <Image source={{ uri }} contentFit="cover" style={{ flex: 1, borderRadius: 3, backgroundColor: fallback }} />
        : <View style={{ flex: 1, borderRadius: 3, backgroundColor: fallback }} />}
    </View>
  );
}

function Step({ n, title, text }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: 14 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: C.accent }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{title}</Text>
        <Text style={{ fontSize: 12.5, color: C.textMid, lineHeight: 18, marginTop: 1 }}>{text}</Text>
      </View>
    </View>
  );
}

export function SubscriptionIntroScreen({ navigation }) {
  const { width: SW } = useWindowDimensions();
  const kept = usePhotoStore((s) => s.kept);

  // Les 3 derniers coups de cœur illustrent la page (sinon : aplats sauge).
  const last = kept.slice(-3).reverse().map((p) => p.url);
  const cx = (SW - 32) / 2 - POLA_W / 2; // x du polaroïd central

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 190 }} showsVerticalScrollIndicator={false}>
        <BackButton onPress={() => navigation.goBack()} />

        <View style={{ height: 160, marginTop: 14 }}>
          <Polaroid uri={last[1]} fallback={C.sage3} left={cx - 78} top={18} rotate="-9deg" />
          <Polaroid uri={last[2]} fallback={C.albumSoft} left={cx + 80} top={14} rotate="8deg" />
          <Polaroid uri={last[0]} fallback={C.sage2} left={cx} top={2} rotate="-1deg" z={2} />
        </View>

        <Text style={{ fontSize: 24, fontWeight: "700", color: C.text, lineHeight: 29, marginTop: 6 }}>
          Tes coups de cœur, dans ta boîte aux lettres
        </Text>

        <Step n="1" title="Tu fais ton tri" text="Chaque ❤️ rejoint tes coups de cœur." />
        <Step n="2" title={`Chaque mois, ${SUB_PHOTOS} photos au hasard`} text="On te propose une sélection. Tu peux en changer." />
        <Step n="3" title="Tu valides, on imprime" text="Rien ne part sans ton accord." />
      </ScrollView>

      {/* Bas d'écran : prix + bouton */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: C.border }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: C.text }}>{SUB_PRICE_LABEL}</Text>
          <Text style={{ fontSize: 12.5, color: C.textMid }}>/ mois · {SUB_PHOTOS} tirages, livraison comprise</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate("SubscriptionSetup")}
          style={[{ height: 50, borderRadius: 25, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", marginTop: 8 }, SHADOW]}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Démarrer l'abonnement</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 8 }}>
          Sans engagement · tu résilies quand tu veux
        </Text>
      </View>
    </SafeAreaView>
  );
}
