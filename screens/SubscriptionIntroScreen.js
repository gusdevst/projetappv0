// screens/SubscriptionIntroScreen.js
// Présentation de l'abonnement mensuel « Coups de cœur » : tirages 10 × 15 cm.
// En haut : un éventail de tirages faits avec les vrais coups de cœur. Dessous : l'offre (20 tirages, prix) ;
// « Continuer » mène au réglage. (Les magnets ont été retirés le 14 nov. 2026 : ancienne version dans
// archive/magnets/app/SubscriptionIntroScreen.js.)

import { View, ScrollView, TouchableOpacity, StatusBar, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { PrintTile, useKeptUrls } from "../components/ProductArt";
import { SHADOW } from "../components/home/ui";
import { C } from "../constants/theme";
import { SUB_PHOTOS, SUB_PRICE_LABEL, SUB_FORMAT_LABEL } from "../constants/subscription";

export function SubscriptionIntroScreen({ navigation }) {
  const { width: SW } = useWindowDimensions();
  const urls = useKeptUrls(3);
  const heroW = SW - 32;
  const tileW = Math.min(112, heroW * 0.34);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        <BackButton onPress={() => navigation.goBack()} />

        {/* Visuel : trois tirages éventail */}
        <LinearGradient colors={[C.albumSoft, "#ecd3c3"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ marginTop: 12, borderRadius: 24, overflow: "hidden", height: tileW * 0.72 + 70, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: heroW * 0.8, height: tileW * 0.72 + 30 }}>
            <PrintTile width={tileW} index={0} uri={urls[0]} style={{ position: "absolute", left: 0, top: 18, transform: [{ rotate: "-9deg" }] }} />
            <PrintTile width={tileW} index={1} uri={urls[1]} style={{ position: "absolute", left: heroW * 0.8 / 2 - tileW / 2, top: 4, zIndex: 2, transform: [{ rotate: "3deg" }] }} />
            <PrintTile width={tileW} index={2} uri={urls[2]} style={{ position: "absolute", right: 0, top: 20, zIndex: 3, transform: [{ rotate: "9deg" }] }} />
          </View>
        </LinearGradient>

        <Text style={{ fontSize: 23, fontWeight: "700", color: C.text, lineHeight: 27, marginTop: 14 }}>
          Tes plus beaux souvenirs, chez toi chaque mois
        </Text>
        <Text style={{ fontSize: 12.5, color: C.textMid, lineHeight: 18, marginTop: 6 }}>
          {`Chaque mois, ${SUB_PHOTOS} de tes coups de cœur sont imprimés en ${SUB_FORMAT_LABEL}. Tu valides avant l'envoi.`}
        </Text>

        {/* L'offre */}
        <View style={[{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, borderRadius: 20, padding: 12, borderWidth: 2, borderColor: C.album, backgroundColor: C.albumSoft }, SHADOW]}>
          <View style={{ width: 74, height: 54, justifyContent: "center", alignItems: "center" }}>
            <PrintTile width={62} uri={urls[0]} style={{ transform: [{ rotate: "-5deg" }] }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>Abonnement Coups de cœur</Text>
            <Text style={{ fontSize: 11.5, color: C.textMid, marginTop: 1 }}>{SUB_PHOTOS} tirages · {SUB_FORMAT_LABEL}</Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: C.album, marginTop: 5 }}>{SUB_PRICE_LABEL} / mois</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bas d'écran : bouton */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: C.border }}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate("SubscriptionSetup", { product: "prints" })}
          style={[{ height: 50, borderRadius: 25, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }, SHADOW]}>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Continuer</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 8 }}>Livraison comprise · sans engagement</Text>
      </View>
    </SafeAreaView>
  );
}
