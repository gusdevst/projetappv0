// screens/PosterIntroScreen.js
// Présentation du poster photo, construite comme « Nouveaux tirages » (PrintNewScreen) et « Choisis ton format » du livre :
// en-tête (flèche terracotta + petit titre gris + titre), ENCART ORANGE PÂLE avec l'image et les points ✓ (pastilles blanches), un bouton en bas.
// Choix d'Augustin (11 nov. 2026, piste C de `Claude outputs/maquette-poster-presentation.html`, sans onglets) :
//   · l'image (PosterProjection) = UN format à la fois avec un iPhone à côté, mise à jour quand on touche un des 4 formats placés SOUS l'encart
//     (prix sur chaque format) ; des pêle-mêle dans certains formats montrent qu'on peut mettre plusieurs photos ;
//   · plus tard : « Voir chez moi » (projection sur le mur) dans l'image ;
//   · aucune pastille sur l'image (12 nov. : « Livré sous 3 à 7 jours » et « Impression haute définition » retirées ; ce dernier est un point de la liste ✓) ;
//   · plus de « Comment ça marche » ni de « Bon à savoir ».
// Ouverte à chaque « ＋ Créer » du bloc « Posters » (Chambre noire) ; « Créer mon poster » → choix de la photo (une ou plusieurs).
// Textes : fiche produit imprimeur.fr (voir posterProducts.js).

import { useState } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import Icon from "../components/Icons";
import BackButton from "../components/BackButton";
import PosterProjection from "../components/poster/PosterProjection";
import { useKeptUrls } from "../components/ProductArt";
import { SHADOW } from "../components/home/ui";
import { C, S } from "../constants/theme";
import { formatEuro } from "../constants/subscription";
import { POSTER_FORMATS, POSTER_FORMAT_KEYS, POSTER_HIGHLIGHTS, DEFAULT_POSTER_FORMAT } from "../services/posterProducts";
import { COLLAGE_MIN, COLLAGE_MAX } from "../services/posterCollage";

const Check = ({ children }) => (
  <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 9 }}>
    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
      <Icon name="check" size={12} color={C.album} strokeWidth={3} />
    </View>
    <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: C.text }}>{children}</Text>
  </View>
);

export function PosterIntroScreen({ navigation }) {
  const { width: SW } = useWindowDimensions();
  const urls = useKeptUrls(16); // les vrais coups de cœur (aplats si l'utilisateur n'en a pas encore)
  const [fmt, setFmt] = useState(DEFAULT_POSTER_FORMAT); // format touché sous l'encart : l'image au-dessus se met à jour

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ padding: S.pad, paddingTop: 8, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        {/* En-tête : retour + « Nouveau poster » avec l'icône */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BackButton accentColor={C.album} onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, color: C.textMuted, fontWeight: "500" }}>Posters photo</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon name="polaroid" size={22} color={C.album} />
              <Text style={{ fontSize: 19, color: C.text, fontWeight: "600" }}>Nouveau poster</Text>
            </View>
          </View>
        </View>

        {/* Encart orange : image + points */}
        <View style={{ marginTop: 16, backgroundColor: C.albumSoft, borderRadius: 20, padding: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: C.album }}>IMPRIMÉ EN FRANCE 🇫🇷</Text>
          <Text style={{ fontSize: 19, fontWeight: "700", color: C.text, marginTop: 4 }}>Tes plus beaux souvenirs, en grand</Text>

          <View style={{ marginTop: 12 }}>
            <PosterProjection format={POSTER_FORMATS[fmt]} urls={urls} width={SW - S.pad * 2 - 32} />
          </View>

          <View style={{ marginTop: 6 }}>
            <Check>Une photo, ou {COLLAGE_MIN} à {COLLAGE_MAX} en pêle-mêle, alignées comme des tirages</Check>
            {POSTER_HIGHLIGHTS.map((t) => <Check key={t}>{t}</Check>)}
          </View>
        </View>

        {/* Formats : toucher un format met à jour l'image de l'encart (poster à la bonne taille, iPhone à côté) */}
        <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: C.textMuted, marginTop: 22, marginBottom: 8 }}>4 FORMATS · TOUCHE POUR LES VOIR</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {POSTER_FORMAT_KEYS.map((k) => {
            const f = POSTER_FORMATS[k];
            const on = fmt === k;
            return (
              <TouchableOpacity key={k} activeOpacity={0.85} onPress={() => setFmt(k)} accessibilityLabel={`Voir le format ${f.name}`}
                style={[{ flex: 1, backgroundColor: on ? C.albumSoft : C.bgCard, borderRadius: 14, borderWidth: 2, borderColor: on ? C.album : "transparent", paddingVertical: 10, paddingHorizontal: 4, alignItems: "center" }, SHADOW]}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{f.name}</Text>
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{f.sizeLabel.replace(" cm", "")}</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.text, marginTop: 5 }}>{formatEuro(f.saleCents)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 16, marginTop: 10 }}>
          Prix TTC, livraison comprise. Tu choisis le format après tes photos, pour voir si la qualité suffit.
        </Text>
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 26, borderTopWidth: 1, borderTopColor: C.border }}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.replace("PosterPick")}
          style={[{ height: 50, borderRadius: 25, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }, SHADOW]}>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Créer mon poster</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
