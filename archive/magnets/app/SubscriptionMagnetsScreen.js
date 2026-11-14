// screens/SubscriptionMagnetsScreen.js
// Détail de l'offre « magnets » (maquette validée le 7 nov., écran 2) : la grille des 9 magnets avec les vrais
// coups de cœur de l'utilisateur, trois atouts, le prix, un seul bouton. Ouvert depuis la présentation.

import { View, ScrollView, TouchableOpacity, StatusBar, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Text from "../components/AppText";
import Icon from "../components/Icons";
import BackButton from "../components/BackButton";
import { MagnetGrid, useKeptUrls } from "../components/ProductArt";
import { SHADOW } from "../components/home/ui";
import { C } from "../constants/theme";
import { SUB_MAGNETS, SUB_MAGNETS_PRICE_LABEL } from "../constants/subscription";

function Chip({ text }) {
  return (
    <View style={{ backgroundColor: C.albumSoft, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 5 }}>
      <Text style={{ fontSize: 11.5, fontWeight: "600", color: C.album }}>{text}</Text>
    </View>
  );
}

function Bullet({ children }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 10 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}>
        <Icon name="check" size={12} color={C.album} strokeWidth={3} />
      </View>
      <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: C.text }}>{children}</Text>
    </View>
  );
}

export function SubscriptionMagnetsScreen({ navigation }) {
  const { width: SW } = useWindowDimensions();
  const urls = useKeptUrls(9);
  const panelPad = 46;
  const gridW = SW - 32 - panelPad * 2;
  const bold = { fontWeight: "700", color: C.text };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 170 }} showsVerticalScrollIndicator={false}>
        <BackButton onPress={() => navigation.goBack()} />

        {/* Les 9 magnets sur une surface « frigo » */}
        <LinearGradient colors={[C.bgMuted, C.border]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ marginTop: 12, borderRadius: 24, paddingVertical: 18, paddingHorizontal: panelPad, alignItems: "center" }}>
          <MagnetGrid width={gridW} gap={9} urls={urls} rotate="-2deg" />
          <View style={{ position: "absolute", left: 12, top: 10, backgroundColor: C.album, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
            <Text style={{ fontSize: 9.5, fontWeight: "700", color: "#fff" }}>NOUVEAU</Text>
          </View>
        </LinearGradient>

        <Text style={{ fontSize: 21, fontWeight: "700", color: C.text, marginTop: 14 }}>{SUB_MAGNETS} magnets, chaque mois</Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
          <Chip text="5 × 5 cm" /><Chip text="Carrés" /><Chip text="Aimantés" />
        </View>

        <Bullet>Tes <Text style={bold}>{SUB_MAGNETS} coups de cœur</Text> tirés au hasard, tu changes ceux que tu veux</Bullet>
        <Bullet>Tu valides avant l'envoi, <Text style={bold}>rien ne part sans toi</Text></Bullet>
        <Bullet>Livraison comprise, résiliable à tout moment</Bullet>
      </ScrollView>

      {/* Bas d'écran : prix + bouton */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 26, borderTopWidth: 1, borderTopColor: C.border }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: C.text }}>{SUB_MAGNETS_PRICE_LABEL}</Text>
          <Text style={{ fontSize: 12.5, color: C.textMid }}>/ mois · livraison comprise</Text>
        </View>
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate("SubscriptionSetup", { product: "magnets" })}
          style={[{ height: 50, borderRadius: 25, backgroundColor: C.album, alignItems: "center", justifyContent: "center", marginTop: 8 }, SHADOW]}>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Choisir les magnets</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("SubscriptionSetup", { product: "prints" })} style={{ marginTop: 10 }}>
          <Text style={{ fontSize: 12.5, fontWeight: "600", color: C.album, textAlign: "center" }}>Plutôt des tirages photo ?</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
