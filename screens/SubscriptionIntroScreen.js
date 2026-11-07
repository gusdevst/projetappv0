// screens/SubscriptionIntroScreen.js
// Présentation de l'abonnement mensuel « Coups de cœur » (maquette « magnets mis en avant », validée le 7 nov.).
// En haut : des magnets faits avec les vrais coups de cœur. Dessous : les deux offres — magnets en grand
// (présélectionnés, pastille NOUVEAU), tirages photo plus discrets. Toucher la carte magnets déjà
// sélectionnée ouvre son détail ; « Continuer » mène au réglage avec l'offre choisie.

import { useState } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { MagnetCluster, MagnetGrid, PrintTile, useKeptUrls } from "../components/ProductArt";
import { SHADOW } from "../components/home/ui";
import { C } from "../constants/theme";
import { SUB_PHOTOS, SUB_MAGNETS, SUB_MAGNETS_PRICE_LABEL, SUB_PRICE_LABEL, SUB_FORMAT_LABEL } from "../constants/subscription";

function Radio({ on }) {
  return (
    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? C.accent : C.border, backgroundColor: on ? C.accent : "#fff", alignItems: "center", justifyContent: "center" }}>
      {on && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" }} />}
    </View>
  );
}

export function SubscriptionIntroScreen({ navigation }) {
  const { width: SW } = useWindowDimensions();
  const [sel, setSel] = useState("magnets"); // magnets mis en avant : présélectionnés
  const urls = useKeptUrls(9);
  const heroW = SW - 32;
  const magnets = sel === "magnets";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        <BackButton onPress={() => navigation.goBack()} />

        {/* Visuel : magnets éparpillés façon frigo */}
        <LinearGradient colors={[C.sage, C.sage2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ marginTop: 12, borderRadius: 24, overflow: "hidden", height: 156 * ((heroW - 24) / 288) + 24, padding: 12 }}>
          <MagnetCluster width={heroW - 24} urls={urls} />
          <View style={{ position: "absolute", left: 12, top: 10, backgroundColor: C.album, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, zIndex: 20 }}>
            <Text style={{ fontSize: 9.5, fontWeight: "700", color: "#fff" }}>NOUVEAU</Text>
          </View>
        </LinearGradient>

        <Text style={{ fontSize: 23, fontWeight: "700", color: C.text, lineHeight: 27, marginTop: 14 }}>
          Tes plus beaux souvenirs, sur ton frigo
        </Text>
        <Text style={{ fontSize: 12.5, color: C.textMid, lineHeight: 18, marginTop: 6 }}>
          {magnets
            ? `Chaque mois, ${SUB_MAGNETS} de tes coups de cœur deviennent des magnets. Tu valides avant l'envoi.`
            : `Chaque mois, ${SUB_PHOTOS} de tes coups de cœur sont imprimés en ${SUB_FORMAT_LABEL}. Tu valides avant l'envoi.`}
        </Text>

        {/* Offre 1 : magnets (en vedette) */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => (magnets ? navigation.navigate("SubscriptionMagnets") : setSel("magnets"))}
          style={[{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, borderRadius: 20, padding: 12, borderWidth: 2, borderColor: magnets ? C.accent : "transparent", backgroundColor: magnets ? C.sage : C.bgCard }, SHADOW]}>
          <MagnetGrid width={74} gap={3} urls={urls} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>Magnets photo</Text>
            <Text style={{ fontSize: 11.5, color: C.textMid, marginTop: 1 }}>{SUB_MAGNETS} magnets carrés · 5 × 5 cm</Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: C.accent, marginTop: 5 }}>{SUB_MAGNETS_PRICE_LABEL} / mois</Text>
            {magnets && <Text style={{ fontSize: 11, fontWeight: "600", color: C.accent, marginTop: 3 }}>Voir le détail ›</Text>}
          </View>
          <View style={{ position: "absolute", right: 12, top: 11, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ backgroundColor: C.album, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>NOUVEAU</Text>
            </View>
            <Radio on={magnets} />
          </View>
        </TouchableOpacity>

        {/* Offre 2 : tirages (plus discrets) */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => setSel("prints")}
          style={[{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 9, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 2, borderColor: !magnets ? C.accent : "transparent", backgroundColor: !magnets ? C.sage : C.bgCard }, SHADOW]}>
          <View style={{ width: 74, height: 54, justifyContent: "center", alignItems: "center" }}>
            <PrintTile width={62} uri={urls[0]} style={{ transform: [{ rotate: "-5deg" }] }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>Tirages photo</Text>
            <Text style={{ fontSize: 11.5, color: C.textMid, marginTop: 1 }}>{SUB_PHOTOS} tirages · {SUB_FORMAT_LABEL}</Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: !magnets ? C.accent : C.textMid, marginTop: 5 }}>{SUB_PRICE_LABEL} / mois</Text>
          </View>
          <View style={{ position: "absolute", right: 12, top: 11 }}><Radio on={!magnets} /></View>
        </TouchableOpacity>
      </ScrollView>

      {/* Bas d'écran : bouton */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: C.border }}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate("SubscriptionSetup", { product: sel })}
          style={[{ height: 50, borderRadius: 25, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }, SHADOW]}>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{magnets ? "Continuer avec les magnets" : "Continuer avec les tirages"}</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 8 }}>Livraison comprise · sans engagement</Text>
      </View>
    </SafeAreaView>
  );
}
