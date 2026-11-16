// components/AddressForm.js
// Formulaire d'adresse de livraison, partagé par l'écran de commande et « Mes adresses » (Réglages).
// Champs : nom du destinataire · adresse (suggestions en tapant) · complément · téléphone · (nom de l'adresse).
// Le parent garde la valeur : <AddressForm value={form} onChange={(patch) => setForm({ ...form, ...patch })} />
// Validation et découpage de l'adresse : services/addresses.js (validateAddressForm).

import { View, TextInput } from "react-native";
import Text from "./AppText";
import AddressInput from "./AddressInput";
import { C, FONT } from "../constants/theme";

function Field({ label, hint, children }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 11.5, fontWeight: "600", color: C.textMid, marginBottom: 5, marginLeft: 3 }}>
        {label}{!!hint && <Text style={{ fontWeight: "400", color: C.textMuted }}>{`  ·  ${hint}`}</Text>}
      </Text>
      <View style={{ backgroundColor: C.bgMuted, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 }}>{children}</View>
    </View>
  );
}

const inputStyle = { fontFamily: FONT, fontSize: 14, color: C.text, paddingVertical: 2 };

export default function AddressForm({ value, onChange, showLabel = false, labelPlaceholder = "Chez moi" }) {
  return (
    <View>
      {showLabel && (
        <Field label="Nom de l'adresse">
          <TextInput value={value.label} onChangeText={(label) => onChange({ label })} maxLength={30}
            placeholder={labelPlaceholder} placeholderTextColor={C.textMuted} style={inputStyle} />
        </Field>
      )}
      <Field label="Prénom et nom du destinataire">
        <TextInput value={value.name} onChangeText={(name) => onChange({ name })} maxLength={60}
          placeholder="Camille Martin" placeholderTextColor={C.textMuted}
          autoComplete="name" textContentType="name" style={inputStyle} />
      </Field>
      <Field label="Adresse" hint="France">
        <AddressInput value={value.line} onChange={(line) => onChange({ line })} placeholder="12 rue des Lilas, 59000 Lille" />
      </Field>
      <Field label="Complément" hint="facultatif">
        <TextInput value={value.complement} onChangeText={(complement) => onChange({ complement })} maxLength={80}
          placeholder="Bâtiment, étage, code…" placeholderTextColor={C.textMuted} style={inputStyle} />
      </Field>
      <Field label="Téléphone" hint="pour le livreur">
        <TextInput value={value.phone} onChangeText={(phone) => onChange({ phone })} maxLength={20}
          placeholder="06 12 34 56 78" placeholderTextColor={C.textMuted} keyboardType="phone-pad"
          autoComplete="tel" textContentType="telephoneNumber" style={inputStyle} />
      </Field>
    </View>
  );
}

export const EMPTY_ADDRESS_FORM = { label: "", name: "", line: "", complement: "", phone: "" };
