// screens/PartenairesScreen.js
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import BackButton from "../components/BackButton";

const PARTNERS = [
  {
    name: "Cheerz",
    emoji: "🖼️",
    bg: "#fef3e2",
    color: "#e8903a",
    tagline: "Le spécialiste du tirage photo",
    description: "Tirages carrés, classiques ou panoramiques. Livres photo haut de gamme avec reliure souple ou rigide. Interface simple et rendu de qualité.",
    specialties: ["Tirages & polaroids", "Livres photo", "Calendriers", "Posters & cadres"],
    discount: 15,
    code: "PHOTOTRI15",
    website: "cheerz.com",
  },
  {
    name: "CEWE",
    emoji: "📚",
    bg: "#e8f4fd",
    color: "#3a7ec8",
    tagline: "Le leader européen du photobook",
    description: "N°1 en Europe pour les albums photo. Qualité d'impression professionnelle, large choix de formats et de papiers. Idéal pour les grands albums de famille.",
    specialties: ["Albums & photobooks", "Tirages grand format", "Cartes postales", "Produits cadeaux"],
    discount: 15,
    code: "PHOTOTRI15",
    website: "cewe.fr",
  },
  {
    name: "Photobox",
    emoji: "🎁",
    bg: "#e6f4f2",
    color: C.album,
    tagline: "Impressions & cadeaux personnalisés",
    description: "Large gamme de produits personnalisés : coussins, mugs, puzzles, toiles canvas. Parfait pour offrir ou décorer. Livraison rapide partout en France.",
    specialties: ["Impressions & canvas", "Cadeaux personnalisés", "Mugs & coussins", "Puzzles photo"],
    discount: 20,
    code: "PHOTOTRI20",
    website: "photobox.fr",
  },
];

const COMING_SOON = [
  { name: "Fizzer", emoji: "💌", desc: "Cartes postales depuis ton téléphone" },
  { name: "Printful", emoji: "👕", desc: "Vêtements & objets avec tes photos" },
];

export function PartenairesScreen({ navigation }) {
  // MVP : impression non disponible — on n'ouvre pas les sites partenaires.
  function openWebsite() {
    Alert.alert("Bientôt disponible", "L'impression de tes souvenirs arrive bientôt 🌸");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "900", fontSize: 20, color: C.text }}>Mes partenaires</Text>
          <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Codes exclusifs Pellicule</Text>
        </View>
        <View style={{ backgroundColor: `${C.accent}18`, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: C.accent }}>3 offres</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>

        {/* ── Bandeau intro ────────────────────────────────────────────── */}
        <View style={{
          backgroundColor: `${C.accent}12`, borderRadius: 16,
          borderWidth: 1.5, borderColor: `${C.accent}30`,
          padding: 16, marginBottom: 20,
          flexDirection: "row", alignItems: "center", gap: 12,
        }}>
          <Text style={{ fontSize: 32 }}>🤝</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "900", fontSize: 15, color: C.text, marginBottom: 3 }}>
              Partenaires sélectionnés pour toi
            </Text>
            <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 17 }}>
              Des réductions exclusives pour donner vie à tes meilleures photos.
            </Text>
          </View>
        </View>

        {/* ── Cartes partenaires ────────────────────────────────────────── */}
        {PARTNERS.map((p, index) => (
          <View
            key={p.name}
            style={{
              backgroundColor: C.bgCard, borderRadius: 18,
              borderWidth: 1, borderColor: C.border,
              marginBottom: 16, overflow: "hidden",
            }}
          >
            {/* En-tête carte */}
            <View style={{ backgroundColor: p.bg, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}>
                <Text style={{ fontSize: 26 }}>{p.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "900", fontSize: 18, color: p.color }}>{p.name}</Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>{p.tagline}</Text>
              </View>
              <View style={{ backgroundColor: p.color, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ fontSize: 12, fontWeight: "900", color: "#fff" }}>-{p.discount}%</Text>
              </View>
            </View>

            <View style={{ padding: 16 }}>
              {/* Description */}
              <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 19, marginBottom: 14 }}>
                {p.description}
              </Text>

              {/* Spécialités */}
              <Text style={{ fontSize: 10, fontWeight: "800", color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                Spécialités
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {p.specialties.map((s) => (
                  <View key={s} style={{ backgroundColor: `${p.color}12`, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: `${p.color}30` }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: p.color }}>{s}</Text>
                  </View>
                ))}
              </View>

              {/* Code promo */}
              <View style={{ backgroundColor: `${p.color}10`, borderRadius: 12, borderWidth: 1.5, borderColor: `${p.color}30`, padding: 12, alignItems: "center", marginBottom: 14 }}>
                <Text style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>Ton code exclusif</Text>
                <Text style={{ fontSize: 20, fontWeight: "900", color: p.color, letterSpacing: 2 }}>{p.code}</Text>
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{p.discount}% de réduction sur ta commande</Text>
              </View>

              {/* Bouton */}
              <TouchableOpacity
                onPress={() => openWebsite(p.website)}
                style={{
                  backgroundColor: p.color, borderRadius: 12,
                  padding: 13, alignItems: "center",
                  flexDirection: "row", justifyContent: "center", gap: 8,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
                  Commander sur {p.name}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>→</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* ── Bientôt disponible ───────────────────────────────────────── */}
        <Text style={{ fontSize: 10, fontWeight: "800", color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
          Bientôt disponible
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          {COMING_SOON.map((p) => (
            <View key={p.name} style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, alignItems: "center", opacity: 0.6 }}>
              <Text style={{ fontSize: 24, marginBottom: 6 }}>{p.emoji}</Text>
              <Text style={{ fontWeight: "800", fontSize: 13, color: C.text }}>{p.name}</Text>
              <Text style={{ fontSize: 10, color: C.textMuted, textAlign: "center", marginTop: 3 }}>{p.desc}</Text>
            </View>
          ))}
        </View>

        {/* ── Note bas de page ─────────────────────────────────────────── */}
        <Text style={{ fontSize: 10, color: C.textMuted, textAlign: "center", lineHeight: 15 }}>
          Les codes sont valables jusqu'à épuisement des offres.{"\n"}
          Pellicule n'est pas responsable des conditions de vente des partenaires.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

export default PartenairesScreen;
