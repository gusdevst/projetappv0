// screens/TriModeScreen.js
// Écran de lancement du tri — présenté comme une modale qui slide depuis le bas.
//
// Deux modes :
//   "Ménage"  → lance le swipe sur toutes les photos restantes
//   "Album"   → step 1 : choix des filtres (par mois)
//               step 2 : nom de l'album → crée l'album → lance le swipe en mode album

import { useState, useMemo, useRef } from "react";
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StatusBar, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";

const MOIS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

// Groupe les photos par mois, retourne un tableau trié du plus récent au plus ancien
function buildMonthGroups(photos) {
  const map = {};
  photos.forEach((p) => {
    const d   = new Date(p.creationTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map[key]) {
      map[key] = { key, label: `${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`, ids: new Set() };
    }
    map[key].ids.add(p.id);
  });
  return Object.values(map)
    .sort((a, b) => b.key.localeCompare(a.key))
    .map((g) => ({ key: g.key, label: g.label, count: g.ids.size, ids: g.ids }));
}

export function TriModeScreen({ navigation }) {
  const [step, setStep] = useState(0); // 0 = choix mode, 1 = config album
  const [selectedKeys, setSelectedKeys] = useState([]); // mois cochés (vide = toutes)
  const [albumName, setAlbumName] = useState("");

  const libraryPhotos  = usePhotoStore((s) => s.libraryPhotos);
  const kept           = usePhotoStore((s) => s.kept);
  const deleted        = usePhotoStore((s) => s.deleted);
  const printed        = usePhotoStore((s) => s.printed);
  const skipped        = usePhotoStore((s) => s.skipped);
  const createAlbum    = usePhotoStore((s) => s.createAlbum);

  // Photos déjà traitées → exclues de la file
  const triedIds = useMemo(() => new Set([
    ...kept.map((x) => x.id),
    ...deleted.map((x) => x.id),
    ...printed.map((x) => x.id),
    ...skipped.map((x) => x.id),
  ]), [kept, deleted, printed, skipped]);

  const remaining   = useMemo(() => libraryPhotos.filter((p) => !triedIds.has(p.id)), [libraryPhotos, triedIds]);
  const monthGroups = useMemo(() => buildMonthGroups(remaining), [remaining]);

  // Photos correspondant aux filtres cochés (vide = toutes)
  const filteredPhotos = useMemo(() => {
    if (selectedKeys.length === 0) return remaining;
    const union = new Set(
      monthGroups.filter((g) => selectedKeys.includes(g.key)).flatMap((g) => [...g.ids])
    );
    return remaining.filter((p) => union.has(p.id));
  }, [remaining, selectedKeys, monthGroups]);

  // Ajouter / retirer un mois des filtres
  const toggleKey = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // ── Mode Ménage ───────────────────────────────────────────────────────────
  const handleMenage = () => {
    navigation.replace("Swipe", { queue: remaining });
  };

  // ── Mode Album ────────────────────────────────────────────────────────────
  const handleLancerAlbum = () => {
    const name = albumName.trim();
    if (!name || filteredPhotos.length === 0) return;
    createAlbum(name);
    const newAlbum = usePhotoStore.getState().albums.slice(-1)[0];
    navigation.replace("Swipe", {
      queue:     filteredPhotos,
      albumMode: true,
      albumId:   newAlbum.id,
      albumName: name,
    });
  };

  const canLaunch = albumName.trim().length > 0 && filteredPhotos.length > 0;

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 0 — Choix du mode
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: S.pad, paddingBottom: 0, alignSelf: "flex-start" }}
        >
          <Text style={{ fontSize: 22, color: C.textMuted }}>✕</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, padding: S.pad, justifyContent: "center" }}>
          <Text style={{ fontSize: 26, fontWeight: "900", color: C.text, marginBottom: 6 }}>
            Que veux-tu faire ?
          </Text>
          <Text style={{ fontSize: 14, color: C.textMuted, marginBottom: 36 }}>
            {remaining.length} photos t'attendent 📷
          </Text>

          {/* ── Carte Ménage ───────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={handleMenage}
            style={{
              backgroundColor: C.bgCard,
              borderRadius: S.radiusLg,
              padding: 24,
              borderWidth: 2,
              borderColor: C.border,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 38, marginBottom: 10 }}>🧹</Text>
            <Text style={{ fontSize: 18, fontWeight: "900", color: C.text, marginBottom: 6 }}>
              Faire le ménage
            </Text>
            <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 19 }}>
              Passe en revue tes photos, supprime les ratées et libère de l'espace sur ton téléphone.
            </Text>
          </TouchableOpacity>

          {/* ── Carte Album ────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => setStep(1)}
            style={{
              backgroundColor: C.accent,
              borderRadius: S.radiusLg,
              padding: 24,
              elevation: 6,
              shadowColor: C.accent,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3,
              shadowRadius: 14,
            }}
          >
            <Text style={{ fontSize: 38, marginBottom: 10 }}>📁</Text>
            <Text style={{ fontSize: 18, fontWeight: "900", color: "#fff", marginBottom: 6 }}>
              Créer un album
            </Text>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 19 }}>
              Choisis une période, donne un nom, et swipe pour sélectionner tes meilleures photos.
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 1 — Config album (filtres + nom)
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={() => setStep(0)}
            style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, padding: 8, borderWidth: 1, borderColor: C.border }}
          >
            <Text style={{ color: C.textMuted, fontSize: 16, paddingHorizontal: 4 }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontWeight: "900", fontSize: 20, color: C.text }}>Créer un album</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: S.pad, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Section filtres ────────────────────────────────────────── */}
          <Text style={sectionLabel}>Quelle période ?</Text>
          <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 14, lineHeight: 17 }}>
            Sélectionne un ou plusieurs mois. Laisse vide pour inclure toutes tes photos.
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {/* Chips de mois */}
            {monthGroups.map((g) => {
              const on = selectedKeys.includes(g.key);
              return (
                <TouchableOpacity
                  key={g.key}
                  onPress={() => toggleKey(g.key)}
                  style={[chip, on ? chipOn : chipOff]}
                >
                  <Text style={[chipText, { color: on ? C.accent : C.textMuted }]}>
                    {g.label}
                    {"  "}
                    <Text style={{ fontWeight: "500", fontSize: 11 }}>{g.count}</Text>
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Chip "Toutes les photos" */}
            {selectedKeys.length > 0 && (
              <TouchableOpacity onPress={() => setSelectedKeys([])} style={[chip, chipOff]}>
                <Text style={[chipText, { color: C.textMuted }]}>✕ Effacer les filtres</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Compteur de photos sélectionnées */}
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            backgroundColor: C.bgCard, borderRadius: S.radius,
            padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 28,
          }}>
            <Text style={{ fontSize: 22 }}>📸</Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: C.text }}>
              {filteredPhotos.length} photo{filteredPhotos.length > 1 ? "s" : ""} sélectionnée{filteredPhotos.length > 1 ? "s" : ""}
            </Text>
            {selectedKeys.length > 0 && (
              <Text style={{ fontSize: 12, color: C.textMuted, marginLeft: "auto" }}>
                {selectedKeys.length} mois
              </Text>
            )}
          </View>

          {/* ── Nom de l'album ─────────────────────────────────────────── */}
          <Text style={sectionLabel}>Nom de l'album</Text>
          <TextInput
            value={albumName}
            onChangeText={setAlbumName}
            placeholder="Ex. Vacances été 2025, Noël en famille…"
            placeholderTextColor={C.textMuted}
            returnKeyType="done"
            style={{
              backgroundColor: C.bgCard,
              borderRadius: S.radius,
              borderWidth: 1.5,
              borderColor: albumName.trim() ? C.accent : C.border,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 15,
              color: C.text,
            }}
          />

        </ScrollView>

        {/* ── Bouton flottant "Lancer le tri" ───────────────────────────── */}
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border,
          padding: S.pad,
          paddingBottom: Platform.OS === "ios" ? 32 : S.pad,
        }}>
          <TouchableOpacity
            onPress={handleLancerAlbum}
            disabled={!canLaunch}
            style={{
              backgroundColor: canLaunch ? C.accent : `${C.accent}40`,
              borderRadius: S.radius,
              padding: 16,
              alignItems: "center",
              elevation: canLaunch ? 4 : 0,
              shadowColor: C.accent,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: canLaunch ? 0.3 : 0,
              shadowRadius: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
              {filteredPhotos.length === 0
                ? "Aucune photo dans cette période"
                : albumName.trim() === ""
                ? "Entre un nom pour continuer"
                : `Lancer le tri · ${filteredPhotos.length} photos →`}
            </Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles réutilisables ───────────────────────────────────────────────────────
const sectionLabel = {
  fontSize: 11, fontWeight: "800", color: C.textMuted,
  textTransform: "uppercase", letterSpacing: 1.5,
  marginBottom: 10,
};
const chip = {
  paddingHorizontal: 14, paddingVertical: 8,
  borderRadius: S.radiusFull, borderWidth: 1.5,
};
const chipOn  = { borderColor: C.accent, backgroundColor: `${C.accent}15` };
const chipOff = { borderColor: C.border, backgroundColor: C.bgCard };
const chipText = { fontSize: 13, fontWeight: "700" };
