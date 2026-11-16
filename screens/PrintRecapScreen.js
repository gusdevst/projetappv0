// screens/PrintRecapScreen.js
// Commander des tirages — étape 2 : récapitulatif (même construction que BookOrderRecap / PosterRecap).
// Reçoit { photoIds, address } de BookOrderAddress (le choix des photos est fait avant : PosterPick en mode « prints »).
// On choisit ici le FORMAT (10 × 15 ou 10 × 10 cm). « Payer » lance la commande (PrintOrderProgress) : photos envoyées à Pellicule,
// commande « reçue ». ⚠️ Pas de paiement (Stripe viendra entre le bouton et PrintOrderProgress) et PAS de transmission à imprimeur.fr.

import { useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { SHADOW } from "../components/home/ui";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { addressLine } from "../services/addresses";
import { PRINT_PRODUCT, printOneShotCents } from "../services/printProducts";
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

export function PrintRecapScreen({ navigation, route }) {
  const { photoIds = [], address } = route?.params ?? {};
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const [format, setFormat] = useState(PRINT_PRODUCT.formats[0].key);
  const [consent, setConsent] = useState(false);

  const byId = useMemo(() => new Map(libraryPhotos.map((p) => [p.id, p])), [libraryPhotos]);
  const ids = useMemo(() => photoIds.filter((id) => byId.has(id)), [photoIds, byId]);
  const missing = photoIds.length - ids.length;
  const n = ids.length;
  const price = printOneShotCents(n);
  const total = price ? formatEuro(price) : "—";
  const ok = n >= PRINT_PRODUCT.minCount && !!address;

  const thumbs = ids.slice(0, 3).map((id) => byId.get(id)?.url);
  const f = PRINT_PRODUCT.formats.find((x) => x.key === format);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ padding: S.pad, paddingTop: 8, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <BackButton accentColor={C.album} onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, color: C.textMuted }}>Commander · étape 2 sur 2</Text>
            <Text style={{ fontSize: 19, fontWeight: "600", color: C.text }}>Ta commande</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 14, marginHorizontal: 2 }}>
          {[1, 2].map((k) => <View key={k} style={{ flex: 1, height: 4, borderRadius: 3, backgroundColor: C.album }} />)}
        </View>

        <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12, ...SHADOW }}>
          <View style={{ width: 92, height: 74 }}>
            {thumbs.map((uri, i) => (
              <View key={i} style={{ position: "absolute", left: i * 22, top: i % 2 ? 8 : 0, width: 44, height: 56, backgroundColor: "#fff", borderRadius: 3, padding: 3, paddingBottom: 10,
                transform: [{ rotate: `${(i - 1) * 7}deg` }], ...SHADOW, shadowOpacity: 0.2 }}>
                <View style={{ flex: 1, backgroundColor: C.sage2, overflow: "hidden" }}>
                  {!!uri && <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
                </View>
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>{n} tirage{n > 1 ? "s" : ""}</Text>
            <Text style={{ fontSize: 12.5, color: C.textMid, lineHeight: 19, marginTop: 3 }}>
              {f?.label} · photos recadrées au centre{"\n"}Une photo = un tirage
            </Text>
          </View>
        </View>

        {missing > 0 && (
          <View style={{ backgroundColor: "#fbeadb", borderRadius: 14, padding: 12, marginBottom: 12 }}>
            <Text style={{ fontSize: 12.5, color: "#c4621c", lineHeight: 18 }}>
              {missing} photo{missing > 1 ? "s ne sont" : " n'est"} plus sur ton téléphone et {missing > 1 ? "ont été retirées" : "a été retirée"} de la commande.
              {n < PRINT_PRODUCT.minCount ? ` Il en faut au moins ${PRINT_PRODUCT.minCount} : reviens en arrière pour en choisir d'autres.` : ""}
            </Text>
          </View>
        )}

        <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: C.textMuted, marginBottom: 8, marginLeft: 4 }}>FORMAT</Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
          {PRINT_PRODUCT.formats.map((x) => {
            const sel = x.key === format;
            return (
              <TouchableOpacity key={x.key} activeOpacity={0.85} onPress={() => setFormat(x.key)}
                style={[{ flex: 1, alignItems: "center", backgroundColor: sel ? "#fbf3ee" : C.bgCard, borderRadius: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: sel ? C.album : "transparent" }, SHADOW]}>
                <View style={{ width: x.widthMm / 4, height: x.heightMm / 4, backgroundColor: sel ? C.album : C.sage2, borderRadius: 2, marginBottom: 8, opacity: sel ? 0.9 : 1 }} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{x.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ backgroundColor: C.bgCard, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12, ...SHADOW }}>
          <Line label={`${n} tirages ${f?.label ?? ""}`} value={total} />
          <Line label="Livraison Colissimo" value="offerte" />
          <Line label="Total TTC" value={total} total />
        </View>

        <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, marginBottom: 14, ...SHADOW }}>
          <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: C.textMuted, marginBottom: 4 }}>LIVRAISON</Text>
          {address ? (
            <Text style={{ fontSize: 13, color: C.text, lineHeight: 20 }}>
              {address.name}{"\n"}{addressLine(address)}{address.complement ? `\n${address.complement}` : ""}
            </Text>
          ) : <Text style={{ fontSize: 13, color: C.textMuted }}>Aucune adresse choisie.</Text>}
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 6 }}>
            <Text style={{ fontSize: 12.5, fontWeight: "700", color: C.album }}>{address ? "Modifier" : "Choisir une adresse"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => setConsent((v) => !v)} activeOpacity={0.8} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", marginHorizontal: 2 }}>
          <View style={{ width: 22, height: 22, borderRadius: 7, alignItems: "center", justifyContent: "center",
            backgroundColor: consent ? C.album : "transparent", borderWidth: consent ? 0 : 1.5, borderColor: C.border }}>
            {consent && <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>✓</Text>}
          </View>
          <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: C.textMid }}>
            J'accepte que mes photos soient envoyées à Pellicule et à l'imprimeur pour fabriquer mes tirages. Elles sont supprimées après l'impression.
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={{ paddingHorizontal: S.pad, paddingTop: 8, paddingBottom: 12, backgroundColor: C.bg }}>
        {__DEV__ && (
          <View style={{ backgroundColor: "#fbeadb", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 9 }}>
            <Text style={{ fontSize: 11.5, color: "#c4621c", fontWeight: "500", lineHeight: 16 }}>🧪 Mode test : aucun paiement, rien n'est envoyé à l'imprimeur. La commande est seulement enregistrée.</Text>
          </View>
        )}
        <TouchableOpacity disabled={!consent || !ok}
          onPress={() => navigation.navigate("PrintOrderProgress", { photoIds: ids, format, address })}
          style={{ height: 52, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center", elevation: 3, opacity: consent && ok ? 1 : 0.4 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Payer {total}</Text>
        </TouchableOpacity>
        {!consent && <Text style={{ fontSize: 11.5, color: C.textMuted, textAlign: "center", marginTop: 8 }}>Coche la case ci-dessus pour continuer.</Text>}
      </View>
    </SafeAreaView>
  );
}
