// screens/PosterRecapScreen.js
// Récapitulatif du poster (maquette `maquette-poster.html`, écran 6) : aperçu, quantité, livraison, total.
// Commander un poster — étape 2 : reçoit l'adresse choisie dans BookOrderAddress (même écran que pour un livre, `nextScreen`).
// « Payer » lance la commande (PosterOrderProgress) : fichier fabriqué sur le téléphone, envoyé à Pellicule (Supabase), commande « reçue ».
// ⚠️ Le PAIEMENT n'est PAS branché (Stripe viendra s'insérer entre le bouton et PosterOrderProgress) et la commande n'est
//    PAS transmise à imprimeur.fr (décision d'Augustin, 16 nov. 2026).
// Port : UN seul forfait par commande, déjà inclus dans le prix (voir posterProducts.js).

import { useState, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { PosterFrame } from "../components/poster/PosterParts";
import CollagePoster from "../components/poster/CollagePoster";
import { useBookFonts } from "../components/book/bookFonts";
import { collageLayout, collagePhotoOrder } from "../services/posterCollage";
import { SHADOW } from "../components/home/ui";
import { C } from "../constants/theme";
import { addressLine } from "../services/addresses";
import { usePhotoStore } from "../store/usePhotoStore";
import { formatEuro } from "../constants/subscription";
import { POSTER_FORMATS, POSTER_MAX_QTY, DEFAULT_POSTER_FORMAT, posterPriceCents, posterIsLandscape, posterSizeLabel } from "../services/posterProducts";

export function PosterRecapScreen({ navigation, route }) {
  const { photoId, format, crop, collage, title, address } = route.params ?? {}; // collage : poster pêle-mêle (plusieurs photos) · address : adresse choisie à l'étape 1
  useBookFonts(); // titre du pêle-mêle
  const f = POSTER_FORMATS[format] ?? POSTER_FORMATS[DEFAULT_POSTER_FORMAT];
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const kept = usePhotoStore((s) => s.kept);
  const photo = useMemo(
    () => libraryPhotos.find((p) => p.id === photoId) ?? kept.find((p) => p.id === photoId) ?? null,
    [libraryPhotos, kept, photoId],
  );
  const cPhotos = useMemo(() => {
    if (!collage) return [];
    const byId = new Map([...kept, ...libraryPhotos].map((p) => [p.id, p]));
    return collage.photoIds.map((id) => byId.get(id)).filter(Boolean);
  }, [collage, libraryPhotos, kept]);
  const cCells = useMemo(() => (collage ? collageLayout(collage.style, cPhotos.length, { seed: collage.seed, hasTitle: !!collage.title }) : []), [collage, cPhotos.length]);
  const cOrder = useMemo(() => collagePhotoOrder(cPhotos.length, collage?.seed ?? 0), [collage, cPhotos.length]);
  const [qty, setQty] = useState(1);
  const [consent, setConsent] = useState(false);
  const total = posterPriceCents(f.key, qty);

  const stepBtn = (label, onPress, disabled) => (
    <TouchableOpacity onPress={onPress} disabled={disabled} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={{ fontSize: 20, lineHeight: 22, color: disabled ? C.textMuted : C.album, fontWeight: "700" }}>{label}</Text>
    </TouchableOpacity>
  );
  const card = [{ backgroundColor: C.bgCard, borderRadius: 16, padding: 12, marginTop: 10 }, SHADOW];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 230 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BackButton onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>Ton poster</Text>
            <Text style={{ fontSize: 12, color: C.textMuted }}>Vérifie avant de commander</Text>
          </View>
        </View>

        <View style={[...card, { flexDirection: "row", gap: 14, marginTop: 14 }]}>
          {collage
            ? <CollagePoster width={86} photos={cPhotos} cells={cCells} order={cOrder} crops={collage.crops} bg={collage.bg} title={collage.title} titleFont={collage.titleFont} />
            : <PosterFrame uri={photo?.url} crop={crop} title={title} width={posterIsLandscape(photo) ? 104 : 78} landscape={posterIsLandscape(photo)} />}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>Poster {f.name}</Text>
            <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              {collage ? `${posterSizeLabel(f.key, false)} · pêle-mêle, ${cPhotos.length} photos` : `${posterSizeLabel(f.key, posterIsLandscape(photo))}${posterIsLandscape(photo) ? " · horizontal" : ""}`}
            </Text>
            <Text style={{ fontSize: 12, color: C.textMuted }}>Papier brillant 250 g</Text>
            <Text style={{ fontSize: 12, color: C.textMuted }}>Livré roulé et protégé</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, alignSelf: "flex-start", marginTop: 8, backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 3 }}>
              {stepBtn("−", () => setQty((n) => Math.max(1, n - 1)), qty <= 1)}
              <Text style={{ fontSize: 15, fontWeight: "700", color: C.text, minWidth: 16, textAlign: "center" }}>{qty}</Text>
              {stepBtn("＋", () => setQty((n) => Math.min(POSTER_MAX_QTY, n + 1)), qty >= POSTER_MAX_QTY)}
            </View>
          </View>
        </View>

        <View style={card}>
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: C.text }}>Livraison</Text>
          {address ? (
            <Text style={{ fontSize: 13, color: C.text, lineHeight: 20, marginTop: 6 }}>
              {address.name}{"\n"}{addressLine(address)}{address.complement ? `\n${address.complement}` : ""}
            </Text>
          ) : (
            <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 6 }}>Aucune adresse choisie.</Text>
          )}
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 6 }}>
            <Text style={{ fontSize: 12.5, fontWeight: "700", color: C.album }}>{address ? "Modifier" : "Choisir une adresse"}</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 8 }}>Colissimo · 2 à 4 jours ouvrés après l'impression (1 à 3 jours)</Text>
        </View>

        <View style={card}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
            <Text style={{ fontSize: 13, color: C.textMid }}>Poster {f.name} × {qty}</Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: C.text }}>{formatEuro(total)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
            <Text style={{ fontSize: 13, color: C.textMid }}>Livraison</Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: C.text }}>incluse</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.border, marginTop: 6, paddingTop: 8 }}>
            <Text style={{ fontSize: 14, color: C.text }}>Total TTC</Text>
            <Text style={{ fontSize: 17, fontWeight: "800", color: C.text }}>{formatEuro(total)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 26, borderTopWidth: 1, borderTopColor: C.border }}>
        <TouchableOpacity onPress={() => setConsent((v) => !v)} activeOpacity={0.8} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", marginHorizontal: 2, marginBottom: 10 }}>
          <View style={{ width: 22, height: 22, borderRadius: 7, alignItems: "center", justifyContent: "center",
            backgroundColor: consent ? C.album : "transparent", borderWidth: consent ? 0 : 1.5, borderColor: C.border }}>
            {consent && <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>✓</Text>}
          </View>
          <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: C.textMid }}>
            J'accepte que ma photo soit envoyée à Pellicule et à l'imprimeur pour fabriquer mon poster. Elle est supprimée après l'impression.
          </Text>
        </TouchableOpacity>
        {__DEV__ && (
          <View style={{ backgroundColor: "#fbeadb", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 9 }}>
            <Text style={{ fontSize: 11.5, color: "#c4621c", fontWeight: "500", lineHeight: 16 }}>🧪 Mode test : aucun paiement, rien n'est envoyé à l'imprimeur. La commande est seulement enregistrée.</Text>
          </View>
        )}
        <TouchableOpacity activeOpacity={0.85} disabled={!consent || !address}
          onPress={() => navigation.navigate("PosterOrderProgress", { params: { photoId, crop, collage, title }, format: f.key, quantity: qty, address })}
          style={{ height: 52, borderRadius: 26, backgroundColor: C.album, alignItems: "center", justifyContent: "center", opacity: consent && address ? 1 : 0.4 }}>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Payer {formatEuro(total)}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
