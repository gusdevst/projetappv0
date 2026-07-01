// screens/MomentScreen.js
import { useMemo, useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StatusBar, Dimensions, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { groupByMoment } from "../services/photoAnalysis";
import BackButton from "../components/BackButton";

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
function RangeCalendarPicker({ visible, initialFrom, initialTo, onConfirm, onCancel, accent = C.accent, minYear }) {
  const today = new Date();
  const init  = initialFrom || today;

  const [viewYear,  setViewYear]  = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth());
  const [rangeFrom, setRangeFrom] = useState(initialFrom || null);
  const [rangeTo,   setRangeTo]   = useState(initialTo   || null);
  // "picking" : "from" → on attend le 1er tap, "to" → on attend le 2e tap
  const [picking, setPicking] = useState("from");
  // "header" : null = grille des jours, "month" = choix du mois, "year" = choix de l'année
  const [header, setHeader] = useState(null);
  // À chaque réouverture, on repart sur la grille des jours.
  useEffect(() => { if (visible) setHeader(null); }, [visible]);

  // Bornes de l'année : de la plus vieille photo jusqu'à l'année courante.
  const firstYear = Math.min(minYear ?? today.getFullYear() - 12, today.getFullYear());
  const years = Array.from({ length: today.getFullYear() - firstYear + 1 }, (_, i) => firstYear + i);

  // Sélectionne un mois depuis le sélecteur rapide (en bornant au mois courant pour l'année en cours).
  const pickMonth = (m) => {
    setViewMonth(m);
    setHeader(null);
  };
  // Sélectionne une année ; si on dépasse le mois courant pour l'année en cours, on borne.
  const pickYear = (y) => {
    setViewYear(y);
    if (y === today.getFullYear() && viewMonth > today.getMonth()) setViewMonth(today.getMonth());
    setHeader("month");
  };

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
                backgroundColor: picking === "from" ? accent : `${accent}15`,
              }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: picking === "from" ? "#fff" : accent }}>
                  {rangeFrom ? dateLabel(rangeFrom) : "Date de début"}
                </Text>
              </View>
              <Text style={{ color: C.textMuted, alignSelf: "center" }}>→</Text>
              <View style={{
                paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99,
                backgroundColor: picking === "to" ? accent : `${accent}15`,
              }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: picking === "to" ? "#fff" : (rangeTo ? accent : C.textMuted) }}>
                  {rangeTo ? dateLabel(rangeTo) : "Date de fin"}
                </Text>
              </View>
            </View>

            {/* Navigation mois — le mois et l'année sont cliquables pour un saut rapide */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <TouchableOpacity onPress={prevMonth} style={[styles.navBtn, { opacity: header ? 0 : 1 }]} disabled={!!header}>
                <Text style={styles.navTxt}>‹</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setHeader(header === "month" ? null : "month")}
                  style={[styles.headerChip, header === "month" && { backgroundColor: `${accent}18`, borderColor: accent }]}
                >
                  <Text style={{ fontWeight: "800", fontSize: 15, color: header === "month" ? accent : C.text }}>{MOIS[viewMonth]}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setHeader(header === "year" ? null : "year")}
                  style={[styles.headerChip, header === "year" && { backgroundColor: `${accent}18`, borderColor: accent }]}
                >
                  <Text style={{ fontWeight: "800", fontSize: 15, color: header === "year" ? accent : C.text }}>{viewYear}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={nextMonth} style={[styles.navBtn, { opacity: header ? 0 : (nextBlocked ? 0.25 : 1) }]} disabled={!!header || nextBlocked}>
                <Text style={styles.navTxt}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Sélecteur rapide de MOIS */}
            {header === "month" ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {MOIS.map((m, i) => {
                  const disabled = viewYear === today.getFullYear() && i > today.getMonth();
                  const active = i === viewMonth;
                  return (
                    <View key={m} style={{ width: "33.33%", padding: 4 }}>
                      <TouchableOpacity disabled={disabled} onPress={() => pickMonth(i)}
                        style={{
                          paddingVertical: 14, borderRadius: 12, alignItems: "center",
                          backgroundColor: active ? accent : `${accent}10`, opacity: disabled ? 0.3 : 1,
                        }}>
                        <Text style={{ fontWeight: "700", fontSize: 13, color: active ? "#fff" : C.text }}>{m.slice(0, 4)}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

            /* Sélecteur rapide d'ANNÉE */
            ) : header === "year" ? (
              <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {years.map((y) => {
                    const active = y === viewYear;
                    return (
                      <View key={y} style={{ width: "33.33%", padding: 4 }}>
                        <TouchableOpacity onPress={() => pickYear(y)}
                          style={{
                            paddingVertical: 14, borderRadius: 12, alignItems: "center",
                            backgroundColor: active ? accent : `${accent}10`,
                          }}>
                          <Text style={{ fontWeight: "700", fontSize: 14, color: active ? "#fff" : C.text }}>{y}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>

            /* Grille des jours (vue par défaut) */
            ) : (
            <>
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
                        backgroundColor: `${accent}18`,
                      }} />
                    )}
                    <View style={{
                      width: 34, height: 34, borderRadius: 17,
                      backgroundColor: isEndpoint ? accent : "transparent",
                      borderWidth: isToday && !isEndpoint ? 1.5 : 0,
                      borderColor: accent,
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: isEndpoint || isToday ? "800" : "400",
                        color: isEndpoint ? "#fff" : isFuture ? "#d0c0b0" : isToday ? accent : C.text,
                      }}>
                        {day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            </>
            )}

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
                style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: canConfirm ? accent : `${accent}40`, alignItems: "center" }}
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
  headerChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1.5, borderColor: "transparent", backgroundColor: "#f5f0eb",
  },
};

// ─── MomentScreen ─────────────────────────────────────────────────────────────
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
          <Text style={{ fontWeight: "800", fontSize: 18, color: C.text }}>Tri par moment</Text>
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
