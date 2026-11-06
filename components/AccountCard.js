// components/AccountCard.js
// Carte « Ton compte » en haut des Réglages (maquette : maquette-compte-connexion.html).
// Pas connecté → invitation à se connecter. Connecté → e-mail + « Se déconnecter ».
import { View, TouchableOpacity, Alert } from "react-native";
import Text from "./AppText";
import { C, S } from "../constants/theme";
import { useAuthStore } from "../store/useAuthStore";
import { signOut } from "../services/auth";

export function AccountCard({ navigation }) {
  const session = useAuthStore((s) => s.session);
  const user = session?.user;

  // Pas connecté
  if (!user) {
    return (
      <View style={{
        backgroundColor: C.sage, borderRadius: S.radius, borderWidth: 1, borderColor: C.sage2,
        padding: 16, marginTop: 8,
      }}>
        <Text style={{ fontWeight: "800", fontSize: 16, color: C.text }}>👤 Ton compte</Text>
        <Text style={{ fontSize: 13, color: C.textMid, lineHeight: 19, marginTop: 4, marginBottom: 14 }}>
          Connecte-toi pour retrouver ta progression, tes albums et tes séries sur tous tes appareils.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Auth")}
          style={{
            height: 48, borderRadius: S.radiusFull, backgroundColor: C.accent,
            alignItems: "center", justifyContent: "center", elevation: 3,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Se connecter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Connecté
  const email = user.email ?? "";
  const confirmLogout = () =>
    Alert.alert("Se déconnecter ?", "Tes photos et ta progression restent sur ce téléphone.", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => signOut() },
    ]);

  return (
    <View style={{
      backgroundColor: C.bgCard, borderRadius: S.radius, borderWidth: 1, borderColor: C.border,
      padding: 16, marginTop: 8,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{
          width: 48, height: 48, borderRadius: 24, backgroundColor: C.sage2,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ color: C.accent, fontWeight: "800", fontSize: 20 }}>
            {email.charAt(0).toUpperCase() || "?"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontWeight: "700", fontSize: 15, color: C.text }}>{email}</Text>
          <Text style={{ fontSize: 12, color: C.textMid, marginTop: 2 }}>Connecté avec e-mail</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={confirmLogout}
        style={{
          height: 44, borderRadius: S.radiusFull, borderWidth: 1.5, borderColor: C.border,
          alignItems: "center", justifyContent: "center", marginTop: 14,
        }}
      >
        <Text style={{ color: C.textMid, fontWeight: "700", fontSize: 14 }}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
}
