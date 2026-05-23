//─────────────────────────────────────────────
// screens/SettingsScreen.js
// ─────────────────────────────────────────────
import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, StatusBar, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { RowSetting } from "../components/RowSetting";
import { usePhotoStore } from "../store/usePhotoStore";

// Métadonnées des actions de swipe configurables (clé partagée avec SwipeScreen)
const SWIPE_ACTIONS = [
  { key: "skip",     label: "Passer",       desc: "Aucune action, la photo reviendra plus tard", emoji: "⏭" },
  { key: "delete",   label: "Supprimer",    desc: "Envoyer dans la corbeille",                   emoji: "🗑" },
  { key: "album",    label: "Album",        desc: "Ajouter à la pile à imprimer",                emoji: "🖨" },
  { key: "favorite", label: "Coup de cœur", desc: "Ajouter aux favoris",                         emoji: "❤️" },
  { key: "none",     label: "Désactivée",   desc: "Rien ne se passe, la photo rebondit",         emoji: "🚫" },
];

// Les 4 directions affichées dans Settings
const DIRECTIONS = [
  { key: "up",    label: "Vers le haut",   emoji: "↑" },
  { key: "down",  label: "Vers le bas",    emoji: "↓" },
  { key: "left",  label: "Vers la gauche", emoji: "←" },
  { key: "right", label: "Vers la droite", emoji: "→" },
];

const getActionMeta = (key) => SWIPE_ACTIONS.find((a) => a.key === key) || SWIPE_ACTIONS[0];

