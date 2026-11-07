// screens/SubscriptionSetupScreen.js
// Réglage de l'abonnement mensuel « Coups de cœur » (maquette validée, écrans 3 et 4).
// Deux onglets : « Pour moi » (10 tirages, un seul abonnement) · « Pour un proche »
// (prénom, adresse, nombre de photos, petit mot ; autant d'abonnements qu'on veut).
// Pour l'instant : enregistre l'abonnement sur le téléphone. Paiement et envoi = étapes suivantes.

import { useState } from "react";
import { View, ScrollView, TouchableOpacity, TextInput, StatusBar, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { Toggle } from "../components/Toggle";
import { SHADOW } from "../components/home/ui";
import { C, FONT } from "../constants/theme";
import {
  SUB_PHOTOS, SUB_GIFT_CHOICES, SUB_FORMAT_LABEL, SUB_SEND_DAY, priceLabelFor,
} from "../constants/subscription";
import { useSubscriptionStore } from "../store/useSubscriptionStore";
import { useAuthStore } from "../store/useAuthStore";

const MIN_ADDRESS = 12; // « 3 rue X, 75001 Paris » : en dessous, ce n'est pas une adresse

// Case de formulaire : petit titre + contenu (texte fixe ou saisie).
function Field({ label, children, right }) {
  return (
    <View style={[{ backgroundColor: C.bgCard, borderRadius: 13, paddingVertical: 9, paddingHorizontal: 13, marginTop: 8, flexDirection: "row", alignItems: "center" }, SHADOW]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 10.5, color: C.textMuted, fontWeight: "500" }}>{label}</Text>
        {children}
      </View>
      {right}
    </View>
  );
}

const Value = ({ children }) => (
  <Text style={{ fontSize: 13.5, fontWeight: "500", color: C.text, marginTop: 1 }}>{children}</Text>
);

function Input(props) {
  return (
    <TextInput
      placeholderTextColor={C.textMuted}
      {...props}
      style={[{ fontSize: 13.5, fontWeight: "500", color: C.text, fontFamily: FONT, paddingVertical: 2, marginTop: 1 }, props.style]}
    />
  );
}

function Banner({ icon, bg, color, children }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: bg, borderRadius: 14, padding: 11, marginTop: 12 }}>
      <Text style={{ fontSize: 15 }}>{icon}</Text>
      <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color }}>{children}</Text>
    </View>
  );
}

function ValidateRow({ value, onToggle, sub }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: C.bgCard, borderRadius: 15, paddingVertical: 10, paddingHorizontal: 12, marginTop: 10 }, SHADOW]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13.5, fontWeight: "500", color: C.text }}>Je valide chaque envoi</Text>
        <Text style={{ fontSize: 11, color: C.textMuted }}>{sub}</Text>
      </View>
      <Toggle value={value} onToggle={onToggle} />
    </View>
  );
}

function Stepper({ value, onMinus, onPlus, canMinus, canPlus }) {
  const btn = (label, on, enabled) => (
    <TouchableOpacity onPress={on} disabled={!enabled} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: enabled ? C.sage : C.bgMuted }}>
      <Text style={{ fontSize: 17, fontWeight: "600", color: enabled ? C.accent : C.textMuted }}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      {btn("−", onMinus, canMinus)}
      <Text style={{ fontSize: 17, fontWeight: "700", color: C.text, minWidth: 22, textAlign: "center" }}>{value}</Text>
      {btn("+", onPlus, canPlus)}
    </View>
  );
}

