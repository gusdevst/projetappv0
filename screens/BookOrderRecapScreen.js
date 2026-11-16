// screens/BookOrderRecapScreen.js
// Commander un livre — étape 2 : récapitulatif et paiement (maquette : écran 3).
// Reçoit { albumId, address } de BookOrderAddress. « Payer » lance la fabrication et l'envoi (BookOrderProgress).
// ⚠️ Le paiement n'est PAS branché : en test, « Payer » lance directement la commande. Stripe viendra s'insérer ici,
//    entre le toucher du bouton et l'ouverture de BookOrderProgress.

import { useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { BookCover } from "../components/book/BookPage";
import { useBookFonts } from "../components/book/bookFonts";
import { SHADOW } from "../components/home/ui";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { pageRatio } from "../services/photoBook";
import { bookSpec, bookPriceCents } from "../services/bookProducts";
import { addressLine } from "../services/addresses";
import { formatEuro } from "../constants/subscription";

function Line({ label, value, total }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: total ? 11 : 7,
      ...(total ? { borderTopWidth: 1, borderTopColor: C.border, marginTop: 4 } : {}) }}>
      <Text style={{ fontSize: total ? 16 : 13.5, fontWeight: total ? "800" : "400", color: C.text }}>{label}</Text>
      <Text style={{ fontSize: total ? 16 : 13.5, fontWeight: total ? "800" : "600", color: C.text }}>{value}</Text>
    </View>
  );
}

export function BookOrderRecapScreen({ navigation, route }) {
  const albumId = route?.params?.albumId;
  const address = route?.params?.address;
  const album   = usePhotoStore((s) => s.albums.find((a) => a.id === albumId));
  const printed = usePhotoStore((s) => s.printed);
  const book    = usePhotoStore((s) => s.books[albumId]);
  useBookFonts();
  const [consent, setConsent] = useState(false);
  const urlById = useMemo(() => Object.fromEntries(printed.map((p) => [p.id, p.url])), [printed]);

  if (!album || !book || !address) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} />;

  const spec = bookSpec(book);
  const price = bookPriceCents(book);
  const total = price != null ? formatEuro(price) : "—";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.pad, paddingTop: 8, paddingBottom: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <BackButton accentColor={C.album} onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, color: C.textMuted }}>Commander · étape 2 sur 2</Text>
            <Text style={{ fontSize: 19, fontWeight: "600", color: C.text }}>Ta commande</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 14, marginHorizontal: 2 }}>
          {[1, 2].map((n) => <View key={n} style={{ flex: 1, height: 4, borderRadius: 3, backgroundColor: C.album }} />)}
        </View>

        <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12, ...SHADOW }}>
          <BookCover cover={book.cover} size={book.orientation === "landscape" ? 100 : 66} ratio={pageRatio(book)} urlById={urlById} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: "600", color: C.text }}>{book.cover.title || album.name}</Text>
            <Text style={{ fontSize: 12.5, color: C.textMid, lineHeight: 19, marginTop: 3 }}>
              {book.format} pages · {spec.orientation === "landscape" ? "horizontal" : "vertical"}{"\n"}{spec.sizeLabel} · couverture rigide
            </Text>
          </View>
        </View>

        <View style={{ backgroundColor: C.bgCard, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12, ...SHADOW }}>
          <Line label={`Livre photo ${book.format} pages`} value={total} />
          <Line label="Livraison Colissimo" value="offerte" />
          <Line label="Total TTC" value={total} total />
        </View>

        <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, marginBottom: 14, ...SHADOW }}>
          <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: C.textMuted, marginBottom: 4 }}>LIVRAISON</Text>
          <Text style={{ fontSize: 13, color: C.text, lineHeight: 20 }}>
            {address.name}{"\n"}{addressLine(address)}{address.complement ? `\n${address.complement}` : ""}
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 6 }}>
            <Text style={{ fontSize: 12.5, fontWeight: "700", color: C.album }}>Modifier</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => setConsent((v) => !v)} activeOpacity={0.8} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", marginHorizontal: 2 }}>
          <View style={{ width: 22, height: 22, borderRadius: 7, alignItems: "center", justifyContent: "center",
            backgroundColor: consent ? C.album : "transparent", borderWidth: consent ? 0 : 1.5, borderColor: C.border }}>
            {consent && <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>✓</Text>}
          </View>
          <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: C.textMid }}>
            J'accepte que mes photos soient envoyées à Pellicule et à l'imprimeur pour fabriquer mon livre. Elles sont supprimées après l'impression.
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={{ paddingHorizontal: S.pad, paddingTop: 8, paddingBottom: 12, backgroundColor: C.bg }}>
        {__DEV__ && (
          <View style={{ backgroundColor: "#fbeadb", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 9 }}>
            <Text style={{ fontSize: 11.5, color: "#c4621c", fontWeight: "500", lineHeight: 16 }}>🧪 Mode test : aucun paiement, aucune impression réelle.</Text>
          </View>
        )}
        <TouchableOpacity
          disabled={!consent || price == null}
          onPress={() => navigation.navigate("BookOrderProgress", { albumId, address })}
          style={{ height: 52, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center", elevation: 3,
            opacity: consent && price != null ? 1 : 0.4 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Payer {total}</Text>
        </TouchableOpacity>
        {!consent && <Text style={{ fontSize: 11.5, color: C.textMuted, textAlign: "center", marginTop: 8 }}>Coche la case ci-dessus pour continuer.</Text>}
      </View>
    </SafeAreaView>
  );
}
