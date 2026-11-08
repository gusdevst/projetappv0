// screens/OnboardingScreen.js
// Premier lancement : explique l'app, propose les rappels et le compte, puis demande l'accès aux photos.
// Les pages (textes, visuels) viennent de constants/tutorialSlides.js — les mêmes que Réglages → Tutoriel.
// Pas de carousel complexe : juste un index local.

import { useState } from "react";
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import Text from "../components/AppText";
import { SlideContent } from "../components/TutorialSlide";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../constants/theme";
import { TUTORIAL_SLIDES } from "../constants/tutorialSlides";
import { usePhotoStore } from "../store/usePhotoStore";
import { useAuthStore } from "../store/useAuthStore";
import { useNotificationReminder } from "../hooks/useNotificationReminder";

const SLIDES = TUTORIAL_SLIDES;

export function OnboardingScreen({ navigation }) {
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const requestPermission = usePhotoStore((s) => s.requestPermission);
  const loadLibrary = usePhotoStore((s) => s.loadLibrary);
  const session = useAuthStore((s) => s.session);
  const { enableReminders, markPromptSeen } = useNotificationReminder();

  const slide = SLIDES[idx];
  const accountDone = !!slide.account && !!session; // compte déjà créé / connecté → on continue simplement
  const next = () => setIdx((i) => i + 1);

  const onMain = async () => {
    // Page rappels → on demande l'autorisation des notifications
    if (slide.notif) {
      setLoading(true);
      const result = await enableReminders("daily"); // demande la permission + programme un rappel quotidien
      markPromptSeen(); // on a posé la question : on ne la reposera plus ailleurs
      setLoading(false);
      if (!result.success && result.reason === "permission_denied") {
        Alert.alert(
          "Notifications désactivées",
          "Pas de souci ! Tu pourras activer tes rappels quand tu veux depuis le menu Rappels de l'application.",
          [{ text: "Compris", onPress: next }]
        );
        return;
      }
      next();
      return;
    }
    // Page compte → écran de connexion / création ; au retour on reste sur cette page (le bouton devient « Continuer »)
    if (slide.account && !session) {
      navigation.navigate("Auth");
      return;
    }
    // Dernière page → demande de permission + chargement
    if (slide.final) {
      setLoading(true);
      const status = await requestPermission();
      if (status === "granted") {
        await loadLibrary();
      }
      setLoading(false);
      // La navigation vers Home / PermissionDenied est gérée par AppNavigator
      // qui réagit au changement de `permission` dans le store.
      return;
    }
    next();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <SlideContent slide={slide} />
      </ScrollView>

      {/* Indicateur de position */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 20 }}>
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

      <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <TouchableOpacity
          onPress={onMain}
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
              {accountDone ? "Continuer" : slide.cta || "Continuer"}
            </Text>
          )}
        </TouchableOpacity>

        {/* « Plus tard » : on passe la page sans rien activer (pas de demande d'autorisation) */}
        {!!slide.later && !accountDone && (
          <TouchableOpacity onPress={next} disabled={loading} hitSlop={{ top: 8, bottom: 8, left: 20, right: 20 }} style={{ alignItems: "center", marginTop: 14 }}>
            <Text style={{ fontSize: 14.5, fontWeight: "600", color: C.accent }}>{slide.later}</Text>
          </TouchableOpacity>
        )}
        {!!slide.foot && (
          <Text style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 12 }}>{slide.foot}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

export default OnboardingScreen;