export function SubscriptionSetupScreen({ navigation, route }) {
  const [tab, setTab] = useState(route.params?.kind === "gift" ? "gift" : "self");

  const subs    = useSubscriptionStore((s) => s.subs);
  const addSub  = useSubscriptionStore((s) => s.addSub);
  const session = useAuthStore((s) => s.session);
  const alreadySelf = subs.some((x) => x.kind === "self");

  // « Pour moi »
  const [myAddress, setMyAddress]   = useState("");
  const [myValidate, setMyValidate] = useState(true);
  // « Pour un proche »
  const [giftName, setGiftName]       = useState("");
  const [giftAddress, setGiftAddress] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftCount, setGiftCount]     = useState(10);
  const [giftValidate, setGiftValidate] = useState(true);

  const isSelf = tab === "self";
  const count  = isSelf ? SUB_PHOTOS : giftCount;
  const price  = priceLabelFor(count);

  // Pourquoi le bouton est grisé (affiché sous le bouton).
  let blocked = null;
  if (isSelf) {
    if (alreadySelf) blocked = "Tu as déjà cet abonnement.";
    else if (myAddress.trim().length < MIN_ADDRESS) blocked = "Ajoute ton adresse de livraison.";
  } else {
    if (giftName.trim().length < 2) blocked = "Ajoute le prénom de ton proche.";
    else if (giftAddress.trim().length < MIN_ADDRESS) blocked = "Ajoute son adresse de livraison.";
    else if (!price) blocked = `Le prix pour ${giftCount} photos n'est pas encore fixé.`;
  }

  const changeCount = (dir) => {
    const i = SUB_GIFT_CHOICES.indexOf(giftCount);
    const next = SUB_GIFT_CHOICES[i + dir];
    if (next) setGiftCount(next);
  };

  function submit() {
    if (!session) {
      Alert.alert(
        "Connecte-toi d'abord",
        "L'abonnement est lié à ton compte Pellicule.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Se connecter", onPress: () => navigation.navigate("Auth") },
        ]
      );
      return;
    }
    addSub(isSelf
      ? { kind: "self", userId: session.user.id, address: myAddress.trim(), count: SUB_PHOTOS, validateEach: myValidate }
      : { kind: "gift", userId: session.user.id, name: giftName.trim(), address: giftAddress.trim(), message: giftMessage.trim(), count: giftCount, validateEach: giftValidate }
    );
    Alert.alert(
      "Abonnement enregistré",
      "Tes réglages sont sauvegardés. Le paiement et l'envoi des photos arrivent bientôt.",
      [{ text: "OK", onPress: () => navigation.navigate("Main", { screen: "GalleryTab" }) }]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <BackButton onPress={() => navigation.goBack()} />
            <Text style={{ fontSize: 19, fontWeight: "600", color: C.text }}>{isSelf ? "Mon abonnement" : "Offrir à un proche"}</Text>
          </View>

          {/* Onglets */}
          <View style={{ flexDirection: "row", backgroundColor: C.bgMuted, borderRadius: 14, padding: 3, marginTop: 14 }}>
            {[["self", "Pour moi"], ["gift", "Pour un proche"]].map(([k, label]) => (
              <TouchableOpacity key={k} onPress={() => setTab(k)} activeOpacity={0.8}
                style={[{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 11 }, tab === k && [{ backgroundColor: C.bgCard }, SHADOW]]}>
                <Text style={{ fontSize: 12.5, fontWeight: tab === k ? "600" : "500", color: tab === k ? C.text : C.textMuted }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {isSelf ? (
            <>
              <Field label="Photos par mois"><Value>{SUB_PHOTOS} tirages</Value></Field>
              <Field label="Format"><Value>{SUB_FORMAT_LABEL}, papier brillant</Value></Field>
              <Field label="Adresse de livraison">
                <Input value={myAddress} onChangeText={setMyAddress} editable={!alreadySelf} multiline
                  placeholder="Prénom Nom, rue, code postal, ville" />
              </Field>
              <Field label="Je reçois ma sélection le"><Value>{SUB_SEND_DAY}{SUB_SEND_DAY === 1 ? "er" : ""} de chaque mois</Value></Field>
              <ValidateRow value={myValidate} onToggle={() => setMyValidate((v) => !v)} sub="Sinon, la sélection part toute seule" />
              <Banner icon="🔒" bg={C.sage} color={C.green}>
                Tes photos ne sont envoyées à l'imprimeur qu'après ta validation.
              </Banner>
            </>
          ) : (
            <>
              <Field label="Prénom du proche">
                <Input value={giftName} onChangeText={setGiftName} placeholder="Mamie Odile" autoCapitalize="words" />
              </Field>
              <Field label="Adresse de livraison">
                <Input value={giftAddress} onChangeText={setGiftAddress} multiline placeholder="Prénom Nom, rue, code postal, ville" />
              </Field>
              <Field label="Photos par mois"
                right={<Stepper value={giftCount} onMinus={() => changeCount(-1)} onPlus={() => changeCount(1)}
                  canMinus={SUB_GIFT_CHOICES.indexOf(giftCount) > 0}
                  canPlus={SUB_GIFT_CHOICES.indexOf(giftCount) < SUB_GIFT_CHOICES.length - 1} />}>
                <Value>{SUB_GIFT_CHOICES.join(", ")}</Value>
              </Field>
              <Field label="Petit mot au dos de la 1re photo">
                <Input value={giftMessage} onChangeText={setGiftMessage} multiline maxLength={120}
                  placeholder="« Avec tout mon amour »" style={{ fontStyle: "italic" }} />
              </Field>
              <Banner icon="🎲" bg={C.albumSoft} color={C.album}>
                Photos tirées au hasard dans tes coups de cœur, jamais deux fois les mêmes.
              </Banner>
              <ValidateRow value={giftValidate} onToggle={() => setGiftValidate((v) => !v)} sub="Tu reçois la sélection avant elle" />
            </>
          )}
        </ScrollView>

        {/* Bouton fixe en bas (remonte avec le clavier) */}
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 18 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!!blocked}
            onPress={submit}
            style={[{ height: 50, borderRadius: 25, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", opacity: blocked ? 0.4 : 1 }, !blocked && SHADOW]}
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
              {isSelf ? "S'abonner" : "Offrir"}{price ? ` · ${price} / mois` : ""}
            </Text>
          </TouchableOpacity>
          {!!blocked && (
            <Text style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 8 }}>{blocked}</Text>
          )}
          {!blocked && !isSelf && (
            <Text style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 8 }}>
              {giftName.trim()} n'a rien à installer.
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
