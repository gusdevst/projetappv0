// screens/PrintNewScreen.js
// « Nouveaux tirages » : page produit ouverte par « ＋ Nouveau » du bloc Tirages photos (Chambre noire).
// Maquette validée le 10 nov. : `Claude outputs/maquette-tirages-nouveau.html`. Même construction que « Choisis ton format » du livre :
// présentation du produit, puis le choix entre ABONNEMENT (→ présentation des abonnements) et TIRAGE SIMPLE (pas encore branché : « Bientôt »).
// Données et textes : services/printProducts.js (prix du tirage simple = exemple à fixer).

import { View, ScrollView, TouchableOpacity, StatusBar, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Text from "../components/AppText";
import Icon from "../components/Icons";
import BackButton from "../components/BackButton";
import { useKeptUrls, MagnetGrid } from "../components/ProductArt";
import { SHADOW } from "../components/home/ui";
import { C, S } from "../constants/theme";
import { formatEuro, SUB_PRICE_LABEL, SUB_PHOTOS, SUB_MAGNETS, SUB_MAGNETS_PRICE_LABEL } from "../constants/subscription";
import { PRINT_PRODUCT, PRINT_HIGHLIGHTS, PRINT_STEPS, PRINT_GOOD_TO_KNOW } from "../services/printProducts";

// Un tirage (cadre blanc, photo, marge basse façon polaroïd) incliné.
function Print({ uri, w, rotate, style }) {
  return (
    <View style={[{ width: w, height: w * 1.28, backgroundColor: "#fff", borderRadius: 3, padding: w * 0.06, paddingBottom: w * 0.21, transform: [{ rotate }], ...SHADOW, shadowOpacity: 0.2 }, style]}>
      <View style={{ flex: 1, backgroundColor: C.sage2, overflow: "hidden" }}>
        {!!uri && <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
      </View>
    </View>
  );
}

// Éventail de 3 tirages + pastille de format.
function Fan({ urls }) {
  return (
    <View style={{ alignItems: "center", marginTop: 8 }}>
      <View style={{ width: 280, height: 150 }}>
        <Print uri={urls[0]} w={84} rotate="-9deg" style={{ position: "absolute", left: 14, top: 18 }} />
        <Print uri={urls[1]} w={84} rotate="3deg" style={{ position: "absolute", left: 98, top: 6, zIndex: 2 }} />
        <Print uri={urls[2]} w={84} rotate="10deg" style={{ position: "absolute", left: 182, top: 20 }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
        <View style={{ height: 1.5, width: 34, backgroundColor: C.album, opacity: 0.5 }} />
        <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, backgroundColor: C.album }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>{PRINT_PRODUCT.formats[0].label}</Text>
        </View>
        <View style={{ height: 1.5, width: 34, backgroundColor: C.album, opacity: 0.5 }} />
      </View>
    </View>
  );
}

// Petite vignette de carte : 1 ou 2 tirages.
function MiniPrints({ urls, count }) {
  return (
    <View style={{ width: 70, height: 70, borderRadius: 14, backgroundColor: C.albumSoft, overflow: "hidden" }}>
      {count === 2 ? (
        <>
          <Print uri={urls[0]} w={34} rotate="-8deg" style={{ position: "absolute", left: 9, top: 12 }} />
          <Print uri={urls[1]} w={34} rotate="7deg" style={{ position: "absolute", left: 27, top: 14 }} />
        </>
      ) : (
        <Print uri={urls[0]} w={34} rotate="4deg" style={{ position: "absolute", left: 18, top: 12 }} />
      )}
    </View>
  );
}

const Check = ({ children }) => (
  <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 9 }}>
    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
      <Icon name="check" size={12} color={C.album} strokeWidth={3} />
    </View>
    <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: C.text }}>{children}</Text>
  </View>
);

const Label = ({ children }) => (
  <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: C.textMuted, marginTop: 24, marginBottom: 8 }}>{children}</Text>
);

