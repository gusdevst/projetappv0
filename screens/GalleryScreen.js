// screens/GalleryScreen.js
// Affiche les photos d'une section (kept/deleted/album) selon route.params.section.
// - Corbeille : restauration individuelle ou vidage
// - Album souvenirs : liste des albums → tap → grille de l'album → tap → plein écran swipeable

import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  Dimensions, StatusBar, Alert, TextInput, Platform,
} from "react-native";
import { Image } from "expo-image";

let NavigationBar = null;
try { NavigationBar = require("expo-navigation-bar"); } catch (e) {}
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { C, S } from "../constants/theme";
import { PhotoGrid } from "../components/PhotoGrid";
import { ZoomableImage } from "../components/ZoomableImage";
import BackButton from "../components/BackButton";
import { usePhotoStore } from "../store/usePhotoStore";
import * as Sharing from "expo-sharing";
import { addPhotoToPelliculeAlbum } from "../services/photoLibrary";

const { width: SW, height: SH } = Dimensions.get("window");

// Icône de partage standard (3 points reliés, style Android) dessinée en Views,
// faute de librairie d'icônes dans le projet.
function ShareIcon({ color = "#fff", size = 20 }) {
  const d = size * 0.3;
  const dot  = { position: "absolute", width: d, height: d, borderRadius: d / 2, backgroundColor: color };
  const L = { x: d / 2, y: size / 2 };
  const T = { x: size - d / 2, y: d / 2 };
  const B = { x: size - d / 2, y: size - d / 2 };
  const seg = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    return {
      position: "absolute", height: 2, borderRadius: 1, backgroundColor: color,
      width: len, left: (a.x + b.x) / 2 - len / 2, top: (a.y + b.y) / 2 - 1,
      transform: [{ rotate: `${ang}deg` }],
    };
  };
  return (
    <View style={{ width: size, height: size }}>
      <View style={seg(L, T)} />
      <View style={seg(L, B)} />
      <View style={[dot, { left: L.x - d / 2, top: L.y - d / 2 }]} />
      <View style={[dot, { left: T.x - d / 2, top: T.y - d / 2 }]} />
      <View style={[dot, { left: B.x - d / 2, top: B.y - d / 2 }]} />
    </View>
  );
}

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
  const addPhotoToAlbum      = usePhotoStore((s) => s.addPhotoToAlbum);

  // Drill-down album : null = liste des albums, "__sans_album__" = photos sans album, sinon id album
  // On peut ouvrir directement un album via route.params.albumId (lien depuis le bilan de tri).
  const [activeAlbumId, setActiveAlbumId] = useState(route?.params?.albumId ?? null);
  const activeAlbum = albums.find((a) => a.id === activeAlbumId) ?? null;
  const activeAlbumPhotos = activeAlbum
    ? photos.filter((p) => activeAlbum.photoIds.includes(p.id))
    : [];

  // Plein écran
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = selectedGroup ? selectedGroup[selectedIndex] : null;


  const [deleting, setDeleting]         = useState(false);
  // ── Sélection multiple (appui long → mode sélection) ────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds,   setSelectedIds]   = useState(new Set());
  // ── Export ──────────────────────────────────────────────────────────────────
  const [showExport, setShowExport]     = useState(false);
  const [syncLoading, setSyncLoading]   = useState(false);
  const [syncDone, setSyncDone]         = useState(false);
  const [newAlbumModal, setNewAlbumModal] = useState(false);
  const [newAlbumName, setNewAlbumName]   = useState("");
  // Affectation d'une photo "sans album" : la photo à ranger (null = feuille fermée)
  const [assignPhoto, setAssignPhoto] = useState(null);
  // Nom saisi pour créer un album directement depuis la feuille d'affectation
  const [assignNewName, setAssignNewName] = useState("");

  // ── Partage natif (WhatsApp, SMS, etc.) ──────────────────────────────────
  const handleShare = async (photo) => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Partage indisponible", "Cette fonctionnalité n'est pas disponible sur cet appareil.");
        return;
      }
      await Sharing.shareAsync(photo.url);
    } catch (e) {
      Alert.alert("Erreur", "Impossible de partager cette photo.");
    }
  };

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

  // ── Gestion de la sélection multiple ───────────────────────────────────────
  const enterSelectionMode = (photo) => {
    setSelectionMode(true);
    setSelectedIds(new Set([photo.id]));
  };
  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };
  const toggleSelection = (photo) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photo.id)) next.delete(photo.id);
      else next.add(photo.id);
      return next;
    });
  };
  // Handler unifié : en mode sélection → toggle, sinon → plein écran
  const handlePhotoPress = (photo, group) => {
    if (selectionMode) { toggleSelection(photo); return; }
    openPhoto(group, photo);
  };

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
            if (!ok) Alert.alert("Erreur", "La suppression a échoué. Vérifie que tu as bien autorisé Pellicule à supprimer des photos.");
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

  // ─── Photo "sans album" : affecter à un album ou retirer du menu ─────────
  // Tout se passe dans UNE seule feuille (pas d'empilement de modales) :
  // on n'ouvre pas le plein écran, on ouvre directement la feuille d'affectation.
  const closeAssign = () => { setAssignPhoto(null); setAssignNewName(""); };
  const handleAssignToAlbum = (albumId) => {
    if (assignPhoto) addPhotoToAlbum(albumId, assignPhoto.id);
    closeAssign();
  };
  // Crée un album et y range la photo, directement depuis la feuille.
  const handleCreateAndAssign = () => {
    const name = assignNewName.trim();
    if (!name || !assignPhoto) return;
    createAlbum(name);
    const fresh = usePhotoStore.getState().albums;
    const newId = fresh[fresh.length - 1]?.id;
    if (newId) addPhotoToAlbum(newId, assignPhoto.id);
    closeAssign();
  };
  // Retire la photo de "Album souvenirs" (pile printed) → elle quitte ce menu.
  const handleRemoveFromSouvenirs = () => {
    if (assignPhoto) restorePhoto(assignPhoto.id, "printed");
    closeAssign();
  };

  // ── Export : synchroniser vers la galerie native ─────────────────────────
  // En mode sélection, on n'exporte que les photos sélectionnées ; sinon toutes.
  const allExportPhotos  = section === "kept" ? photos : activeAlbumPhotos;
  const exportPhotos     = selectionMode && selectedIds.size > 0
    ? allExportPhotos.filter((p) => selectedIds.has(p.id))
    : allExportPhotos;
  const exportAlbumName  = section === "kept" ? "❤️ Coups de cœur" : (activeAlbum?.name ?? "Album");

  const handleSyncToGallery = async () => {
    if (exportPhotos.length === 0) return;
    setSyncLoading(true);
    setSyncDone(false);
    try {
      // On appelle addPhotoToPelliculeAlbum pour chaque photo.
      // La fonction crée le dossier natif à la 1ère photo, puis y ajoute les suivantes.
      for (const photo of exportPhotos) {
        await addPhotoToPelliculeAlbum(photo.id, exportAlbumName);
      }
      setSyncDone(true);
    } catch (err) {
      Alert.alert("Erreur", "La synchronisation a échoué. Vérifie les permissions de l'app.");
    } finally {
      setSyncLoading(false);
    }
  };

  const confirmDeleteAlbum = (album) => {
    Alert.alert(
      "Supprimer l'album",
      `Supprimer "${album.name}" ? Les photos contenues dans cet album seront retirées du menu "Album souvenirs". Elles ne sont pas supprimées de ton téléphone.`,
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
        <BackButton
          accentColor={section === "album" ? C.album : config.accent}
          onPress={() => {
            if (activeAlbumId) { setActiveAlbumId(null); }
            else { navigation.goBack(); }
          }}
        />
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* Bouton export visible dans la section "Coups de cœur" */}
            {section === "kept" && photos.length > 0 && (
              <TouchableOpacity
                onPress={() => { setSyncDone(false); setShowExport(true); }}
                style={{ backgroundColor: `${accent}15`, borderRadius: S.radiusFull, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: accent }}
              >
                <Text style={{ fontSize: 13, color: accent, fontWeight: "800" }}>📤 Exporter</Text>
              </TouchableOpacity>
            )}
            <Text style={{ fontSize: 13, color: accent, fontWeight: "800" }}>{photos.length} photos</Text>
          </View>
        )}
        {activeAlbum && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {/* Bouton export de l'album ouvert */}
            {activeAlbumPhotos.length > 0 && (
              <TouchableOpacity
                onPress={() => { setSyncDone(false); setShowExport(true); }}
                style={{ backgroundColor: `${accent}15`, borderRadius: S.radiusFull, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: accent }}
              >
                <Text style={{ fontSize: 13, color: accent, fontWeight: "800" }}>📤 Exporter</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => confirmDeleteAlbum(activeAlbum)}>
              <Text style={{ fontSize: 20 }}>🗑</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Bannière "vider la corbeille" en haut (section deleted) ── */}
      {showEmpty && photos.length > 0 && (
        <TouchableOpacity
          onPress={confirmEmptyTrash}
          disabled={deleting}
          style={{
            marginHorizontal: S.pad,
            marginBottom: 10,
            backgroundColor: `${C.red}12`,
            borderRadius: S.radius,
            padding: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderWidth: 1.5,
            borderColor: `${C.red}40`,
            opacity: deleting ? 0.6 : 1,
          }}
        >
          <Text style={{ color: C.red, fontWeight: "700", fontSize: 13 }}>
            🗑 {deleting ? "Suppression…" : "Vider la corbeille"}
          </Text>
          <Text style={{ color: C.red, fontSize: 12 }}>
            {photos.reduce((a, p) => a + p.size, 0).toFixed(1)} Mo · {photos.length} photo{photos.length > 1 ? "s" : ""}
          </Text>
        </TouchableOpacity>
      )}

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
          // ── Vue "Sans album" : un tap ouvre la feuille d'affectation ──────
          <PhotoGrid photos={photosSansAlbum} onPress={(p) => setAssignPhoto(p)} />

        ) : section === "album" && activeAlbum ? (
          // ── Vue grille d'un album ─────────────────────────────────────────
          activeAlbumPhotos.length === 0 ? (
            <Text style={{ color: C.textMuted, textAlign: "center", marginTop: 60, fontSize: 14, fontStyle: "italic" }}>
              Cet album est vide.
            </Text>
          ) : (
            <PhotoGrid
            photos={activeAlbumPhotos}
            onPress={(p) => handlePhotoPress(p, activeAlbumPhotos)}
            onLongPress={enterSelectionMode}
            selectedIds={selectionMode ? selectedIds : undefined}
          />
          )

        ) : (
          // ── Vue grille par défaut (kept / deleted) ────────────────────────
          <PhotoGrid
            photos={photos}
            onPress={(p) => handlePhotoPress(p, photos)}
            onLongPress={section !== "deleted" ? enterSelectionMode : undefined}
            selectedIds={selectionMode && section !== "deleted" ? selectedIds : undefined}
          />
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

      {/* ── Modal export ── */}
      <Modal
        visible={showExport}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExport(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 44, maxHeight: SH * 0.85 }}>

            {/* En-tête */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: C.text }}>Exporter les photos</Text>
              <TouchableOpacity onPress={() => setShowExport(false)}>
                <Text style={{ fontSize: 22, color: C.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>
              {exportPhotos.length} photo{exportPhotos.length > 1 ? "s" : ""} · {exportAlbumName}
            </Text>

            {/* ── Option 1 : galerie native ─────────────────────────────────── */}
            <View style={{
              backgroundColor: C.bg, borderRadius: 16, padding: 16, marginBottom: 14,
              borderWidth: 1.5, borderColor: syncDone ? C.green : C.border,
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <Text style={{ fontSize: 28 }}>📲</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", fontSize: 15, color: C.text }}>Copier dans ta galerie</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2, lineHeight: 17 }}>
                    Crée un album "{Platform.OS === "ios" ? `Pellicule — ${exportAlbumName}` : `Pellicule/${exportAlbumName}`}" dans ton app Photos.
                    Pratique pour commander sur Cheerz, CEWE, etc.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleSyncToGallery}
                disabled={syncLoading || syncDone}
                style={{
                  backgroundColor: syncDone ? `${C.green}20` : `${accent}15`,
                  borderRadius: 12, padding: 12, alignItems: "center",
                  borderWidth: 1, borderColor: syncDone ? C.green : accent,
                  opacity: syncLoading ? 0.6 : 1,
                }}
              >
                <Text style={{ fontWeight: "800", fontSize: 14, color: syncDone ? C.green : accent }}>
                  {syncLoading ? "Synchronisation…" : syncDone ? "✓ Album créé dans ta galerie !" : `Syncer ${exportPhotos.length} photo${exportPhotos.length > 1 ? "s" : ""} →`}
                </Text>
              </TouchableOpacity>
              {syncDone && (
                <Text style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 8 }}>
                  Ouvre ton app Photos → Albums pour retrouver les photos.
                </Text>
              )}
            </View>

            {/* ── Option 2 : partager photo par photo ───────────────────────── */}
            <View style={{ backgroundColor: C.bg, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <Text style={{ fontSize: 28 }}>📤</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", fontSize: 15, color: C.text }}>Partager une photo</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                    Appuie sur une photo pour l'envoyer via WhatsApp, email, etc.
                  </Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {exportPhotos.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => handleShare(p)}
                      style={{ borderRadius: 12, overflow: "hidden", position: "relative" }}
                    >
                      <Image source={{ uri: p.url }} style={{ width: 80, height: 80 }} resizeMode="cover" />
                      <View style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        backgroundColor: "rgba(0,0,0,0.35)", paddingVertical: 4, alignItems: "center",
                      }}>
                        <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>Partager</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

          </View>
        </View>
      </Modal>

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
                  <>
                    <TouchableOpacity
                      onPress={() => handleShare(selected)}
                      style={{
                        backgroundColor: C.green,
                        borderRadius: S.radius,
                        padding: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 52,
                      }}
                    >
                      <ShareIcon color="#fff" size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRestore(selected.id)}
                      style={{ flex: 1, backgroundColor: "rgba(255,255,255,.2)", borderRadius: S.radius, padding: 14, alignItems: "center" }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>↩ Retirer des coups de cœur</Text>
                    </TouchableOpacity>
                  </>
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

      {/* ── Feuille "Affecter / retirer" (photo sans album) ── */}
      <Modal
        visible={!!assignPhoto}
        transparent
        animationType="slide"
        onRequestClose={closeAssign}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(60,20,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.bgCard, borderRadius: S.radiusLg, padding: S.padLg, paddingBottom: 44, maxHeight: SH * 0.85 }}>

            {/* Aperçu de la photo */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
              {assignPhoto && (
                <Image source={{ uri: assignPhoto.url }} style={{ width: 56, height: 56, borderRadius: 12 }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: "900", color: C.text }}>Ranger cette photo</Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                  {albums.length === 0 ? "Crée un album pour la ranger" : "Choisis un album ou crée-en un"}
                </Text>
              </View>
            </View>

            {albums.length > 0 && (
              <ScrollView style={{ maxHeight: SH * 0.35 }}>
                {albums.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => handleAssignToAlbum(a.id)}
                    style={{
                      backgroundColor: C.bg, borderRadius: 14, padding: 14,
                      borderWidth: 1, borderColor: C.border, marginBottom: 8,
                      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>📁 {a.name}</Text>
                      <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                        {a.photoIds.length} photo{a.photoIds.length > 1 ? "s" : ""}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 18, color: C.purple }}>＋</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Création d'un album directement ici (pas de 2e modale) */}
            <View style={{ marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                Nouvel album
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  value={assignNewName}
                  onChangeText={setAssignNewName}
                  placeholder="Ex. Vacances 2026"
                  placeholderTextColor={C.textMuted}
                  style={{
                    flex: 1, backgroundColor: C.bg, borderRadius: 12,
                    borderWidth: 1, borderColor: C.border,
                    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.text,
                  }}
                />
                <TouchableOpacity
                  onPress={handleCreateAndAssign}
                  disabled={!assignNewName.trim()}
                  style={{
                    backgroundColor: C.purple, borderRadius: 12, paddingHorizontal: 16,
                    justifyContent: "center", opacity: assignNewName.trim() ? 1 : 0.4,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Créer</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Retirer du menu "Album souvenirs" */}
            <TouchableOpacity
              onPress={handleRemoveFromSouvenirs}
              style={{
                marginTop: 16, borderRadius: S.radius, padding: 14, alignItems: "center",
                borderWidth: 1.5, borderColor: C.red,
              }}
            >
              <Text style={{ color: C.red, fontWeight: "800", fontSize: 14 }}>🗑 Retirer du menu album</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={closeAssign} style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={{ color: C.textMuted, fontSize: 14 }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Barre de sélection multiple ── */}
      {selectionMode && (
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          backgroundColor: C.bg,
          borderTopWidth: 1, borderTopColor: C.border,
          paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28,
          flexDirection: "row", gap: 10, alignItems: "center",
        }}>
          {/* Bouton annuler la sélection */}
          <TouchableOpacity
            onPress={exitSelectionMode}
            style={{
              paddingHorizontal: 14, paddingVertical: 12,
              borderRadius: S.radiusFull,
              backgroundColor: C.bgCard,
              borderWidth: 1, borderColor: C.border,
            }}
          >
            <Text style={{ color: C.textMuted, fontSize: 14, fontWeight: "700" }}>✕</Text>
          </TouchableOpacity>
          {/* Bouton exporter la sélection */}
          <TouchableOpacity
            onPress={() => { setSyncDone(false); setShowExport(true); }}
            disabled={selectedIds.size === 0}
            style={{
              flex: 1, backgroundColor: selectedIds.size > 0 ? accent : C.bgCard,
              borderRadius: S.radius, padding: 14, alignItems: "center",
              opacity: selectedIds.size > 0 ? 1 : 0.5,
            }}
          >
            <Text style={{ color: selectedIds.size > 0 ? "#fff" : C.textMuted, fontWeight: "800", fontSize: 14 }}>
              📤 Exporter {selectedIds.size > 0 ? `${selectedIds.size} photo${selectedIds.size > 1 ? "s" : ""}` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      )}

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
