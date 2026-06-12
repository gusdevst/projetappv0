//─────────────────────────────────────────────
// screens/SettingsScreen.js
// ─────────────────────────────────────────────
import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, StatusBar, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { RowSetting } from "../components/RowSetting";
import { usePhotoStore } from "../store/usePhotoStore";
import { scheduleReminder, requestPermission } from "../services/notificationService";

// ── Données de configuration ──────────────────────────────────────────────────

const SWIPE_ACTIONS = [
  { key: "skip",     label: "Passer",              desc: "Aucune action, la photo reviendra plus tard", emoji: "⏭" },
  { key: "delete",   label: "Supprimer",           desc: "Envoyer dans la corbeille",                   emoji: "🗑" },
  { key: "album",    label: "Album",               desc: "Ajouter à la pile à imprimer",                emoji: "🖨" },
  { key: "favorite", label: "Coup de cœur",        desc: "Ajouter aux favoris",                         emoji: "❤️" },
  { key: "hesitate", label: "Je déciderai plus tard", desc: "Mettre de côté pour décider ensuite",      emoji: "🤔" },
  { key: "none",     label: "Désactivée",          desc: "Rien ne se passe, la photo rebondit",         emoji: "🚫" },
];

const DIRECTIONS = [
  { key: "up",    label: "Swipe vers le haut",   emoji: "↑" },
  { key: "down",  label: "Swipe vers le bas",    emoji: "↓" },
  { key: "left",  label: "Swipe vers la gauche", emoji: "←" },
  { key: "right", label: "Swipe vers la droite", emoji: "→" },
];

const NOTIF_OPTIONS = [
  { key: "off",        label: "Désactivées",            desc: "Aucun rappel",                    emoji: "🔕" },
  { key: "daily",      label: "Quotidien",              desc: "Un rappel toutes les 24h",         emoji: "📅" },
  { key: "every2days", label: "Tous les 2 jours",       desc: "Un rappel toutes les 48h",         emoji: "🔔" },
  { key: "weekly",     label: "Hebdomadaire",           desc: "Un rappel toutes les semaines",    emoji: "📆" },
];

const getActionMeta = (key) => SWIPE_ACTIONS.find((a) => a.key === key) || SWIPE_ACTIONS[0];

// ── Composant ─────────────────────────────────────────────────────────────────

