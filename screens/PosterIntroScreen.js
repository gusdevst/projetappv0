// screens/PosterIntroScreen.js
// Présentation du poster photo (maquette `maquette-poster.html`, écran 2) : met en avant la qualité d'impression.
// Affichée à la 1re création (« posterIntroSeen ») ; ensuite « ＋ Créer » va directement au choix de la photo,
// et le petit ⓘ du bloc « Posters » (Chambre noire) la rouvre. Textes : fiche produit imprimeur.fr (voir posterProducts.js).

import { useEffect } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import Icon from "../components/Icons";
import BackButton from "../components/BackButton";
import { PosterHeroScene } from "../components/poster/PosterParts";
import { useKeptUrls } from "../components/ProductArt";
import { SHADOW } from "../components/home/ui";
import { C } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { formatEuro } from "../constants/subscription";
import { POSTER_FORMATS, POSTER_FORMAT_KEYS, POSTER_HIGHLIGHTS } from "../services/posterProducts";

export function PosterIntroScreen({ navigation }) {
  const { width: SW } = useWindowDimensions();
  const heroUrl = useKeptUrls(1)[0];
  const setSeen = usePhotoStore((s) => s.setPosterIntroSeen);
  useEffect(() => { setSeen(true); }, [setSeen]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={{ marginTop: 12 }}>
          <PosterHeroScene uri={heroUrl} width={SW - 32} />
        </View>

        <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: C.album, marginTop: 18 }}>IMPRIMÉ EN FRANCE</Text>
        <Text style={{ fontSize: 22, fontWeight: "700", color: C.text, marginTop: 4 }}>Ta plus belle photo, en grand</Text>
        {POSTER_HIGHLIGHTS.map((t) => (
          <View key={t} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 10 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" size={12} color={C.album} strokeWidth={3} />
            </View>
            <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: C.text }}>{t}</Text>
          </View>
        ))}

        <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: C.textMuted, marginTop: 24, marginBottom: 8 }}>4 FORMATS</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {POSTER_FORMAT_KEYS.map((k) => {
            const f = POSTER_FORMATS[k];
            return (
              <View key={k} style={[{ flex: 1, backgroundColor: C.bgCard, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 4, alignItems: "center" }, SHADOW]}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{f.name}</Text>
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{f.sizeLabel.replace(" cm", "")}</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.text, marginTop: 5 }}>{formatEuro(f.saleCents)}</Text>
              </View>
            );
          })}
        </View>
        <Text style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 16, marginTop: 10 }}>
          Prix TTC, livraison comprise. Tu choisis le format après ta photo, pour voir si la qualité suffit.
        </Text>
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 26, borderTopWidth: 1, borderTopColor: C.border }}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.replace("PosterPick")}
          style={[{ height: 50, borderRadius: 25, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }, SHADOW]}>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Choisir ma photo</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
