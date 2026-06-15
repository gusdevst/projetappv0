// screens/TriModeScreen.js
// Écran de lancement du tri — présenté comme une modale qui slide depuis le bas.
//
// Deux modes :
//   "Ménage"  → lance le swipe sur toutes les photos restantes (ou preQueue si fourni)
//   "Album"   → step 1 : choix créer un nouvel album ou continuer un existant
//               step 2 (nouvel album) : filtres mois + nom → crée l'album → lance le swipe
//               step 2 (album existant) : sélectionner l'album → lance le swipe

import { useState, useMemo, useEffect } from "react";
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

export function TriModeScreen({ navigation, route }) {
  // preQueue : file de photos pré-construite (depuis MomentScreen / DuplicatesScreen)
  const preQueue      = route.params?.preQueue      ?? null;
  const skipToMenage  = route.params?.skipToMenage  ?? false;
  // skipToAlbum : vient du toggle "Album" de HomeScreen → on saute le step 0
  const skipToAlbum   = route.params?.skipToAlbum   ?? false;

  // step 0 = choix ménage/album
  // step 1 = album : nouveau ou existant ?
  // step 2 = config (filtres + nom si nouvel album ; liste si existant)
  const [step, setStep]                       = useState(skipToAlbum ? 1 : 0);
  const [albumSubStep, setAlbumSubStep]       = useState(null); // "new" | "existing"
  const [selectedKeys, setSelectedKeys]       = useState([]);
  const [albumName, setAlbumName]             = useState("");
  const [selectedExistingAlbum, setSelectedExistingAlbum] = useState(null);

  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const kept          = usePhotoStore((s) => s.kept);
  const deleted       = usePhotoStore((s) => s.deleted);
  const printed       = usePhotoStore((s) => s.printed);
  const skipped       = usePhotoStore((s) => s.skipped);
  const createAlbum   = usePhotoStore((s) => s.createAlbum);
  const albums        = usePhotoStore((s) => s.albums);

  const triedIds = useMemo(() => new Set([
    ...kept.map((x) => x.id),
    ...deleted.map((x) => x.id),
    ...printed.map((x) => x.id),
    ...skipped.map((x) => x.id),
  ]), [kept, deleted, printed, skipped]);

  // Si preQueue fourni (depuis MomentScreen etc.), on l'utilise tel quel
  const remaining   = preQueue ?? libraryPhotos.filter((p) => !triedIds.has(p.id));
  const monthGroups = useMemo(() => buildMonthGroups(remaining), [remaining]);

  const filteredPhotos = useMemo(() => {
    if (selectedKeys.length === 0) return remaining;
    const union = new Set(
      monthGroups.filter((g) => selectedKeys.includes(g.key)).flatMap((g) => [...g.ids])
    );
    return remaining.filter((p) => union.has(p.id));
  }, [remaining, selectedKeys, monthGroups]);

  const toggleKey = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // ── Mode Ménage ───────────────────────────────────────────────────────────
  const handleMenage = () => {
    navigation.replace("Swipe", { queue: remaining, mode: "menage" });
  };

  // Aléatoire : sauter directement en ménage APRÈS le rendu (jamais pendant)
  useEffect(() => {
    if (skipToMenage && preQueue) {
      navigation.replace("Swipe", { queue: preQueue, mode: "menage" });
    }
  }, []);

  // ── Mode Album — Nouvel album ─────────────────────────────────────────────
  const handleLancerNouvelAlbum = () => {
    const name = albumName.trim();
    if (!name || filteredPhotos.length === 0) return;
    createAlbum(name);
    const newAlbum = usePhotoStore.getState().albums.slice(-1)[0];
    navigation.replace("Swipe", {
      queue:     filteredPhotos,
      mode:      "album",
      albumId:   newAlbum.id,
      albumName: name,
    });
  };

  // ── Mode Album — Album existant ───────────────────────────────────────────
  const handleLancerAlbumExistant = () => {
    if (!selectedExistingAlbum || filteredPhotos.length === 0) return;
    navigation.replace("Swipe", {
      queue:     filteredPhotos,
      mode:      "album",
      albumId:   selectedExistingAlbum.id,
      albumName: selectedExistingAlbum.name,
    });
  };

  const canLaunchNew      = albumName.trim().length > 0 && filteredPhotos.length > 0;
  const canLaunchExisting = !!selectedExistingAlbum && filteredPhotos.length > 0;

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 0 — Choix du mode
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 0) {
    const photoCount = preQueue ? preQueue.length : remaining.length;
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
          <Text style={{ fontSize: 26, fontWeight: "900", color: C.text, marginBottom: 6, textAlign: "center" }}>
            Que veux-tu faire ?
          </Text>
          <Text style={{ fontSize: 14, color: C.textMuted, marginBottom: 36, textAlign: "center" }}>
            {`${photoCount} photo${photoCount > 1 ? "s" : ""} sélectionnée${photoCount > 1 ? "s" : ""} 📷`}
          </Text>

          {/* ── Carte Ménage ───────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={handleMenage}
            style={{
              borderRadius: S.radiusLg,
              padding: 24,
              marginBottom: 16,
              alignItems: "center",
              backgroundColor: "#1a1a1a",
              elevation: 4,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.18,
              shadowRadius: 10,
            }}
          >
            <Text style={{ fontSize: 42, marginBottom: 10 }}>🧹</Text>
            <Text style={{ fontSize: 18, fontWeight: "900", color: "#fff", marginBottom: 6, textAlign: "center" }}>
              Faire le ménage
            </Text>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 19, textAlign: "center" }}>
              Supprime les ratées et libère de l'espace sur ton téléphone.
            </Text>
          </TouchableOpacity>

          {/* ── Carte Album ────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => setStep(1)}
            style={{
              backgroundColor: C.album,
              borderRadius: S.radiusLg,
              padding: 24,
              alignItems: "center",
              elevation: 6,
              shadowColor: C.album,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3,
              shadowRadius: 14,
            }}
          >
            <Text style={{ fontSize: 42, marginBottom: 10 }}>🖼️</Text>
            <Text style={{ fontSize: 18, fontWeight: "900", color: "#fff", marginBottom: 6, textAlign: "center" }}>
              Créer / compléter un album
            </Text>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 19, textAlign: "center" }}>
              Construis un album en swipant les photos que tu veux garder.
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 1 — Nouvel album ou album existant ?
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 1) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={() => setStep(0)}
            style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, padding: 8, borderWidth: 1, borderColor: C.border }}
          >
            <Text style={{ color: C.textMuted, fontSize: 16, paddingHorizontal: 4 }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontWeight: "900", fontSize: 20, color: C.text }}>Album</Text>
        </View>

        <View style={{ flex: 1, padding: S.pad, justifyContent: "center" }}>
          {/* ── Nouvel album ───────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => { setAlbumSubStep("new"); setStep(2); }}
            style={{
              backgroundColor: C.album,
              borderRadius: S.radiusLg,
              padding: 24,
              marginBottom: 16,
              elevation: 6,
              shadowColor: C.album,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3,
              shadowRadius: 14,
            }}
          >
            <Text style={{ fontSize: 38, marginBottom: 10 }}>✨</Text>
            <Text style={{ fontSize: 18, fontWeight: "900", color: "#fff", marginBottom: 6 }}>
              Créer un nouvel album
            </Text>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 19 }}>
              Choisis une période, donne un nom, et commence à trier.
            </Text>
          </TouchableOpacity>

          {/* ── Album existant ─────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => { setAlbumSubStep("existing"); setStep(2); }}
            disabled={albums.length === 0}
            style={{
              backgroundColor: C.bgCard,
              borderRadius: S.radiusLg,
              padding: 24,
              borderWidth: 2,
              borderColor: C.border,
              opacity: albums.length === 0 ? 0.5 : 1,
            }}
          >
            <Text style={{ fontSize: 38, marginBottom: 10 }}>📂</Text>
            <Text style={{ fontSize: 18, fontWeight: "900", color: C.text, marginBottom: 6 }}>
              Continuer un album existant
            </Text>
            <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 19 }}>
              {albums.length === 0
                ? "Aucun album créé pour l'instant."
                : `${albums.length} album${albums.length > 1 ? "s" : ""} disponible${albums.length > 1 ? "s" : ""}`}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 2 — Config filtres + nom/album
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={() => setStep(1)}
            style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, padding: 8, borderWidth: 1, borderColor: C.border }}
          >
            <Text style={{ color: C.textMuted, fontSize: 16, paddingHorizontal: 4 }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontWeight: "900", fontSize: 20, color: C.text }}>
            {albumSubStep === "new" ? "Nouvel album" : "Continuer un album"}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: S.pad, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Liste des albums existants ──────────────────────────── */}
          {albumSubStep === "existing" && (
            <>
              <Text style={sectionLabel}>Choisir un album</Text>
              {albums.map((a) => {
                const isActive = selectedExistingAlbum?.id === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => setSelectedExistingAlbum(a)}
                    style={{
                      backgroundColor: isActive ? `${C.album}15` : C.bgCard,
                      borderRadius: S.radius,
                      borderWidth: 1.5,
                      borderColor: isActive ? C.album : C.border,
                      padding: 14,
                      marginBottom: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>📁</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "700", fontSize: 14, color: C.text }}>{a.name}</Text>
                      <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                        {a.photoIds.length} photo{a.photoIds.length > 1 ? "s" : ""}
                      </Text>
                    </View>
                    {isActive && <Text style={{ color: C.album, fontSize: 18 }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 20 }} />
            </>
          )}

          {/* ── Filtres mois — masqués si les photos viennent d'un contexte pré-filtré ── */}
          {preQueue ? (
            // Résumé de la sélection pré-filtrée (par moment, par lieu…)
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 10,
              backgroundColor: `${C.album}12`, borderRadius: S.radius,
              padding: 14, borderWidth: 1.5, borderColor: C.album, marginBottom: 28,
            }}>
              <Text style={{ fontSize: 22 }}>✅</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: C.album }}>
                  {preQueue.length} photo{preQueue.length > 1 ? "s" : ""} déjà sélectionnée{preQueue.length > 1 ? "s" : ""}
                </Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                  Filtres appliqués depuis la sélection précédente
                </Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={sectionLabel}>Quelle période ?</Text>
              <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 14, lineHeight: 17 }}>
                Sélectionne un ou plusieurs mois. Laisse vide pour inclure toutes tes photos.
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {monthGroups.map((g) => {
                  const on = selectedKeys.includes(g.key);
                  return (
                    <TouchableOpacity
                      key={g.key}
                      onPress={() => toggleKey(g.key)}
                      style={[chip, on ? chipOn : chipOff]}
                    >
                      <Text style={[chipText, { color: on ? C.album : C.textMuted }]}>
                        {g.label}{"  "}
                        <Text style={{ fontWeight: "500", fontSize: 11 }}>{g.count}</Text>
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {selectedKeys.length > 0 && (
                  <TouchableOpacity onPress={() => setSelectedKeys([])} style={[chip, chipOff]}>
                    <Text style={[chipText, { color: C.textMuted }]}>✕ Effacer les filtres</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Compteur */}
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
            </>
          )}

          {/* ── Nom du nouvel album ───────────────────────────────────── */}
          {albumSubStep === "new" && (
            <>
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
                  borderColor: albumName.trim() ? C.album : C.border,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 15,
                  color: C.text,
                }}
              />
            </>
          )}

        </ScrollView>

        {/* ── Bouton flottant ───────────────────────────────────────────── */}
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border,
          padding: S.pad,
          paddingBottom: Platform.OS === "ios" ? 32 : S.pad,
        }}>
          {albumSubStep === "new" ? (
            <TouchableOpacity
              onPress={handleLancerNouvelAlbum}
              disabled={!canLaunchNew}
              style={{
                backgroundColor: canLaunchNew ? C.album : `${C.album}40`,
                borderRadius: S.radius, padding: 16, alignItems: "center",
                elevation: canLaunchNew ? 4 : 0,
                shadowColor: C.album, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: canLaunchNew ? 0.3 : 0, shadowRadius: 8,
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
          ) : (
            <TouchableOpacity
              onPress={handleLancerAlbumExistant}
              disabled={!canLaunchExisting}
              style={{
                backgroundColor: canLaunchExisting ? C.album : `${C.album}40`,
                borderRadius: S.radius, padding: 16, alignItems: "center",
                elevation: canLaunchExisting ? 4 : 0,
                shadowColor: C.album, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: canLaunchExisting ? 0.3 : 0, shadowRadius: 8,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
                {!selectedExistingAlbum
                  ? "Choisis un album pour continuer"
                  : filteredPhotos.length === 0
                  ? "Aucune photo dans cette période"
                  : `Continuer "${selectedExistingAlbum.name}" · ${filteredPhotos.length} photos →`}
              </Text>
            </TouchableOpacity>
          )}
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
const chipOn  = { borderColor: C.album, backgroundColor: `${C.album}15` };
const chipOff = { borderColor: C.border, backgroundColor: C.bgCard };
const chipText = { fontSize: 13, fontWeight: "700" };
