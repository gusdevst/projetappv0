// components/SessionTutoOverlay.js
// Overlay d'accueil affiché UNE SEULE FOIS à la 1re session de chaque mode.
// Il se pose par-dessus l'écran de tri réel (SwipeScreen) pour que l'utilisateur
// voie les vrais boutons derrière le voile pendant qu'on les explique.
//
// Props :
//   visible  → true pour afficher l'overlay
//   mode     → "menage" (tri) | "album" — change le texte et la couleur d'accent
//   onClose  → appelé quand l'utilisateur tape "J'ai compris"

import { View, Text, TouchableOpacity, Modal } from "react-native";
import { C, S } from "../constants/theme";

// Contenu selon le mode. On garde 3 lignes max : court = lu.
const CONTENT = {
  menage: {
    accent: C.accent,
    title: "Bienvenue dans le tri 👋",
    steps: [
      { icon: "👆", text: "Appuie sur un bouton ou swipe la photo pour décider : garder, supprimer ou passer." },
      { icon: "↔️", text: "Chaque direction de swipe correspond à une action. Rapide une fois pris en main." },
      { icon: "⚙️", text: "Le bouton réglages, en haut à droite, te laisse personnaliser chaque swipe." },
    ],
  },
  album: {
    accent: C.album,
    title: "Créons ton album 📁",
    steps: [
      { icon: "👆", text: "Appuie ou swipe pour ajouter la photo à l'album, ou la passer." },
      { icon: "📁", text: "Le badge de l'album, en haut, montre les photos déjà ajoutées." },
      { icon: "⚙️", text: "Le bouton réglages, en haut à droite, te laisse personnaliser chaque swipe." },
    ],
  },
};

export function SessionTutoOverlay({ visible, mode = "menage", onClose }) {
  const data = CONTENT[mode] ?? CONTENT.menage;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.78)",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: C.bgCard,
            borderRadius: S.radiusLg,
            padding: 24,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: "900",
              color: C.text,
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            {data.title}
          </Text>

          {data.steps.map((step, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 26 }}>{step.icon}</Text>
              <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: C.textMid }}>
                {step.text}
              </Text>
            </View>
          ))}

          <TouchableOpacity
            onPress={onClose}
            style={{
              marginTop: 8,
              backgroundColor: data.accent,
              borderRadius: S.radius,
              paddingVertical: 15,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>J'ai compris</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
