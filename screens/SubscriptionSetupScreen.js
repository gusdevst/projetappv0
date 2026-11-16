// screens/SubscriptionSetupScreen.js
// Réglage de l'abonnement mensuel « Coups de cœur » — étape 1 : le TYPE d'abonnement (maquette validée, écrans 3 et 4, simplifiés le 16 nov. 2026).
// Deux onglets : « Pour moi » (20 tirages, un seul abonnement) · « Pour un proche » (prénom, petit mot ; autant d'abonnements qu'on veut),
// + dates d'envoi et « Je valide chaque envoi ». L'ADRESSE n'est plus saisie ici : « Continuer » ouvre l'écran d'adresse des commandes
// (BookOrderAddress : adresse du compte déjà enregistrée, ou « offrir à quelqu'un d'autre »), puis SubscriptionRecap (récap, accord, « S'abonner »).
// Même parcours que le livre, le poster et le tirage simple : adresse → récapitulatif → confirmation.

import { useState } from "react";
import { View, ScrollView, TouchableOpacity, TextInput, StatusBar, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { Toggle } from "../components/Toggle";
import { SHADOW } from "../components/home/ui";
import { C, FONT } from "../constants/theme";
import {
  SUB_PHOTOS, SUB_FORMAT_LABEL, SUB_SEND_DAY, SUB_VALIDATE_BY, SUB_PRODUCTS, priceLabelFor,
} from "../constants/subscription";
import SubDaysFields from "../components/SubDaysFields";
import { useSubscriptionStore } from "../store/useSubscriptionStore";

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
      <Toggle value={value} onToggle={onToggle} color={C.album} />
    </View>
  );
}

export function SubscriptionSetupScreen({ navigation, route }) {
  const [tab, setTab] = useState(route.params?.kind === "gift" ? "gift" : "self");

  const subs    = useSubscriptionStore((s) => s.subs);
  const alreadySelf = subs.some((x) => x.kind === "self" && x.status !== "cancelled");

  const product = "prints"; // un seul type d'envoi depuis le 14 nov. 2026 (magnets retirés : archive/magnets/)
  // « Pour moi »
  const [myValidate, setMyValidate]     = useState(true);
  const [myDays, setMyDays]             = useState({ selectionDay: SUB_SEND_DAY, sendDay: SUB_VALIDATE_BY });
  // « Pour un proche »
  const [giftName, setGiftName]       = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftValidate, setGiftValidate] = useState(true);
  const [giftDays, setGiftDays]         = useState({ selectionDay: SUB_SEND_DAY, sendDay: SUB_VALIDATE_BY });

  const isSelf = tab === "self";
  const prod   = SUB_PRODUCTS[product];
  const count  = prod.fixedCount ?? SUB_PHOTOS;
  const price  = priceLabelFor(count, product);

  // Pourquoi le bouton est grisé (affiché sous le bouton).
  let blocked = null;
  if (isSelf) {
    if (alreadySelf) blocked = "Tu as déjà cet abonnement.";
  } else {
    if (giftName.trim().length < 2) blocked = "Ajoute le prénom de ton proche.";
    else if (!price) blocked = "Le prix n'est pas encore fixé.";
  }

  // Étape suivante : l'adresse (celle du compte, ou celle du proche), puis le récapitulatif. Si on n'est pas connecté,
  // l'écran d'adresse propose de se connecter d'abord.
  function next() {
    const setup = isSelf
      ? { kind: "self", product, count, validateEach: myValidate, ...myDays }
      : { kind: "gift", name: giftName.trim(), message: giftMessage.trim(), product, count, validateEach: giftValidate, ...giftDays };
    navigation.navigate("BookOrderAddress", { nextScreen: "SubscriptionRecap", what: "abonnement", startForm: !isSelf, nextParams: { setup } });
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
              <Field label="Photos par mois"><Value>{count} {prod.units}</Value></Field>
              <Field label="Format"><Value>{`${SUB_FORMAT_LABEL}, papier brillant`}</Value></Field>
              <SubDaysFields {...myDays} onChange={setMyDays} />
              <ValidateRow value={myValidate} onToggle={() => setMyValidate((v) => !v)} sub="Sinon, la sélection part toute seule" />
              <Banner icon="📍" bg={C.albumSoft} color={C.album}>
                Étape suivante : l'adresse de livraison (celle de ton compte). Tes photos ne partent qu'après ta validation chaque mois.
              </Banner>
            </>
          ) : (
            <>
              <Field label="Prénom du proche">
                <Input value={giftName} onChangeText={setGiftName} placeholder="Mamie Odile" autoCapitalize="words" />
              </Field>
              <Field label="Tirages par mois"><Value>{count} {prod.units}</Value></Field>
              <Field label="Format"><Value>{SUB_FORMAT_LABEL}, papier brillant</Value></Field>
              <Field label="Petit mot au dos de la 1re photo">
                <Input value={giftMessage} onChangeText={setGiftMessage} multiline maxLength={120}
                  placeholder="« Avec tout mon amour »" style={{ fontStyle: "italic" }} />
              </Field>
              <Banner icon="🎲" bg={C.albumSoft} color={C.album}>
                Photos tirées au hasard dans tes coups de cœur, jamais deux fois les mêmes.
              </Banner>
              <SubDaysFields {...giftDays} onChange={setGiftDays} />
              <ValidateRow value={giftValidate} onToggle={() => setGiftValidate((v) => !v)} sub="Tu reçois la sélection avant elle" />
              <Banner icon="📍" bg={C.albumSoft} color={C.album}>
                Étape suivante : le nom et l'adresse de {giftName.trim() || "ton proche"}.
              </Banner>
            </>
          )}

        </ScrollView>

        {/* Bouton fixe en bas (remonte avec le clavier) */}
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 18 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!!blocked}
            onPress={next}
            style={[{ height: 50, borderRadius: 25, backgroundColor: C.album, alignItems: "center", justifyContent: "center", opacity: blocked ? 0.4 : 1 }, !blocked && SHADOW]}
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
              Continuer{price ? ` · ${price} / mois` : ""}
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
