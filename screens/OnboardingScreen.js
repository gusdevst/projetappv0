// screens/OnboardingScreen.js
// Premier lancement : explique le concept de l'app et déclenche la demande de permission.
// Trois slides simples — pas de carousel complexe, juste un index local.

import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { useNotificationReminder } from "../hooks/useNotificationReminder";

const SLIDES = [
  {
    // Première slide : le logo remplace l'emoji
    logo: true,
    title: "Bienvenue sur Pellicule",
    desc: "Tes souvenirs méritent mieux. On va t'aider à trier ta photothèque sans douleur.",
  },
  {
    emoji: "🔀",
    title: "Swipe pour décider",
    desc: "Glisse à droite pour garder, à gauche pour supprimer, vers le haut pour imprimer. Comme Tinder, mais pour tes photos.",
  },
  {
    emoji: "❤️",
    title: "Coup de cœur",
    desc: "Appuie sur le bouton ❤️ pendant le tri pour ajouter une photo à tes coups de cœur. Retrouve-les dans le menu principal.",
  },
  {
    emoji: "🗂️",
    title: "Créer un album",
    desc: "Choisis le mode Album pour sélectionner des photos et les regrouper dans un album souvenir.",
  },
  {
    emoji: "🔔",
    notif: true, // slide qui déclenche la demande d'autorisation des notifications
    title: "Des rappels pour avancer",
    desc: "Configure la fréquence (quotidien, 2x/jour, hebdo…) et l'heure de tes rappels. Choisis ton rythme de session — Rapide (10 photos), Normal (30) ou Sérieux (50) — et Pellicule t'indique combien de sessions il reste pour tout trier.",
  },
  {
    emoji: "🔒",
    title: "Tes photos restent privées",
    desc: "Tout se passe sur ton téléphone. Pellicule n'envoie aucune photo sur un serveur.",
  },
];

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
          <Image
            source={require("../assets/icon.png")}
            style={{ width: 110, height: 110, borderRadius: 25, marginBottom: 24 }}
          />
        ) : (
          <Text style={{ fontSize: 88, marginBottom: 24 }}>{slide.emoji}</Text>
        )}
        <Text style={{ fontSize: 28, fontWeight: "900", color: C.text, textAlign: "center", marginBottom: 12 }}>
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
              backgroundColor: i === idx ? C.accent : C.border,
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
            borderRadius: S.radius,
            padding: 18,
            alignItems: "center",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
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
