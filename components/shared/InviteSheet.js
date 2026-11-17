// components/shared/InviteSheet.js
// Feuille « Invite tes proches » (maquette Claude outputs/maquette-album-partage.html, écran 2) : s'ouvre par le bas
// depuis la page d'un album. Elle :
//   · demande d'être connecté (sinon renvoie vers la connexion) et le prénom, une seule fois ;
//   · crée le partage sur Supabase (ou retrouve celui qui existe) → le CODE à 6 caractères ;
//   · « Partager l'invitation » ouvre la feuille de partage du téléphone avec un message prêt ;
//   · « Changer le code » (l'ancien ne marche plus) ;
//   · liste « DÉJÀ DANS L'ALBUM » (toi + les invités, « ··· » = retirer).

import { useState, useEffect, useCallback } from "react";
import { View, TouchableOpacity, Pressable, Modal, ScrollView, TextInput, Keyboard, Platform, Share, Alert, ActivityIndicator, useWindowDimensions } from "react-native";
import Text from "../AppText";
import { C, FONT } from "../../constants/theme";
import {
  accountFirstName, rememberFirstName, shareAlbum, fetchMembers, regenerateCode,
  renameSharedAlbum, removeMember, inviteMessage,
} from "../../services/sharedAlbums";

const frDate = (iso) => {
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); } catch (e) { return ""; }
};
const AVATARS = ["#6f9a4b", "#b8653f", "#7a5fa8", "#c4621c", "#4b7a8a"];