export function SettingsScreen({ navigation }) {
  const [showPremium, setShowPremium]           = useState(false);
  const [menageExpanded, setMenageExpanded]     = useState(false);
  const [albumExpanded, setAlbumExpanded]       = useState(false);
  // editingSwipe = { mode: "menage"|"album", direction: string } | null
  const [editingSwipe, setEditingSwipe]         = useState(null);
  const [notifLoading, setNotifLoading]         = useState(false);

  const swipeMappingsMenage     = usePhotoStore((s) => s.swipeMappingsMenage);
  const swipeMappingsAlbum      = usePhotoStore((s) => s.swipeMappingsAlbum);
  const setSwipeMapping         = usePhotoStore((s) => s.setSwipeMapping);
  const resetSwipeMappings      = usePhotoStore((s) => s.resetSwipeMappings);
  const notificationFrequency   = usePhotoStore((s) => s.notificationFrequency);
  const setNotificationFrequency = usePhotoStore((s) => s.setNotificationFrequency);

  const comingSoon = (feature) =>
    Alert.alert("Bientôt disponible", `${feature} arrive très vite 🌸`);

  // ── Swipe settings ─────────────────────────────────────────────────────────
  const handlePickAction = (actionKey) => {
    if (!editingSwipe) return;
    setSwipeMapping(editingSwipe.mode, editingSwipe.direction, actionKey);
    setEditingSwipe(null);
  };

  const confirmReset = (swipeMode) => {
    Alert.alert(
      "Réinitialiser",
      `Remettre les directions de swipe "${swipeMode === "menage" ? "Ménage" : "Album"}" par défaut ?`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Réinitialiser", style: "destructive", onPress: () => resetSwipeMappings(swipeMode) },
      ]
    );
  };

  // ── Notifications ──────────────────────────────────────────────────────────
  const handleSetFrequency = async (freq) => {
    // Si l'utilisateur veut activer les notifs, on vérifie la permission d'abord
    if (freq !== "off") {
      setNotifLoading(true);
      const granted = await requestPermission();
      setNotifLoading(false);

      if (!granted) {
        Alert.alert(
          "Permission refusée",
          "Pour recevoir des rappels, active les notifications pour Phototri dans tes Réglages.",
          [{ text: "OK" }]
        );
        return;
      }
    }

    // Enregistre dans le store (persisté) et programme le rappel
    setNotificationFrequency(freq);
    const result = await scheduleReminder(freq);

    if (freq !== "off" && !result.success) {
      Alert.alert("Erreur", "Impossible de programmer le rappel. Réessaie dans un moment.");
      setNotificationFrequency("off");
    }
  };

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const Section = ({ title }) => (
    <Text style={{
      fontSize: 11, fontWeight: "800", color: C.textMuted,
      letterSpacing: 1.5, marginTop: 24, marginBottom: 10,
      textTransform: "uppercase",
    }}>
      {title}
    </Text>
  );

  // Résumé des directions pour l'en-tête du menu réduit
  const makeSummary = (mappings) => DIRECTIONS.map((dir) => {
    const action = getActionMeta(mappings?.[dir.key] ?? "none");
    return `${dir.emoji} ${action.emoji}`;
  }).join("  ");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* En-tête */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 12,
        padding: S.pad, paddingBottom: 8,
      }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            backgroundColor: C.bgCard, borderRadius: S.radiusFull,
            paddingHorizontal: 14, paddingVertical: 8,
            borderWidth: 1, borderColor: C.border,
          }}
        >
          <Text style={{ color: C.textMuted, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: "900", fontSize: 22, color: C.text }}>Paramètres</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.pad, paddingBottom: 40 }}>

        {/* Banner Premium */}
        <TouchableOpacity
          onPress={() => setShowPremium(true)}
          style={{
            backgroundColor: C.accent, borderRadius: S.radius,
            padding: 18, marginTop: 8, marginBottom: 4,
            flexDirection: "row", alignItems: "center", gap: 14, elevation: 4,
          }}
        >
          <Text style={{ fontSize: 32 }}>⭐</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "900", fontSize: 16, color: "#fff" }}>Phototri Premium</Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,.8)", marginTop: 2 }}>
              IA illimitée · Albums HD · Sans pub
            </Text>
          </View>
          <View style={{
            backgroundColor: "rgba(255,255,255,.25)", borderRadius: S.radiusFull,
            paddingHorizontal: 12, paddingVertical: 6,
          }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>2,99 €/mois</Text>
          </View>
        </TouchableOpacity>

        {/* ── Section Rappels ─────────────────────────────────────────────── */}
        <Section title="Rappels" />
        <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 12, marginTop: -4, lineHeight: 17 }}>
          Reçois une notification pour te rappeler de trier tes photos.
        </Text>

        {NOTIF_OPTIONS.map((opt) => {
          const isSelected = notificationFrequency === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => !notifLoading && handleSetFrequency(opt.key)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 14,
                backgroundColor: isSelected ? `${C.accent}15` : C.bgCard,
                borderRadius: S.radius,
                borderWidth: 1,
                borderColor: isSelected ? C.accent : C.border,
                marginBottom: 8,
                opacity: notifLoading ? 0.5 : 1,
              }}
            >
              {/* Icône */}
              <View style={{
                width: 36, height: 36, backgroundColor: isSelected ? `${C.accent}25` : C.bgMuted,
                borderRadius: S.radiusSm, alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ fontSize: 18 }}>{opt.emoji}</Text>
              </View>

              {/* Texte */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", fontSize: 14, color: C.text }}>{opt.label}</Text>
                <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{opt.desc}</Text>
              </View>

              {/* Coche si sélectionné */}
              {isSelected && (
                <Text style={{ color: C.accent, fontSize: 18, fontWeight: "900" }}>✓</Text>
              )}
            </TouchableOpacity>
          );
        })}

        {/* ── Section Tri par swipe — Mode Ménage ──────────────────────────── */}
        <Section title="🧹 Swipe — Mode Ménage" />
        <TouchableOpacity
          onPress={() => setMenageExpanded(!menageExpanded)}
          style={{
            backgroundColor: C.bgCard, borderRadius: S.radius, borderWidth: 1,
            borderColor: menageExpanded ? C.accent : C.border,
            padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            marginBottom: menageExpanded ? 8 : 0,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "700", fontSize: 14, color: C.text }}>Personnaliser les directions</Text>
            {!menageExpanded && (
              <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{makeSummary(swipeMappingsMenage)}</Text>
            )}
          </View>
          <Text style={{ color: C.textMuted, fontSize: 18, marginLeft: 8 }}>{menageExpanded ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {menageExpanded && (
          <>
            <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 10, lineHeight: 17 }}>
              Suppression, coup de cœur, hésitation. Le bouton 🗑 reste toujours "Supprimer".
            </Text>
            {DIRECTIONS.map((dir) => {
              const action = getActionMeta(swipeMappingsMenage?.[dir.key] ?? "none");
              return (
                <RowSetting
                  key={dir.key}
                  emoji={dir.emoji}
                  label={dir.label}
                  desc={`${action.emoji}  ${action.label}`}
                  onPress={() => setEditingSwipe({ mode: "menage", direction: dir.key })}
                  right={<Text style={{ color: C.textMuted, fontSize: 18 }}>›</Text>}
                />
              );
            })}
            <TouchableOpacity
              onPress={() => confirmReset("menage")}
              style={{ alignSelf: "flex-end", paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 }}
            >
              <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: "700" }}>↺ Réinitialiser</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Section Tri par swipe — Mode Album ───────────────────────────── */}
        <Section title="📁 Swipe — Mode Album" />
        <TouchableOpacity
          onPress={() => setAlbumExpanded(!albumExpanded)}
          style={{
            backgroundColor: C.bgCard, borderRadius: S.radius, borderWidth: 1,
            borderColor: albumExpanded ? C.accent : C.border,
            padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            marginBottom: albumExpanded ? 8 : 0,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "700", fontSize: 14, color: C.text }}>Personnaliser les directions</Text>
            {!albumExpanded && (
              <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{makeSummary(swipeMappingsAlbum)}</Text>
            )}
          </View>
          <Text style={{ color: C.textMuted, fontSize: 18, marginLeft: 8 }}>{albumExpanded ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {albumExpanded && (
          <>
            <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 10, lineHeight: 17 }}>
              Par défaut : haut = ajouter à l'album, droite = garder sans album, bas = supprimer.
            </Text>
            {DIRECTIONS.map((dir) => {
              const action = getActionMeta(swipeMappingsAlbum?.[dir.key] ?? "none");
              return (
                <RowSetting
                  key={dir.key}
                  emoji={dir.emoji}
                  label={dir.label}
                  desc={`${action.emoji}  ${action.label}`}
                  onPress={() => setEditingSwipe({ mode: "album", direction: dir.key })}
                  right={<Text style={{ color: C.textMuted, fontSize: 18 }}>›</Text>}
                />
              );
            })}
            <TouchableOpacity
              onPress={() => confirmReset("album")}
              style={{ alignSelf: "flex-end", paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 }}
            >
              <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: "700" }}>↺ Réinitialiser</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Section Compte ───────────────────────────────────────────────── */}
        <Section title="Compte" />
        <RowSetting emoji="💬" label="Nous contacter" desc="Support & feedback"
          onPress={() => comingSoon("Le formulaire de contact")}
          right={<Text style={{ color: C.textMuted }}>›</Text>} />
        <RowSetting emoji="⭐" label="Noter l'app" desc="5 étoiles ça aide vraiment 🙏"
          onPress={() => comingSoon("La note dans le store")}
          right={<Text style={{ color: C.textMuted }}>›</Text>} />
        <RowSetting emoji="🔒" label="Politique de confidentialité"
          onPress={() => comingSoon("La page de confidentialité")}
          right={<Text style={{ color: C.textMuted }}>›</Text>} />

        <Text style={{ textAlign: "center", color: C.textMuted, fontSize: 11, marginTop: 24 }}>
          Phototri v1.0.0 · Fait avec 🌸 en France
        </Text>

      </ScrollView>

      {/* ── Modal Premium ────────────────────────────────────────────────── */}
      <Modal visible={showPremium} transparent animationType="slide" onRequestClose={() => setShowPremium(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(60,20,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.bgCard, borderRadius: S.radiusLg, padding: S.padLg, paddingBottom: 44 }}>
            <Text style={{ fontSize: 28, textAlign: "center", marginBottom: 8 }}>⭐</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: C.text, textAlign: "center", marginBottom: 4 }}>
              Phototri Premium
            </Text>
            <Text style={{ fontSize: 14, color: C.textMuted, textAlign: "center", marginBottom: 24 }}>
              Essai gratuit 7 jours, puis 2,99 €/mois
            </Text>
            {[
              { emoji: "🧠", label: "IA illimitée",    desc: "Conseils et améliorations sans limite" },
              { emoji: "📸", label: "Albums HD",        desc: "Export haute résolution" },
              { emoji: "🚫", label: "Sans publicité",   desc: "Expérience 100% propre" },
              { emoji: "⚡", label: "Priorité support", desc: "Réponse en moins de 24h" },
            ].map((f) => (
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
                Alert.alert("Bientôt disponible", "Phototri Premium arrive bientôt 🌸 Merci de ton intérêt !");
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

      {/* ── Modal picker de direction de swipe ──────────────────────────── */}
      <Modal visible={!!editingSwipe} transparent animationType="slide" onRequestClose={() => setEditingSwipe(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(60,20,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: C.bgCard,
            borderTopLeftRadius: S.radiusLg, borderTopRightRadius: S.radiusLg,
            padding: S.padLg, paddingBottom: 40,
          }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: C.text, marginBottom: 4 }}>
              {editingSwipe ? DIRECTIONS.find((d) => d.key === editingSwipe.direction)?.label : ""}
            </Text>
            <Text style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
              Quelle action ce swipe déclenche-t-il ?
            </Text>

            {SWIPE_ACTIONS.map((a) => {
              const currentMappings = editingSwipe?.mode === "album" ? swipeMappingsAlbum : swipeMappingsMenage;
              const isSelected = currentMappings?.[editingSwipe?.direction] === a.key;
              return (
                <TouchableOpacity
                  key={a.key}
                  onPress={() => handlePickAction(a.key)}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 12,
                    padding: 14,
                    backgroundColor: isSelected ? `${C.accent}15` : "transparent",
                    borderRadius: S.radius,
                    borderWidth: 1, borderColor: isSelected ? C.accent : C.border,
                    marginBottom: 8,
                  }}
                >
                  <View style={{
                    width: 36, height: 36, backgroundColor: C.bgMuted,
                    borderRadius: S.radiusSm, alignItems: "center", justifyContent: "center",
                  }}>
                    <Text style={{ fontSize: 18 }}>{a.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "700", fontSize: 14, color: C.text }}>{a.label}</Text>
                    <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{a.desc}</Text>
                  </View>
                  {isSelected && <Text style={{ color: C.accent, fontSize: 18, fontWeight: "900" }}>✓</Text>}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              onPress={() => setEditingSwipe(null)}
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
