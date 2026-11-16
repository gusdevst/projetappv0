// screens/SubscriptionRecapScreen.js
// Abonnement Coups de cœur — étape 2 : récapitulatif et accord, puis confirmation (même construction que BookOrderRecap / PrintRecap).
// Reçoit { setup, address } : `setup` vient de SubscriptionSetup (type d'abonnement, dates…), `address` de BookOrderAddress (adresse du compte
// ou d'un proche). « S'abonner » enregistre l'abonnement (store + table `subscriptions`) avec l'adresse structurée (nom, rue, code postal, ville,
// téléphone). ⚠️ Pas de paiement (Stripe viendra entre le bouton et l'enregistrement). Aucune photo ne part maintenant :
// chaque mois, l'utilisateur valide sa sélection (SubscriptionMonth), c'est ELLE qui envoie les photos.

import { useState } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { PrintTile, useKeptUrls } from "../components/ProductArt";
import { SHADOW } from "../components/home/ui";
import { C, S } from "../constants/theme";
import { SUB_PRODUCTS, SUB_FORMAT_LABEL, priceLabelFor, dayLabel } from "../constants/subscription";
import { useSubscriptionStore } from "../store/useSubscriptionStore";
import { useAuthStore } from "../store/useAuthStore";
import { addressLine, addressSnapshot } from "../services/addresses";
import { requestPermission } from "../services/notificationService";
import { refreshSubscriptionNotifications } from "../services/subscriptionNotifications";

function Line({ label, value, total }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: total ? 11 : 7,
      ...(total ? { borderTopWidth: 1, borderTopColor: C.border, marginTop: 4 } : {}) }}>
      <Text style={{ fontSize: total ? 16 : 13.5, fontWeight: total ? "800" : "400", color: C.text }}>{label}</Text>
      <Text style={{ fontSize: total ? 16 : 13.5, fontWeight: total ? "800" : "600", color: C.text }}>{value}</Text>
    </View>
  );
}

