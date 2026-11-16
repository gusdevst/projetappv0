// screens/AddressesScreen.js
// « Mes adresses » (Réglages) : les adresses de livraison du compte. Ajouter, modifier, supprimer, choisir celle « par défaut »
// (reprise automatiquement à chaque commande). Données : services/addresses.js (table `addresses`).
// La modification d'une adresse ne change jamais une commande déjà passée (la commande en garde une copie).

import { useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import AddressForm, { EMPTY_ADDRESS_FORM } from "../components/AddressForm";
import { Toggle } from "../components/Toggle";
import { SHADOW } from "../components/home/ui";
import { C, S } from "../constants/theme";
import { useAuthStore } from "../store/useAuthStore";
import { useAddresses } from "../hooks/useAddresses";
import { accountPhone } from "../services/auth";
import { saveAddress, deleteAddress, setDefaultAddress, validateAddressForm, addressLine } from "../services/addresses";

export function AddressesScreen({ navigation }) {
  const session = useAuthStore((s) => s.session);
  const signedIn = !!session;
  const myPhone = accountPhone(session) ?? "";
  const { addresses, loading, error, reload } = useAddresses(navigation, signedIn);
  const [editing, setEditing] = useState(null); // null = liste · { id?, form, makeDefault } = formulaire
  const [busy, setBusy] = useState(false);

  const openNew = () => setEditing({ id: null, form: { ...EMPTY_ADDRESS_FORM, phone: myPhone, label: addresses.length ? "" : "Chez moi" }, makeDefault: addresses.length === 0 });
  const openEdit = (a) => setEditing({
    id: a.id, makeDefault: a.isDefault,
    form: { label: a.label, name: a.name, line: addressLine(a), complement: a.complement, phone: a.phone },
  });

  async function submit() {
    const res = validateAddressForm(editing.form, { needLabel: true });
    if (res.error) { Alert.alert("Adresse à compléter", res.error); return; }
    setBusy(true);
    try {
      await saveAddress({ ...res.value, id: editing.id }, { makeDefault: editing.makeDefault });
      await reload();
      setEditing(null);
    } catch (e) {
      Alert.alert("Adresse non enregistrée", "Vérifie ta connexion et réessaie.");
    } finally { setBusy(false); }
  }

  function confirmDelete(a) {
    Alert.alert(`Supprimer « ${a.label} » ?`, "Les commandes déjà passées gardent leur adresse de livraison.", [
      { text: "Garder", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => {
        try { await deleteAddress(a.id); await reload(); } catch (e) { Alert.alert("Suppression impossible", "Vérifie ta connexion et réessaie."); }
      } },
    ]);
  }

  async function makeDefault(a) {
    try { await setDefaultAddress(a.id); await reload(); } catch (e) { Alert.alert("Changement impossible", "Vérifie ta connexion et réessaie."); }
  }

  const back = () => (editing ? setEditing(null) : navigation.goBack());

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingTop: 8, paddingBottom: 12 }}>
          <BackButton accentColor={C.album} onPress={back} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, color: C.textMuted }}>Réglages</Text>
            <Text style={{ fontSize: 19, fontWeight: "600", color: C.text }}>{editing ? (editing.id ? "Modifier l'adresse" : "Nouvelle adresse") : "Mes adresses"}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: S.pad, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {!signedIn && (
            <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 18, ...SHADOW }}>
              <Text style={{ fontSize: 14, color: C.text, lineHeight: 20 }}>Tes adresses sont enregistrées dans ton compte. Connecte-toi pour les retrouver.</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Auth")}
                style={{ height: 48, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center", marginTop: 14 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14.5 }}>Me connecter</Text>
              </TouchableOpacity>
            </View>
          )}

          {signedIn && !editing && (
            <>
              {loading && <ActivityIndicator color={C.album} style={{ marginTop: 30 }} />}
              {!loading && !!error && (
                <View style={{ backgroundColor: C.albumSoft, borderRadius: 14, padding: 12, marginBottom: 12 }}>
                  <Text style={{ fontSize: 12.5, color: C.text, lineHeight: 18 }}>Impossible de lire tes adresses (connexion ?).</Text>
                  <TouchableOpacity onPress={reload}><Text style={{ fontSize: 12.5, fontWeight: "700", color: C.album, marginTop: 6 }}>Réessayer</Text></TouchableOpacity>
                </View>
              )}
              {!loading && !error && addresses.length === 0 && (
                <Text style={{ fontSize: 13, color: C.textMid, lineHeight: 19, textAlign: "center", marginVertical: 24 }}>
                  Aucune adresse enregistrée.{"\n"}Ajoutes-en une : elle sera reprise à chaque commande.
                </Text>
              )}
              {addresses.map((a) => (
                <View key={a.id} style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, marginBottom: 12, ...SHADOW }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{a.label}</Text>
                    {a.isDefault && (
                      <View style={{ backgroundColor: C.sage, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9.5, fontWeight: "700", letterSpacing: 0.6, color: C.accent }}>PAR DÉFAUT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: C.textMid, lineHeight: 19, marginTop: 4 }}>
                    {a.name}{"\n"}{addressLine(a)}{a.complement ? `\n${a.complement}` : ""}{"\n"}{a.phone}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 18, marginTop: 10 }}>
                    <TouchableOpacity onPress={() => openEdit(a)}><Text style={{ fontSize: 12.5, fontWeight: "700", color: C.album }}>Modifier</Text></TouchableOpacity>
                    {!a.isDefault && <TouchableOpacity onPress={() => makeDefault(a)}><Text style={{ fontSize: 12.5, fontWeight: "700", color: C.album }}>Mettre par défaut</Text></TouchableOpacity>}
                    <TouchableOpacity onPress={() => confirmDelete(a)}><Text style={{ fontSize: 12.5, fontWeight: "700", color: C.textMuted }}>Supprimer</Text></TouchableOpacity>
                  </View>
                </View>
              ))}
              {!loading && (
                <TouchableOpacity onPress={openNew}
                  style={{ flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderStyle: "dashed", borderColor: C.album, borderRadius: 16, padding: 14 }}>
                  <Text style={{ color: C.album, fontWeight: "700", fontSize: 14 }}>＋ Ajouter une adresse</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {signedIn && !!editing && (
            <>
              <AddressForm value={editing.form} onChange={(p) => setEditing((e) => ({ ...e, form: { ...e.form, ...p } }))} showLabel labelPlaceholder="Chez Maman" />
              {addresses.length > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 2, marginBottom: 14 }}>
                  <Toggle value={editing.makeDefault} onToggle={() => setEditing((e) => ({ ...e, makeDefault: !e.makeDefault }))} color={C.album} />
                  <Text style={{ flex: 1, fontSize: 13, color: C.text }}>Adresse par défaut (reprise à chaque commande)</Text>
                </View>
              )}
              <TouchableOpacity disabled={busy} onPress={submit}
                style={{ height: 52, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center", elevation: 3, opacity: busy ? 0.5 : 1 }}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Enregistrer</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