export function SettingsScreen({ navigation }) {
  const [showPremium, setShowPremium] = useState(false);

  // Direction en cours de configuration (null = modal fermée)
  const [editingDirection, setEditingDirection] = useState(null);

  const swipeMappings      = usePhotoStore((s) => s.swipeMappings);
  const setSwipeMapping    = usePhotoStore((s) => s.setSwipeMapping);
  const resetSwipeMappings = usePhotoStore((s) => s.resetSwipeMappings);

  const comingSoon = (feature) =>
    Alert.alert("Bientôt disponible", `${feature} arrive très vite 🌸`);

  const handlePickAction = (actionKey) => {
    if (!editingDirection) return;
    setSwipeMapping(editingDirection, actionKey);
    setEditingDirection(null);
  };

  const confirmReset = () => {
    Alert.alert(
      "Réinitialiser",
      "Remettre les directions de swipe par défaut ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Réinitialiser", style: "destructive", onPress: () => resetSwipeMappings() },
      ]
    );
  };

  const Section = ({ title }) => (
    <Text style={{ fontSize: 11, fontWeight: "800", color: C.textMuted, letterSpacing: 1.5, marginTop: 24, marginBottom: 10, textTransform: "uppercase" }}>{title}</Text>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.textMuted, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: "900", fontSize: 22, color: C.text }}>Paramètres</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.pad, paddingBottom: 40 }}>
        {/* Banner Premium */}
        <TouchableOpacity onPress={() => setShowPremium(true)} style={{ backgroundColor: C.accent, borderRadius: S.radius, padding: 18, marginTop: 8, marginBottom: 4, flexDirection: "row", alignItems: "center", gap: 14, elevation: 4 }}>
          <Text style={{ fontSize: 32 }}>⭐</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "900", fontSize: 16, color: "#fff" }}>Phototri Premium</Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,.8)", marginTop: 2 }}>IA illimitée · Albums HD · Sans pub</Text>
          </View>
          <View style={{ backgroundColor: "rgba(255,255,255,.25)", borderRadius: S.radiusFull, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>2,99 €/mois</Text>
          </View>
        </TouchableOpacity>

        {/* Notifications, Suppression auto, Assistant IA : masqués pour le MVP — */}
        {/* à réactiver quand expo-notifications + scheduling + backend IA seront en place. */}

        <Section title="Tri par swipe" />
        <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 10, marginTop: -4, lineHeight: 17 }}>
          Choisis ce que fait chaque direction de swipe sur l'écran de tri. Les boutons (cœur, corbeille, album) gardent leur action quoi qu'il arrive.
        </Text>
        {DIRECTIONS.map((dir) => {
          const action = getActionMeta(swipeMappings?.[dir.key] ?? "none");
          return (
            <RowSetting
              key={dir.key}
              emoji={dir.emoji}
              label={dir.label}
              desc={`${action.emoji}  ${action.label}`}
              onPress={() => setEditingDirection(dir.key)}
              right={<Text style={{ color: C.textMuted, fontSize: 18 }}>›</Text>}
            />
          );
        })}
        <TouchableOpacity
          onPress={confirmReset}
          style={{
            alignSelf: "flex-end",
            paddingHorizontal: 12,
            paddingVertical: 6,
            marginTop: 4,
          }}
        >
          <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: "700" }}>
            ↺ Réinitialiser
          </Text>
        </TouchableOpacity>

        <Section title="Compte" />
        <RowSetting emoji="💬" label="Nous contacter" desc="Support & feedback" onPress={() => comingSoon("Le formulaire de contact")} right={<Text style={{ color: C.textMuted }}>›</Text>} />
        <RowSetting emoji="⭐" label="Noter l'app" desc="5 étoiles ça aide vraiment 🙏" onPress={() => comingSoon("La note dans le store")} right={<Text style={{ color: C.textMuted }}>›</Text>} />
        <RowSetting emoji="🔒" label="Politique de confidentialité" onPress={() => comingSoon("La page de confidentialité")} right={<Text style={{ color: C.textMuted }}>›</Text>} />

        <Text style={{ textAlign: "center", color: C.textMuted, fontSize: 11, marginTop: 24 }}>Phototri v1.0.0 · Fait avec 🌸 en France</Text>
      </ScrollView>

      {/* Modal Premium */}
      <Modal
        visible={showPremium}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPremium(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(60,20,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.bgCard, borderRadius: S.radiusLg, padding: S.padLg, paddingBottom: 44 }}>
            <Text style={{ fontSize: 28, textAlign: "center", marginBottom: 8 }}>⭐</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: C.text, textAlign: "center", marginBottom: 4 }}>Phototri Premium</Text>
            <Text style={{ fontSize: 14, color: C.textMuted, textAlign: "center", marginBottom: 24 }}>Essai gratuit 7 jours, puis 2,99 €/mois</Text>
            {[
              { emoji: "🧠", label: "IA illimitée",      desc: "Conseils et améliorations sans limite" },
              { emoji: "📸", label: "Albums HD",          desc: "Export haute résolution" },
              { emoji: "🚫", label: "Sans publicité",     desc: "Expérience 100% propre" },
              { emoji: "⚡", label: "Priorité support",   desc: "Réponse en moins de 24h" },
            ].map(f => (
              <View key={f.label} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <Text style={{ fontSize: 22 }}>{f.emoji}</Text>
                <View>
                  <Text style={{ fontWeight: "700", fontSize: 14, color: C.text }}>{f.label}</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted }}>{f.desc}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity
              onPress={() => {
                setShowPremium(false);
                Alert.alert("Bientôt disponible", "Phototri Premium arrive bientôt 🌸 Merci de ton intérêt — on te tient au courant !");
              }}
              style={{ backgroundColor: C.accent, borderRadius: S.radius, padding: 16, alignItems: "center", marginTop: 8, elevation: 4 }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>Commencer l'essai gratuit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPremium(false)} style={{ marginTop: 14, alignItems: "center" }}>
              <Text style={{ color: C.textMuted, fontSize: 14 }}>Non merci</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal — picker d'action pour une direction de swipe */}
      <Modal
        visible={!!editingDirection}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingDirection(null)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(60,20,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: S.radiusLg, borderTopRightRadius: S.radiusLg, padding: S.padLg, paddingBottom: 40 }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: C.text, marginBottom: 4 }}>
              {editingDirection ? DIRECTIONS.find((d) => d.key === editingDirection)?.label : ""}
            </Text>
            <Text style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
              Quelle action ce swipe déclenche-t-il ?
            </Text>

            {SWIPE_ACTIONS.map((a) => {
              const isSelected = swipeMappings?.[editingDirection] === a.key;
              return (
                <TouchableOpacity
                  key={a.key}
                  onPress={() => handlePickAction(a.key)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: 14,
                    backgroundColor: isSelected ? `${C.accent}15` : "transparent",
                    borderRadius: S.radius,
                    borderWidth: 1,
                    borderColor: isSelected ? C.accent : C.border,
                    marginBottom: 8,
                  }}
                >
                  <View style={{ width: 36, height: 36, backgroundColor: C.bgMuted, borderRadius: S.radiusSm, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 18 }}>{a.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "700", fontSize: 14, color: C.text }}>{a.label}</Text>
                    <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{a.desc}</Text>
                  </View>
                  {isSelected && (
                    <Text style={{ color: C.accent, fontSize: 18, fontWeight: "900" }}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              onPress={() => setEditingDirection(null)}
              style={{ marginTop: 8, alignItems: "center", paddingVertical: 10 }}
            >
              <Text style={{ color: C.textMuted, fontSize: 14 }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}