export default function InviteSheet({ visible, onClose, album, session, onSignIn, onChanged }) {
  const { height } = useWindowDimensions();
  const [kb, setKb] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [shared, setShared] = useState(null);   // la ligne shared_albums
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => setKb(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKb(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Crée / retrouve le partage, puis lit les invités.
  const load = useCallback(async (ownerName) => {
    setLoading(true); setError(null);
    const res = await shareAlbum({ localAlbumId: album.id, name: album.name, ownerName });
    if (!res.ok) { setLoading(false); setError(res.message); return; }
    if (res.album.name !== album.name) renameSharedAlbum(res.album.id, album.name); // album renommé sur le téléphone
    setShared({ ...res.album, name: album.name });
    setMembers(await fetchMembers(res.album.id));
    setLoading(false);
    onChanged?.();
  }, [album?.id, album?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // À l'ouverture : connecté ? prénom connu ? sinon on s'arrête là et on le demande.
  useEffect(() => {
    if (!visible || !album) return;
    setShared(null); setMembers([]); setError(null);
    if (!session) return;
    const n = accountFirstName(session);
    setFirstName(n ?? ""); setNameDraft("");
    if (n) load(n);
  }, [visible, album?.id, session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitName = async () => {
    const n = nameDraft.trim();
    if (!n) return;
    Keyboard.dismiss();
    setFirstName(n);
    rememberFirstName(n);
    load(n);
  };

  const doShare = async () => {
    if (!shared) return;
    try { await Share.share({ message: inviteMessage(shared.name, shared.code) }); } catch (e) {}
  };

  const doChangeCode = () => {
    Alert.alert(
      "Changer le code ?",
      "L'ancien code ne marchera plus. Les personnes déjà dans l'album restent dans l'album.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Changer le code", onPress: async () => {
            const r = await regenerateCode(shared.id);
            if (r.ok) setShared((s) => ({ ...s, code: r.code }));
            else Alert.alert("Impossible", r.message);
        } },
      ],
    );
  };

  const doRemove = (m) => {
    Alert.alert(
      `Retirer ${m.name} ?`,
      `${m.name} ne pourra plus envoyer de photos à cet album. Les photos déjà envoyées restent dans ta boîte aux lettres.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Retirer", style: "destructive", onPress: async () => {
            const r = await removeMember(shared.id, m.userId);
            if (r.ok) { setMembers((l) => l.filter((x) => x.userId !== m.userId)); onChanged?.(); }
            else Alert.alert("Impossible", r.message);
        } },
      ],
    );
  };

  const needName = !!session && !firstName && !shared && !loading && !error;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(35,39,31,0.4)" }} />
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingBottom: kb > 0 ? kb + 12 : 34, maxHeight: height * 0.88 }}>
          <View style={{ alignItems: "center", paddingTop: 10, marginBottom: 8 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: C.border }} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 6 }}>
            <Text style={{ fontWeight: "600", fontSize: 18, color: C.text }}>Invite tes proches</Text>
            <Text style={{ fontSize: 12.5, color: C.textMuted, marginTop: 3, lineHeight: 18 }}>
              Ils choisissent leurs photos et te les envoient. Tu décides ensuite lesquelles entrent dans l'album.
            </Text>

            {/* 1. Pas connecté */}
            {!session && (
              <View style={{ marginTop: 18 }}>
                <Text style={{ fontSize: 13.5, color: C.text, lineHeight: 20 }}>
                  Pour partager un album, il faut un compte Pellicule : tes proches et toi vous retrouvez ainsi dans le même album.
                </Text>
                <Btn label="Me connecter" onPress={onSignIn} style={{ marginTop: 14 }} />
              </View>
            )}

            {/* 2. Prénom (une seule fois) */}
            {needName && (
              <View style={{ marginTop: 18 }}>
                <Text style={{ fontSize: 13.5, color: C.text, lineHeight: 20 }}>Comment tes proches doivent-ils t'appeler ?</Text>
                <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.albumSoft, borderRadius: 16, padding: 8, paddingLeft: 14 }}>
                  <TextInput
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    placeholder="Ton prénom"
                    placeholderTextColor={C.textMuted}
                    autoCapitalize="words"
                    returnKeyType="go"
                    onSubmitEditing={submitName}
                    maxLength={30}
                    style={{ flex: 1, fontSize: 15, color: C.text, fontFamily: FONT, paddingVertical: 6 }}
                  />
                  <TouchableOpacity
                    disabled={!nameDraft.trim()} onPress={submitName} activeOpacity={0.85}
                    style={{ backgroundColor: nameDraft.trim() ? C.album : C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: nameDraft.trim() ? "#fff" : C.textMuted }}>Continuer</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 8 }}>Ce prénom s'affichera chez les personnes que tu invites.</Text>
              </View>
            )}

            {/* 3. Chargement / erreur */}
            {session && loading && !shared && (
              <View style={{ paddingVertical: 36, alignItems: "center" }}><ActivityIndicator color={C.album} /></View>
            )}
            {session && error && (
              <View style={{ marginTop: 18 }}>
                <Text style={{ fontSize: 13.5, color: C.red, lineHeight: 20 }}>{error}</Text>
                <Btn label="Réessayer" onPress={() => load(firstName || nameDraft.trim())} style={{ marginTop: 12 }} />
              </View>
            )}

            {/* 4. Le code */}
            {shared && (
              <>
                <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: C.textMuted, marginTop: 18 }}>CODE DE L'ALBUM</Text>
                <View style={{ flexDirection: "row", justifyContent: "center", gap: 7, marginTop: 8 }}>
                  {shared.code.split("").map((ch, i) => (
                    <View key={i} style={{ width: 42, height: 52, borderRadius: 12, backgroundColor: C.bgCard, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 24, fontWeight: "700", color: C.album }}>{ch}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity onPress={doChangeCode} activeOpacity={0.7} style={{ alignSelf: "center", marginTop: 10, marginBottom: 14, padding: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: C.album }}>Changer le code</Text>
                </TouchableOpacity>
                <Btn label="Partager l'invitation" onPress={doShare} />

                <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: C.textMuted, marginTop: 20, marginBottom: 8 }}>DÉJÀ DANS L'ALBUM</Text>
                <Row letter={(firstName || "T")[0].toUpperCase()} color={AVATARS[0]} title="Toi" sub="Propriétaire" />
                {members.map((m, i) => (
                  <Row
                    key={m.userId}
                    letter={(m.name || "?")[0].toUpperCase()}
                    color={AVATARS[(i + 1) % AVATARS.length]}
                    title={m.name}
                    sub={`A rejoint le ${frDate(m.joinedAt)} · ${m.sent} photo${m.sent > 1 ? "s" : ""} envoyée${m.sent > 1 ? "s" : ""}`}
                    onMore={() => doRemove(m)}
                  />
                ))}
                {members.length === 0 && (
                  <Text style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4, lineHeight: 18 }}>
                    Personne n'a encore rejoint l'album. Partage l'invitation pour commencer.
                  </Text>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Btn({ label, onPress, style }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}
      style={[{ alignItems: "center", backgroundColor: C.album, borderRadius: 999, paddingVertical: 13,
        shadowColor: C.album, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 3 }, style]}>
      <Text style={{ fontSize: 14.5, fontWeight: "600", color: "#fff" }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Row({ letter, color, title, sub, onMore }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.bgCard, borderRadius: 14, padding: 10, marginBottom: 6 }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{letter}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{title}</Text>
        <Text numberOfLines={1} style={{ fontSize: 11.5, color: C.textMuted }}>{sub}</Text>
      </View>
      {onMore && (
        <TouchableOpacity onPress={onMore} hitSlop={10} style={{ paddingHorizontal: 6 }}>
          <Text style={{ fontSize: 18, color: C.textMuted, fontWeight: "700" }}>···</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
