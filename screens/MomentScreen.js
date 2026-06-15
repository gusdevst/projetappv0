// screens/MomentScreen.js
import { useMemo, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StatusBar, Dimensions, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { groupByMoment } from "../services/photoAnalysis";

const { width: SW } = Dimensions.get("window");

// ─── Calendrier ───────────────────────────────────────────────────────────────
const MOIS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];
const JOURS = ["Lu","Ma","Me","Je","Ve","Sa","Di"];

function dateLabel(d) {
  if (!d) return "—";
  return `${String(d.getDate()).padStart(2,"0")} ${MOIS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
}

/**
 * RangeCalendarPicker — sélection d'une plage de dates en un seul calendrier.
 * 1er tap = date de début, 2e tap = date de fin.
 * Les jours entre les deux sont surlignés.
 */
function RangeCalendarPicker({ visible, initialFrom, initialTo, onConfirm, onCancel }) {
  const today = new Date();
  const init  = initialFrom || today;

  const [viewYear,  setViewYear]  = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth());
  const [rangeFrom, setRangeFrom] = useState(initialFrom || null);
  const [rangeTo,   setRangeTo]   = useState(initialTo   || null);
  // "picking" : "from" → on attend le 1er tap, "to" → on attend le 2e tap
  const [picking, setPicking] = useState("from");

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstSlot   = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const cells = [
    ...Array(firstSlot).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    const isMax = viewYear === today.getFullYear() && viewMonth === today.getMonth();
    if (isMax) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }
  const nextBlocked = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  function handleDayPress(day) {
    const tapped = new Date(viewYear, viewMonth, day);
    if (picking === "from") {
      setRangeFrom(tapped);
      setRangeTo(null);
      setPicking("to");
    } else {
      // Si l'user tape avant la date de début, on inverse
      if (rangeFrom && tapped < rangeFrom) {
        setRangeTo(rangeFrom);
        setRangeFrom(tapped);
      } else {
        setRangeTo(tapped);
      }
      setPicking("from");
    }
  }

  function dayStatus(day) {
    const d    = new Date(viewYear, viewMonth, day);
    const from = rangeFrom ? new Date(rangeFrom.getFullYear(), rangeFrom.getMonth(), rangeFrom.getDate()) : null;
    const to   = rangeTo   ? new Date(rangeTo.getFullYear(),   rangeTo.getMonth(),   rangeTo.getDate())   : null;
    const isFrom = from && d.getTime() === from.getTime();
    const isTo   = to   && d.getTime() === to.getTime();
    const inRange = from && to && d > from && d < to;
    const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    const isFuture = d > today;
    return { isFrom, isTo, inRange, isToday, isFuture };
  }

  const canConfirm = !!rangeFrom;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 }}
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity activeOpacity={1}>
          <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 20 }}>

            <Text style={{ fontWeight: "800", fontSize: 16, color: C.text, textAlign: "center", marginBottom: 6 }}>
              Choisir une période
            </Text>

            {/* Indicateur de l'étape en cours */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14, justifyContent: "center" }}>
              <View style={{
                paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99,
                backgroundColor: picking === "from" ? C.accent : `${C.accent}15`,
              }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: picking === "from" ? "#fff" : C.accent }}>
                  {rangeFrom ? dateLabel(rangeFrom) : "Date de début"}
                </Text>
              </View>
              <Text style={{ color: C.textMuted, alignSelf: "center" }}>→</Text>
              <View style={{
                paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99,
                backgroundColor: picking === "to" ? C.accent : `${C.accent}15`,
              }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: picking === "to" ? "#fff" : (rangeTo ? C.accent : C.textMuted) }}>
                  {rangeTo ? dateLabel(rangeTo) : "Date de fin"}
                </Text>
              </View>
            </View>

            {/* Navigation mois */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
                <Text style={styles.navTxt}>‹</Text>
              </TouchableOpacity>
              <Text style={{ fontWeight: "700", fontSize: 15, color: C.text }}>
                {MOIS[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={[styles.navBtn, { opacity: nextBlocked ? 0.25 : 1 }]}>
                <Text style={styles.navTxt}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Entêtes jours */}
            <View style={{ flexDirection: "row", marginBottom: 4 }}>
              {JOURS.map((j) => (
                <View key={j} style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: C.textMuted }}>{j}</Text>
                </View>
              ))}
            </View>

            {/* Grille */}
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {cells.map((day, i) => {
                if (!day) return <View key={`_${i}`} style={{ width: "14.28%", height: 40 }} />;
                const { isFrom, isTo, inRange, isToday, isFuture } = dayStatus(day);
                const isEndpoint = isFrom || isTo;
                return (
                  <TouchableOpacity
                    key={day}
                    disabled={isFuture}
                    onPress={() => handleDayPress(day)}
                    style={{ width: "14.28%", height: 40, alignItems: "center", justifyContent: "center" }}
                  >
                    {/* Fond de plage (entre les deux bornes) */}
                    {inRange && (
                      <View style={{
                        position: "absolute", top: 3, bottom: 3, left: 0, right: 0,
                        backgroundColor: `${C.accent}18`,
                      }} />
                    )}
                    <View style={{
                      width: 34, height: 34, borderRadius: 17,
                      backgroundColor: isEndpoint ? C.accent : "transparent",
                      borderWidth: isToday && !isEndpoint ? 1.5 : 0,
                      borderColor: C.accent,
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: isEndpoint || isToday ? "800" : "400",
                        color: isEndpoint ? "#fff" : isFuture ? "#d0c0b0" : isToday ? C.accent : C.text,
                      }}>
                        {day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Boutons */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                onPress={onCancel}
                style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, alignItems: "center" }}
              >
                <Text style={{ color: C.textMuted, fontWeight: "700" }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => canConfirm && onConfirm(rangeFrom, rangeTo)}
                disabled={!canConfirm}
                style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: canConfirm ? C.accent : `${C.accent}40`, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = {
  navBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#f5f0eb", alignItems: "center", justifyContent: "center" },
  navTxt: { fontSize: 20, color: C.text },
};

// ─── MomentScreen ─────────────────────────────────────────────────────────────
export function MomentScreen({ navigation, route }) {
  const mode = route.params?.mode ?? "menage";
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const deleted       = usePhotoStore((s) => s.deleted);
  const [selectedId, setSelectedId] = useState(null);

  // Exclure les photos mises en corbeille
  const activePhotos = useMemo(() => {
    const ids = new Set(deleted.map((p) => p.id));
    return libraryPhotos.filter((p) => !ids.has(p.id));
  }, [libraryPhotos, deleted]);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* En-tête */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border }}
        >
          <Text style={{ color: C.textMuted, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={{ fontWeight: "800", fontSize: 18, color: C.text }}>Tri par moment</Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            {moments.length === 0
              ? "Pas encore de photos chargées"
              : `${moments.length} moment(s) · ${filteredPhotos.length} photo${filteredPhotos.length > 1 ? "s" : ""}`}
          </Text>
        </View>
      </View>

      {/* Sélecteur de créneau — un seul bouton */}
      <View style={{ paddingHorizontal: S.pad, marginBottom: 12 }}>
        <TouchableOpacity
          onPress={() => setShowRangePicker(true)}
          style={{
            backgroundColor: C.bgCard, borderRadius: 16, padding: 12,
            borderWidth: 1.5, borderColor: hasFilter ? C.accent : C.border,
            flexDirection: "row", alignItems: "center", gap: 10,
          }}
        >
          <Text style={{ fontSize: 18 }}>📅</Text>
          <View style={{ flex: 1 }}>
            {hasFilter ? (
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.accent }}>
                {dateLabel(dateFrom)}{dateTo ? ` → ${dateLabel(dateTo)}` : " → aujourd'hui"}
              </Text>
            ) : (
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.textMuted }}>
                Filtrer par période
              </Text>
            )}
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
              {hasFilter ? `${filteredPhotos.length} photo${filteredPhotos.length > 1 ? "s" : ""} dans ce créneau` : "Touche pour choisir"}
            </Text>
          </View>
          {hasFilter ? (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); clearFilter(); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ fontSize: 13, color: C.textMuted }}>✕</Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ color: C.textMuted, fontSize: 14 }}>›</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Liste des moments */}
      <ScrollView style={{ flex: 1, paddingHorizontal: S.pad }}>
        {moments.length === 0 ? (
          <View style={{ alignItems: "center", justifyContent: "center", padding: 40 }}>
            <Text style={{ fontSize: 56, marginBottom: 12 }}>📅</Text>
            <Text style={{ fontSize: 14, color: C.textMuted, textAlign: "center" }}>
              {hasFilter ? "Aucune photo dans ce créneau." : "Aucun moment détecté pour le moment."}
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
                  backgroundColor: isSelected ? `${C.accent}15` : C.bgCard,
                  borderRadius: S.radius, padding: 14, marginBottom: 10,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? C.accent : C.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: isSelected ? C.accent : C.border }}>
                    <Image source={{ uri: m.photos[0]?.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", fontSize: 14, color: C.text }}>{m.label}</Text>
                    <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                      {m.photos.length} photo{m.photos.length > 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Text style={{ color: isSelected ? C.accent : C.textMuted, fontSize: 18, fontWeight: "800" }}>
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

      {/* CTA tri — visible dès qu'un moment OU une période est sélectionné */}
      {(selected || (hasFilter && filteredPhotos.length > 0)) && (
        <View style={{ padding: S.pad, paddingTop: 0 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("TriMode", {
              preQueue: selected ? selected.photos : filteredPhotos,
              ...(mode === "album" ? { skipToAlbum: true } : { skipToMenage: true }),
            })}
            style={{ backgroundColor: C.accent, borderRadius: S.radius, padding: 16, alignItems: "center", elevation: 4,
              shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
              {selected
                ? `🔀 Trier les ${selected.photos.length} photo${selected.photos.length > 1 ? "s" : ""} de ce moment`
                : `🔀 Trier toute la période · ${filteredPhotos.length} photo${filteredPhotos.length > 1 ? "s" : ""}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal calendrier plage */}
      <RangeCalendarPicker
        visible={showRangePicker}
        initialFrom={dateFrom}
        initialTo={dateTo}
        onConfirm={handleRangeConfirm}
        onCancel={() => setShowRangePicker(false)}
      />
    </SafeAreaView>
  );
}

export default MomentScreen;
