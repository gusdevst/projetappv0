// screens/MailboxSwipeScreen.js
// Boîte aux lettres d'un album partagé : le PROPRIÉTAIRE swipe les photos reçues (maquette Claude outputs/maquette-album-partage.html, écrans 10 à 12).
//   → droite = GARDER (enregistrée dans la photothèque + l'album)      ← gauche = REFUSER (effacée du serveur)
// Pas d'annulation (la décision part aussitôt), pas de suppression ni de partage, rien n'est compté dans la progression.
// Les décisions partent une par une en arrière-plan (file) avec 3 essais ; à la fin on attend que tout soit enregistré.
// Params : { albumId, albumName, localAlbumId, senderId?, senderName? }

import { useState, useEffect, useRef } from "react";
import { View, TouchableOpacity, ActivityIndicator, StatusBar, Platform, Dimensions, Alert } from "react-native";
import Text from "../components/AppText";
import Icon from "../components/Icons";
import { ZoomableImage } from "../components/ZoomableImage";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { photoDateLabel } from "../services/photoDate";
import { fetchMailboxPhotos, keepMailboxPhoto, refuseMailboxPhoto } from "../services/sharedMailbox";

const { width: SW } = Dimensions.get("window");
const GLASS = { backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;

export function MailboxSwipeScreen({ navigation, route }) {
  const { albumId, albumName, localAlbumId, senderId, senderName } = route.params;
  const [photos, setPhotos] = useState(null);   // null = chargement
  const [error, setError] = useState("");
  const [idx, setIdx] = useState(0);
  const [kept, setKept] = useState(0);
  const [refused, setRefused] = useState(0);
  const [failed, setFailed] = useState(0);
  const [inflight, setInflight] = useState(0);  // décisions pas encore enregistrées
  const chain = useRef(Promise.resolve());
  const zoomRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetchMailboxPhotos(albumId, senderId, senderName);
      if (!alive) return;
      if (!res.ok) setError(res.message); else setPhotos(res.photos);
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Les photos gardées doivent apparaître dans la photothèque de l'appli : on la relit quand tout est enregistré.
  const doneAll = photos && idx >= photos.length;
  useEffect(() => {
    if (doneAll && inflight === 0 && kept > 0) usePhotoStore.getState().loadLibrary();
  }, [doneAll, inflight, kept]);

  const decide = (photo, keep) => {
    setInflight((n) => n + 1);
    chain.current = chain.current.then(async () => {
      for (let t = 1; t <= 3; t++) {
        try {
          if (keep) { await keepMailboxPhoto(photo, { localAlbumId, albumName }); setKept((n) => n + 1); }
          else { await refuseMailboxPhoto(photo); setRefused((n) => n + 1); }
          break;
        } catch (e) {
          if (t === 3) setFailed((n) => n + 1); else await wait(1500 * t);
        }
      }
      setInflight((n) => n - 1);
    });
  };

  const photo = photos?.[idx] ?? null;
  const act = (keep) => {
    if (!photo) return;
    decide(photo, keep);
    setIdx((i) => i + 1);
  };
  const fly = (keep) => zoomRef.current?.flyOff(keep ? "right" : "left", () => act(keep));

  const leave = () => navigation.goBack();
  const back = () => {
    if (inflight > 0) { Alert.alert("Enregistrement en cours", "Attends un instant : tes dernières décisions s'enregistrent."); return; }
    leave();
  };

  // ── Chargement / erreur / vide ──
  if (error || photos === null || photos.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 28 }}>
        {error ? (
          <>
            <Text style={{ fontSize: 15, color: C.text, textAlign: "center", lineHeight: 21 }}>{error}</Text>
            <TouchableOpacity onPress={leave} style={{ marginTop: 20, backgroundColor: C.album, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ color: "#fff", fontWeight: "600" }}>Retour</Text>
            </TouchableOpacity>
          </>
        ) : photos === null ? (
          <><ActivityIndicator color={C.album} /><Text style={{ marginTop: 12, color: C.textMuted }}>Ouverture de la boîte aux lettres…</Text></>
        ) : (
          <>
            <Text style={{ fontSize: 17, fontWeight: "600", color: C.text }}>Rien à trier</Text>
            <TouchableOpacity onPress={leave} style={{ marginTop: 20, backgroundColor: C.album, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ color: "#fff", fontWeight: "600" }}>Retour</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  // ── Terminé ──
  if (doneAll) {
    const saving = inflight > 0;
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 28 }}>
        {saving ? <ActivityIndicator color={C.album} /> : (
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}>
            <Icon name="check" size={30} color={C.album} strokeWidth={2.4} />
          </View>
        )}
        <Text style={{ fontSize: 22, fontWeight: "600", color: C.text, marginTop: 16, textAlign: "center" }}>
          {saving ? "Enregistrement…" : "Boîte aux lettres triée !"}
        </Text>
        <Text style={{ fontSize: 14, color: C.textMuted, marginTop: 8, textAlign: "center", lineHeight: 21 }}>
          {`${plural(kept, "photo")} gardée${kept > 1 ? "s" : ""} dans « ${albumName} »\n${plural(refused, "photo")} refusée${refused > 1 ? "s" : ""}`}
          {failed > 0 ? `\n${plural(failed, "photo")} non enregistrée${failed > 1 ? "s" : ""} : elle${failed > 1 ? "s" : ""} reste${failed > 1 ? "nt" : ""} dans la boîte, réessaie plus tard.` : ""}
        </Text>
        <TouchableOpacity disabled={saving} onPress={leave} style={{ marginTop: 24, backgroundColor: saving ? C.border : C.album, borderRadius: 14, paddingHorizontal: 26, paddingVertical: 13 }}>
          <Text style={{ color: saving ? C.textMuted : "#fff", fontWeight: "600", fontSize: 15 }}>Terminer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Swipe ──
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar hidden />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 15, paddingTop: Platform.OS === "android" ? 24 : 52 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={back} style={[GLASS, { borderRadius: S.radiusFull, paddingHorizontal: 12, paddingVertical: 7 }]}>
            <Text style={{ color: "#fff", fontWeight: "500", fontSize: 12.5 }}>← Retour</Text>
          </TouchableOpacity>
          <View style={{ alignItems: "center", maxWidth: SW * 0.5 }}>
            <Text numberOfLines={1} style={{ color: "#fff", fontWeight: "600", fontSize: 13, textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 4 }}>{`De ${photo.senderName}`}</Text>
            <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 11, textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 4 }}>{photoDateLabel(photo)}</Text>
            <Text numberOfLines={1} style={{ color: C.albumSoft, fontSize: 11, fontWeight: "600", marginTop: 2, textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4 }}>{albumName}</Text>
          </View>
          <View style={[GLASS, { paddingHorizontal: 12, paddingVertical: 7, borderRadius: S.radiusFull }]}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "500" }}>{idx + 1} / {photos.length}</Text>
          </View>
        </View>
      </View>

      <ZoomableImage
        ref={zoomRef}
        uri={photo.url}
        onSwipeLeft={() => act(false)}
        onSwipeRight={() => act(true)}
        onSwipeUp={() => {}}
        onSwipeDown={() => {}}
        bounceDirs={["up", "down"]}
      />

      {/* Rappel des gestes */}
      <View pointerEvents="none" style={{ position: "absolute", bottom: 128, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, zIndex: 5 }}>
        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600", letterSpacing: 1.2, opacity: 0.9, textShadowColor: "rgba(0,0,0,0.75)", textShadowRadius: 4 }}>← REFUSER</Text>
        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600", letterSpacing: 1.2, opacity: 0.9, textShadowColor: "rgba(0,0,0,0.75)", textShadowRadius: 4 }}>GARDER →</Text>
      </View>

      <View style={{ position: "absolute", bottom: 40, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 56, zIndex: 10 }}>
        <TouchableOpacity onPress={() => fly(false)} activeOpacity={0.8}
          style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 2, borderColor: "rgba(255,255,255,0.55)", alignItems: "center", justifyContent: "center" }}>
          <Icon name="close" size={26} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => fly(true)} activeOpacity={0.8}
          style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.album, borderWidth: 2, borderColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}>
          <Icon name="check" size={28} color="#fff" strokeWidth={2.6} />
        </TouchableOpacity>
      </View>

      <View pointerEvents="none" style={{ position: "absolute", bottom: 18, left: 48, right: 48, height: 3, borderRadius: 2, zIndex: 10, backgroundColor: "rgba(255,255,255,0.14)" }}>
        <View style={{ height: 3, borderRadius: 2, width: `${Math.round((idx / photos.length) * 100)}%`, backgroundColor: C.albumSoft, opacity: 0.75 }} />
      </View>
    </View>
  );
}
