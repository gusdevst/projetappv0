//─────────────────────────────────────────────
// screens/SettingsScreen.js
// ─────────────────────────────────────────────
import { useState, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, StatusBar, Alert, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { RowSetting } from "../components/RowSetting";
import { usePhotoStore } from "../store/usePhotoStore";
import { scheduleReminder, requestPermission } from "../services/notificationService";

// ── Données de configuration ──────────────────────────────────────────────────

const TUTORIAL_SLIDES = [
  {
    emoji: "🌸",
    title: "Bienvenue sur Phototri",
    desc: "Tes souvenirs méritent mieux. On va t'aider à trier ta photothèque sans douleur — photo par photo.",
  },
  {
    emoji: "↔️",
    title: "Swipe pour décider",
    desc: "Glisse à droite ou à gauche pour passer, vers le bas pour supprimer. Chaque direction est personnalisable dans les paramètres.",
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
    emoji: "🗑",
    title: "Vider la corbeille",
    desc: "Les photos supprimées vont dans la Corbeille. Tu confirmes la suppression définitive depuis le menu principal.",
  },
  {
    emoji: "🔒",
    title: "Tes photos restent privées",
    desc: "Tout se passe sur ton téléphone. Phototri n'envoie aucune photo sur un serveur.",
  },
];

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
  const [showTutorial, setShowTutorial]         = useState(false);
  const [tutorialIdx, setTutorialIdx]           = useState(0);
  const [menageExpanded, setMenageExpanded]     = useState(false);
  const [albumExpanded, setAlbumExpanded]       = useState(false);
  // editingSwipe = { mode: "menage"|"album", direction: string } | null
  const [editingSwipe, setEditingSwipe]         = useState(null);
  const [notifLoading, setNotifLoading]         = useState(false);

  const swipeMappingsMenage      = usePhotoStore((s) => s.swipeMappingsMenage);
  const swipeMappingsAlbum       = usePhotoStore((s) => s.swipeMappingsAlbum);
  const setSwipeMapping          = usePhotoStore((s) => s.setSwipeMapping);
  const resetSwipeMappings       = usePhotoStore((s) => s.resetSwipeMappings);
  const notificationFrequency    = usePhotoStore((s) => s.notificationFrequency);
  const setNotificationFrequency = usePhotoStore((s) => s.setNotificationFrequency);
  const notificationHour         = usePhotoStore((s) => s.notificationHour);
  const setNotificationHour      = usePhotoStore((s) => s.setNotificationHour);
  const randomCount              = usePhotoStore((s) => s.randomCount);
  const setRandomCount           = usePhotoStore((s) => s.setRandomCount);
  const libraryPhotos            = usePhotoStore((s) => s.libraryPhotos);
  const kept                     = usePhotoStore((s) => s.kept);
  const deleted                  = usePhotoStore((s) => s.deleted);
  const printed                  = usePhotoStore((s) => s.printed);
  const skipped                  = usePhotoStore((s) => s.skipped);

  // Nombre de photos pas encore triées (même logique que TriModeScreen)
  const remainingCount = useMemo(() => {
    const triedIds = new Set([
      ...kept.map((p) => p.id),
      ...deleted.map((p) => p.id),
      ...printed.map((p) => p.id),
      ...skipped.map((p) => p.id),
    ]);
    return libraryPhotos.filter((p) => !triedIds.has(p.id)).length;
  }, [libraryPhotos, kept, deleted, printed, skipped]);

  // Nb de sessions restantes affiché dans l'aperçu de la notification
  const sessionsLeft = remainingCount > 0 ? Math.ceil(remainingCount / randomCount) : 0;

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
  // Quand l'heure change, on reprogramme immédiatement si un rappel est actif
  const handleChangeHour = async (newHour) => {
    setNotificationHour(newHour);
    if (notificationFrequency !== "off") {
      await scheduleReminder(notificationFrequency, { remainingCount, randomCount, notificationHour: newHour });
    }
  };

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

    // Enregistre dans le store (persisté) et programme le rappel avec les stats actuelles
    setNotificationFrequency(freq);
    const result = await scheduleReminder(freq, { remainingCount, randomCount, notificationHour });

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

        {/* ── Section Session aléatoire ────────────────────────────────────── */}
        <Section title="🎲 Session aléatoire" />
        <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 12, marginTop: -4, lineHeight: 17 }}>
          Nombre de photos tirées au sort à chaque session. Ajuste par dizaine selon ton rythme.
        </Text>
        <View style={{
          backgroundColor: C.bgCard, borderRadius: S.radius, borderWidth: 1,
          borderColor: C.border, padding: 16, marginBottom: 8,
          flexDirection: "row", alignItems: "center", gap: 16,
        }}>
          {/* Moins */}
          <TouchableOpacity
            onPress={() => setRandomCount(Math.max(10, randomCount - 10))}
            disabled={randomCount <= 10}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: randomCount <= 10 ? C.bgMuted : C.bgCard,
              borderWidth: 1.5, borderColor: randomCount <= 10 ? C.border : C.accent,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "800", color: randomCount <= 10 ? C.textMuted : C.accent }}>−</Text>
          </TouchableOpacity>

          {/* Valeur */}
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 36, fontWeight: "900", color: C.text }}>{randomCount}</Text>
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>photos</Text>
          </View>

          {/* Plus */}
          <TouchableOpacity
            onPress={() => setRandomCount(Math.min(200, randomCount + 10))}
            disabled={randomCount >= 200}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: randomCount >= 200 ? C.bgMuted : C.bgCard,
              borderWidth: 1.5, borderColor: randomCount >= 200 ? C.border : C.accent,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "800", color: randomCount >= 200 ? C.textMuted : C.accent }}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginBottom: 16 }}>
          Min 10 · Max 200 · Affiché sur le toggle de l'accueil
        </Text>

        {/* ── Section Rappels ─────────────────────────────────────────────── */}
        <Section title="Rappels" />
        <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 12, marginTop: -4, lineHeight: 17 }}>
          Reçois une notification pour te rappeler de trier tes photos.
        </Text>

        {/* ── Sélecteur d'heure ──────────────────────────────────────────── */}
        <Text style={{ fontSize: 11, fontWeight: "800", color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
          Heure du rappel
        </Text>
        <View style={{
          backgroundColor: C.bgCard, borderRadius: S.radius, borderWidth: 1,
          borderColor: C.border, padding: 14, marginBottom: 16,
          flexDirection: "row", alignItems: "center", gap: 16,
        }}>
          {/* Moins */}
          <TouchableOpacity
            onPress={() => handleChangeHour((notificationHour + 23) % 24)}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: C.bgCard, borderWidth: 1.5, borderColor: C.accent,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "800", color: C.accent }}>−</Text>
          </TouchableOpacity>

          {/* Heure affichée */}
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 34, fontWeight: "900", color: C.text }}>
              {String(notificationHour).padStart(2, "0")}h00
            </Text>
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              {notificationHour < 12 ? "matin" : notificationHour < 18 ? "après-midi" : "soirée"}
            </Text>
          </View>

          {/* Plus */}
          <TouchableOpacity
            onPress={() => handleChangeHour((notificationHour + 1) % 24)}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: C.bgCard, borderWidth: 1.5, borderColor: C.accent,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "800", color: C.accent }}>+</Text>
          </TouchableOpacity>
        </View>

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

        {/* Aperçu de la notification quand un rappel est actif */}
        {notificationFrequency !== "off" && (
          <View style={{
            backgroundColor: `${C.accent}10`,
            borderRadius: S.radius,
            borderWidth: 1,
            borderColor: `${C.accent}30`,
            padding: 14,
            marginTop: 4,
            marginBottom: 8,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
          }}>
            <Text style={{ fontSize: 18, marginTop: 1 }}>💬</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: C.accent, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Aperçu de la notification
              </Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.text, marginBottom: 1 }}>
                Phototri 📷
              </Text>
              <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 17 }}>
                {sessionsLeft > 0
                  ? `Il te reste ${sessionsLeft} session${sessionsLeft > 1 ? "s" : ""} de ${randomCount} photos à trier 📸`
                  : "Ta galerie est au top 🌸 Bravo !"}
              </Text>
              {/* Heure et note selon la fréquence */}
              {notificationFrequency === "every2days" ? (
                <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
                  ⚠️ Rappel toutes les 48h depuis l'activation — heure non garantie.
                </Text>
              ) : (
                <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
                  🕐 Se déclenche à {String(notificationHour).padStart(2, "0")}h00 — appuie pour lancer une session.
                </Text>
              )}
            </View>
          </View>
        )}

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

        {/* ── Section Aide ─────────────────────────────────────────────────── */}
        <Section title="Aide" />
        <RowSetting emoji="🎓" label="Tutoriel" desc="Revoir comment fonctionne Phototri"
          onPress={() => { setTutorialIdx(0); setShowTutorial(true); }}
          right={<Text style={{ color: C.textMuted }}>›</Text>} />

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

      {/* ── Modal Tutoriel ───────────────────────────────────────────────── */}
      <Modal visible={showTutorial} transparent animationType="fade" onRequestClose={() => setShowTutorial(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <View style={{ backgroundColor: C.bgCard, borderRadius: S.radiusLg, padding: 28, width: "100%" }}>

            {/* Slide actuel */}
            <View style={{ alignItems: "center", marginBottom: 24 }}>
              <Text style={{ fontSize: 52, marginBottom: 16 }}>{TUTORIAL_SLIDES[tutorialIdx].emoji}</Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color: C.text, textAlign: "center", marginBottom: 10 }}>
                {TUTORIAL_SLIDES[tutorialIdx].title}
              </Text>
              <Text style={{ fontSize: 14, color: C.textMuted, textAlign: "center", lineHeight: 21 }}>
                {TUTORIAL_SLIDES[tutorialIdx].desc}
              </Text>
            </View>

            {/* Indicateur de progression */}
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 24 }}>
              {TUTORIAL_SLIDES.map((_, i) => (
                <View key={i} style={{
                  width: i === tutorialIdx ? 20 : 6, height: 6,
                  borderRadius: 3,
                  backgroundColor: i === tutorialIdx ? C.accent : C.border,
                }} />
              ))}
            </View>

            {/* Boutons navigation */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {tutorialIdx > 0 && (
                <TouchableOpacity
                  onPress={() => setTutorialIdx(tutorialIdx - 1)}
                  style={{ flex: 1, backgroundColor: C.bgMuted, borderRadius: S.radius, padding: 14, alignItems: "center" }}
                >
                  <Text style={{ color: C.textMuted, fontWeight: "700" }}>← Précédent</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  if (tutorialIdx < TUTORIAL_SLIDES.length - 1) {
                    setTutorialIdx(tutorialIdx + 1);
                  } else {
                    setShowTutorial(false);
                  }
                }}
                style={{ flex: 1, backgroundColor: C.accent, borderRadius: S.radius, padding: 14, alignItems: "center", elevation: 3 }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>
                  {tutorialIdx < TUTORIAL_SLIDES.length - 1 ? "Suivant →" : "Terminer ✓"}
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
