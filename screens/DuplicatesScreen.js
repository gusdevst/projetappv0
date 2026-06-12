// screens/DuplicatesScreen.js
import { useMemo, useState, useRef, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  Image, StatusBar, Dimensions, Modal, FlatList, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { findDuplicates } from "../services/photoAnalysis";

const { width: SW, height: SH } = Dimensions.get("window");
const PHOTO_SIZE = (SW - S.pad * 2 - 28 - 28 - 8) / 2;
const THUMB_SIZE = 56;

export function DuplicatesScreen({ navigation }) {
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const deleted       = usePhotoStore((s) => s.deleted);
  const addDeleted    = usePhotoStore((s) => s.addDeleted);
  const addSkipped    = usePhotoStore((s) => s.addSkipped);

  const [selectedGroupIdx, setSelectedGroupIdx] = useState(null);
  // fullscreen = { photos: [...], idx: number } | null
  // `photos` = liste locale des photos restantes à traiter dans le groupe
  const [fullscreen, setFullscreen] = useState(null);

  const mainListRef  = useRef(null); // FlatList de la photo principale (swipe)
  const flatListRef  = useRef(null); // FlatList des miniatures

  // Masquer/afficher la barre de statut Android quand le modal plein écran s'ouvre
  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (fullscreen !== null) {
      StatusBar.setHidden(true, "fade");
    } else {
      StatusBar.setHidden(false, "fade");
    }
    return () => StatusBar.setHidden(false, "fade");
  }, [fullscreen]);

  const activePhotos = useMemo(() => {
    const ids = new Set(deleted.map((p) => p.id));
    return libraryPhotos.filter((p) => !ids.has(p.id));
  }, [libraryPhotos, deleted]);

  const groups = useMemo(() => findDuplicates(activePhotos), [activePhotos]);
  const totalDuplicates = groups.reduce((a, g) => a + g.photos.length, 0);

  function openFullscreen(group, photoIdx) {
    setFullscreen({ photos: [...group.photos], idx: photoIdx });
  }

  function goToPhoto(idx) {
    if (!fullscreen) return;
    const clamped = Math.max(0, Math.min(idx, fullscreen.photos.length - 1));
    setFullscreen({ ...fullscreen, idx: clamped });
    mainListRef.current?.scrollToIndex({ index: clamped, animated: true });
    flatListRef.current?.scrollToIndex({ index: clamped, animated: true, viewPosition: 0.5 });
  }

  function advanceAfterAction(processedPhoto, storeAction) {
    storeAction(processedPhoto);
    const remaining = fullscreen.photos.filter((p) => p.id !== processedPhoto.id);
    if (remaining.length === 0) {
      setFullscreen(null);
      setSelectedGroupIdx(null);
    } else {
      const newIdx = Math.min(fullscreen.idx, remaining.length - 1);
      setFullscreen({ photos: remaining, idx: newIdx });
      setTimeout(() => {
        mainListRef.current?.scrollToIndex({ index: newIdx, animated: false });
        flatListRef.current?.scrollToIndex({ index: newIdx, animated: true, viewPosition: 0.5 });
      }, 50);
    }
  }

  function keepCurrentPhoto(photo)   { advanceAfterAction(photo, addSkipped); }
  function deleteCurrentPhoto(photo) { advanceAfterAction(photo, addDeleted); }

  const currentPhoto = fullscreen ? fullscreen.photos[fullscreen.idx] : null;
  const groupSize    = fullscreen ? fullscreen.photos.length : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border }}
        >
          <Text style={{ color: C.textMuted, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={{ fontWeight: "800", fontSize: 18, color: C.text }}>Doublons probables</Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            {groups.length === 0
              ? "Aucun doublon détecté"
              : `${groups.length} groupe(s) · ${totalDuplicates} photos`}
          </Text>
        </View>
      </View>

      {/* ── État vide ────────────────────────────────────────────────────── */}
      {groups.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
          <Text style={{ fontSize: 56, marginBottom: 12 }}>🪞</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text, textAlign: "center" }}>
            Pas de doublons détectés
          </Text>
          <Text style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 8, lineHeight: 18 }}>
            On détecte les photos prises à moins de 2 secondes d'écart avec les mêmes dimensions (mode rafale, double appui…).
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1, paddingHorizontal: S.pad }}>
          {groups.map((g, idx) => {
            const isSelected = idx === selectedGroupIdx;
            const first      = g.photos[0];
            const dateStr    = new Date(first.creationTime).toLocaleDateString("fr-FR", {
              day: "numeric", month: "long", year: "numeric",
            });

            return (
              <TouchableOpacity
                key={idx}
                onPress={() => setSelectedGroupIdx(isSelected ? null : idx)}
                activeOpacity={isSelected ? 1 : 0.75}
                style={{
                  backgroundColor: isSelected ? `${C.accent}10` : C.bgCard,
                  borderRadius: S.radius,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? C.accent : C.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: isSelected ? C.accent : C.border }}>
                    <Image source={{ uri: first.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", fontSize: 14, color: C.text }}>
                      {g.photos.length} photos quasi identiques
                    </Text>
                    <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{dateStr}</Text>
                  </View>
                  <Text style={{ color: isSelected ? C.accent : C.textMuted, fontSize: 18, fontWeight: "800" }}>
                    {isSelected ? "▾" : "›"}
                  </Text>
                </View>

                {isSelected && (
                  <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {g.photos.map((p, pIdx) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => openFullscreen(g, pIdx)}
                        activeOpacity={0.85}
                        style={{ borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: C.border }}
                      >
                        <Image
                          source={{ uri: p.url }}
                          style={{ width: PHOTO_SIZE, height: PHOTO_SIZE }}
                          resizeMode="cover"
                        />
                        <View style={{
                          position: "absolute", bottom: 0, left: 0, right: 0,
                          backgroundColor: "rgba(0,0,0,0.4)", paddingVertical: 5,
                          alignItems: "center",
                        }}>
                          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                            Voir en plein écran
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── Modal plein écran ────────────────────────────────────────────── */}
      <Modal
        visible={fullscreen !== null}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setFullscreen(null)}
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {/* Photos swipeables plein écran */}
          {fullscreen && (
            <FlatList
              ref={mainListRef}
              data={fullscreen.photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(p) => p.id}
              initialScrollIndex={fullscreen.idx}
              getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
              onMomentumScrollEnd={(e) => {
                const newIdx = Math.round(e.nativeEvent.contentOffset.x / SW);
                if (newIdx !== fullscreen.idx) {
                  setFullscreen((f) => f ? { ...f, idx: newIdx } : f);
                  flatListRef.current?.scrollToIndex({ index: newIdx, animated: true, viewPosition: 0.5 });
                }
              }}
              renderItem={({ item: p }) => (
                <Image
                  source={{ uri: p.url }}
                  style={{ width: SW, height: SH }}
                  resizeMode="contain"
                />
              )}
              style={{ flex: 1 }}
            />
          )}

          {/* ── Top bar ── */}
          <View style={{
            position: "absolute",
            top: Platform.OS === "android" ? 16 : 52,
            left: 0, right: 0,
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingHorizontal: 16, zIndex: 10,
          }}>
            <TouchableOpacity
              onPress={() => setFullscreen(null)}
              style={{
                backgroundColor: "rgba(0,0,0,0.55)",
                borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>← Retour</Text>
            </TouchableOpacity>

            {/* Compteur photo X / N */}
            {fullscreen && (
              <View style={{
                backgroundColor: "rgba(0,0,0,0.55)",
                borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
              }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                  {fullscreen.idx + 1} / {groupSize}
                </Text>
              </View>
            )}
          </View>

          {/* ── Zone basse : miniatures + CTA ── */}
          {fullscreen && (
            <View style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              paddingBottom: 36, zIndex: 10,
            }}>
              {/* Fond flouté simulé */}
              <View style={{
                backgroundColor: "rgba(0,0,0,0.72)",
                paddingTop: 16, paddingBottom: 0,
                borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)",
              }}>

                {/* Bande de miniatures */}
                <FlatList
                  ref={flatListRef}
                  data={fullscreen.photos}
                  horizontal
                  keyExtractor={(p) => p.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                  style={{ marginBottom: 16 }}
                  getItemLayout={(_, index) => ({
                    length: THUMB_SIZE + 8,
                    offset: (THUMB_SIZE + 8) * index,
                    index,
                  })}
                  renderItem={({ item: p, index }) => {
                    const isActive = index === fullscreen.idx;
                    return (
                      <TouchableOpacity
                        onPress={() => goToPhoto(index)}
                        activeOpacity={0.8}
                        style={{
                          width: THUMB_SIZE,
                          height: THUMB_SIZE,
                          borderRadius: 10,
                          overflow: "hidden",
                          borderWidth: isActive ? 2.5 : 1.5,
                          borderColor: isActive ? "#fff" : "rgba(255,255,255,0.25)",
                          opacity: isActive ? 1 : 0.55,
                        }}
                      >
                        <Image
                          source={{ uri: p.url }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    );
                  }}
                />

                {/* CTAs côte à côte */}
                <View style={{ paddingHorizontal: 16, flexDirection: "row", gap: 10 }}>
                  {/* Supprimer */}
                  <TouchableOpacity
                    onPress={() => deleteCurrentPhoto(currentPhoto)}
                    style={{
                      flex: 1,
                      backgroundColor: "rgba(255,255,255,0.1)",
                      borderRadius: S.radius,
                      paddingVertical: 16,
                      alignItems: "center",
                      borderWidth: 1.5,
                      borderColor: "rgba(255,80,80,0.5)",
                    }}
                  >
                    <Text style={{ color: "#ff6b6b", fontWeight: "800", fontSize: 15 }}>
                      🗑 Supprimer
                    </Text>
                    <Text style={{ color: "rgba(255,107,107,0.7)", fontSize: 11, marginTop: 3 }}>
                      cette photo
                    </Text>
                  </TouchableOpacity>

                  {/* Garder */}
                  <TouchableOpacity
                    onPress={() => keepCurrentPhoto(currentPhoto)}
                    style={{
                      flex: 1,
                      backgroundColor: C.accent,
                      borderRadius: S.radius,
                      paddingVertical: 16,
                      alignItems: "center",
                      elevation: 8,
                      shadowColor: C.accent,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.5,
                      shadowRadius: 12,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                      ✓ Garder
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 3 }}>
                      cette photo
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default DuplicatesScreen;