export function PrintNewScreen({ navigation }) {
  const urls = useKeptUrls(3);
  const magnetUrls = useKeptUrls(9);
  const { baseCount, baseCents, extraCents } = PRINT_PRODUCT.oneShot;

  const soon = () => Alert.alert(
    "Bientôt disponible",
    `Le tirage simple arrive bientôt 🌸\nEn attendant, tu peux t'abonner : ${SUB_PHOTOS} tirages chaque mois.`
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ padding: S.pad, paddingTop: 8, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* En-tête : retour + « Nouveaux tirages » avec l'icône polaroïd */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BackButton accentColor={C.album} onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, color: C.textMuted, fontWeight: "500" }}>Tirages photo</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon name="polaroid" size={22} color={C.album} />
              <Text style={{ fontSize: 19, color: C.text, fontWeight: "600" }}>Nouveaux tirages</Text>
            </View>
          </View>
        </View>

        {/* Le produit */}
        <View style={{ marginTop: 16, backgroundColor: C.albumSoft, borderRadius: 20, padding: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: C.album }}>DU VRAI PAPIER, CHEZ TOI</Text>
          <Text style={{ fontSize: 19, fontWeight: "700", color: C.text, marginTop: 4 }}>Tes photos en tirages</Text>
          <Fan urls={urls} />
          <View style={{ marginTop: 6 }}>
            {PRINT_HIGHLIGHTS.map((t) => <Check key={t}>{t}</Check>)}
          </View>
        </View>

        <Label>CHOISIS TA FORMULE</Label>

        {/* Abonnement */}
        <View style={[{ backgroundColor: C.bgCard, borderRadius: 20, padding: 14, marginBottom: 12, borderWidth: 2, borderColor: C.album }, SHADOW]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <MiniPrints urls={urls} count={2} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>Abonnement</Text>
                <View style={{ backgroundColor: C.album, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>LE + MALIN</Text>
                </View>
              </View>
              <Text style={{ fontSize: 12.5, color: C.textMid, marginTop: 2, lineHeight: 17 }}>
                Chaque mois, {SUB_PHOTOS} de tes coups de cœur arrivent chez toi. Tu valides avant l'envoi.
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 26, fontWeight: "800", color: C.text }}>{SUB_PRICE_LABEL} <Text style={{ fontSize: 13, fontWeight: "600", color: C.textMuted }}>/ mois</Text></Text>
              <Text style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 16 }}>{SUB_PHOTOS} tirages · TTC, livraison comprise{"\n"}Pause ou résiliation quand tu veux</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate("SubscriptionIntro")} accessibilityLabel="S'abonner aux tirages"
              style={{ height: 44, paddingHorizontal: 18, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>S'abonner</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tirage simple */}
        <View style={[{ backgroundColor: C.bgCard, borderRadius: 20, padding: 14, marginBottom: 12, borderWidth: 2, borderColor: "transparent" }, SHADOW]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <MiniPrints urls={[urls[2]]} count={1} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>Tirage simple</Text>
              <Text style={{ fontSize: 12.5, color: C.textMid, marginTop: 2, lineHeight: 17 }}>Tu choisis tes photos, on les imprime une seule fois.</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 26, fontWeight: "800", color: C.text }}>{formatEuro(baseCents)} <Text style={{ fontSize: 13, fontWeight: "600", color: C.textMuted }}>pour {baseCount}</Text></Text>
              <Text style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 16 }}>TTC, livraison comprise{"\n"}+ {formatEuro(extraCents)} par tirage en plus</Text>
            </View>
            <TouchableOpacity onPress={soon} accessibilityLabel="Choisir le tirage simple"
              style={{ height: 44, paddingHorizontal: 18, borderRadius: S.radiusFull, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.album, fontWeight: "700", fontSize: 14 }}>Choisir</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Magnets (abonnement) : la page de détail des magnets ouvre ensuite le réglage de l'abonnement */}
        <View style={[{ backgroundColor: C.bgCard, borderRadius: 20, padding: 14, marginBottom: 12, borderWidth: 2, borderColor: "transparent" }, SHADOW]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 70, height: 70, borderRadius: 14, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}>
              <MagnetGrid width={52} gap={2} urls={magnetUrls} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>Magnets</Text>
                <View style={{ backgroundColor: C.album, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>NOUVEAU</Text>
                </View>
              </View>
              <Text style={{ fontSize: 12.5, color: C.textMid, marginTop: 2, lineHeight: 17 }}>
                {SUB_MAGNETS} magnets carrés 5 × 5 cm, chaque mois, pour ton frigo.
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 26, fontWeight: "800", color: C.text }}>{SUB_MAGNETS_PRICE_LABEL} <Text style={{ fontSize: 13, fontWeight: "600", color: C.textMuted }}>/ mois</Text></Text>
              <Text style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 16 }}>TTC, livraison comprise{"\n"}Pause ou résiliation quand tu veux</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate("SubscriptionMagnets")} accessibilityLabel="Découvrir les magnets"
              style={{ height: 44, paddingHorizontal: 18, borderRadius: S.radiusFull, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.album, fontWeight: "700", fontSize: 14 }}>Découvrir</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Label>COMMENT ÇA MARCHE</Label>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {PRINT_STEPS.map((t, i) => (
            <View key={t} style={[{ flex: 1, backgroundColor: C.bgCard, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 8, alignItems: "center" }, SHADOW]}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: C.album }}>{i + 1}</Text>
              <Text style={{ fontSize: 12, color: C.textMid, textAlign: "center", lineHeight: 16, marginTop: 2 }}>{t}</Text>
            </View>
          ))}
        </View>

        <Label>BON À SAVOIR</Label>
        {PRINT_GOOD_TO_KNOW.map((t) => (
          <Text key={t} style={{ fontSize: 12, color: C.textMuted, lineHeight: 18, marginBottom: 2 }}>• {t}</Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
