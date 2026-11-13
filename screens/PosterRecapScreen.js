// screens/PosterRecapScreen.js
// Récapitulatif du poster (maquette `maquette-poster.html`, écran 6) : aperçu, quantité, livraison, total.
// ⏸ Le PAIEMENT et la commande imprimeur.fr sont en standby (décision d'Augustin) : le bouton « Payer » reste grisé
// avec « BIENTÔT ». Le nom et l'adresse saisis ici restent sur l'écran (rien n'est enregistré ni envoyé).
// Port : UN seul forfait par commande, déjà inclus dans le prix (voir posterProducts.js).

import { useState, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, TextInput, Alert, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import AddressInput from "../components/AddressInput";
import { PosterFrame } from "../components/poster/PosterParts";
import CollagePoster from "../components/poster/CollagePoster";
import { useBookFonts } from "../components/book/bookFonts";
import { collageLayout, collagePhotoOrder } from "../services/posterCollage";
import { SHADOW } from "../components/home/ui";
import { C, FONT } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { formatEuro } from "../constants/subscription";
import { POSTER_FORMATS, POSTER_MAX_QTY, DEFAULT_POSTER_FORMAT, posterPriceCents, posterIsLandscape, posterSizeLabel } from "../services/posterProducts";

export function PosterRecapScreen({ navigation, route }) {
  const { photoId, format, crop, collage, title } = route.params ?? {}; // collage : poster pêle-mêle (plusieurs photos)
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
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
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
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 130 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
          <TextInput value={name} onChangeText={setName} placeholder="Nom sur le colis" placeholderTextColor={C.textMuted}
            style={{ marginTop: 8, backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, fontFamily: FONT }} />
          <View style={{ marginTop: 8 }}>
            <AddressInput value={address} onChange={setAddress} placeholder="Adresse de livraison" />
          </View>
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
        <TouchableOpacity activeOpacity={0.85}
          onPress={() => Alert.alert("Bientôt disponible", "Le paiement des posters arrive bientôt 🌸")}
          style={{ height: 52, borderRadius: 26, backgroundColor: C.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Text style={{ color: C.textMuted, fontSize: 15, fontWeight: "700" }}>Payer · {formatEuro(total)}</Text>
          <View style={{ backgroundColor: C.album, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 8.5, fontWeight: "700", color: "#fff" }}>BIENTÔT</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
