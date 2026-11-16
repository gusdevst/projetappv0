// screens/BookOrderAddressScreen.js
// Commander un livre — étape 1 : « Où l'envoyer ? » (maquette : Claude outputs/maquette-commande-livre.html, écrans 2a à 2d).
// Ouvert par « Continuer » de BookCheck : navigation.navigate("BookOrderAddress", { albumId }).
//  · pas connecté          → carte « Connecte-toi » (ouvre Auth, on revient ici)
//  · aucune adresse        → formulaire (2a), l'adresse peut être enregistrée dans le compte
//  · adresse(s) enregistrée(s) → la par défaut est déjà choisie (2b) ; « Changer… » liste toutes les adresses (2c)
//  · « Offrir à quelqu'un d'autre » → formulaire (2d), à enregistrer ou à usage unique
// « Continuer » envoie l'adresse choisie à l'écran récapitulatif (BookOrderRecap).

import { useEffect, useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { Toggle } from "../components/Toggle";
import AddressForm, { EMPTY_ADDRESS_FORM } from "../components/AddressForm";
import { SHADOW } from "../components/home/ui";
import { C, S } from "../constants/theme";
import { useAuthStore } from "../store/useAuthStore";
import { useAddresses } from "../hooks/useAddresses";
import { saveAddress, validateAddressForm, addressLine } from "../services/addresses";
import { accountPhone } from "../services/auth";

function StepBar({ step }) {
  return (
    <View style={{ flexDirection: "row", gap: 5, marginBottom: 14, marginHorizontal: 2 }}>
      {[1, 2].map((n) => <View key={n} style={{ flex: 1, height: 4, borderRadius: 3, backgroundColor: n <= step ? C.album : C.bgMuted }} />)}
    </View>
  );
}

function AddressCard({ a, selected, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}
      style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: selected ? "#fff" : C.bgCard, borderRadius: 16, padding: 13, marginBottom: 10,
        borderWidth: 1.5, borderColor: selected ? C.album : C.border }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? C.album : C.border, marginTop: 1, alignItems: "center", justifyContent: "center" }}>
        {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.album }} />}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{a.label}</Text>
          {a.isDefault && (
            <View style={{ backgroundColor: C.sage, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 }}>
              <Text style={{ fontSize: 9.5, fontWeight: "700", letterSpacing: 0.6, color: C.accent }}>PAR DÉFAUT</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 13, color: C.textMid, lineHeight: 19, marginTop: 2 }}>
          {a.name}{"\n"}{addressLine(a)}{a.complement ? `\n${a.complement}` : ""}{"\n"}{a.phone}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function BookOrderAddressScreen({ navigation, route }) {
  const albumId = route?.params?.albumId;
  // Poster (ou autre produit) : { nextScreen: "PosterRecap", nextParams: {...}, what: "poster" } ; par défaut, le récap du livre.
  const nextScreen = route?.params?.nextScreen ?? "BookOrderRecap";
  const nextParams = route?.params?.nextParams ?? { albumId };
  const what = route?.params?.what ?? "livre";
  const GIFT = { livre: "ce livre", poster: "ce poster", tirage: "ces tirages", abonnement: "cet abonnement" };
  // startForm : ouvre directement le formulaire (abonnement offert à un proche). returnTo : au lieu d'ouvrir un nouvel écran,
  // revient à cet écran déjà ouvert en lui passant l'adresse (ex. « Modifier l'adresse » d'un abonnement).
  const startForm = !!route?.params?.startForm;
  const returnTo = route?.params?.returnTo ?? null;
  const session = useAuthStore((s) => s.session);
  const signedIn = !!session;
  const { addresses, loading, error, reload } = useAddresses(navigation, signedIn);

  // "pick" = adresse déjà choisie (2b) · "list" = toutes mes adresses (2c) · "form" = nouvelle adresse (2a / 2d)
  const [mode, setMode] = useState(startForm ? "form" : "pick");
  const [selectedId, setSelectedId] = useState(null);
  // Le téléphone du compte (saisi à la création du compte ou avec ma 1re adresse) pré-remplit le formulaire.
  const myPhone = accountPhone(session) ?? "";
  const [form, setForm] = useState({ ...EMPTY_ADDRESS_FORM, phone: myPhone });
  const [save, setSave] = useState(true);
  const [busy, setBusy] = useState(false);

  const hasAddresses = addresses.length > 0;
  const gift = hasAddresses; // un formulaire ouvert alors qu'on a déjà des adresses = on offre à quelqu'un d'autre

  // Dès que la liste est connue : choisir la par défaut (ou la 1re) ; sans adresse → formulaire.
  useEffect(() => {
    if (loading) return;
    if (!hasAddresses) { setMode("form"); setSelectedId(null); return; }
    setSelectedId((cur) => (cur && addresses.some((a) => a.id === cur) ? cur : (addresses.find((a) => a.isDefault) ?? addresses[0]).id));
    setMode((m) => (m === "form" && !gift ? "pick" : m));
  }, [loading, hasAddresses, addresses]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => addresses.find((a) => a.id === selectedId) ?? null, [addresses, selectedId]);
  const patch = (p) => setForm((f) => ({ ...f, ...p }));

  const goRecap = (address) => (returnTo
    ? navigation.popTo(returnTo, { ...nextParams, address, pickedAt: Date.now() }, { merge: true })
    : navigation.navigate(nextScreen, { ...nextParams, address }));

  async function submitForm() {
    // Une adresse enregistrée a besoin d'un nom ; première adresse du compte = « Chez moi ».
    const needLabel = save && hasAddresses;
    const res = validateAddressForm(form, { needLabel });
    if (res.error) { Alert.alert("Adresse à compléter", res.error); return; }
    if (!save) { goRecap({ ...res.value, id: null }); return; }
    setBusy(true);
    try {
      const saved = await saveAddress({ ...res.value, label: res.value.label || "Chez moi" });
      await reload();
      goRecap(saved);
    } catch (e) {
      Alert.alert("Adresse non enregistrée", "On n'a pas pu enregistrer l'adresse dans ton compte. Vérifie ta connexion et réessaie.");
    } finally { setBusy(false); }
  }

  const back = () => {
    if (mode === "form" && hasAddresses) { setMode("list"); return; }
    if (mode === "list") { setMode("pick"); return; }
    navigation.goBack();
  };

  const title = mode === "form" ? (gift ? `Offrir ${GIFT[what] ?? "ce cadeau"}` : "Où l'envoyer ?") : "Où l'envoyer ?";

  // ── Pas connecté ────────────────────────────────────────────────────────────
  if (!signedIn) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ padding: S.pad, paddingTop: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <BackButton accentColor={C.album} onPress={() => navigation.goBack()} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11.5, color: C.textMuted }}>Commander</Text>
              <Text style={{ fontSize: 19, fontWeight: "600", color: C.text }}>Connecte-toi</Text>
            </View>
          </View>
          <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 18, ...SHADOW }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>Un compte est nécessaire pour commander</Text>
            <Text style={{ fontSize: 13, color: C.textMid, lineHeight: 19, marginTop: 6 }}>
              Il garde ton adresse et te permet de suivre ta commande. Une fois connecté, tu reviens ici.
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Auth")}
              style={{ height: 50, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center", marginTop: 16, elevation: 3 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Me connecter ou créer un compte</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: S.pad, paddingTop: 8, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <BackButton accentColor={C.album} onPress={back} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11.5, color: C.textMuted }}>{returnTo ? "Adresse de livraison" : "Commander · étape 1 sur 2"}</Text>
              <Text style={{ fontSize: 19, fontWeight: "600", color: C.text }}>{title}</Text>
            </View>
          </View>
          {!returnTo && <StepBar step={1} />}

          {loading && <ActivityIndicator color={C.album} style={{ marginTop: 30 }} />}

          {!loading && !!error && !hasAddresses && (
            <View style={{ backgroundColor: C.albumSoft, borderRadius: 14, padding: 12, marginBottom: 14 }}>
              <Text style={{ fontSize: 12.5, color: C.text, lineHeight: 18 }}>
                Impossible de lire tes adresses enregistrées (connexion ?). Tu peux quand même saisir une adresse.
              </Text>
              <TouchableOpacity onPress={reload}><Text style={{ fontSize: 12.5, fontWeight: "700", color: C.album, marginTop: 6 }}>Réessayer</Text></TouchableOpacity>
            </View>
          )}

          {/* 2b : l'adresse choisie */}
          {!loading && mode === "pick" && selected && (
            <>
              <AddressCard a={selected} selected onPress={() => {}} />
              <TouchableOpacity onPress={() => setMode("list")} style={{ marginHorizontal: 4, marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.album }}>Changer d'adresse ou offrir à quelqu'un ›</Text>
              </TouchableOpacity>
            </>
          )}

          {/* 2c : mes adresses */}
          {!loading && mode === "list" && (
            <>
              <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: C.textMuted, marginBottom: 8, marginLeft: 4 }}>MES ADRESSES</Text>
              {addresses.map((a) => <AddressCard key={a.id} a={a} selected={a.id === selectedId} onPress={() => setSelectedId(a.id)} />)}
              <TouchableOpacity onPress={() => { setForm({ ...EMPTY_ADDRESS_FORM, phone: myPhone }); setSave(true); setMode("form"); }}
                style={{ flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderStyle: "dashed", borderColor: C.album, borderRadius: 16, padding: 13, marginBottom: 10 }}>
                <Text style={{ color: C.album, fontWeight: "700", fontSize: 14 }}>＋ Offrir à quelqu'un d'autre</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 16, marginHorizontal: 4 }}>
                Un cadeau pour un proche : tu saisis son nom et son adresse. Tu peux la garder dans tes adresses (ex. « Chez Maman ») ou l'utiliser une seule fois.
              </Text>
            </>
          )}

          {/* 2a / 2d : formulaire */}
          {!loading && mode === "form" && (
            <>
              <AddressForm value={form} onChange={patch} showLabel={save && hasAddresses} labelPlaceholder="Chez Maman" />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 2, marginBottom: 14 }}>
                <Toggle value={save} onToggle={() => setSave((v) => !v)} color={C.album} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: C.text }}>{hasAddresses ? "Enregistrer dans mes adresses" : "Enregistrer dans mon compte"}</Text>
                  <Text style={{ fontSize: 11.5, color: C.textMuted }}>{hasAddresses ? "Sinon, elle ne sert que pour cette commande" : "Pour ne plus la ressaisir"}</Text>
                </View>
              </View>
            </>
          )}

          {!loading && (
            <View style={{ alignSelf: "flex-start", backgroundColor: C.sage, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: C.accent }}>🚚 Colissimo · livraison comprise</Text>
            </View>
          )}
        </ScrollView>

        {!loading && (
          <View style={{ paddingHorizontal: S.pad, paddingTop: 8, paddingBottom: 12, backgroundColor: C.bg }}>
            <TouchableOpacity
              disabled={busy || (mode !== "form" && !selected)}
              onPress={() => (mode === "form" ? submitForm() : goRecap(selected))}
              style={{ height: 52, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center", elevation: 3,
                opacity: busy || (mode !== "form" && !selected) ? 0.5 : 1 }}>
              {busy ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                  {returnTo ? "Utiliser cette adresse" : mode === "list" || (mode === "form" && hasAddresses) ? "Utiliser cette adresse" : "Continuer"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
