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
import AddressInput from "../components/AddressInput";
import { SHADOW } from "../components/home/ui";
import { C, FONT } from "../constants/theme";
import {
  SUB_PHOTOS, SUB_GIFT_CHOICES, SUB_FORMAT_LABEL, SUB_SEND_DAY, SUB_VALIDATE_BY, SUB_PRODUCTS, SUB_PRICES, priceLabelFor,
} from "../constants/subscription";
import SubDaysFields from "../components/SubDaysFields";
import { useSubscriptionStore } from "../store/useSubscriptionStore";
import { useAuthStore } from "../store/useAuthStore";
import { requestPermission } from "../services/notificationService";
import { refreshSubscriptionNotifications } from "../services/subscriptionNotifications";

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

// Choix du type d'envoi : tirages photo ou magnets.
function ProductPicker({ value, onChange }) {
  const from = (k) => {
    const labels = Object.values(SUB_PRICES[k]);
    return k === "prints" ? `dès ${labels[0]} / mois` : `${labels[0]} / mois`;
  };
  return (
    <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
      {["prints", "magnets"].map((k) => {
        const p = SUB_PRODUCTS[k];
        const on = value === k;
        return (
          <TouchableOpacity key={k} onPress={() => onChange(k)} activeOpacity={0.85}
            style={[{ flex: 1, borderRadius: 16, padding: 12, backgroundColor: on ? C.sage : C.bgCard, borderWidth: 2, borderColor: on ? C.accent : "transparent" }, SHADOW]}>
            <Text style={{ fontSize: 22 }}>{k === "prints" ? "🖼️" : "🧲"}</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: C.text, marginTop: 4 }}>{p.label}</Text>
            <Text style={{ fontSize: 11, color: C.textMid, marginTop: 1 }}>{p.tagline}</Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: C.accent, marginTop: 6 }}>{from(k)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function SubscriptionSetupScreen({ navigation, route }) {
  const [tab, setTab] = useState(route.params?.kind === "gift" ? "gift" : "self");

  const subs    = useSubscriptionStore((s) => s.subs);
  const addSub  = useSubscriptionStore((s) => s.addSub);
  const session = useAuthStore((s) => s.session);
  const alreadySelf = subs.some((x) => x.kind === "self" && x.status !== "cancelled");

  const [product, setProduct] = useState("prints"); // type d'envoi : "prints" | "magnets"
  // « Pour moi »
  const [myRecipient, setMyRecipient]   = useState("");   // nom sur l'enveloppe
  const [myAddress, setMyAddress]       = useState("");   // choisie dans les suggestions, ou saisie à la main
  const [myComplement, setMyComplement] = useState("");   // bâtiment, étage… (facultatif)
  const [myValidate, setMyValidate]     = useState(true);
  const [myDays, setMyDays]             = useState({ selectionDay: SUB_SEND_DAY, sendDay: SUB_VALIDATE_BY });
  // « Pour un proche »
  const [giftName, setGiftName]       = useState("");
  const [giftRecipient, setGiftRecipient]   = useState(""); // facultatif : vide = le prénom
  const [giftAddress, setGiftAddress]       = useState("");
  const [giftComplement, setGiftComplement] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftCount, setGiftCount]     = useState(10);
  const [giftValidate, setGiftValidate] = useState(true);
  const [giftDays, setGiftDays]         = useState({ selectionDay: SUB_SEND_DAY, sendDay: SUB_VALIDATE_BY });

  const isSelf = tab === "self";
  const prod   = SUB_PRODUCTS[product];
  const count  = prod.fixedCount ?? (isSelf ? SUB_PHOTOS : giftCount);
  const price  = priceLabelFor(count, product);

  // Pourquoi le bouton est grisé (affiché sous le bouton).
  let blocked = null;
  if (isSelf) {
    if (alreadySelf) blocked = "Tu as déjà cet abonnement.";
    else if (myRecipient.trim().length < 3) blocked = "Ajoute ton nom pour l'enveloppe.";
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

  async function submit() {
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
    // Adresse = ligne principale, + 2ᵉ ligne si complément (la 1re ligne sert d'aperçu dans l'app).
    const full = (main, complement) => (complement.trim() ? `${main.trim()}\n${complement.trim()}` : main.trim());
    addSub(isSelf
      ? { kind: "self", userId: session.user.id, recipient: myRecipient.trim(), address: full(myAddress, myComplement), product, count, validateEach: myValidate, ...myDays }
      : { kind: "gift", userId: session.user.id, name: giftName.trim(), recipient: giftRecipient.trim() || giftName.trim(), address: full(giftAddress, giftComplement), message: giftMessage.trim(), product, count, validateEach: giftValidate, ...giftDays }
    );
    // Pour prévenir le 1er du mois que la sélection est prête : on demande la permission ici,
    // au bon moment, puis on programme la notification.
    try {
      if (await requestPermission()) await refreshSubscriptionNotifications();
    } catch (e) { /* pas de notification : l'abonnement est enregistré quand même */ }
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

          <ProductPicker value={product} onChange={setProduct} />

          {isSelf ? (
            <>
              <Field label={product === "magnets" ? "Magnets par mois" : "Photos par mois"}><Value>{count} {prod.units}</Value></Field>
              <Field label="Format"><Value>{product === "magnets" ? "5 × 5 cm, aimantés, carrés" : `${SUB_FORMAT_LABEL}, papier brillant`}</Value></Field>
              <Field label="Nom sur l'enveloppe">
                <Input value={myRecipient} onChangeText={setMyRecipient} editable={!alreadySelf} placeholder="Prénom Nom" autoCapitalize="words" />
              </Field>
              <Field label="Adresse de livraison">
                <AddressInput value={myAddress} onChange={setMyAddress} editable={!alreadySelf}
                  placeholder="Commence à taper ton adresse" />
              </Field>
              <Field label="Complément d'adresse (facultatif)">
                <Input value={myComplement} onChangeText={setMyComplement} editable={!alreadySelf} placeholder="Bâtiment, étage, code porte…" />
              </Field>
              <SubDaysFields {...myDays} onChange={setMyDays} />
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
              <Field label="Nom sur l'enveloppe (facultatif)">
                <Input value={giftRecipient} onChangeText={setGiftRecipient} placeholder={giftName.trim() || "Prénom Nom"} autoCapitalize="words" />
              </Field>
              <Field label="Adresse de livraison">
                <AddressInput value={giftAddress} onChange={setGiftAddress} placeholder="Commence à taper son adresse" />
              </Field>
              <Field label="Complément d'adresse (facultatif)">
                <Input value={giftComplement} onChangeText={setGiftComplement} placeholder="Bâtiment, étage, code porte…" />
              </Field>
              {product === "magnets" ? (
                <>
                  <Field label="Magnets par mois"><Value>{count} {prod.units}</Value></Field>
                  <Field label="Format"><Value>5 × 5 cm, aimantés, carrés</Value></Field>
                </>
              ) : (
                <Field label="Photos par mois"
                  right={<Stepper value={giftCount} onMinus={() => changeCount(-1)} onPlus={() => changeCount(1)}
                    canMinus={SUB_GIFT_CHOICES.indexOf(giftCount) > 0}
                    canPlus={SUB_GIFT_CHOICES.indexOf(giftCount) < SUB_GIFT_CHOICES.length - 1} />}>
                  <Value>{SUB_GIFT_CHOICES.join(", ")}</Value>
                </Field>
              )}
              <Field label={product === "magnets" ? "Petit mot glissé dans l'envoi" : "Petit mot au dos de la 1re photo"}>
                <Input value={giftMessage} onChangeText={setGiftMessage} multiline maxLength={120}
                  placeholder="« Avec tout mon amour »" style={{ fontStyle: "italic" }} />
              </Field>
              <Banner icon="🎲" bg={C.albumSoft} color={C.album}>
                Photos tirées au hasard dans tes coups de cœur, jamais deux fois les mêmes.
              </Banner>
              <SubDaysFields {...giftDays} onChange={setGiftDays} />
              <ValidateRow value={giftValidate} onToggle={() => setGiftValidate((v) => !v)} sub="Tu reçois la sélection avant elle" />
            </>
          )}

          {/* Information sur les données personnelles (RGPD : à donner au moment où on les collecte) */}
          <View style={{ marginTop: 16, paddingHorizontal: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: C.textMid }}>Tes données</Text>
            <Text style={{ fontSize: 11, color: C.textMuted, lineHeight: 16, marginTop: 3 }}>
              Pour imprimer et expédier tes {prod.units}, Pellicule envoie les photos de ta sélection, le nom et l'adresse de livraison
              à son imprimeur. Ces données servent uniquement à préparer ta commande et sont supprimées après l'impression.
              Tu peux demander leur suppression à tout moment.
              {isSelf ? "" : ` En offrant cet abonnement, tu confirmes avoir l'accord de ${giftName.trim() || "ton proche"} pour donner son adresse.`}
            </Text>
          </View>
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