export function SubscriptionRecapScreen({ navigation, route }) {
  const { setup, address } = route?.params ?? {};
  const session = useAuthStore((s) => s.session);
  const addSub = useSubscriptionStore((s) => s.addSub);
  const urls = useKeptUrls(2);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!setup || !address) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} />;

  const self = setup.kind === "self";
  const prod = SUB_PRODUCTS[setup.product] ?? SUB_PRODUCTS.prints;
  const price = priceLabelFor(setup.count, setup.product);
  const forWho = self ? "pour moi" : `pour ${setup.name}`;

  async function subscribe() {
    if (busy || !session) return;
    setBusy(true);
    // Adresse en texte (affichage, anciens écrans) + structurée (nom, rue, code postal, ville, téléphone : pour le colis).
    const text = address.complement ? `${addressLine(address)}\n${address.complement}` : addressLine(address);
    addSub({
      kind: setup.kind, userId: session.user.id, name: setup.name, message: setup.message,
      recipient: address.name, address: text, addressData: addressSnapshot(address),
      product: setup.product, count: setup.count, validateEach: setup.validateEach,
      selectionDay: setup.selectionDay, sendDay: setup.sendDay,
    });
    // Pour prévenir le jour choisi que la sélection est prête : permission demandée ici, au bon moment, puis notification programmée.
    try { if (await requestPermission()) await refreshSubscriptionNotifications(); } catch (e) { /* abonnement enregistré quand même */ }
    setBusy(false);
    setDone(true);
  }

  // ── Confirmation ───────────────────────────────────────────────────────────
  if (done) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={{ padding: S.pad, paddingTop: 24, alignItems: "center" }}>
          <Text style={{ fontSize: 11.5, color: C.textMuted }}>Abonnement Coups de cœur · {forWho}</Text>
          <Text style={{ fontSize: 22, fontWeight: "700", color: C.text, marginTop: 2 }}>Abonnement enregistré !</Text>
          <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.sage, alignItems: "center", justifyContent: "center", marginVertical: 18 }}>
            <Text style={{ fontSize: 34, fontWeight: "800", color: C.accent }}>✓</Text>
          </View>
          <Text style={{ fontSize: 13, color: C.textMid, lineHeight: 19, textAlign: "center", paddingHorizontal: 8 }}>
            Le {dayLabel(setup.selectionDay)} de chaque mois, tu reçois une sélection de {setup.count} coups de cœur.
            {setup.validateEach ? ` Tu la valides avant le ${setup.sendDay}, puis` : " Elle part toute seule, puis"} elle est imprimée en France et expédiée à {address.city}.
          </Text>
          {__DEV__ && (
            <Text style={{ fontSize: 11.5, color: "#c4621c", textAlign: "center", marginTop: 14 }}>
              🧪 Mode test : aucun paiement, aucune photo envoyée pour l'instant.
            </Text>
          )}
        </ScrollView>
        <View style={{ paddingHorizontal: S.pad, paddingTop: 8, paddingBottom: 12, gap: 8 }}>
          <TouchableOpacity onPress={() => navigation.reset({ index: 1, routes: [{ name: "Main", params: { screen: "GalleryTab" } }, { name: "SubscriptionList" }] })}
            style={{ height: 52, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center", elevation: 3 }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Voir mes abonnements</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.reset({ index: 0, routes: [{ name: "Main", params: { screen: "GalleryTab" } }] })}
            style={{ height: 48, borderRadius: S.radiusFull, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.textMid, fontWeight: "700", fontSize: 14.5 }}>Retour au Labo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ padding: S.pad, paddingTop: 8, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <BackButton accentColor={C.album} onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, color: C.textMuted }}>Abonnement · étape 2 sur 2</Text>
            <Text style={{ fontSize: 19, fontWeight: "600", color: C.text }}>Ton abonnement</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 14, marginHorizontal: 2 }}>
          {[1, 2].map((k) => <View key={k} style={{ flex: 1, height: 4, borderRadius: 3, backgroundColor: C.album }} />)}
        </View>

        <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12, ...SHADOW }}>
          <View style={{ width: 62, height: 62 }}>
            <PrintTile uri={urls[0]} width={44} index={0} style={{ position: "absolute", left: 0, top: 24, transform: [{ rotate: "-8deg" }] }} />
            <PrintTile uri={urls[1]} width={44} index={1} style={{ position: "absolute", left: 18, top: 6, transform: [{ rotate: "7deg" }] }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>Abonnement Coups de cœur</Text>
            <Text style={{ fontSize: 12.5, color: C.textMid, lineHeight: 19, marginTop: 3 }}>
              {setup.count} {prod.units} {SUB_FORMAT_LABEL} par mois{"\n"}{self ? "Pour moi" : `Pour ${setup.name}`}
            </Text>
          </View>
        </View>

        <View style={{ backgroundColor: C.bgCard, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12, ...SHADOW }}>
          <Line label={`${setup.count} tirages par mois`} value={price ? `${price} / mois` : "—"} />
          <Line label="Livraison Colissimo" value="offerte" />
          <Line label="Total TTC" value={price ? `${price} / mois` : "—"} total />
          <Text style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 16, paddingBottom: 6 }}>
            Pause ou résiliation quand tu veux. Rien n'est facturé un mois que tu ne valides pas.
          </Text>
        </View>

        <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, marginBottom: 12, ...SHADOW }}>
          <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: C.textMuted, marginBottom: 4 }}>CHAQUE MOIS</Text>
          <Text style={{ fontSize: 13, color: C.text, lineHeight: 20 }}>
            Le {dayLabel(setup.selectionDay)} : tu reçois ta sélection{"\n"}
            {setup.validateEach ? `Avant le ${setup.sendDay} : tu la valides` : `Le ${setup.sendDay} : elle part à l'impression toute seule`}
          </Text>
        </View>

        <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, marginBottom: 14, ...SHADOW }}>
          <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: C.textMuted, marginBottom: 4 }}>LIVRAISON</Text>
          <Text style={{ fontSize: 13, color: C.text, lineHeight: 20 }}>
            {address.name}{"\n"}{addressLine(address)}{address.complement ? `\n${address.complement}` : ""}
          </Text>
          {!!setup.message && <Text style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic", marginTop: 6 }}>« {setup.message} »</Text>}
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
            J'accepte que les photos de chaque sélection validée, mon nom et l'adresse de livraison soient envoyés à Pellicule et à l'imprimeur pour fabriquer et expédier mes tirages.
            Ces données sont supprimées après l'impression et je peux demander leur suppression à tout moment.
            {self ? "" : ` J'ai l'accord de ${setup.name} pour donner son adresse.`}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={{ paddingHorizontal: S.pad, paddingTop: 8, paddingBottom: 12, backgroundColor: C.bg }}>
        {__DEV__ && (
          <View style={{ backgroundColor: "#fbeadb", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 9 }}>
            <Text style={{ fontSize: 11.5, color: "#c4621c", fontWeight: "500", lineHeight: 16 }}>🧪 Mode test : aucun paiement. Aucune photo ne part maintenant : seulement quand tu valides une sélection.</Text>
          </View>
        )}
        <TouchableOpacity disabled={!consent || busy || !price || !session} onPress={subscribe}
          style={{ height: 52, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center", elevation: 3, opacity: consent && !busy && price && session ? 1 : 0.4 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{self ? "S'abonner" : "Offrir"}{price ? ` · ${price} / mois` : ""}</Text>
        </TouchableOpacity>
        {!consent && <Text style={{ fontSize: 11.5, color: C.textMuted, textAlign: "center", marginTop: 8 }}>Coche la case ci-dessus pour continuer.</Text>}
      </View>
    </SafeAreaView>
  );
}
