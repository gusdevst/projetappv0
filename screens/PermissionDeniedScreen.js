// screens/PermissionDeniedScreen.js
// Affiché si l'utilisateur a refusé l'accès aux photos.
// iOS ne re-déclenche pas le prompt système après un refus — il faut passer par les Réglages.

import { View, Text, TouchableOpacity, Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";

export function PermissionDeniedScreen() {
  const checkPermission = usePhotoStore((s) => s.checkPermission);
  const loadLibrary = usePhotoStore((s) => s.loadLibrary);

  const openSettings = () => {
    Linking.openSettings();
  };

  // Quand l'utilisateur revient des Réglages, on revérifie la permission.
  // Si elle a été accordée entretemps, AppNavigator route automatiquement vers Home.
  const recheck = async () => {
    const status = await checkPermission();
    if (status === "granted") await loadLibrary();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ fontSize: 88, marginBottom: 24 }}>📷</Text>
        <Text style={{ fontSize: 24, fontWeight: "900", color: C.text, textAlign: "center", marginBottom: 12 }}>
          Accès aux photos refusé
        </Text>
        <Text style={{ fontSize: 15, color: C.textMuted, textAlign: "center", lineHeight: 22, marginBottom: 8 }}>
          Phototri a besoin d'accéder à ta photothèque pour fonctionner. Tu peux activer l'accès dans les réglages de ton téléphone.
        </Text>
        <Text style={{ fontSize: 13, color: C.textMuted, textAlign: "center", marginTop: 12 }}>
          {Platform.OS === "ios"
            ? "Réglages → Phototri → Photos → Toutes les photos"
            : "Paramètres → Apps → Phototri → Autorisations → Photos"}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 32, gap: 12 }}>
        <TouchableOpacity
          onPress={openSettings}
          style={{ backgroundColor: C.accent, borderRadius: S.radius, padding: 18, alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>Ouvrir les réglages</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={recheck}
          style={{ backgroundColor: C.bgCard, borderRadius: S.radius, padding: 16, alignItems: "center", borderWidth: 1, borderColor: C.border }}
        >
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 14 }}>J'ai activé l'accès, revérifier</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default PermissionDeniedScreen;
