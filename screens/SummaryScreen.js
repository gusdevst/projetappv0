
// ─────────────────────────────────────────────
// screens/SummaryScreen.js
// ─────────────────────────────────────────────
import { useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, StatusBar, Dimensions, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";

const { width: SW } = Dimensions.get("window");

export function SummaryScreen({ navigation, route }) {
  const {
    albumId,
    albumName,
    // Stats de la session courante (envoyées par SwipeScreen)
    sessionKept        = [],
    sessionDeleted     = [],
    sessionHesitated   = [],
    sessionAlbumPhotos = [],
  } = route.params || {};

  // On garde le store uniquement pour les actions (reset) et la liste albums
  const albums         = usePhotoStore((state) => state.albums);
  const resetSkipped   = usePhotoStore((state) => state.resetSkipped);
  const resetHesitated = usePhotoStore((state) => state.resetHesitated);

  // Stats basées sur la SESSION uniquement
  const deletedSize = sessionDeleted.reduce((a, p) => a + (p.size || 0), 0);

  // Album créé pendant cette session (mode album uniquement)
  const createdAlbum = albumId ? albums.find((a) => a.id === albumId) : null;

  // Tri terminé → on libère les photos "skipped" pour le prochain tri
  useEffect(() => {
    resetSkipped();
  }, [resetSkipped]);

  // Exporte les coups de cœur de la session dans un album natif "Phototri ❤️"
  // Relancer le tri uniquement sur les photos hésitées de cette session
  const handleRetrierHesites = () => {
    if (sessionHesitated.length === 0) return;
    const queue = sessionHesitated.map((p) => ({ ...p }));
    resetHesitated(); // on vide la pile du store avant de relancer
    navigation.navigate("Swipe", { queue });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ padding: 24 }}>

        <Text style={{ fontSize: 56, textAlign: "center", marginBottom: 8 }}>🎉</Text>
        <Text style={{ fontSize: 26, fontWeight: "900", color: C.text, textAlign: "center", marginBottom: 4 }}>
          Tri terminé !
        </Text>
        <Text style={{ fontSize: 14, color: C.textMuted, textAlign: "center", marginBottom: 24 }}>
          Voici ton bilan
        </Text>

        {/* ── Grille de stats ───────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Coups de cœur",    val: sessionKept.length,           color: C.green,  emoji: "❤️" },
            { label: "Supprimées",      val: sessionDeleted.length,         color: C.red,    emoji: "🗑" },
            { label: "À l'album",       val: sessionAlbumPhotos.length,     color: C.purple, emoji: "📁" },
            { label: "Mo libérés",      val: deletedSize.toFixed(1),        color: C.yellow, emoji: "✨" },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                width: (SW - 60) / 2,
                backgroundColor: C.bgCard,
                borderRadius: S.radius,
                padding: 20,
                alignItems: "center",
                borderWidth: 1,
                borderColor: C.border,
              }}
            >
              <Text style={{ fontSize: 24, marginBottom: 6 }}>{s.emoji}</Text>
              <Text style={{ fontSize: 28, fontWeight: "900", color: s.color }}>{s.val}</Text>
              <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Section album créé (mode album uniquement) ──────────────── */}
        {createdAlbum && (
          <View style={{
            backgroundColor: `${C.accent}12`,
            borderRadius: S.radius,
            padding: 18,
            borderWidth: 2,
            borderColor: `${C.accent}50`,
            marginBottom: 16,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 24 }}>📁</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "900", fontSize: 16, color: C.text }}>
                  {createdAlbum.name}
                </Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                  {sessionAlbumPhotos.length} photo{sessionAlbumPhotos.length > 1 ? "s" : ""} ajoutée{sessionAlbumPhotos.length > 1 ? "s" : ""} · Synchronisé dans ta galerie ✓
                </Text>
              </View>
            </View>
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

        {/* ── Section partenaires ──────────────────────────────────────── */}
        <View style={{
          backgroundColor: C.bgCard,
          borderRadius: S.radius,
          padding: 18,
          borderWidth: 1.5,
          borderColor: `${C.accent}40`,
          marginBottom: 16,
        }}>
          {/* Badge promo */}
          <View style={{
            backgroundColor: C.accent, borderRadius: 99, alignSelf: "flex-start",
            paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10,
          }}>
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#fff", letterSpacing: 0.5 }}>
              OFFRE EXCLUSIVE
            </Text>
          </View>

          <Text style={{ fontWeight: "900", fontSize: 15, color: C.text, marginBottom: 4 }}>
            15% de réduction chez nos partenaires
          </Text>
          <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 14, lineHeight: 17 }}>
            Imprime tes plus belles photos avec ton code Phototri.
          </Text>

          {/* Code promo */}
          <View style={{
            backgroundColor: `${C.accent}12`, borderRadius: 12,
            borderWidth: 1.5, borderColor: `${C.accent}40`,
            padding: 12, alignItems: "center", marginBottom: 16,
          }}>
            <Text style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Ton code</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: C.accent, letterSpacing: 2 }}>
              PHOTOTRI15
            </Text>
          </View>

          {/* Logos partenaires */}
          {[
            { name: "Cheerz",   desc: "Tirages & livres photo",  emoji: "🖼️" },
            { name: "CEWE",     desc: "Albums & photobooks",     emoji: "📚" },
            { name: "Photobox", desc: "Impressions & cadeaux",   emoji: "🎁" },
          ].map((p, i) => (
            <TouchableOpacity
              key={p.name}
              onPress={() => Alert.alert(
                `Commander chez ${p.name}`,
                `Rendez-vous sur ${p.name.toLowerCase()}.fr et saisis le code PHOTOTRI15 pour bénéficier de 15% de réduction sur ta commande !`
              )}
              style={{
                flexDirection: "row", alignItems: "center", gap: 12,
                paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: C.border,
              }}
            >
              <View style={{
                width: 42, height: 42, borderRadius: 12,
                backgroundColor: "#f5f0eb",
                alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", fontSize: 14, color: C.text }}>{p.name}</Text>
                <Text style={{ fontSize: 12, color: C.textMuted }}>{p.desc}</Text>
              </View>
              <Text style={{ fontSize: 13, color: C.accent, fontWeight: "700" }}>Voir →</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Retour accueil ───────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => navigation.popToTop()}
          style={{
            backgroundColor: C.accent,
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
