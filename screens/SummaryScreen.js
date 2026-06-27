
// ─────────────────────────────────────────────
// screens/SummaryScreen.js
// ─────────────────────────────────────────────
import { useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, StatusBar, Dimensions, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { useNotificationReminder } from "../hooks/useNotificationReminder";

const { width: SW } = Dimensions.get("window");

export function SummaryScreen({ navigation, route }) {
  const {
    albumId,
    albumName,
    mode = "menage",
    // Stats de la session courante (envoyées par SwipeScreen)
    sessionKept        = [],
    sessionDeleted     = [],
    sessionHesitated   = [],
    sessionAlbumPhotos = [],
    sessionConserved   = [],
  } = route.params || {};

  const isAlbum = mode === "album";
  const accent  = isAlbum ? C.album : C.accent;

  // On garde le store uniquement pour les actions (reset) et la liste albums
  const albums            = usePhotoStore((state) => state.albums);
  const resetHesitated    = usePhotoStore((state) => state.resetHesitated);
  const clearAlbumFilters = usePhotoStore((state) => state.clearAlbumFilters);
  const deleteAlbum       = usePhotoStore((state) => state.deleteAlbum);

  // Rappels push : filet de secours si les notifs sont encore désactivées.
  const { notificationsEnabled, enableReminders } = useNotificationReminder();

  const handleEnableReminders = async () => {
    const result = await enableReminders(); // quotidien à 9h par défaut
    if (result.success) {
      Alert.alert("C'est activé ! 🔔", "Tu recevras un rappel chaque jour à 9h. Tu peux changer l'heure dans les Réglages.");
    } else if (result.reason === "permission_denied") {
      Alert.alert(
        "Permission refusée",
        "Pour recevoir des rappels, active les notifications pour Pellicule dans tes Réglages."
      );
    }
  };

  // Stats basées sur la SESSION uniquement
  const deletedSize = sessionDeleted.reduce((a, p) => a + (p.size || 0), 0);
  // Total des photos passées en revue cette session (toutes décisions confondues)
  const reviewedCount =
    sessionConserved.length + sessionDeleted.length + sessionKept.length +
    sessionHesitated.length + sessionAlbumPhotos.length;

  // Album créé pendant cette session (mode album uniquement)
  const createdAlbum = albumId ? albums.find((a) => a.id === albumId) : null;

  // En mode album, on réinitialise les filtres combinés de la session.
  // ⚠️ On NE réinitialise PAS "skipped" : en ménage il contient les photos conservées
  // (décision définitive) qui ne doivent jamais revenir. En album, "ne pas envoyer"
  // n'enregistre rien, donc la photo revient naturellement au prochain album.
  useEffect(() => {
    if (isAlbum) {
      clearAlbumFilters();
      // Nettoie l'album s'il est vide (l'user a lancé une session sans swiper une seule photo dedans).
      // Sans ça, un album fantôme resterait dans le store et ferait afficher "1 album" sur l'accueil.
      if (albumId && createdAlbum && createdAlbum.photoIds.length === 0) {
        deleteAlbum(albumId);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Exporte les coups de cœur de la session dans un album natif "Pellicule ❤️"
  // Relancer le tri uniquement sur les photos hésitées de cette session
  const handleRetrierHesites = () => {
    if (sessionHesitated.length === 0) return;
    const queue = sessionHesitated.map((p) => ({ ...p }));
    resetHesitated(); // on vide la pile du store avant de relancer
    if (isAlbum && albumId) {
      // On reste dans le même mode album pour que les photos atterrissent dans le bon album
      navigation.navigate("Swipe", { queue, mode: "album", albumId, albumName });
    } else {
      navigation.navigate("Swipe", { queue });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ padding: 24 }}>

        <Text style={{ fontSize: 56, textAlign: "center", marginBottom: 8 }}>{isAlbum ? "📔" : "🎉"}</Text>
        <Text style={{ fontSize: 26, fontWeight: "900", color: C.text, textAlign: "center", marginBottom: 4 }}>
          {isAlbum ? "Album mis à jour !" : "Tri terminé !"}
        </Text>
        <Text style={{ fontSize: 14, color: C.textMuted, textAlign: "center", marginBottom: 24 }}>
          {isAlbum ? (albumName || "Ton album") : "Voici ton bilan"}
        </Text>

        {/* ── Grille de stats (mode ménage uniquement) ──────────────────── */}
        {!isAlbum && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Passées en revue", val: reviewedCount,         color: C.purple, emoji: "👀" },
            { label: "Conservées",       val: sessionConserved.length, color: C.green,  emoji: "💚" },
            { label: "Supprimées",       val: sessionDeleted.length,   color: C.red,    emoji: "🗑" },
            { label: "Mo libérés",       val: deletedSize.toFixed(1),  color: C.yellow, emoji: "✨" },
          ].map((s) => {
            const isTrash = s.emoji === "🗑";
            const cardContent = (
              <View
                style={{
                  width: (SW - 60) / 2,
                  backgroundColor: C.bgCard,
                  borderRadius: S.radius,
                  padding: 20,
                  alignItems: "center",
                  borderWidth: isTrash ? 1.5 : 1,
                  borderColor: isTrash ? `${C.red}50` : C.border,
                }}
              >
                <Text style={{ fontSize: 24, marginBottom: 6 }}>{s.emoji}</Text>
                <Text style={{ fontSize: 28, fontWeight: "900", color: s.color }}>{s.val}</Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{s.label}</Text>
                {isTrash && s.val > 0 && (
                  <Text style={{ fontSize: 10, color: C.red, fontWeight: "700", marginTop: 4 }}>Voir →</Text>
                )}
              </View>
            );
            if (isTrash && s.val > 0) {
              return (
                <TouchableOpacity
                  key={s.label}
                  onPress={() => navigation.navigate("Gallery", { section: "deleted" })}
                  activeOpacity={0.7}
                >
                  {cardContent}
                </TouchableOpacity>
              );
            }
            return <View key={s.label}>{cardContent}</View>;
          })}
        </View>
        )}

        {/* ── Bilan album (mode album) ──────────────────────────────────── */}
        {isAlbum && createdAlbum && (
          <View style={{
            backgroundColor: `${C.album}12`,
            borderRadius: S.radius,
            padding: 20,
            borderWidth: 2,
            borderColor: `${C.album}50`,
            marginBottom: 16,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Text style={{ fontSize: 26 }}>📔</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "900", fontSize: 18, color: C.text }}>
                  {createdAlbum.name}
                </Text>
                <Text style={{ fontSize: 13, color: C.album, fontWeight: "700", marginTop: 2 }}>
                  {createdAlbum.photoIds.length} photo{createdAlbum.photoIds.length > 1 ? "s" : ""} dans l'album
                </Text>
              </View>
            </View>

            {sessionAlbumPhotos.length > 0 && (
              <>
                <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
                  +{sessionAlbumPhotos.length} ajoutée{sessionAlbumPhotos.length > 1 ? "s" : ""} cette session · Synchronisé dans ta galerie ✓
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {sessionAlbumPhotos.map((p) => (
                      <Image key={p.id} source={{ uri: p.url }} style={{ width: 70, height: 70, borderRadius: 12 }} />
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            <TouchableOpacity
              onPress={() => navigation.navigate("Gallery", { section: "album", albumId: createdAlbum.id })}
              style={{
                backgroundColor: C.album, borderRadius: 14,
                padding: 15, alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>📂 Voir l'album</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Section "J'hésite" (visible seulement si des photos hésitées cette session) ── */}
        {sessionHesitated.length > 0 && (
          <View
            style={{
              backgroundColor: C.bgCard,
              borderRadius: S.radius,
              padding: 16,
              borderWidth: 2,
              borderColor: "rgba(255,165,0,0.4)",
              marginBottom: 16,
            }}
          >
            {/* En-tête */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Text style={{ fontSize: 20 }}>🤔</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", fontSize: 14, color: C.text }}>
                  {sessionHesitated.length} photo{sessionHesitated.length > 1 ? "s" : ""} en attente de décision
                </Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                  Tu avais hésité sur ces photos. Prêt à trancher ?
                </Text>
              </View>
            </View>

            {/* Miniatures */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {sessionHesitated.map((p) => (
                  <Image
                    key={p.id}
                    source={{ uri: p.url }}
                    style={{ width: 70, height: 70, borderRadius: 12 }}
                  />
                ))}
              </View>
            </ScrollView>

            {/* Bouton Retrier */}
            <TouchableOpacity
              onPress={handleRetrierHesites}
              style={{
                backgroundColor: "rgba(255,165,0,0.15)",
                borderWidth: 1.5,
                borderColor: "rgba(255,165,0,0.6)",
                borderRadius: 12,
                padding: 13,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "rgb(200,120,0)", fontWeight: "800", fontSize: 14 }}>
                Retrier ces photos →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── CTA création d'album (mode ménage uniquement) ────────────── */}
        {!isAlbum && (
        <TouchableOpacity
          onPress={() => navigation.navigate("Home", { startMode: "album" })}
          style={{
            backgroundColor: `${C.album}12`,
            borderRadius: S.radius,
            padding: 18,
            borderWidth: 1.5,
            borderColor: `${C.album}50`,
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Text style={{ fontSize: 34 }}>📔</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "900", fontSize: 15, color: C.text, marginBottom: 3 }}>
              Crée un album de tes plus belles photos
            </Text>
            <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 17 }}>
              Regroupe tes souvenirs et fais-les imprimer via nos partenaires.
            </Text>
          </View>
          <Text style={{ fontSize: 16, color: C.album, fontWeight: "800" }}>→</Text>
        </TouchableOpacity>
        )}

        {/* ── Rappel d'activation des notifications (si encore désactivées) ── */}
        {!notificationsEnabled && (
          <TouchableOpacity
            onPress={handleEnableReminders}
            style={{
              backgroundColor: C.bgCard,
              borderRadius: S.radius,
              padding: 18,
              borderWidth: 1.5,
              borderColor: `${C.accent}50`,
              marginBottom: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            <Text style={{ fontSize: 30 }}>🔔</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900", fontSize: 15, color: C.text, marginBottom: 3 }}>
                Ne perds plus le rythme
              </Text>
              <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 17 }}>
                Active un rappel quotidien (9h par défaut, heure modifiable) pour penser à trier tes photos.
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: C.accent, fontWeight: "800" }}>Activer</Text>
          </TouchableOpacity>
        )}

        {/* ── Retour accueil ───────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => navigation.popToTop()}
          style={{
            backgroundColor: accent,
            borderRadius: S.radius,
            padding: 16,
            alignItems: "center",
            elevation: 4,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>← Retour à l'accueil</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}
