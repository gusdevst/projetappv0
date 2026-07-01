//─────────────────────────────────────────────
// screens/SettingsScreen.js
// ─────────────────────────────────────────────
import { useState, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, StatusBar, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { RowSetting } from "../components/RowSetting";
import BackButton from "../components/BackButton";
import { usePhotoStore } from "../store/usePhotoStore";

// ── Données de configuration ──────────────────────────────────────────────────

const TUTORIAL_SLIDES = [
  {
    emoji: "🎞️",
    title: "Bienvenue sur Pellicule",
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
    emoji: "🖼️",
    title: "Imprime tes souvenirs",
    desc: "Une photo imprimée prend vie : accrochée chez toi, offerte ou glissée dans un album, elle se regarde vraiment. Pellicule t'aidera bientôt à transformer tes plus belles photos en tirages, albums et cadres.",
  },
  {
    emoji: "🗑",
    title: "Vider la corbeille",
    desc: "Les photos supprimées vont dans la Corbeille. Tu confirmes la suppression définitive depuis le menu principal.",
  },
  {
    emoji: "🔔",
    title: "Garde le rythme",
    desc: "Active un rappel automatique pour penser à trier tes photos chaque jour. Choisis la fréquence et l'heure dans les Réglages, et reçois une petite notification au bon moment.",
  },
  {
    emoji: "🔒",
    title: "Tes photos restent privées",
    desc: "Tout se passe sur ton téléphone. Pellicule n'envoie aucune photo sur un serveur.",
  },
];

// Actions proposées en mode MÉNAGE.
const SWIPE_ACTIONS_MENAGE = [
  { key: "skip",     label: "Conserver la photo",     desc: "Garder sur le téléphone et passer à la suivante", emoji: "💚" },
  { key: "delete",   label: "Supprimer",              desc: "Envoyer dans la corbeille",                       emoji: "🗑" },
  { key: "hesitate", label: "Je déciderai plus tard", desc: "Mettre de côté pour décider ensuite",             emoji: "🤔" },
  { key: "none",     label: "Désactivée",             desc: "Rien ne se passe, la photo rebondit",             emoji: "🚫" },
];

// Actions proposées en mode ALBUM (suppression possible pour faire le ménage en même temps).
const SWIPE_ACTIONS_ALBUM = [
  { key: "album",    label: "Envoyer dans l'album",        desc: "Ajouter cette photo à l'album",                       emoji: "📁" },
  { key: "skip",     label: "Ne pas envoyer dans l'album", desc: "Photo conservée, elle pourra revenir pour un autre album", emoji: "⏭️" },
  { key: "delete",   label: "Supprimer",                   desc: "Envoyer dans la corbeille (tri en même temps)",       emoji: "🗑" },
  { key: "hesitate", label: "Je déciderai plus tard",      desc: "Mettre de côté pour décider ensuite",                 emoji: "🤔" },
  { key: "none",     label: "Désactivée",                  desc: "Rien ne se passe, la photo rebondit",                 emoji: "🚫" },
];

const actionsFor = (mode) => (mode === "album" ? SWIPE_ACTIONS_ALBUM : SWIPE_ACTIONS_MENAGE);

const DIRECTIONS = [
  { key: "up",    label: "Swipe vers le haut",   emoji: "↑" },
  { key: "down",  label: "Swipe vers le bas",    emoji: "↓" },
  { key: "left",  label: "Swipe vers la gauche", emoji: "←" },
  { key: "right", label: "Swipe vers la droite", emoji: "→" },
];

const getActionMeta = (key, mode) => {
  const list = actionsFor(mode);
  return list.find((a) => a.key === key) || list[0];
};

// ── Composant ─────────────────────────────────────────────────────────────────

export function SettingsScreen({ navigation, route }) {
  // focusSection = "menage" | "album" — passé depuis SwipeScreen via le bouton ⚙️
  const focusSection = route?.params?.focusSection ?? null;

  const [showTutorial, setShowTutorial]         = useState(false);
  const [tutorialIdx, setTutorialIdx]           = useState(0);
  const [menageExpanded, setMenageExpanded]     = useState(focusSection === "menage");
  const [albumExpanded, setAlbumExpanded]       = useState(focusSection === "album");
  // editingSwipe = { mode: "menage"|"album", direction: string } | null
  const [editingSwipe, setEditingSwipe]         = useState(null);
  const swipeMappingsMenage      = usePhotoStore((s) => s.swipeMappingsMenage);
  const swipeMappingsAlbum       = usePhotoStore((s) => s.swipeMappingsAlbum);
  const setSwipeMapping          = usePhotoStore((s) => s.setSwipeMapping);
  const resetSwipeMappings       = usePhotoStore((s) => s.resetSwipeMappings);
  const randomCount              = usePhotoStore((s) => s.randomCount);
  const setRandomCount           = usePhotoStore((s) => s.setRandomCount);
  const restartTri               = usePhotoStore((s) => s.restartTri);
  const resetKept                = usePhotoStore((s) => s.resetKept);

  const comingSoon = (feature) =>
    Alert.alert("Bientôt disponible", `${feature} arrive très vite !`);

  // ── Swipe settings ─────────────────────────────────────────────────────────
  const handlePickAction = (actionKey) => {
    if (!editingSwipe) return;
    setSwipeMapping(editingSwipe.mode, editingSwipe.direction, actionKey);
    setEditingSwipe(null);
  };

  const confirmReset = (swipeMode) => {
    Alert.alert(
      "Réinitialiser",
      `Remettre les directions de swipe "${swipeMode === "menage" ? "Tri" : "Album"}" par défaut ?`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Réinitialiser", style: "destructive", onPress: () => resetSwipeMappings(swipeMode) },
      ]
    );
  };

  // ── Remettre à 0 le tri ──────────────────────────────────────────────────
  const confirmRestartTri = () => {
    Alert.alert(
      "Recommencer le tri ?",
      "Toutes tes photos non supprimées reviendront dans la file à trier. " +
        "Tes coups de cœur ❤️, tes albums et ta corbeille sont conservés.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Tout retrier",
          style: "destructive",
          onPress: () => {
            restartTri();
            Alert.alert("C'est reparti !", "Tes photos sont prêtes à être triées à nouveau.");
          },
        },
      ]
    );
  };

  const confirmResetKept = () => {
    Alert.alert(
      "Réinitialiser les coups de cœur ?",
      "Toutes tes photos ❤️ seront retirées de la liste des coups de cœur. Elles ne sont pas supprimées.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Réinitialiser",
          style: "destructive",
          onPress: () => {
            resetKept();
            Alert.alert("Fait !", "Tes coups de cœur ont été remis à zéro.");
          },
        },
      ]
    );
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
  const makeSummary = (mappings, mode) => DIRECTIONS.map((dir) => {
    const action = getActionMeta(mappings?.[dir.key] ?? "none", mode);
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
        <BackButton accentColor={C.accent} onPress={() => navigation.goBack()} />
        <Text style={{ fontWeight: "900", fontSize: 22, color: C.text }}>Paramètres</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.pad, paddingBottom: 40 }}>

        {/* ── Section Tri par swipe — Mode Tri ──────────────────────────── */}
        <Section title="🧹 Swipe — Mode Tri" />
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
              <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{makeSummary(swipeMappingsMenage, "menage")}</Text>
            )}
          </View>
          <Text style={{ color: C.textMuted, fontSize: 18, marginLeft: 8 }}>{menageExpanded ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {menageExpanded && (
          <>
            <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 10, lineHeight: 17 }}>
              Conserver, supprimer ou hésiter. Le coup de cœur ❤️ se fait uniquement avec le bouton cœur pendant le tri.
            </Text>
            {DIRECTIONS.map((dir) => {
              const action = getActionMeta(swipeMappingsMenage?.[dir.key] ?? "none", "menage");
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
              <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{makeSummary(swipeMappingsAlbum, "album")}</Text>
            )}
          </View>
          <Text style={{ color: C.textMuted, fontSize: 18, marginLeft: 8 }}>{albumExpanded ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {albumExpanded && (
          <>
            <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 10, lineHeight: 17 }}>
              Par défaut : haut = envoyer dans l'album, droite/bas = ne pas envoyer (la photo pourra revenir pour un autre album). Tu peux aussi activer la suppression sur une direction pour faire le tri en même temps.
            </Text>
            {DIRECTIONS.map((dir) => {
              const action = getActionMeta(swipeMappingsAlbum?.[dir.key] ?? "none", "album");
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

        {/* ── Section Session aléatoire (compacte) ─────────────────────────── */}
        <Section title="🎲 Photos par session aléatoire" />
        <View style={{
          backgroundColor: C.bgCard, borderRadius: S.radius, borderWidth: 1,
          borderColor: C.border, paddingVertical: 10, paddingHorizontal: 16,
          flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4,
        }}>
          <TouchableOpacity
            onPress={() => setRandomCount(Math.max(10, randomCount - 10))}
            disabled={randomCount <= 10}
            style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: randomCount <= 10 ? C.bgMuted : `${C.accent}15`,
              borderWidth: 1.5, borderColor: randomCount <= 10 ? C.border : C.accent,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "800", color: randomCount <= 10 ? C.textMuted : C.accent }}>−</Text>
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 24, fontWeight: "900", color: C.text }}>{randomCount}</Text>
            <Text style={{ fontSize: 10, color: C.textMuted }}>photos / session</Text>
          </View>

          <TouchableOpacity
            onPress={() => setRandomCount(Math.min(200, randomCount + 10))}
            disabled={randomCount >= 200}
            style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: randomCount >= 200 ? C.bgMuted : `${C.accent}15`,
              borderWidth: 1.5, borderColor: randomCount >= 200 ? C.border : C.accent,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "800", color: randomCount >= 200 ? C.textMuted : C.accent }}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginBottom: 4 }}>
          Min 10 · Max 200
        </Text>

        {/* ── Section Recommencer le tri ───────────────────────────────────── */}
        <Section title="🔄 Recommencer" />

        {/* Option 1 : renvoyer toutes les photos dans la file */}
        <TouchableOpacity
          onPress={confirmRestartTri}
          style={{
            backgroundColor: C.bgCard, borderRadius: S.radius, borderWidth: 1.5,
            borderColor: C.red, padding: 16, marginBottom: 10,
            flexDirection: "row", alignItems: "center", gap: 12,
          }}
        >
          <View style={{
            width: 36, height: 36, backgroundColor: `${C.red}15`,
            borderRadius: S.radiusSm, alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ fontSize: 18 }}>🔄</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "800", fontSize: 14, color: C.red }}>
              Renvoyer toutes les photos dans la file
            </Text>
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2, lineHeight: 16 }}>
              Toutes les photos non supprimées reviennent à trier. Coups de cœur, albums et corbeille conservés.
            </Text>
          </View>
        </TouchableOpacity>

        {/* Option 2 : réinitialiser les coups de cœur */}
        <TouchableOpacity
          onPress={confirmResetKept}
          style={{
            backgroundColor: C.bgCard, borderRadius: S.radius, borderWidth: 1.5,
            borderColor: C.red, padding: 16,
            flexDirection: "row", alignItems: "center", gap: 12,
          }}
        >
          <View style={{
            width: 36, height: 36, backgroundColor: `${C.red}15`,
            borderRadius: S.radiusSm, alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ fontSize: 18 }}>❤️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "800", fontSize: 14, color: C.red }}>
              Réinitialiser les coups de cœur
            </Text>
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2, lineHeight: 16 }}>
              Retire toutes les photos ❤️ de ta liste. Elles ne sont pas supprimées.
            </Text>
          </View>
        </TouchableOpacity>

        {/* ── Section Aide ─────────────────────────────────────────────────── */}
        <Section title="Aide" />
        <RowSetting emoji="🎓" label="Tutoriel" desc="Revoir comment fonctionne Pellicule"
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
          Pellicule v1.0.0 · Fait avec ❤️ en France
        </Text>

      </ScrollView>

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

            {actionsFor(editingSwipe?.mode).map((a) => {
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
