// screens/MomentScreen.js
import { useMemo, useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, Modal,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { groupByMoment } from "../services/photoAnalysis";
import BackButton from "../components/BackButton";
import { RangeCalendarPicker, dateLabel } from "../components/RangeCalendarPicker";

export function MomentScreen({ navigation, route }) {
  const mode = route.params?.mode ?? "menage";
  // Couleur du mode : violet en mode album, orange en mode ménage
  const accent = mode === "album" ? C.album : C.accent;
  const libraryPhotos  = usePhotoStore((s) => s.libraryPhotos);
  const deleted        = usePhotoStore((s) => s.deleted);
  const addAlbumFilter = usePhotoStore((s) => s.addAlbumFilter);
  const [selectedId, setSelectedId] = useState(null);

  // Exclure les photos mises en corbeille
  const activePhotos = useMemo(() => {
    const ids = new Set(deleted.map((p) => p.id));
    return libraryPhotos.filter((p) => !ids.has(p.id));
  }, [libraryPhotos, deleted]);

  // Année de la plus vieille photo → borne basse du sélecteur d'année du calendrier.
  const minYear = useMemo(() => {
    let min = new Date().getFullYear();
    for (const p of activePhotos) {
      const y = new Date(p.creationTime).getFullYear();
      if (y < min) min = y;
    }
    return min;
  }, [activePhotos]);

  // Créneau de dates
  const [dateFrom,      setDateFrom]      = useState(null); // Date | null
  const [dateTo,        setDateTo]        = useState(null); // Date | null
  const [showRangePicker, setShowRangePicker] = useState(false);

  // Filtre les photos selon le créneau avant de grouper
  const filteredPhotos = useMemo(() => {
    if (!dateFrom && !dateTo) return activePhotos;
    const from = dateFrom
      ? new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate()).getTime()
      : 0;
    const to = dateTo
      ? new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59, 999).getTime()
      : Infinity;
    return activePhotos.filter((p) => p.creationTime >= from && p.creationTime <= to);
  }, [activePhotos, dateFrom, dateTo]);

  const moments = useMemo(() => groupByMoment(filteredPhotos), [filteredPhotos]);
  const selected = moments.find((m) => m.id === selectedId);

  function handleRangeConfirm(from, to) {
    setDateFrom(from);
    setDateTo(to || null);
    setShowRangePicker(false);
    setSelectedId(null);
  }

  function clearFilter() { setDateFrom(null); setDateTo(null); setSelectedId(null); }

  const hasFilter = !!(dateFrom || dateTo);

  // Ajoute la sélection courante (moment ou période) comme filtre combiné, puis revient.
  function addAsFilter() {
    const photos = selected ? selected.photos : filteredPhotos;
    if (photos.length === 0) return;
    const label = selected
      ? selected.label
      : `${dateLabel(dateFrom)}${dateTo ? `–${dateLabel(dateTo)}` : "→auj."}`;
    addAlbumFilter({
      id: `date-${selected ? selected.id : `${dateFrom?.getTime()}_${dateTo?.getTime() || "now"}`}`,
      type: "date",
      label,
      photoIds: photos.map((p) => p.id),
    });
    navigation.goBack();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* En-tête */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <BackButton mode={mode} onPress={() => navigation.goBack()} />
        <View>
          <Text style={{ fontWeight: "800", fontSize: 18, color: C.text }}>Tri par date</Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            {moments.length === 0
              ? "Pas encore de photos chargées"
              : `${moments.length} moment(s) · ${filteredPhotos.length} photo${filteredPhotos.length > 1 ? "s" : ""}`}
          </Text>
        </View>
      </View>

      {/* Sélecteur de créneau — gros bouton */}
      <View style={{ paddingHorizontal: S.pad, marginBottom: 14 }}>
        <TouchableOpacity
          onPress={() => setShowRangePicker(true)}
          style={{
            backgroundColor: C.bgCard, borderRadius: 20, padding: 20,
            borderWidth: 2, borderColor: hasFilter ? accent : C.border,
            flexDirection: "row", alignItems: "center", gap: 14,
          }}
        >
          <Text style={{ fontSize: 30 }}>📅</Text>
          <View style={{ flex: 1 }}>
            {hasFilter ? (
              <Text style={{ fontSize: 17, fontWeight: "800", color: accent }}>
                {dateLabel(dateFrom)}{dateTo ? ` → ${dateLabel(dateTo)}` : " → aujourd'hui"}
              </Text>
            ) : (
              <Text style={{ fontSize: 17, fontWeight: "800", color: C.text }}>
                Choisir une période
              </Text>
            )}
            <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 3 }}>
              {hasFilter ? `${filteredPhotos.length} photo${filteredPhotos.length > 1 ? "s" : ""} dans ce créneau` : "Touche pour ouvrir le calendrier"}
            </Text>
          </View>
          {hasFilter ? (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); clearFilter(); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ fontSize: 16, color: C.textMuted }}>✕</Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ color: C.textMuted, fontSize: 18 }}>›</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* CTA démarrer le tri — juste sous le calendrier, dès qu'une période/un moment est choisi */}
      {(selected || (hasFilter && filteredPhotos.length > 0)) && (
        <View style={{ paddingHorizontal: S.pad, marginBottom: 14, gap: 8 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("TriMode", {
              preQueue: selected ? selected.photos : filteredPhotos,
              ...(mode === "album" ? { skipToAlbum: true } : { skipToMenage: true }),
            })}
            style={{ backgroundColor: accent, borderRadius: S.radius, padding: 16, alignItems: "center", elevation: 4,
              shadowColor: accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
              {selected
                ? `🔀 Trier les ${selected.photos.length} photo${selected.photos.length > 1 ? "s" : ""} de ce moment`
                : `🔀 Trier toute la période · ${filteredPhotos.length} photo${filteredPhotos.length > 1 ? "s" : ""}`}
            </Text>
          </TouchableOpacity>

          {/* Mode album : ajouter cette sélection comme filtre combiné */}
          {mode === "album" && (
            <TouchableOpacity
              onPress={addAsFilter}
              style={{ borderRadius: S.radius, padding: 14, alignItems: "center", borderWidth: 1.5, borderColor: accent }}
            >
              <Text style={{ color: accent, fontWeight: "800", fontSize: 14 }}>➕ Ajouter comme filtre</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Liste des moments — affichée seulement après le choix d'une période */}
      <ScrollView style={{ flex: 1, paddingHorizontal: S.pad }}>
        {!hasFilter ? (
          <View style={{ alignItems: "center", justifyContent: "center", padding: 40, marginTop: 30 }}>
            <Text style={{ fontSize: 56, marginBottom: 14 }}>🗓️</Text>
            <Text style={{ fontSize: 16, fontWeight: "800", color: C.text, textAlign: "center", marginBottom: 6 }}>
              Choisis d'abord une période
            </Text>
            <Text style={{ fontSize: 13, color: C.textMuted, textAlign: "center", lineHeight: 19 }}>
              Sélectionne tes dates avec le calendrier ci-dessus pour voir tes moments.
            </Text>
          </View>
        ) : moments.length === 0 ? (
          <View style={{ alignItems: "center", justifyContent: "center", padding: 40 }}>
            <Text style={{ fontSize: 56, marginBottom: 12 }}>📅</Text>
            <Text style={{ fontSize: 14, color: C.textMuted, textAlign: "center" }}>
              Aucune photo dans ce créneau.
            </Text>
          </View>
        ) : (
          moments.map((m) => {
            const isSelected = m.id === selectedId;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => setSelectedId(isSelected ? null : m.id)}
                style={{
                  backgroundColor: isSelected ? `${accent}15` : C.bgCard,
                  borderRadius: S.radius, padding: 14, marginBottom: 10,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? accent : C.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: isSelected ? accent : C.border }}>
                    <Image source={{ uri: m.photos[0]?.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", fontSize: 14, color: C.text }}>{m.label}</Text>
                    <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                      {m.photos.length} photo{m.photos.length > 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Text style={{ color: isSelected ? accent : C.textMuted, fontSize: 18, fontWeight: "800" }}>
                    {isSelected ? "✓" : "›"}
                  </Text>
                </View>

                {isSelected && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {m.photos.slice(0, 8).map((p) => (
                        <Image key={p.id} source={{ uri: p.url }} style={{ width: 52, height: 52, borderRadius: 8 }} />
                      ))}
                    </View>
                  </ScrollView>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Modal calendrier plage */}
      <RangeCalendarPicker
        visible={showRangePicker}
        initialFrom={dateFrom}
        initialTo={dateTo}
        accent={accent}
        minYear={minYear}
        onConfirm={handleRangeConfirm}
        onCancel={() => setShowRangePicker(false)}
      />
    </SafeAreaView>
  );
}

export default MomentScreen;
