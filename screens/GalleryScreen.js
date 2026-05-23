// ─────────────────────────────────────────────
// screens/GalleryScreen.js
// ─────────────────────────────────────────────
// Affiche les photos d'une section (kept/deleted/album) selon route.params.section.
// - Corbeille : permet de restaurer une photo individuelle ou de vider tout
// - Album souvenirs : permet de créer des albums nommés et d'y assigner des photos

import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Dimensions, StatusBar, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { PhotoGrid } from "../components/PhotoGrid";
import { usePhotoStore } from "../store/usePhotoStore";

const { width: SW, height: SH } = Dimensions.get("window");

// Mapping section (passé via route.params) → titre, couleur d'accent, et clé du store
const SECTION_CONFIG = {
  kept:    { title: "Photos coup de cœur", accent: C.green,  storeKey: "kept",    showEmpty: false },
  deleted: { title: "Corbeille",         accent: C.red,    storeKey: "deleted", showEmpty: true  },
  album:   { title: "Album souvenirs",   accent: C.purple, storeKey: "printed", showEmpty: false },
};

export function GalleryScreen({ navigation, route }) {
  const section = route?.params?.section ?? "kept";
  const config  = SECTION_CONFIG[section] ?? SECTION_CONFIG.kept;
  const { title, accent, showEmpty } = config;

  const photos     = usePhotoStore((s) => s[config.storeKey]);
  const albums     = usePhotoStore((s) => s.albums);
  const emptyTrash = usePhotoStore((s) => s.emptyTrash);
  const restorePhoto         = usePhotoStore((s) => s.restorePhoto);
  const createAlbum          = usePhotoStore((s) => s.createAlbum);
  const deleteAlbum          = usePhotoStore((s) => s.deleteAlbum);
  const addPhotoToAlbum      = usePhotoStore((s) => s.addPhotoToAlbum);
  const removePhotoFromAlbum = usePhotoStore((s) => s.removePhotoFromAlbum);

  const [selected, setSelected]         = useState(null); // photo affichée en plein écran
  const [deleting, setDeleting]         = useState(false);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false); // modal "Ajouter à un album"
  const [newAlbumModal, setNewAlbumModal]     = useState(false); // modal "Nouvel album"
  const [newAlbumName, setNewAlbumName]       = useState("");

  // ─── Helpers album ──────────────────────────────────────────────────────
  const photoIdsInAlbums = new Set(albums.flatMap((a) => a.photoIds));
  const photosSansAlbum  = photos.filter((p) => !photoIdsInAlbums.has(p.id));

  // ─── Actions corbeille ──────────────────────────────────────────────────
  const confirmEmptyTrash = () => {
    Alert.alert(
      "Vider la corbeille",
      `Supprimer définitivement ${photos.length} photo(s) ? Sur iOS, elles seront récupérables 30 jours dans "Récemment supprimées".`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            const ok = await emptyTrash();
            setDeleting(false);
            if (!ok) {
              Alert.alert("Erreur", "La suppression a échoué. Vérifie que tu as bien autorisé Phototri à supprimer des photos.");
            }
          },
        },
      ]
    );
  };

  const handleRestore = (photoId) => {
    restorePhoto(photoId, config.storeKey);
    setSelected(null);
  };

  // ─── Actions albums ─────────────────────────────────────────────────────
  const handleCreateAlbum = () => {
    if (newAlbumName.trim().length === 0) return;
    createAlbum(newAlbumName);
    setNewAlbumName("");
    setNewAlbumModal(false);
  };

  const confirmDeleteAlbum = (album) => {
    Alert.alert(
      "Supprimer l'album",
      `Supprimer "${album.name}" ? Les photos ne sont pas supprimées, elles repassent dans "Sans album".`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: () => deleteAlbum(album.id) },
      ]
    );
  };

  const togglePhotoInAlbum = (albumId, photoId) => {
    const album = albums.find((a) => a.id === albumId);
    if (!album) return;
    if (album.photoIds.includes(photoId)) {
      removePhotoFromAlbum(albumId, photoId);
    } else {
      addPhotoToAlbum(albumId, photoId);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.textMuted, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: "800", fontSize: 20, color: C.text, flex: 1 }}>{title}</Text>
        <Text style={{ fontSize: 13, color: accent, fontWeight: "800" }}>{photos.length} photos</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14 }}>
        {photos.length === 0 ? (
          <Text style={{ color: C.textMuted, textAlign: "center", marginTop: 60, fontSize: 15 }}>
            Aucune photo ici
          </Text>
        ) : section === "album" ? (
          // ─── Vue "Album souvenirs" : Sans album + albums créés ─────────
          <>
            {/* Bouton créer un album */}
            <TouchableOpacity
              onPress={() => setNewAlbumModal(true)}
              style={{
                backgroundColor: C.bgCard,
                borderRadius: S.radius,
                padding: 14,
                marginBottom: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderWidth: 2,
                borderColor: accent,
                borderStyle: "dashed",
              }}
            >
              <Text style={{ fontSize: 18, color: accent, fontWeight: "800" }}>+ Nouvel album</Text>
            </TouchableOpacity>

            {/* Section "Sans album" */}
            {photosSansAlbum.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontWeight: "800", fontSize: 14, color: C.text, marginBottom: 10, marginLeft: 4 }}>
                  📦 Sans album · {photosSansAlbum.length}
                </Text>
                <PhotoGrid photos={photosSansAlbum} onPress={(p) => setSelected(p)} />
              </View>
            )}

            {/* Section pour chaque album */}
            {albums.map((album) => {
              const albumPhotos = photos.filter((p) => album.photoIds.includes(p.id));
              return (
                <View key={album.id} style={{ marginBottom: 24 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, marginLeft: 4 }}>
                    <Text style={{ fontWeight: "800", fontSize: 14, color: C.text, flex: 1 }}>
                      📁 {album.name} · {albumPhotos.length}
                    </Text>
                    <TouchableOpacity onPress={() => confirmDeleteAlbum(album)}>
                      <Text style={{ fontSize: 18, color: C.textMuted }}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                  {albumPhotos.length === 0 ? (
                    <Text style={{ color: C.textMuted, fontSize: 12, fontStyle: "italic", marginLeft: 4 }}>
                      Aucune photo dans cet album. Appuie sur une photo "Sans album" pour l'ajouter.
                    </Text>
                  ) : (
                    <PhotoGrid photos={albumPhotos} onPress={(p) => setSelected(p)} />
                  )}
                </View>
              );
            })}
          </>
        ) : (
          // ─── Vue par défaut : grille simple ─────────────────────────────
          <PhotoGrid photos={photos} onPress={(p) => setSelected(p)} />
        )}

        {/* Bouton "Vider la corbeille" (uniquement section deleted) */}
        {showEmpty && photos.length > 0 && (
          <TouchableOpacity
            onPress={confirmEmptyTrash}
            disabled={deleting}
            style={{ backgroundColor: C.red, borderRadius: S.radius, padding: 14, alignItems: "center", marginTop: 20, opacity: deleting ? 0.6 : 1 }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
              {deleting ? "Suppression…" : `Vider la corbeille (${photos.reduce((a, p) => a + p.size, 0).toFixed(1)} Mo)`}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ─── Modal Photo en grand ─────────────────────────────────────── */}
      <Modal visible={!!selected} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" }}>
          <TouchableOpacity onPress={() => setSelected(null)} style={{ position: "absolute", top: 52, right: 20, backgroundColor: "rgba(255,255,255,.2)", borderRadius: S.radiusFull, padding: 10, zIndex: 10 }}>
            <Text style={{ color: "#fff", fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
          {selected && (
            <>
              <Image source={{ uri: selected.url }} style={{ width: SW - 40, height: SH * 0.55, borderRadius: S.radius }} resizeMode="contain" />
              <Text style={{ color: "#fff", fontWeight: "700", marginTop: 16, fontSize: 15 }}>
                {selected.location ? `${selected.location} · ${selected.year}` : selected.year}
              </Text>

              {/* Actions selon la section */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 24, paddingHorizontal: 20 }}>
                {section === "deleted" && (
                  <TouchableOpacity
                    onPress={() => handleRestore(selected.id)}
                    style={{ flex: 1, backgroundColor: C.green, borderRadius: S.radius, padding: 14, alignItems: "center" }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>↩ Restaurer</Text>
                  </TouchableOpacity>
                )}
                {section === "kept" && (
                  <TouchableOpacity
                    onPress={() => handleRestore(selected.id)}
                    style={{ flex: 1, backgroundColor: "rgba(255,255,255,.2)", borderRadius: S.radius, padding: 14, alignItems: "center" }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>↩ Retirer des coups de cœur</Text>
                  </TouchableOpacity>
                )}
                {section === "album" && (
                  <>
                    <TouchableOpacity
                      onPress={() => setShowAlbumPicker(true)}
                      style={{ flex: 1, backgroundColor: C.accent, borderRadius: S.radius, padding: 14, alignItems: "center" }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>📁 Ajouter à un album</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRestore(selected.id)}
                      style={{ flex: 1, backgroundColor: "rgba(255,255,255,.2)", borderRadius: S.radius, padding: 14, alignItems: "center" }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>↩ Retirer</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* ─── Modal "Nouvel album" ──────────────────────────────────────── */}
      <Modal visible={newAlbumModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(60,20,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.bgCard, borderRadius: S.radiusLg, padding: S.padLg, paddingBottom: 44 }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: C.text, marginBottom: 8 }}>Nouvel album</Text>
            <Text style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
              Donne un nom à ton album. Tu pourras ensuite y assigner des photos.
            </Text>
            <TextInput
              value={newAlbumName}
              onChangeText={setNewAlbumName}
              placeholder="ex. Vacances Italie 2024"
              placeholderTextColor={C.textMuted}
              autoFocus
              style={{
                borderWidth: 1.5,
                borderColor: C.border,
                borderRadius: S.radius,
                padding: 14,
                fontSize: 15,
                color: C.text,
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setNewAlbumModal(false); setNewAlbumName(""); }}
                style={{ flex: 1, backgroundColor: C.bgMuted, borderRadius: S.radius, padding: 14, alignItems: "center" }}
              >
                <Text style={{ color: C.textMid, fontWeight: "700", fontSize: 14 }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateAlbum}
                disabled={newAlbumName.trim().length === 0}
                style={{
                  flex: 1,
                  backgroundColor: C.accent,
                  borderRadius: S.radius,
                  padding: 14,
                  alignItems: "center",
                  opacity: newAlbumName.trim().length === 0 ? 0.5 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Modal "Choisir un album" ──────────────────────────────────── */}
      <Modal visible={showAlbumPicker} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(60,20,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.bgCard, borderRadius: S.radiusLg, padding: S.padLg, paddingBottom: 44, maxHeight: SH * 0.7 }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: C.text, marginBottom: 16 }}>Ajouter à un album</Text>

            {albums.length === 0 ? (
              <Text style={{ color: C.textMuted, fontSize: 14, marginBottom: 16 }}>
                Tu n'as pas encore créé d'album. Crée-en un d'abord.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: SH * 0.4 }}>
                {albums.map((album) => {
                  const isIn = selected && album.photoIds.includes(selected.id);
                  return (
                    <TouchableOpacity
                      key={album.id}
                      onPress={() => { if (selected) togglePhotoInAlbum(album.id, selected.id); }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 14,
                        backgroundColor: isIn ? `${C.accent}15` : "transparent",
                        borderRadius: S.radius,
                        marginBottom: 6,
                        borderWidth: 1,
                        borderColor: isIn ? C.accent : C.border,
                      }}
                    >
                      <Text style={{ fontSize: 18, marginRight: 12 }}>📁</Text>
                      <Text style={{ flex: 1, fontWeight: "700", fontSize: 14, color: C.text }}>{album.name}</Text>
                      <Text style={{ color: isIn ? C.accent : C.textMuted, fontSize: 14, fontWeight: "800" }}>
                        {isIn ? "✓ Retirer" : "+ Ajouter"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              onPress={() => { setShowAlbumPicker(false); setNewAlbumModal(true); }}
              style={{ backgroundColor: C.bgMuted, borderRadius: S.radius, padding: 14, alignItems: "center", marginTop: 8, borderWidth: 1, borderColor: C.border, borderStyle: "dashed" }}
            >
              <Text style={{ color: C.accent, fontWeight: "800", fontSize: 14 }}>+ Créer un nouvel album</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowAlbumPicker(false)}
              style={{ marginTop: 14, alignItems: "center" }}
            >
              <Text style={{ color: C.textMuted, fontSize: 14 }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
