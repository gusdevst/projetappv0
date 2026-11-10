// components/book/BookFormatChooser.js
// Écran « Choisis ton format » : affiché à la CRÉATION d'un livre photo (1re ouverture d'un album dans PhotoBookScreen).
// Présente le layflat (ouverture à 180°) puis les deux livres avec leur prix. Choisir un format crée le livre.
//
// Données (formats, prix) : services/bookProducts.js — rien n'est écrit en dur ici.
// Textes du layflat : fiche produit imprimeur.fr (pages rigides sans pli central, ouverture à plat 180°, couverture rigide,
// papier photo brillant 400 g/m², fabriqué en France).

import { View, ScrollView, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../AppText";
import BackButton from "../BackButton";
import { SHADOW } from "../home/ui";
import { C, S } from "../../constants/theme";
import { BOOK_PRODUCTS, BOOK_PRODUCT_KEYS, bookPriceCents } from "../../services/bookProducts";
import { formatEuro } from "../../constants/subscription";

// Une page de l'illustration : photo de l'album (ou aplat si pas de photo).
function MiniPage({ uri, w, h, style }) {
  return (
    <View style={[{ width: w, height: h, backgroundColor: C.sage2, overflow: "hidden" }, style]}>
      {!!uri && <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
    </View>
  );
}

// Livre ouvert à plat : deux pages côte à côte, sans pli au milieu, et une pastille « 180° ».
function OpenBook({ urls }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 6 }}>
      <View style={{ flexDirection: "row", ...SHADOW, shadowOpacity: 0.16, backgroundColor: "#fff", padding: 3, borderRadius: 4 }}>
        <MiniPage uri={urls[1]} w={92} h={122} />
        <View style={{ width: 1, backgroundColor: "rgba(0,0,0,0.06)" }} />
        <MiniPage uri={urls[2]} w={92} h={122} />
      </View>
      <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ height: 1.5, width: 34, backgroundColor: C.album, opacity: 0.5 }} />
        <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, backgroundColor: C.album }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>180°</Text>
        </View>
        <View style={{ height: 1.5, width: 34, backgroundColor: C.album, opacity: 0.5 }} />
      </View>
    </View>
  );
}

// Petit livre fermé, à la bonne forme (portrait ou paysage), avec la photo de couverture et une tranche.
function ClosedBook({ product, uri }) {
  const base = 96; // plus grand côté, en pixels
  const ratio = product.heightMm / product.widthMm;
  const w = ratio >= 1 ? Math.round(base / ratio) : base;
  const h = ratio >= 1 ? base : Math.round(base * ratio);
  return (
    <View style={{ width: 108, height: 108, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: w, height: h, borderRadius: 3, overflow: "hidden", backgroundColor: C.sage2, ...SHADOW, shadowOpacity: 0.2 }}>
        {!!uri && <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, backgroundColor: "rgba(0,0,0,0.22)" }} />
      </View>
    </View>
  );
}

const Point = ({ children }) => (
  <View style={{ flexDirection: "row", gap: 8, marginTop: 7 }}>
    <Text style={{ fontSize: 13, color: C.album, fontWeight: "800", width: 14 }}>✓</Text>
    <Text style={{ flex: 1, fontSize: 13, color: C.textMid, lineHeight: 18 }}>{children}</Text>
  </View>
);

// urls : adresses de quelques photos de l'album (pour les illustrations) · onChoose(productKey) crée le livre.
// Pour MODIFIER le format d'un livre existant : current = format actuel (clé), pages = nombre de pages du livre
// (les prix sont alors calculés pour ce nombre de pages) · sans current : création d'un livre.
export default function BookFormatChooser({ albumName, urls = [], onBack, onChoose, current, pages }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.pad, paddingTop: 8, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BackButton accentColor={C.album} onPress={onBack} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, color: C.textMuted, fontWeight: "500" }}>{current ? "Format du livre" : "Nouveau livre photo"}</Text>
            <Text numberOfLines={1} style={{ fontSize: 19, color: C.text, fontWeight: "600" }}>📕 {albumName}</Text>
          </View>
        </View>

        {/* Le layflat */}
        <View style={{ marginTop: 16, backgroundColor: C.albumSoft, borderRadius: 20, padding: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: C.album }}>TOUS NOS LIVRES SONT EN LAYFLAT</Text>
          <Text style={{ fontSize: 19, fontWeight: "700", color: C.text, marginTop: 4 }}>Ouverture à 180°</Text>
          <OpenBook urls={urls} />
          <Point>Le livre s'ouvre complètement à plat, sans pli au milieu.</Point>
          <Point>Tes photos s'étalent sur la double page : rien n'est avalé par la reliure.</Point>
          <Point>Couverture rigide, papier photo brillant épais (400 g).</Point>
          <Point>Imprimé et assemblé en France.</Point>
        </View>

        <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: C.textMuted, marginTop: 22, marginBottom: 8 }}>CHOISIS TON FORMAT</Text>

        {BOOK_PRODUCT_KEYS.map((key) => {
          const p = BOOK_PRODUCTS[key];
          const nPages = pages ?? p.pages.min;
          const price = bookPriceCents({ product: key }, nPages);
          const isCurrent = current === key;
          return (
            <View key={key} style={{ backgroundColor: C.bgCard, borderRadius: 20, padding: 14, marginBottom: 12, borderWidth: 2, borderColor: isCurrent ? C.album : "transparent", ...SHADOW }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <ClosedBook product={p} uri={urls[0]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{p.label}</Text>
                  <Text style={{ fontSize: 13, color: C.textMid, marginTop: 2 }}>{p.sizeLabel}</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>À partir de {p.pages.min} pages</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted }}>Jusqu'à {p.pages.max} pages</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 }}>
                <View>
                  <Text style={{ fontSize: 26, fontWeight: "800", color: C.text }}>{formatEuro(price)}</Text>
                  <Text style={{ fontSize: 11.5, color: C.textMuted }}>
                    pour {nPages} pages · TTC, livraison comprise
                  </Text>
                  <Text style={{ fontSize: 11.5, color: C.textMuted }}>
                    + {formatEuro(p.sale.extraPageCents)} par page en plus
                  </Text>
                </View>
                <TouchableOpacity onPress={() => onChoose(key)} accessibilityLabel={`Choisir le format ${p.label} ${p.sizeLabel}`}
                  style={{ height: 44, paddingHorizontal: 18, borderRadius: S.radiusFull, backgroundColor: isCurrent ? C.albumSoft : C.album, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: isCurrent ? C.album : "#fff", fontWeight: "700", fontSize: 14 }}>{isCurrent ? "Format actuel" : "Choisir"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <Text style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 16, marginTop: 4 }}>
          {current ? "Changer de format garde tes photos et ton titre." : "Tu pourras changer de format et ajouter des pages ensuite, depuis l'éditeur."}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
