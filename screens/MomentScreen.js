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
 * CalendarPicker — calendrier mensuel custom, sans lib externe.
 * Semaine commence le lundi (convention française).
 * Les jours futurs sont désactivés.
 */
function CalendarPicker({ visible, initialDate, title, onConfirm, onCancel }) {
  const today = new Date();
  const init  = initialDate || today;

  const [viewYear,  setViewYear]  = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth());
  const [selected,  setSelected]  = useState(
    new Date(init.getFullYear(), init.getMonth(), init.getDate())
  );

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Quel slot commence le 1er (Lundi = 0 … Dimanche = 6)
  const firstSlot = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;

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

  const isFuture  = (d) => new Date(viewYear, viewMonth, d) > today;
  const isSelected = (d) =>
    selected &&
    selected.getDate() === d &&
    selected.getMonth() === viewMonth &&
    selected.getFullYear() === viewYear;
  const isToday = (d) =>
    d === today.getDate() &&
    viewMonth === today.getMonth() &&
    viewYear  === today.getFullYear();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 }}
        activeOpacity={1}
        onPress={onCancel}
      >
        {/* stopPropagation du tap sur la carte */}
        <TouchableOpacity activeOpacity={1}>
          <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 20 }}>

            <Text style={{ fontWeight: "800", fontSize: 16, color: C.text, textAlign: "center", marginBottom: 14 }}>
              {title}
            </Text>

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
                const sel = isSelected(day);
                const tod = isToday(day);
                const fut = isFuture(day);
                return (
                  <TouchableOpacity
                    key={day}
                    disabled={fut}
                    onPress={() => setSelected(new Date(viewYear, viewMonth, day))}
                    style={{ width: "14.28%", height: 40, alignItems: "center", justifyContent: "center" }}
                  >
                    <View style={{
                      width: 34, height: 34, borderRadius: 17,
                      backgroundColor: sel ? C.accent : "transparent",
                      borderWidth: tod && !sel ? 1.5 : 0,
                      borderColor: C.accent,
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: sel || tod ? "800" : "400",
                        color: sel ? "#fff" : fut ? "#d0c0b0" : tod ? C.accent : C.text,
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
                onPress={() => onConfirm(selected)}
                style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: C.accent, alignItems: "center" }}
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
export function MomentScreen({ navigation }) {
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const deleted       = usePhotoStore((s) => s.deleted);
  const [selectedId, setSelectedId] = useState(null);

  // Exclure les photos mises en corbeille
  const activePhotos = useMemo(() => {
    const ids = new Set(deleted.map((p) => p.id));
    return libraryPhotos.filter((p) => !ids.has(p.id));
  }, [libraryPhotos, deleted]);

  // Créneau de dates
  const [dateFrom,     setDateFrom]     = useState(null); // Date | null
  const [dateTo,       setDateTo]       = useState(null); // Date | null
  const [pickerTarget, setPickerTarget] = useState(null); // "from" | "to" | null

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

  function handleConfirm(date) {
    if (pickerTarget === "from") setDateFrom(date);
    else                         setDateTo(date);
    setPickerTarget(null);
    setSelectedId(null); // reset sélection si le créneau change
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

      {/* Sélecteur de créneau */}
      <View style={{ paddingHorizontal: S.pad, marginBottom: 12 }}>
        <View style={{
          backgroundColor: C.bgCard, borderRadius: 16, padding: 12,
          borderWidth: 1, borderColor: hasFilter ? C.accent : C.border,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: hasFilter ? C.accent : C.textMuted }}>
              📅 Filtrer par période
            </Text>
            {hasFilter && (
              <TouchableOpacity onPress={clearFilter}>
                <Text style={{ fontSize: 11, color: C.textMuted, textDecorationLine: "underline" }}>
                  Réinitialiser
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            {/* Bouton DU */}
            <TouchableOpacity
              onPress={() => setPickerTarget("from")}
              style={{
                flex: 1, padding: 10, borderRadius: 12, alignItems: "center",
                backgroundColor: dateFrom ? `${C.accent}15` : "#f5f0eb",
                borderWidth: 1.5, borderColor: dateFrom ? C.accent : C.border,
              }}
            >
              <Text style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>DU</Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: dateFrom ? C.accent : C.textMuted }}>
                {dateLabel(dateFrom)}
              </Text>
            </TouchableOpacity>

            <View style={{ justifyContent: "center" }}>
              <Text style={{ color: C.textMuted, fontSize: 16 }}>→</Text>
            </View>

            {/* Bouton AU */}
            <TouchableOpacity
              onPress={() => setPickerTarget("to")}
              style={{
                flex: 1, padding: 10, borderRadius: 12, alignItems: "center",
                backgroundColor: dateTo ? `${C.accent}15` : "#f5f0eb",
                borderWidth: 1.5, borderColor: dateTo ? C.accent : C.border,
              }}
            >
              <Text style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>AU</Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: dateTo ? C.accent : C.textMuted }}>
                {dateLabel(dateTo)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
            onPress={() => navigation.navigate("Swipe", {
              queue: selected ? selected.photos : filteredPhotos,
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

      {/* Modal calendrier */}
      <CalendarPicker
        visible={pickerTarget !== null}
        initialDate={pickerTarget === "from" ? (dateFrom || new Date()) : (dateTo || new Date())}
        title={pickerTarget === "from" ? "Date de début" : "Date de fin"}
        onConfirm={handleConfirm}
        onCancel={() => setPickerTarget(null)}
      />
    </SafeAreaView>
  );
}

export default MomentScreen;
