// screens/SharedSendScreen.js
// Fin du tri pour un album PARTAGÉ avec moi : « Envoyer N photos à <prénom> » (maquette Claude outputs/maquette-album-partage.html, écrans 6 à 8).
//   · PRÊT      : les photos choisies, la case d'accord (obligatoire : les photos quittent le téléphone, avec date et lieu),
//                 « Envoyer » ou « Plus tard » (la sélection reste de côté, l'accueil la rappelle).
//   · ENVOI     : barre « 21 sur 34 ». L'envoi tourne en arrière-plan (services/sharedUpload.js) : on peut quitter l'écran,
//                 et il reprend tout seul s'il est interrompu (réseau, appli fermée).
//   · TERMINÉ   : « C'est envoyé ».
// L'état vient de useSharedStore (selections / outbox / upload) : l'écran n'est qu'un affichage.

import { useState, useMemo } from "react";
import { View, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import Icon from "../components/Icons";
import { C } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { useSharedStore } from "../store/useSharedStore";
import { startSending, runOutbox } from "../services/sharedUpload";

const frNum = (n) => n.toLocaleString("fr-FR");
const plural = (n, w) => `${frNum(n)} ${w}${n > 1 ? "s" : ""}`;

export function SharedSendScreen({ navigation, route }) {
  const album = route.params?.sharedAlbum;
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const selection = useSharedStore((s) => s.selections[album?.id]);
  const outbox = useSharedStore((s) => s.outbox[album?.id]);
  const upload = useSharedStore((s) => (s.upload?.albumId === album?.id ? s.upload : null));
  const removeFromSelection = useSharedStore((s) => s.removeFromSelection);
  const [agreed, setAgreed] = useState(false);

  const ids = selection?.ids ?? [];
  const urlById = useMemo(() => new Map(libraryPhotos.map((p) => [p.id, p.url])), [libraryPhotos]);
  const owner = album?.ownerName ?? "";

  const goHome = () => navigation.navigate("Main", { screen: "Home" });

  const running = !!upload?.running;
  const waiting = (outbox?.ids?.length ?? 0) > 0;
  const phase = running ? "sending" : ids.length > 0 ? "ready" : waiting ? "sending" : upload?.finished ? "done" : "empty";

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 }}>
      <BackButton mode="album" onPress={() => (navigation.canGoBack() ? navigation.goBack() : goHome())} />
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 17, fontWeight: "600", color: C.text }}>{album?.name ?? "Album partagé"}</Text>
    </View>
  );

  // ── PRÊT ──
  if (phase === "ready") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {header}
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
          <Text style={{ fontSize: 24, fontWeight: "600", color: C.text }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: C.album }}>{plural(ids.length, "photo")}</Text>
            {` pour ${owner}`}
          </Text>
          <Text style={{ fontSize: 13.5, color: C.textMuted, marginTop: 4, lineHeight: 19 }}>
            {`Ces photos iront dans la boîte aux lettres de ${owner}. ${owner} choisira lesquelles garder : tes originales restent sur ton téléphone.`}
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
            {ids.map((id) => (
              <View key={id} style={{ width: "32%", aspectRatio: 1, borderRadius: 10, overflow: "hidden", backgroundColor: C.albumSoft }}>
                {urlById.get(id) && <Image source={{ uri: urlById.get(id) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
                <TouchableOpacity onPress={() => removeFromSelection(album.id, id)} hitSlop={8}
                  style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="close" size={12} color="#fff" strokeWidth={2.4} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>Touche ✕ pour retirer une photo de l'envoi.</Text>

          {/* Accord : obligatoire */}
          <TouchableOpacity onPress={() => setAgreed((a) => !a)} activeOpacity={0.8}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 20, backgroundColor: C.albumSoft, borderRadius: 14, padding: 14 }}>
            <View style={{
              width: 24, height: 24, borderRadius: 7, marginTop: 1, borderWidth: 2, borderColor: C.album,
              backgroundColor: agreed ? C.album : "transparent", alignItems: "center", justifyContent: "center",
            }}>
              {agreed && <Icon name="check" size={14} color="#fff" strokeWidth={3} />}
            </View>
            <Text style={{ flex: 1, fontSize: 13.5, color: C.text, lineHeight: 19 }}>
              {`J'envoie ces photos à ${owner}, avec leur date et leur lieu de prise de vue. ${owner} pourra les garder ou les refuser.`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={!agreed}
            onPress={() => startSending(album)}
            activeOpacity={0.85}
            style={{ marginTop: 18, backgroundColor: agreed ? C.album : C.border, borderRadius: 16, paddingVertical: 14, alignItems: "center" }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: agreed ? "#fff" : C.textMuted }}>{`Envoyer ${plural(ids.length, "photo")} à ${owner}`}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={goHome} style={{ marginTop: 12, paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: C.textMuted }}>Plus tard (je les garde de côté)</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── ENVOI ──
  if (phase === "sending") {
    const total = upload?.total ?? outbox?.total ?? 0;
    const done = upload?.done ?? Math.max(0, total - (outbox?.ids?.length ?? 0));
    const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
    const error = !running ? upload?.error : null;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {header}
        <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
          <Text style={{ fontSize: 22, fontWeight: "600", color: C.text, textAlign: "center" }}>{`Envoi à ${owner}…`}</Text>
          <Text style={{ fontSize: 15, color: C.textMuted, textAlign: "center", marginTop: 6 }}>
            <Text style={{ fontWeight: "700", color: C.album }}>{frNum(done)}</Text>{` sur ${frNum(total)}`}
          </Text>
          <View style={{ height: 10, borderRadius: 6, backgroundColor: C.bgMuted, overflow: "hidden", marginTop: 18 }}>
            <View style={{ height: 10, width: `${pct}%`, backgroundColor: C.album, borderRadius: 6 }} />
          </View>

          {running ? (
            <View style={{ alignItems: "center", marginTop: 22, gap: 10 }}>
              <ActivityIndicator color={C.album} />
              <Text style={{ fontSize: 13, color: C.textMuted, textAlign: "center", lineHeight: 19 }}>
                Tu peux quitter cet écran : l'envoi continue tant que Pellicule est ouvert, et reprend tout seul s'il est interrompu.
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: "center", marginTop: 22, gap: 12 }}>
              <Text style={{ fontSize: 13.5, color: C.red, textAlign: "center", lineHeight: 19 }}>{error ?? "L'envoi est en pause."}</Text>
              <TouchableOpacity onPress={() => runOutbox(album.id)} style={{ backgroundColor: C.album, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 }}>
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14.5 }}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity onPress={goHome} style={{ marginTop: 26, alignItems: "center", paddingVertical: 10 }}>
            <Text style={{ fontSize: 14, color: C.textMuted }}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── TERMINÉ / RIEN À ENVOYER ──
  const done = phase === "done";
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {header}
      <View style={{ flex: 1, padding: 24, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}>
          <Icon name={done ? "check" : "mail"} size={30} color={C.album} strokeWidth={2.4} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: "600", color: C.text, marginTop: 16, textAlign: "center" }}>
          {done ? "C'est envoyé !" : "Rien à envoyer"}
        </Text>
        <Text style={{ fontSize: 14, color: C.textMuted, marginTop: 8, textAlign: "center", lineHeight: 20 }}>
          {done
            ? `${plural(upload.total - (upload.skipped ?? 0), "photo")} attend${upload.total - (upload.skipped ?? 0) > 1 ? "ent" : ""} dans la boîte aux lettres de ${owner}.${upload.skipped ? `\n${plural(upload.skipped, "photo")} introuvable${upload.skipped > 1 ? "s" : ""} sur ce téléphone : non envoyée${upload.skipped > 1 ? "s" : ""}.` : ""}`
            : "Choisis des photos en swipant vers le haut : elles seront envoyées ici."}
        </Text>
        <TouchableOpacity onPress={goHome} style={{ marginTop: 24, backgroundColor: C.album, borderRadius: 14, paddingHorizontal: 26, paddingVertical: 13 }}>
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
