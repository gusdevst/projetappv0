// screens/JoinAlbumScreen.js
// « Rejoindre un album » (Réglages ; maquette Claude outputs/maquette-album-partage.html, écran 4).
// L'invité tape le code de 6 caractères reçu dans le message de son proche, avec son prénom.
//   · Pas de compte : le code est mis de côté (useSharedStore.pendingCode), on l'envoie créer son compte / se connecter,
//     puis il retrouve son code ici et n'a plus qu'à toucher « Rejoindre ».
//   · Code bon : l'album devient la cible de l'accueil mode Album (bannière « Tu as rejoint … »).

import { useState, useRef, useEffect } from "react";
import { View, TextInput, TouchableOpacity, Pressable, ScrollView, Keyboard, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { C, S, FONT } from "../constants/theme";
import { useAuthStore } from "../store/useAuthStore";
import { useSharedStore } from "../store/useSharedStore";
import { usePhotoStore } from "../store/usePhotoStore";
import { accountFirstName, rememberFirstName, joinAlbum, cleanCode, CODE_LENGTH } from "../services/sharedAlbums";

export function JoinAlbumScreen({ navigation }) {
  const session = useAuthStore((s) => s.session);
  const pendingCode = useSharedStore((s) => s.pendingCode);
  const setPendingCode = useSharedStore((s) => s.setPendingCode);
  const setTarget = useSharedStore((s) => s.setTarget);
  const setHomeMode = usePhotoStore((s) => s.setHomeMode);

  const [code, setCode] = useState(cleanCode(pendingCode));
  const [name, setName] = useState(accountFirstName(session) ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  // Le compte vient d'être créé / connecté : on reprend le prénom s'il est connu.
  useEffect(() => { if (session && !name) setName(accountFirstName(session) ?? ""); }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const complete = code.length === CODE_LENGTH;
  const canGo = complete && !busy && (!session || name.trim().length > 0);

  const goSignIn = () => {
    setPendingCode(code);
    navigation.navigate("Auth");
  };

  const submit = async () => {
    if (!canGo) return;
    if (!session) { goSignIn(); return; }
    Keyboard.dismiss();
    setBusy(true); setError("");
    const res = await joinAlbum(code, name);
    setBusy(false);
    if (!res.ok) { setError(res.message); return; }
    if (name.trim() !== accountFirstName(session)) rememberFirstName(name);
    setPendingCode("");
    setTarget({ id: res.album.id, name: res.album.name, ownerName: res.album.ownerName });
    setHomeMode("album");
    navigation.navigate("Main", { screen: "Home" });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
          <BackButton accentColor={C.album} onPress={() => navigation.goBack()} />
          <Text style={{ fontWeight: "600", fontSize: 20, color: C.text }}>Rejoindre un album</Text>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: S.pad, paddingBottom: 30 }}>
          <View style={{ alignItems: "center", marginTop: 14 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 34 }}>📬</Text>
            </View>
            <Text style={{ fontWeight: "600", fontSize: 19, color: C.text, marginTop: 14 }}>Tape le code reçu</Text>
            <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 4, textAlign: "center" }}>6 caractères, dans le message de ton proche.</Text>
          </View>

          {/* Le code : 6 cases ; un seul champ invisible par-dessus reçoit la frappe (et le collage). */}
          <Pressable onPress={() => inputRef.current?.focus()} style={{ marginTop: 22 }}>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
              {Array.from({ length: CODE_LENGTH }).map((_, i) => {
                const current = i === code.length && !busy;
                return (
                  <View key={i} style={{
                    width: 46, height: 58, borderRadius: 13, backgroundColor: C.bgCard, alignItems: "center", justifyContent: "center",
                    borderWidth: 2, borderColor: current ? C.album : error ? C.red + "88" : C.border,
                  }}>
                    <Text style={{ fontSize: 26, fontWeight: "700", color: C.album }}>{code[i] ?? ""}</Text>
                  </View>
                );
              })}
            </View>
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(t) => { setCode(cleanCode(t)); setError(""); }}
              autoFocus
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              maxLength={14}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: "transparent" }}
            />
          </Pressable>

          {!!error && <Text style={{ fontSize: 13, color: C.red, textAlign: "center", marginTop: 14, lineHeight: 19 }}>{error}</Text>}

          {/* Prénom : affiché au propriétaire de l'album (demandé seulement une fois connecté) */}
          {session && (
            <View style={{ marginTop: 24 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: C.textMuted, marginBottom: 6 }}>TON PRÉNOM</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Comment doit-il t'appeler ?"
                placeholderTextColor={C.textMuted}
                autoCapitalize="words"
                maxLength={30}
                returnKeyType="go"
                onSubmitEditing={submit}
                style={{ backgroundColor: C.bgCard, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text, fontFamily: FONT }}
              />
              <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 6 }}>Ce prénom s'affichera chez le propriétaire de l'album.</Text>
            </View>
          )}

          {!session && (
            <Text style={{ fontSize: 12.5, color: C.textMuted, textAlign: "center", marginTop: 22, lineHeight: 18 }}>
              Il faut un compte Pellicule pour rejoindre un album.{"\n"}On garde ton code pendant que tu en crées un.
            </Text>
          )}
        </ScrollView>

        <View style={{ paddingHorizontal: S.pad, paddingBottom: 14, paddingTop: 6 }}>
          <TouchableOpacity
            onPress={submit}
            disabled={!canGo}
            activeOpacity={0.85}
            style={{
              alignItems: "center", borderRadius: 999, paddingVertical: 14,
              backgroundColor: canGo ? C.album : C.border,
              // Android : pas d'ombre quand le bouton est grisé (ombre + fond clair = rectangle gris)
              ...(canGo ? { shadowColor: C.album, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 3 } : {}),
            }}
          >
            {busy
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ fontSize: 15, fontWeight: "600", color: canGo ? "#fff" : C.textMuted }}>
                  {session ? "Rejoindre l'album" : "Créer mon compte ou me connecter"}
                </Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
