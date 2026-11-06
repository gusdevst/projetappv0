// ─────────────────────────────────────────────
// screens/AuthScreen.js
// Connexion / création de compte par e-mail (maquette validée : maquette-compte-connexion.html).
// 3 états : "signin" · "signup" · "verify" (après création, en attente de confirmation e-mail).
// Apple et Google arrivent aux étapes suivantes : volontairement absents pour l'instant.
// ─────────────────────────────────────────────
import { useState } from "react";
import {
  View, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, StatusBar,
} from "react-native";
import Text from "../components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S, FONT } from "../constants/theme";
import BackButton from "../components/BackButton";
import { signIn, signUp, resendConfirmation, PASSWORD_MIN } from "../services/auth";

export function AuthScreen({ navigation }) {
  const [mode, setMode]         = useState("signin"); // "signin" | "signup" | "verify"
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [info, setInfo]         = useState("");

  const isSignup = mode === "signup";

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setInfo("");
  };

  const validate = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Cet e-mail n'a pas l'air valide.";
    if (isSignup && password.length < PASSWORD_MIN) return `Le mot de passe doit faire ${PASSWORD_MIN} caractères minimum.`;
    if (!password) return "Entre ton mot de passe.";
    return "";
  };

  const submit = async () => {
    if (busy) return;
    const problem = validate();
    if (problem) { setError(problem); return; }
    setBusy(true); setError(""); setInfo("");

    if (isSignup) {
      const res = await signUp(email, password);
      setBusy(false);
      if (!res.ok) { setError(res.message); return; }
      if (res.needsConfirm) { setMode("verify"); return; }
      navigation.goBack(); // compte créé et déjà connecté
      return;
    }

    const res = await signIn(email, password);
    setBusy(false);
    if (!res.ok) { setError(res.message); return; }
    navigation.goBack();
  };

  // État « verify » : l'utilisateur a cliqué le lien dans son mail, on tente la connexion.
  const confirmed = async () => {
    if (busy) return;
    setBusy(true); setError(""); setInfo("");
    const res = await signIn(email, password);
    setBusy(false);
    if (!res.ok) { setError(res.message); return; }
    navigation.goBack();
  };

  const resend = async () => {
    if (busy) return;
    setBusy(true); setError(""); setInfo("");
    const res = await resendConfirmation(email);
    setBusy(false);
    if (!res.ok) { setError(res.message); return; }
    setInfo("Mail renvoyé ✓");
  };

  // ── Petits blocs de style ──────────────────────────────────────────────────
  const fieldBox = {
    height: 50, borderRadius: 14, backgroundColor: C.bgCard, borderWidth: 1,
    borderColor: C.border, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, marginBottom: 10,
  };
  const inputStyle = { flex: 1, fontSize: 15, color: C.text, fontFamily: FONT };
  const mainBtn = {
    height: 52, borderRadius: S.radiusFull, backgroundColor: C.accent,
    alignItems: "center", justifyContent: "center", elevation: 3,
    opacity: busy ? 0.7 : 1,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: S.pad, paddingBottom: 40, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <BackButton accentColor={C.accent} onPress={() => navigation.goBack()} />

          {/* ── État : vérifie ton e-mail ─────────────────────────────── */}
          {mode === "verify" ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 8 }}>
              <View style={{
                width: 84, height: 84, borderRadius: 42, backgroundColor: C.sage,
                alignItems: "center", justifyContent: "center", marginBottom: 18,
              }}>
                <Text style={{ fontSize: 38 }}>✉️</Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: "800", color: C.text, textAlign: "center" }}>
                Regarde ta boîte mail
              </Text>
              <Text style={{ fontSize: 14, color: C.textMid, textAlign: "center", lineHeight: 21, marginTop: 8, marginBottom: 22 }}>
                On t'a envoyé un lien à {email.trim()}. Touche-le pour confirmer ton compte, puis reviens ici.
              </Text>

              <TouchableOpacity onPress={confirmed} disabled={busy} style={[mainBtn, { alignSelf: "stretch" }]}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>J'ai confirmé, continuer</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={resend} disabled={busy}
                style={{
                  alignSelf: "stretch", height: 50, borderRadius: S.radiusFull, marginTop: 10,
                  borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ color: C.textMid, fontWeight: "700", fontSize: 15 }}>Renvoyer le mail</Text>
              </TouchableOpacity>

              {!!error && <Text style={{ color: C.red, fontSize: 13, textAlign: "center", marginTop: 14 }}>{error}</Text>}
              {!!info && <Text style={{ color: C.accent, fontSize: 13, textAlign: "center", marginTop: 14 }}>{info}</Text>}
              <Text style={{ color: C.textMuted, fontSize: 12, textAlign: "center", marginTop: 14 }}>
                Pense à regarder dans tes spams.
              </Text>
            </View>
          ) : (
            /* ── États : connexion / création ────────────────────────── */
            <View style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 26, fontWeight: "800", color: C.text, lineHeight: 30 }}>
                {isSignup ? "Crée ton compte" : "Content de te revoir"}
              </Text>
              <Text style={{ fontSize: 14, color: C.textMid, lineHeight: 21, marginTop: 6, marginBottom: 22 }}>
                {isSignup
                  ? "Ta progression sera sauvegardée, même si tu changes de téléphone."
                  : "Connecte-toi pour retrouver ta progression partout."}
              </Text>

              {/* Onglets Connexion / Créer un compte */}
              <View style={{ flexDirection: "row", backgroundColor: C.bgMuted, borderRadius: S.radiusFull, padding: 4, marginBottom: 14 }}>
                {[["signin", "Connexion"], ["signup", "Créer un compte"]].map(([key, label]) => {
                  const on = mode === key;
                  return (
                    <TouchableOpacity
                      key={key} onPress={() => switchMode(key)}
                      style={{
                        flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: S.radiusFull,
                        backgroundColor: on ? C.bgCard : "transparent",
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "600", color: on ? C.accent : C.textMid }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={fieldBox}>
                <TextInput
                  style={inputStyle}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="E-mail"
                  placeholderTextColor={C.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                />
              </View>
              <View style={fieldBox}>
                <TextInput
                  style={inputStyle}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mot de passe"
                  placeholderTextColor={C.textMuted}
                  secureTextEntry={!showPwd}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  textContentType={isSignup ? "newPassword" : "password"}
                  onSubmitEditing={submit}
                />
                <TouchableOpacity onPress={() => setShowPwd(!showPwd)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ fontSize: 13, color: C.textMuted, fontWeight: "600" }}>{showPwd ? "Cacher" : "Voir"}</Text>
                </TouchableOpacity>
              </View>

              {isSignup && !error && (
                <Text style={{ fontSize: 12, color: C.textMid, marginLeft: 2, marginBottom: 6 }}>
                  {PASSWORD_MIN} caractères minimum.
                </Text>
              )}
              {!!error && <Text style={{ color: C.red, fontSize: 13, marginLeft: 2, marginBottom: 8 }}>{error}</Text>}

              <TouchableOpacity onPress={submit} disabled={busy} style={[mainBtn, { marginTop: 8 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                    {isSignup ? "Créer mon compte" : "Se connecter"}
                  </Text>
                )}
              </TouchableOpacity>

              <Text style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 14, lineHeight: 17 }}>
                {isSignup
                  ? "En créant un compte, tu acceptes nos conditions et notre politique de confidentialité."
                  : "Tu peux aussi utiliser Pellicule sans compte."}
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
