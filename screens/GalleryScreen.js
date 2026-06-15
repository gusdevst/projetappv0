// screens/GalleryScreen.js
// Affiche les photos d'une section (kept/deleted/album) selon route.params.section.
// - Corbeille : restauration individuelle ou vidage
// - Album souvenirs : liste des albums → tap → grille de l'album → tap → plein écran swipeable

import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Image, Modal,
  Dimensions, StatusBar, Alert, TextInput, Platform,
} from "react-native";

let NavigationBar = null;
try { NavigationBar = require("expo-navigation-bar"); } catch (e) {}
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { C, S } from "../constants/theme";
import { PhotoGrid } from "../components/PhotoGrid";
import { ZoomableImage } from "../components/ZoomableImage";
import { usePhotoStore } from "../store/usePhotoStore";

const { width: SW, height: SH } = Dimensions.get("window");

const SECTION_CONFIG = {
  kept:    { title: "Photos coup de cœur", accent: C.green,  storeKey: "kept",    showEmpty: false },
  deleted: { title: "Corbeille",           accent: C.red,    storeKey: "deleted", showEmpty: true  },
  album:   { title: "Album souvenirs",     accent: C.purple, storeKey: "printed", showEmpty: false },
};

export function GalleryScreen({ navigation, route }) {
  const section = route?.params?.section ?? "kept";
  const config  = SECTION_CONFIG[section] ?? SECTION_CONFIG.kept;
  const { title, accent, showEmpty } = config;

  const photos               = usePhotoStore((s) => s[config.storeKey]);
  const albums               = usePhotoStore((s) => s.albums);
  const emptyTrash           = usePhotoStore((s) => s.emptyTrash);
  const restorePhoto         = usePhotoStore((s) => s.restorePhoto);
  const createAlbum          = usePhotoStore((s) => s.createAlbum);
  const deleteAlbum          = usePhotoStore((s) => s.deleteAlbum);
  const removePhotoFromAlbum = usePhotoStore((s) => s.removePhotoFromAlbum);

  // Drill-down album : null = liste des albums, "__sans_album__" = photos sans album, sinon id album
  const [activeAlbumId, setActiveAlbumId] = useState(null);
  const activeAlbum = albums.find((a) => a.id === activeAlbumId) ?? null;
  const activeAlbumPhotos = activeAlbum
    ? photos.filter((p) => activeAlbum.photoIds.includes(p.id))
    : [];

  // Plein écran
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = selectedGroup ? selectedGroup[selectedIndex] : null;


  const [deleting, setDeleting]     = useState(false);
  const [newAlbumModal, setNewAlbumModal] = useState(false);
  const [newAlbumName, setNewAlbumName]   = useState("");

  // ── Masquer StatusBar + NavigationBar Android en plein écran ────────────
  const hideAndroidBars = () => {
    if (Platform.OS !== "android") return;
    StatusBar.setHidden(true, "fade");
    if (NavigationBar) {
      NavigationBar.setBehaviorAsync("immersive-sticky").catch(() => {});
      NavigationBar.setVisibilityAsync("hidden").catch(() => {});
    }
  };
  const showAndroidBars = () => {
    if (Platform.OS !== "android") return;
    StatusBar.setHidden(false, "fade");
    if (NavigationBar) NavigationBar.setVisibilityAsync("visible").catch(() => {});
  };

  useEffect(() => {
    if (selected) hideAndroidBars();
    else showAndroidBars();
  }, [selected]);

  // ─── Plein écran ────────────────────────────────────────────────────────
  const openPhoto = (group, photo) => {
    const idx = group.findIndex((p) => p.id === photo.id);
    if (idx >= 0) { setSelectedGroup(group); setSelectedIndex(idx); }
  };
  const closePhoto = () => { setSelectedGroup(null); setSelectedIndex(0); };
  const showNext = () => setSelectedIndex((i) => Math.min((selectedGroup?.length ?? 1) - 1, i + 1));
  const showPrev = () => setSelectedIndex((i) => Math.max(0, i - 1));

  // ─── Corbeille ──────────────────────────────────────────────────────────
  const confirmEmptyTrash = () => {
    Alert.alert(
      "Vider la corbeille",
      `Supprimer définitivement ${photos.length} photo(s) ? Sur iOS, elles seront récupérables 30 jours dans "Récemment supprimées".`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer", style: "destructive",
          onPress: async () => {
            setDeleting(true);
            const ok = await emptyTrash();
            setDeleting(false);
            if (!ok) Alert.alert("Erreur", "La suppression a échoué. Vérifie que tu as bien autorisé Phototri à supprimer des photos.");
          },
        },
      ]
    );
  };

  const handleRestore = (photoId) => {
    restorePhoto(photoId, config.storeKey);

    // Après retrait, le groupe courant perd une photo.
    // On recalcule : si la photo suivante existe on y va, sinon on recule, sinon on ferme.
    const remaining = (selectedGroup ?? []).filter((p) => p.id !== photoId);
    if (remaining.length === 0) {
      closePhoto();
    } else {
      // On reste au même index si possible (la photo suivante "remonte"), sinon on prend la dernière
      const nextIndex = Math.min(selectedIndex, remaining.length - 1);
      setSelectedGroup(remaining);
      setSelectedIndex(nextIndex);
    }
  };

  // ─── Albums ─────────────────────────────────────────────────────────────
  const handleCreateAlbum = () => {
    if (newAlbumName.trim().length === 0) return;
    createAlbum(newAlbumName);
    setNewAlbumName("");
    setNewAlbumModal(false);
  };

  const confirmDeleteAlbum = (album) => {
    Alert.alert(
      "Supprimer l'album",
      `Supprimer "${album.name}" ? Les photos ne sont pas supprimées, elles restent dans "Album souvenirs".`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer", style: "destructive",
          onPress: () => { deleteAlbum(album.id); if (activeAlbumId === album.id) setActiveAlbumId(null); },
        },
      ]
    );
  };

  const handleRemoveFromAlbum = (photoId) => {
    if (!activeAlbum) return;
    removePhotoFromAlbum(activeAlbum.id, photoId);
    closePhoto();
  };

  // ─── Stats albums ────────────────────────────────────────────────────────
  const photoIdsInAlbums = new Set(albums.flatMap((a) => a.photoIds));
  const photosSansAlbum  = photos.filter((p) => !photoIdsInAlbums.has(p.id));

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <TouchableOpacity
          onPress={() => {
            if (activeAlbumId) { setActiveAlbumId(null); }
            else { navigation.goBack(); }
          }}
          style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border }}
        >
          <Text style={{ color: C.textMuted, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "800", fontSize: 20, color: C.text }}>
            {activeAlbum ? activeAlbum.name : activeAlbumId === "__sans_album__" ? "Sans album" : title}
          </Text>
          {(activeAlbum || activeAlbumId === "__sans_album__") && (
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
              {activeAlbum ? activeAlbumPhotos.length : photosSansAlbum.length} photo{(activeAlbum ? activeAlbumPhotos.length : photosSansAlbum.length) !== 1 ? "s" : ""}
            </Text>
          )}
        </View>
        {!activeAlbumId && (
          <Text style={{ fontSize: 13, color: accent, fontWeight: "800" }}>{photos.length} photos</Text>
        )}
        {activeAlbum && (
          <TouchableOpacity onPress={() => confirmDeleteAlbum(activeAlbum)}>
            <Text style={{ fontSize: 20 }}>🗑</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Contenu ── */}
      <ScrollView contentContainerStyle={{ padding: 14 }}>
        {photos.length === 0 ? (
          <Text style={{ color: C.textMuted, textAlign: "center", marginTop: 60, fontSize: 15 }}>
            Aucune photo ici
          </Text>

        ) : section === "album" && !activeAlbum ? (
          // ── Vue liste des albums ──────────────────────────────────────────
          <>
            {/* Bouton créer un album */}
            <TouchableOpacity
              onPress={() => setNewAlbumModal(true)}
              style={{
                backgroundColor: C.bgCard, borderRadius: S.radius, padding: 14, marginBottom: 14,
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                borderWidth: 2, borderColor: accent, borderStyle: "dashed",
              }}
            >
              <Text style={{ fontSize: 18, color: accent, fontWeight: "800" }}>+ Nouvel album</Text>
            </TouchableOpacity>

            {/* Sans album */}
            {photosSansAlbum.length > 0 && (
              <TouchableOpacity
                onPress={() => setActiveAlbumId("__sans_album__")}
                style={{
                  backgroundColor: C.bgCard, borderRadius: S.radius, padding: 14, marginBottom: 10,
                  flexDirection: "row", alignItems: "center", gap: 12,
                  borderWidth: 1, borderColor: C.border,
                }}
              >
                {/* Vignette */}
                <View style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: C.border }}>
                  <Image source={{ uri: photosSansAlbum[0].url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", fontSize: 14, color: C.text }}>📦 Sans album</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{photosSansAlbum.length} photo{photosSansAlbum.length > 1 ? "s" : ""}</Text>
                </View>
                <Text style={{ color: C.textMuted, fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            )}

            {/* Albums */}
            {albums.length === 0 && photosSansAlbum.length === 0 && (
              <Text style={{ color: C.textMuted, textAlign: "center", marginTop: 40, fontSize: 14 }}>
                Crée ton premier album pour organiser tes photos ici.
              </Text>
            )}
            {albums.map((album) => {
              const albumPhotos = photos.filter((p) => album.photoIds.includes(p.id));
              const cover = albumPhotos[0];
              return (
                <TouchableOpacity
                  key={album.id}
                  onPress={() => setActiveAlbumId(album.id)}
                  style={{
                    backgroundColor: C.bgCard, borderRadius: S.radius, padding: 14, marginBottom: 10,
                    flexDirection: "row", alignItems: "center", gap: 12,
                    borderWidth: 1, borderColor: C.border,
                  }}
                >
                  <View style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: C.border, backgroundColor: C.bgMuted, alignItems: "center", justifyContent: "center" }}>
                    {cover
                      ? <Image source={{ uri: cover.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      : <Text style={{ fontSize: 22 }}>📁</Text>
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", fontSize: 14, color: C.text }}>📁 {album.name}</Text>
                    <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{albumPhotos.length} photo{albumPhotos.length !== 1 ? "s" : ""}</Text>
                  </View>
                  <Text style={{ color: C.textMuted, fontSize: 18 }}>›</Text>
                </TouchableOpacity>
              );
            })}
          </>

        ) : section === "album" && activeAlbumId === "__sans_album__" ? (
          // ── Vue "Sans album" ──────────────────────────────────────────────
          <PhotoGrid photos={photosSansAlbum} onPress={(p) => openPhoto(photosSansAlbum, p)} />

        ) : section === "album" && activeAlbum ? (
          // ── Vue grille d'un album ─────────────────────────────────────────
          activeAlbumPhotos.length === 0 ? (
            <Text style={{ color: C.textMuted, textAlign: "center", marginTop: 60, fontSize: 14, fontStyle: "italic" }}>
              Cet album est vide.
            </Text>
          ) : (
            <PhotoGrid photos={activeAlbumPhotos} onPress={(p) => openPhoto(activeAlbumPhotos, p)} />
          )

        ) : (
          // ── Vue grille par défaut (kept / deleted) ────────────────────────
          <PhotoGrid photos={photos} onPress={(p) => openPhoto(photos, p)} />
        )}

        {/* Vider la corbeille */}
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

      {/* ── Modal plein écran ── */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onShow={hideAndroidBars}
        onRequestClose={closePhoto}
      >
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>

          {/* Compteur position */}
          {selectedGroup && selectedGroup.length > 1 && (
            <View style={{ position: "absolute", top: 16, left: 0, right: 0, alignItems: "center", zIndex: 9 }}>
              <View style={{ backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: S.radiusFull }}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                  {selectedIndex + 1} / {selectedGroup.length}
                </Text>
              </View>
            </View>
          )}

          {/* Image zoomable + swipeable */}
          {selected && (
            <View style={{ flex: 1 }}>
              <ZoomableImage
                uri={selected.url}
                onSwipeLeft={selectedIndex < (selectedGroup?.length ?? 0) - 1 ? showNext : undefined}
                onSwipeRight={selectedIndex > 0 ? showPrev : undefined}
              />
            </View>
          )}

          {/* Actions en bas + bouton sortie */}
          {selected && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 36, paddingTop: 8, backgroundColor: "rgba(0,0,0,0.6)" }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14, textAlign: "center", marginBottom: 14 }}>
                {selected.location ? `${selected.location} · ${selected.year}` : selected.year}
              </Text>

              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                {/* Bouton sortie 🚪 — discret, à gauche */}
                <TouchableOpacity
                  onPress={closePhoto}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.1)",
                    borderRadius: S.radiusFull,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.15)",
                  }}
                >
                  <Text style={{ fontSize: 20 }}>🚪</Text>
                </TouchableOpacity>

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
                {section === "album" && activeAlbum && (
                  <TouchableOpacity
                    onPress={() => handleRemoveFromAlbum(selected.id)}
                    style={{ flex: 1, backgroundColor: "rgba(255,255,255,.15)", borderRadius: S.radius, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>↩ Retirer de l'album</Text>
                  </TouchableOpacity>
                )}
                {!["deleted", "kept"].includes(section) && !activeAlbum && (
                  <View style={{ flex: 1 }} />
                )}
              </View>
            </View>
          )}
        </GestureHandlerRootView>
      </Modal>

      {/* ── Modal "Nouvel album" ── */}
      <Modal
        visible={newAlbumModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setNewAlbumModal(false); setNewAlbumName(""); }}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(60,20,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.bgCard, borderRadius: S.radiusLg, padding: S.padLg, paddingBottom: 44 }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: C.text, marginBottom: 8 }}>Nouvel album</Text>
            <Text style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
              Donne un nom à ton album.
            </Text>
            <TextInput
              value={newAlbumName}
              onChangeText={setNewAlbumName}
              placeholder="ex. Vacances Italie 2024"
              placeholderTextColor={C.textMuted}
              autoFocus
              style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: S.radius, padding: 14, fontSize: 15, color: C.text, marginBottom: 16 }}
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
                style={{ flex: 1, backgroundColor: C.accent, borderRadius: S.radius, padding: 14, alignItems: "center", opacity: newAlbumName.trim().length === 0 ? 0.5 : 1 }}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
