
// ─────────────────────────────────────────────
// screens/SummaryScreen.js
// ─────────────────────────────────────────────
import { useEffect } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar, Dimensions, Alert } from "react-native";
import Text from "../components/AppText";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import Svg, { Ellipse, Rect, Circle, Path } from "react-native-svg";
import Icon from "../components/Icons";
import { usePhotoStore } from "../store/usePhotoStore";
import { useNotificationReminder } from "../hooks/useNotificationReminder";
import { BadgeUnlockBanner, RankUnlockModal } from "../components/AchievementUnlocks";

const { width: SW } = Dimensions.get("window");

// Style de carte sauge : fond clair, ombre douce.
const SHADOW = { shadowColor: "#3c3c28", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 };
const CARD = { backgroundColor: C.bgCard, borderRadius: 18, padding: 14, marginBottom: 12, ...SHADOW };
// Ambre de « J'hésite » (neutre, hors palette).
const AMBER = "#c98a1e", AMBER_SOFT = "#f8ecd6", AMBER_TEXT = "#9a6512";

// Illustration du haut : carte cochée + confettis (Tri) ou livre (Album).
function SummaryIllustration({ album }) {
  return (
    <Svg width={150} height={100} viewBox="0 0 150 100">
      <Ellipse cx="75" cy="94" rx="46" ry="5" fill="#000" opacity={0.06} />
      <Rect x="18" y="20" width="10" height="5" rx="2" fill={C.sage3} transform="rotate(-25 23 22)" />
      <Rect x="120" y="14" width="10" height="5" rx="2" fill={C.album} transform="rotate(30 125 16)" />
      <Circle cx="32" cy="54" r="3.5" fill={album ? C.albumSoft : C.sage2} />
      <Circle cx="122" cy="48" r="3" fill={album ? "#d9a07f" : C.sage3} />
      {album ? (
        <>
          <Path d="M44 20h52a10 10 0 0 1 10 10v58H56a12 12 0 0 1-12-12z" fill={C.albumSoft} />
          <Path d="M44 76a12 12 0 0 1 12-12h50v24H56a12 12 0 0 1-12-12z" fill="#e7c3ad" />
          <Rect x="56" y="30" width="38" height="26" rx="5" fill={C.bgCard} />
          <Circle cx="84" cy="38" r="3.5" fill="#d9a07f" />
          <Path d="M58 54l10-11 8 7 6-5 10 9z" fill={C.album} />
        </>
      ) : (
        <>
          <Rect x="45" y="22" width="60" height="66" rx="13" fill={C.sage} />
          <Rect x="52" y="29" width="46" height="52" rx="9" fill={C.sage3} />
          <Path d="M63 56l8 8 16-17" stroke="#fff" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </Svg>
  );
}

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

        <View style={{ alignItems: "center", marginBottom: 4 }}><SummaryIllustration album={isAlbum} /></View>
        <Text style={{ fontSize: 24, fontWeight: "600", color: C.text, textAlign: "center", marginBottom: 2 }}>
          {isAlbum ? "Album mis à jour !" : "Tri terminé !"}
        </Text>
        <Text style={{ fontSize: 14, color: C.textMuted, textAlign: "center", marginBottom: 24 }}>
          {isAlbum ? (albumName || "Ton album") : "Voici ton bilan"}
        </Text>

        {/* ── Grille de stats (mode ménage uniquement) ──────────────────── */}
        {!isAlbum && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Passées en revue", val: reviewedCount,           color: C.text,   icon: "eye",     bg: C.bgMuted, ic: C.textMid },
            { label: "Conservées",       val: sessionConserved.length, color: C.accent, icon: "check",   bg: C.sage,    ic: C.accent },
            { label: "Supprimées",       val: sessionDeleted.length,   color: C.red,    icon: "trash",   bg: C.redSoft, ic: C.red, trash: true },
            { label: "Mo libérés",       val: deletedSize.toFixed(1),  color: C.accent, icon: "sparkle", bg: C.sage,    ic: C.accent },
          ].map((s) => {
            const isTrash = !!s.trash;
            const cardContent = (
              <View
                style={{
                  width: (SW - 60) / 2,
                  backgroundColor: C.bgCard,
                  borderRadius: 18,
                  paddingVertical: 16, paddingHorizontal: 12,
                  alignItems: "center",
                  borderWidth: isTrash ? 1.5 : 0,
                  borderColor: isTrash ? `${C.red}55` : "transparent",
                  ...SHADOW,
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: s.bg, alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                  <Icon name={s.icon} size={19} color={s.ic} strokeWidth={2.1} />
                </View>
                <Text style={{ fontSize: 26, fontWeight: "600", color: s.color }}>{s.val}</Text>
                <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>{s.label}</Text>
                {isTrash && s.val > 0 && (
                  <Text style={{ fontSize: 11, color: C.red, fontWeight: "600", marginTop: 3 }}>Voir →</Text>
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
          <View style={[CARD, { marginTop: 8 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}>
                <Icon name="album" size={21} color={C.album} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600", fontSize: 17, color: C.text }}>
                  {createdAlbum.name}
                </Text>
                <Text style={{ fontSize: 13, color: C.album, fontWeight: "600", marginTop: 1 }}>
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
                backgroundColor: C.album, borderRadius: 12,
                padding: 13, alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Voir l'album</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Section "J'hésite" (visible seulement si des photos hésitées cette session) ── */}
        {sessionHesitated.length > 0 && (
          <View
            style={[CARD, { borderWidth: 1.5, borderColor: `${AMBER}66` }]}
          >
            {/* En-tête */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: AMBER_SOFT, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 19 }}>🤔</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600", fontSize: 14.5, color: C.text }}>
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
                backgroundColor: AMBER_SOFT,
                borderRadius: 12,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: AMBER_TEXT, fontWeight: "600", fontSize: 14 }}>
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
            backgroundColor: C.albumSoft,
            borderRadius: 18,
            padding: 14,
            marginBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.bgCard, alignItems: "center", justifyContent: "center" }}>
            <Icon name="album" size={21} color={C.album} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "600", fontSize: 14.5, color: C.text, marginBottom: 2 }}>
              Crée un album de tes plus belles photos
            </Text>
            <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 17 }}>
              Regroupe tes souvenirs et fais-les imprimer via nos partenaires.
            </Text>
          </View>
          <Text style={{ fontSize: 16, color: C.album, fontWeight: "500" }}>→</Text>
        </TouchableOpacity>
        )}

        {/* ── Rappel d'activation des notifications (si encore désactivées) ── */}
        {!notificationsEnabled && (
          <TouchableOpacity
            onPress={handleEnableReminders}
            style={[CARD, { flexDirection: "row", alignItems: "center", gap: 12 }]}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}>
              <Icon name="bell" size={19} color={C.accent} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600", fontSize: 14.5, color: C.text, marginBottom: 2 }}>
                Ne perds plus le rythme
              </Text>
              <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 17 }}>
                Active un rappel quotidien (9h par défaut, heure modifiable) pour penser à trier tes photos.
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: C.accent, fontWeight: "600" }}>Activer</Text>
          </TouchableOpacity>
        )}

        {/* ── Retour accueil ───────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => navigation.popToTop()}
          style={{
            backgroundColor: accent,
            borderRadius: 16,
            padding: 15,
            alignItems: "center",
            marginTop: 4,
            shadowColor: accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 4,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>← Retour à l'accueil</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Fin de session : c'est ici qu'on fête un nouveau galon */}
      <BadgeUnlockBanner />
      <RankUnlockModal />
    </SafeAreaView>
  );
}
