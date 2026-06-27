// screens/RappelsScreen.js
// Menu dédié à la configuration des rappels quotidiens de tri.
// Remplace "Mes albums" dans la carte du bas en mode Ménage.

import { useState, useEffect, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, Alert, Modal, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { scheduleReminder, requestPermission, cancelReminders } from "../services/notificationService";
import { getAlbums } from "../services/photoLibrary";
import BackButton from "../components/BackButton";

// ── Drum de chiffres (heure / minute) ────────────────────────────────────────
// Identique au composant dans SettingsScreen
function NumberDrum({ values, selected, onChange }) {
  return (
    <ScrollView
      style={{ height: 160, width: 64 }}
      showsVerticalScrollIndicator={false}
      snapToInterval={48}
      decelerationRate="fast"
    >
      {values.map((v) => (
        <TouchableOpacity
          key={v}
          onPress={() => onChange(v)}
          style={{
            height: 48, alignItems: "center", justifyContent: "center",
            backgroundColor: v === selected ? `${C.accent}18` : "transparent",
            borderRadius: 10,
          }}
        >
          <Text style={{
            fontSize: v === selected ? 26 : 18,
            fontWeight: v === selected ? "900" : "400",
            color: v === selected ? C.accent : C.textMuted,
          }}>
            {String(v).padStart(2, "0")}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const FREQ_OPTIONS = [
  { key: "twice_daily", label: "2 fois par jour",    desc: "Matin et soir",              emoji: "⚡" },
  { key: "daily",       label: "1 fois par jour",    desc: "À l'heure choisie",          emoji: "📅" },
  { key: "every2days",  label: "Tous les 2 jours",   desc: "Un rappel toutes les 48h",   emoji: "🔔" },
  { key: "weekly",      label: "Hebdomadaire",        desc: "Une fois par semaine",       emoji: "📆" },
  { key: "off",         label: "Désactivé",           desc: "Aucun rappel",               emoji: "🔕" },
];

const SESSION_PROFILES = [
  { label: "Rapide",  count: 10, desc: "~1 min",  emoji: "⚡" },
  { label: "Normal",  count: 30, desc: "~3 min",  emoji: "🎯" },
  { label: "Sérieux", count: 50, desc: "~5 min",  emoji: "💪" },
];

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
      map[key] = { key, label: `${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`, count: 0 };
    }
    map[key].count++;
  });
  return Object.values(map).sort((a, b) => b.key.localeCompare(a.key));
}

export function RappelsScreen({ navigation }) {
  const notificationFrequency    = usePhotoStore((s) => s.notificationFrequency);
  const setNotificationFrequency = usePhotoStore((s) => s.setNotificationFrequency);
  const notificationHour         = usePhotoStore((s) => s.notificationHour);
  const setNotificationHour      = usePhotoStore((s) => s.setNotificationHour);
  const notificationMinute       = usePhotoStore((s) => s.notificationMinute);
  const setNotificationMinute    = usePhotoStore((s) => s.setNotificationMinute);
  const notificationHour2        = usePhotoStore((s) => s.notificationHour2);
  const setNotificationHour2     = usePhotoStore((s) => s.setNotificationHour2);
  const notificationMinute2      = usePhotoStore((s) => s.notificationMinute2);
  const setNotificationMinute2   = usePhotoStore((s) => s.setNotificationMinute2);
  const randomCount              = usePhotoStore((s) => s.randomCount);
  const setRandomCount           = usePhotoStore((s) => s.setRandomCount);
  const sortPriority             = usePhotoStore((s) => s.sortPriority);
  const setSortPriority          = usePhotoStore((s) => s.setSortPriority);

  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const kept          = usePhotoStore((s) => s.kept);
  const deleted       = usePhotoStore((s) => s.deleted);
  const printed       = usePhotoStore((s) => s.printed);
  const skipped       = usePhotoStore((s) => s.skipped);

  // Calcul des photos restantes à trier
  const remainingCount = useMemo(() => {
    const triedIds = new Set([
      ...kept.map((p) => p.id),
      ...deleted.map((p) => p.id),
      ...printed.map((p) => p.id),
      ...skipped.map((p) => p.id),
    ]);
    return libraryPhotos.filter((p) => !triedIds.has(p.id)).length;
  }, [libraryPhotos, kept, deleted, printed, skipped]);

  const sessionsLeft = randomCount > 0 ? Math.ceil(remainingCount / randomCount) : 0;

  const monthGroups = useMemo(() => buildMonthGroups(libraryPhotos), [libraryPhotos]);

  // Albums natifs du téléphone
  const [nativeAlbums, setNativeAlbums]   = useState([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);

  // Modals
  // slot : 1 = 1er créneau, 2 = 2e créneau (twice_daily uniquement)
  const [activePickerSlot, setActivePickerSlot] = useState(null); // null | 1 | 2
  const showTimePicker = activePickerSlot !== null;
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [tempHour, setTempHour]     = useState(notificationHour);
  const [tempMinute, setTempMinute] = useState(notificationMinute);

  const [saving, setSaving] = useState(false);

  const openPicker = (slot) => {
    if (slot === 2) { setTempHour(notificationHour2); setTempMinute(notificationMinute2); }
    else            { setTempHour(notificationHour);  setTempMinute(notificationMinute);  }
    setActivePickerSlot(slot);
  };

  const isActive = notificationFrequency !== "off";
  const freq     = FREQ_OPTIONS.find((o) => o.key === notificationFrequency) ?? FREQ_OPTIONS[4];

  // Charge les albums natifs quand on bascule sur "dossier"
  const loadNativeAlbums = async () => {
    if (nativeAlbums.length > 0) { setShowAlbumPicker(true); return; }
    setAlbumsLoading(true);
    try {
      const list = await getAlbums();
      setNativeAlbums(list);
      setShowAlbumPicker(true);
    } catch {
      Alert.alert("Erreur", "Impossible de charger les dossiers photos.");
    } finally {
      setAlbumsLoading(false);
    }
  };

  // Active / met à jour le rappel
  const applySchedule = async (freqKey, h1, m1, h2, m2) => {
    setSaving(true);
    if (freqKey === "off") {
      await cancelReminders();
      setNotificationFrequency("off");
      setSaving(false);
      return;
    }
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert(
        "Permission refusée",
        "Pour recevoir des rappels, active les notifications pour Pellicule dans tes Réglages."
      );
      setSaving(false);
      return;
    }
    const result = await scheduleReminder(freqKey, {
      remainingCount, randomCount,
      notificationHour: h1, notificationMinute: m1,
      notificationHour2: h2, notificationMinute2: m2,
    });
    if (result.success) {
      setNotificationFrequency(freqKey);
      setNotificationHour(h1);
      setNotificationMinute(m1);
      setNotificationHour2(h2);
      setNotificationMinute2(m2);
    } else {
      Alert.alert("Erreur", "Impossible de programmer le rappel. Réessaie.");
    }
    setSaving(false);
  };

  const handleFreqChange = (key) => {
    applySchedule(key, notificationHour, notificationMinute, notificationHour2, notificationMinute2);
  };

  const confirmTimePicker = () => {
    const slot = activePickerSlot;
    setActivePickerSlot(null);
    if (slot === 2) {
      applySchedule(notificationFrequency, notificationHour, notificationMinute, tempHour, tempMinute);
    } else {
      applySchedule(notificationFrequency, tempHour, tempMinute, notificationHour2, notificationMinute2);
    }
  };

  const handleSelectNativeAlbum = (album) => {
    setSortPriority({ type: "native_album", nativeAlbumId: album.id, nativeAlbumTitle: album.title, monthKeys: [] });
    setShowAlbumPicker(false);
  };

  const handleToggleMonth = (key) => {
    const current = sortPriority.monthKeys ?? [];
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    setSortPriority({ ...sortPriority, type: "month", monthKeys: next, nativeAlbumId: null, nativeAlbumTitle: null });
  };

  const timeLabel  = `${String(notificationHour).padStart(2, "0")}h${String(notificationMinute).padStart(2, "0")}`;
  const time2Label = `${String(notificationHour2).padStart(2, "0")}h${String(notificationMinute2).padStart(2, "0")}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "800", fontSize: 20, color: C.text }}>Rappels quotidiens</Text>
          <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>Configure ton rythme de tri</Text>
        </View>
        {/* Badge statut */}
        <View style={{
          backgroundColor: isActive ? `${C.green}20` : `${C.textMuted}15`,
          borderRadius: S.radiusFull,
          paddingHorizontal: 10, paddingVertical: 5,
          borderWidth: 1, borderColor: isActive ? `${C.green}50` : C.border,
        }}>
          <Text style={{ fontSize: 12, fontWeight: "800", color: isActive ? C.green : C.textMuted }}>
            {isActive ? "● Actif" : "○ Inactif"}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: S.pad, paddingBottom: 40 }}>

        {/* ── Carte stats ────────────────────────────────────────────── */}
        <View style={{
          backgroundColor: isActive ? `${C.accent}10` : C.bgCard,
          borderRadius: S.radiusLg,
          padding: 20,
          borderWidth: 2,
          borderColor: isActive ? `${C.accent}40` : C.border,
          marginBottom: 24,
        }}>
          {isActive ? (
            <>
              <Text style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
                {freq.emoji} {freq.label} · {timeLabel}
                {notificationFrequency === "twice_daily" && ` · ${time2Label}`}
              </Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontSize: 36, fontWeight: "900", color: C.accent }}>{remainingCount}</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 2 }}>photos à trier</Text>
                </View>
                <View style={{ width: 1, backgroundColor: C.border }} />
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontSize: 36, fontWeight: "900", color: C.accent }}>{sessionsLeft}</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 2 }}>sessions restantes</Text>
                </View>
                <View style={{ width: 1, backgroundColor: C.border }} />
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontSize: 36, fontWeight: "900", color: C.accent }}>{randomCount}</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 2 }}>photos / session</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 8 }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🔕</Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: C.text, marginBottom: 4 }}>Rappels désactivés</Text>
              <Text style={{ fontSize: 13, color: C.textMuted, textAlign: "center" }}>
                Active une fréquence ci-dessous pour recevoir des notifications de tri.
              </Text>
            </View>
          )}
        </View>

        {/* ── Fréquence ──────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Fréquence</Text>
        <View style={{ gap: 8, marginBottom: 24 }}>
          {FREQ_OPTIONS.map((opt) => {
            const active = notificationFrequency === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => handleFreqChange(opt.key)}
                disabled={saving}
                style={{
                  backgroundColor: active ? `${C.accent}12` : C.bgCard,
                  borderRadius: S.radius,
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderWidth: 1.5,
                  borderColor: active ? C.accent : C.border,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <Text style={{ fontSize: 22, width: 30, textAlign: "center" }}>{opt.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: active ? C.accent : C.text }}>{opt.label}</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{opt.desc}</Text>
                </View>
                {active && (
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Heure(s) du rappel (masqué si off ou every2days) ──────── */}
        {notificationFrequency !== "off" && notificationFrequency !== "every2days" && (
          <>
            <Text style={styles.sectionLabel}>
              {notificationFrequency === "twice_daily" ? "Heures des rappels" : "Heure du rappel"}
            </Text>

            {notificationFrequency === "twice_daily" ? (
              // ── Mode 2x/jour : deux blocs côte à côte ──────────────────
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
                {[
                  { slot: 1, label: "1er rappel", time: timeLabel },
                  { slot: 2, label: "2e rappel",  time: time2Label },
                ].map(({ slot, label, time }) => (
                  <TouchableOpacity
                    key={slot}
                    onPress={() => openPicker(slot)}
                    style={{
                      flex: 1,
                      backgroundColor: C.bgCard,
                      borderRadius: S.radius,
                      padding: 16,
                      alignItems: "center",
                      borderWidth: 1.5,
                      borderColor: C.border,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                      {label}
                    </Text>
                    <Text style={{ fontSize: 28, fontWeight: "900", color: C.text }}>{time}</Text>
                    <Text style={{ fontSize: 12, color: C.accent, fontWeight: "700", marginTop: 6 }}>Changer →</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              // ── Mode 1x : un seul bloc ──────────────────────────────────
              <TouchableOpacity
                onPress={() => openPicker(1)}
                style={{
                  backgroundColor: C.bgCard,
                  borderRadius: S.radius,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderWidth: 1.5,
                  borderColor: C.border,
                  marginBottom: 24,
                }}
              >
                <Text style={{ fontSize: 28, fontWeight: "900", color: C.text }}>{timeLabel}</Text>
                <Text style={{ fontSize: 13, color: C.accent, fontWeight: "700" }}>Changer →</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── Quantité par session ───────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Photos par session</Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
          {SESSION_PROFILES.map((p) => {
            const active = randomCount === p.count;
            return (
              <TouchableOpacity
                key={p.count}
                onPress={() => setRandomCount(p.count)}
                style={{
                  flex: 1,
                  backgroundColor: active ? `${C.accent}12` : C.bgCard,
                  borderRadius: S.radius,
                  padding: 14,
                  alignItems: "center",
                  borderWidth: 1.5,
                  borderColor: active ? C.accent : C.border,
                }}
              >
                <Text style={{ fontSize: 22, marginBottom: 4 }}>{p.emoji}</Text>
                <Text style={{ fontSize: 14, fontWeight: "900", color: active ? C.accent : C.text }}>{p.label}</Text>
                <Text style={{ fontSize: 20, fontWeight: "900", color: active ? C.accent : C.textMuted, marginTop: 4 }}>{p.count}</Text>
                <Text style={{ fontSize: 11, color: C.textMuted }}>{p.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Priorité de tri ────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Ce que tu veux trier en priorité</Text>

        {/* Option : Aléatoire */}
        <TouchableOpacity
          onPress={() => setSortPriority({ type: "random", nativeAlbumId: null, nativeAlbumTitle: null, monthKeys: [] })}
          style={[styles.priorityCard, sortPriority?.type === "random" && styles.priorityCardActive]}
        >
          <Text style={{ fontSize: 22 }}>🎲</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.priorityTitle, sortPriority?.type === "random" && { color: C.accent }]}>Aléatoire</Text>
            <Text style={styles.priorityDesc}>Pellicule choisit les photos pour toi</Text>
          </View>
          {sortPriority?.type === "random" && <CheckMark />}
        </TouchableOpacity>

        {/* Option : Dossier natif */}
        <TouchableOpacity
          onPress={loadNativeAlbums}
          disabled={albumsLoading}
          style={[styles.priorityCard, sortPriority?.type === "native_album" && styles.priorityCardActive]}
        >
          <Text style={{ fontSize: 22 }}>📁</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.priorityTitle, sortPriority?.type === "native_album" && { color: C.accent }]}>
              Un dossier
            </Text>
            <Text style={styles.priorityDesc}>
              {sortPriority?.type === "native_album" && sortPriority.nativeAlbumTitle
                ? `📂 ${sortPriority.nativeAlbumTitle}`
                : albumsLoading ? "Chargement…" : "Choisir un dossier de ta galerie"}
            </Text>
          </View>
          {sortPriority?.type === "native_album" && <CheckMark />}
        </TouchableOpacity>

        {/* Option : Par période (chips mois) */}
        <View style={[styles.priorityCard, sortPriority?.type === "month" && styles.priorityCardActive, { flexDirection: "column", alignItems: "flex-start", gap: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, width: "100%" }}>
            <Text style={{ fontSize: 22 }}>📅</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.priorityTitle, sortPriority?.type === "month" && { color: C.accent }]}>Une période</Text>
              <Text style={styles.priorityDesc}>Sélectionne un ou plusieurs mois</Text>
            </View>
            {sortPriority?.type === "month" && sortPriority.monthKeys?.length > 0 && <CheckMark />}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {monthGroups.map((g) => {
              const on = sortPriority?.type === "month" && (sortPriority.monthKeys ?? []).includes(g.key);
              return (
                <TouchableOpacity
                  key={g.key}
                  onPress={() => handleToggleMonth(g.key)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6,
                    borderRadius: S.radiusFull, borderWidth: 1.5,
                    borderColor: on ? C.accent : C.border,
                    backgroundColor: on ? `${C.accent}15` : C.bg,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: on ? C.accent : C.textMuted }}>
                    {g.label}{"  "}<Text style={{ fontWeight: "500", fontSize: 11 }}>{g.count}</Text>
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

      </ScrollView>

      {/* ── Modal picker heure ─────────────────────────────────────────── */}
      <Modal visible={showTimePicker} transparent animationType="slide" onRequestClose={() => setActivePickerSlot(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: C.text, marginBottom: 4 }}>
              {notificationFrequency === "twice_daily"
                ? (activePickerSlot === 2 ? "2e rappel" : "1er rappel")
                : "Heure du rappel"}
            </Text>
            <Text style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>
              Tu recevras ce rappel à {String(tempHour).padStart(2, "0")}h{String(tempMinute).padStart(2, "0")}
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <NumberDrum values={HOURS}   selected={tempHour}   onChange={setTempHour} />
              <Text style={{ fontSize: 28, fontWeight: "900", color: C.text }}>:</Text>
              <NumberDrum values={MINUTES} selected={tempMinute} onChange={setTempMinute} />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setActivePickerSlot(null)}
                style={{ flex: 1, backgroundColor: C.bgMuted, borderRadius: S.radius, padding: 14, alignItems: "center" }}
              >
                <Text style={{ color: C.textMuted, fontWeight: "700" }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmTimePicker}
                style={{ flex: 1, backgroundColor: C.accent, borderRadius: S.radius, padding: 14, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal choix dossier natif ──────────────────────────────────── */}
      <Modal visible={showAlbumPicker} transparent animationType="slide" onRequestClose={() => setShowAlbumPicker(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44, maxHeight: "70%" }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: C.text, marginBottom: 4 }}>Choisir un dossier</Text>
            <Text style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
              Les photos de ce dossier seront triées en priorité.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {nativeAlbums.map((a) => {
                const active = sortPriority?.nativeAlbumId === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => handleSelectNativeAlbum(a)}
                    style={{
                      backgroundColor: active ? `${C.accent}12` : C.bg,
                      borderRadius: S.radius,
                      padding: 14,
                      marginBottom: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      borderWidth: 1.5,
                      borderColor: active ? C.accent : C.border,
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>📁</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "700", fontSize: 14, color: C.text }}>{a.title}</Text>
                      <Text style={{ fontSize: 12, color: C.textMuted }}>{a.assetCount} photo{a.assetCount !== 1 ? "s" : ""}</Text>
                    </View>
                    {active && <Text style={{ color: C.accent, fontWeight: "900" }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowAlbumPicker(false)}
              style={{ marginTop: 12, padding: 14, alignItems: "center" }}
            >
              <Text style={{ color: C.textMuted, fontWeight: "700" }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

function CheckMark() {
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>✓</Text>
    </View>
  );
}

const styles = {
  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: C.textMuted,
    textTransform: "uppercase", letterSpacing: 1.5,
    marginBottom: 10,
  },
  priorityCard: {
    backgroundColor: C.bgCard,
    borderRadius: S.radius,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    marginBottom: 8,
  },
  priorityCardActive: {
    backgroundColor: `${C.accent}08`,
    borderColor: C.accent,
  },
  priorityTitle: {
    fontSize: 14, fontWeight: "800", color: C.text,
  },
  priorityDesc: {
    fontSize: 12, color: C.textMuted, marginTop: 2,
  },
};
