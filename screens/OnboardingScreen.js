// screens/OnboardingScreen.js
// Premier lancement : explique le concept de l'app et déclenche la demande de permission.
// Slides simples — pas de carousel complexe, juste un index local.

import { useState } from "react";
import { View, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import Text from "../components/AppText";
import Logo from "../components/Logo";
import Icon from "../components/Icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { useNotificationReminder } from "../hooks/useNotificationReminder";
import { SwipeDemo } from "../components/SwipeDemo";

const SLIDES = [
  {
    // Première slide : le logo remplace l'emoji
    logo: true,
    title: "Bienvenue sur Pellicule",
    desc: "Tes souvenirs méritent mieux. On va t'aider à trier ta photothèque sans douleur.",
  },
  {
    demo: "swipe", // mini-écran de tri avec les actions sur les bords
    title: "Swipe ou clic pour décider",
    desc: "Swipe la photo vers une action, ou clique directement sur l'action écrite au bord. Comme pendant le tri.",
  },
  {
    tile: { icon: "heart", bg: C.redSoft, color: C.red, filled: true },
    title: "Coup de cœur",
    desc: "Appuie sur le bouton ❤️ pendant le tri pour ajouter une photo à tes coups de cœur. Retrouve-les dans l'onglet Galerie.",
  },
  {
    tile: { icon: "bell", bg: C.sage, color: C.accent },
    notif: true, // slide qui déclenche la demande d'autorisation des notifications
    title: "Des rappels pour avancer",
    desc: "Configure la fréquence (quotidien, 2x/jour, hebdo…) et l'heure de tes rappels. Choisis ton rythme de session — Rapide (10 photos), Normal (30) ou Sérieux (50) — et Pellicule t'indique combien de sessions il reste pour tout trier.",
  },
  {
    tile: { icon: "flame", bg: "#fbe9da", color: "#c4621c", filled: true }, // orange de la série 🔥 (hors palette)
    title: "Fais grimper ta série",
    desc: "Trie au moins 10 photos par jour pour faire grimper ta série 🔥. Un joker par semaine te pardonne un oubli. Suis ta progression et ton temps de tri dans l'onglet Progression.",
  },
  {
    tile: { icon: "album", bg: C.albumSoft, color: C.album },
    title: "Créer un album",
    desc: "Touche le bouton central pour passer en mode Album, sélectionne des photos et regroupe-les dans un album souvenir.",
  },
  {
    tile: { icon: "lock", bg: C.sage, color: C.accent },
    title: "Tes photos restent privées",
    desc: "Tout se passe sur ton téléphone. Pellicule n'envoie aucune photo sur un serveur.",
  },
];

// Tuile illustrée : icône au trait sur fond doux + quelques confettis.
function SlideTile({ icon, bg, color, filled }) {
  const dot = (size, style, op) => (
    <View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: op }, style]} />
  );
  return (
    <View style={{ width: 130, height: 130, borderRadius: 38, backgroundColor: bg, alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
      {dot(11, { top: 16, right: 20 }, 0.25)}
      {dot(8, { bottom: 20, left: 18 }, 0.2)}
      {dot(6, { top: 28, left: 24 }, 0.3)}
      <Icon name={icon} size={62} color={color} strokeWidth={1.8} filled={filled} />
    </View>
  );
}

export function OnboardingScreen() {
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const requestPermission = usePhotoStore((s) => s.requestPermission);
  const loadLibrary = usePhotoStore((s) => s.loadLibrary);
  const { enableReminders, markPromptSeen } = useNotificationReminder();

  const isLast = idx === SLIDES.length - 1;
  const slide = SLIDES[idx];

  const onNext = async () => {
    // Slide rappels → on demande l'autorisation des notifications
    if (slide.notif) {
      setLoading(true);
      const result = await enableReminders("daily"); // demande la permission + programme un rappel quotidien
      markPromptSeen(); // on a posé la question : on ne la reposera plus ailleurs
      setLoading(false);
      if (!result.success && result.reason === "permission_denied") {
        Alert.alert(
          "Notifications désactivées",
          "Pas de souci ! Tu pourras activer tes rappels quand tu veux depuis le menu Rappels de l'application.",
          [{ text: "Compris", onPress: () => setIdx(idx + 1) }]
        );
        return;
      }
      setIdx(idx + 1);
      return;
    }
    if (!isLast) {
      setIdx(idx + 1);
      return;
    }
    // Dernière slide → demande de permission + chargement
    setLoading(true);
    const status = await requestPermission();
    if (status === "granted") {
      await loadLibrary();
    }
    setLoading(false);
    // La navigation vers Home / PermissionDenied est gérée par AppNavigator
    // qui réagit au changement de `permission` dans le store.
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
        {slide.logo ? (
          <View style={{ marginBottom: 24 }}><Logo size={110} /></View>
        ) : slide.demo === "swipe" ? (
          <SwipeDemo style={{ marginBottom: 24 }} />
        ) : (
          <SlideTile {...slide.tile} />
        )}
        <Text style={{ fontSize: 26, fontWeight: "600", color: C.text, textAlign: "center", marginBottom: 10 }}>
          {slide.title}
        </Text>
        <Text style={{ fontSize: 15, color: C.textMuted, textAlign: "center", lineHeight: 22 }}>
          {slide.desc}
        </Text>
      </View>

      {/* Indicateur de position */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 24 }}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === idx ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === idx ? C.accent : C.sage2,
            }}
          />
        ))}
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        <TouchableOpacity
          onPress={onNext}
          disabled={loading}
          style={{
            backgroundColor: C.accent,
            borderRadius: 16,
            padding: 17,
            alignItems: "center",
            opacity: loading ? 0.6 : 1,
            shadowColor: C.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
              {isLast ? "Autoriser l'accès aux photos" : slide.notif ? "Activer les rappels" : "Continuer"}
            </Text>
          )}
        </TouchableOpacity>
        {isLast && (
          <Text style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 12 }}>
            Pellicule a besoin d'accéder à ta photothèque pour fonctionner.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

export default OnboardingScreen;
