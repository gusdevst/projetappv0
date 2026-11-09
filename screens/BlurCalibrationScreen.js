// [DEV] Calibrage des seuils de flou. Visible seulement en __DEV__ (bouton dans Réglages).
//
// Principe : les photos mesurées sont rangées de la plus floue à la plus nette. Tu déplaces
// un curseur (le seuil) et tu regardes si les photos juste sous la ligne sont vraiment floues
// et celles juste au-dessus vraiment nettes. Quand c'est bon, tu me donnes les deux nombres
// (ou tu les copies dans constants/blurConfig.js).
// Les seuils réglés ici ne servent que pour cet écran : ils ne changent rien ailleurs.
import { useMemo, useRef, useState } from "react";
import { View, FlatList, TouchableOpacity, Modal, Dimensions, StatusBar } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { C, S } from "../constants/theme";
import { BLUR_THRESHOLDS, BLUR_METRIC } from "../constants/blurConfig";
import { BLUR_METRICS, BLUR_METRIC_KEYS, formatScore } from "../services/blurMetrics";
import { usePhotoStore } from "../store/usePhotoStore";
import { useBlurStore } from "../store/useBlurStore";
import { blurScoreOf, isAnalyzable, isWhatsAppPhoto } from "../services/blurDetection";

const { width: SW } = Dimensions.get("window");
const COLS = 3;
const GAP = 4;
const CELL = Math.floor((SW - S.pad * 2 - GAP * (COLS - 1)) / COLS);
const ROW_H = CELL + GAP;

// Tranches de score pour la répartition (les ratios r12 / r24 ont leur propre échelle).
const EDGES_ABS = [0, 25, 50, 100, 150, 200, 300, 500, 1000, Infinity];
const EDGES_RATIO = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1, Infinity];
const isRatio = (metric) => metric === "r12" || metric === "r24";

function bucketLabel(lo, hi) {
  return hi === Infinity ? `${lo}+` : `${lo}`;
}

function StepButton({ label, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center", backgroundColor: C.bgMuted, borderWidth: 1, borderColor: C.border }}
    >
      <Text style={{ fontSize: 13, fontWeight: "700", color: C.text }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function BlurCalibrationScreen({ navigation }) {
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const { scores, rev, whatsapp, status, total, done } = useBlurStore();

  const [tab, setTab] = useState("normal"); // "normal" | "wa"
  const [metric, setMetric] = useState(BLUR_METRIC); // mesure qui décide (dette n°15)
  const [th, setTh] = useState(() => JSON.parse(JSON.stringify(BLUR_THRESHOLDS)));
  const EDGES = isRatio(metric) ? EDGES_RATIO : EDGES_ABS;
  const [opened, setOpened] = useState(null); // { photo, score } affichée en grand
  const listRef = useRef(null);

  // Photos mesurées, séparées normales / WhatsApp, de la plus floue à la plus nette.
  const groups = useMemo(() => {
    const normal = [];
    const wa = [];
    for (const photo of libraryPhotos) {
      if (!isAnalyzable(photo)) continue;
      const score = blurScoreOf(scores[photo.id], photo, metric);
      if (score == null) continue;
      (isWhatsAppPhoto(photo, whatsapp.ids) ? wa : normal).push({ photo, score });
    }
    normal.sort((a, b) => a.score - b.score);
    wa.sort((a, b) => a.score - b.score);
    return { normal, wa };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryPhotos, rev, whatsapp, metric]);

  const list = groups[tab];
  const threshold = th[metric][tab];
  const flagged = useMemo(() => {
    const i = list.findIndex((x) => x.score >= threshold);
    return i === -1 ? list.length : i;
  }, [list, threshold]);

  // Répartition des scores par tranche.
  const buckets = useMemo(() => {
    const counts = new Array(EDGES.length - 1).fill(0);
    for (const x of list) {
      for (let i = 0; i < counts.length; i++) {
        if (x.score >= EDGES[i] && x.score < EDGES[i + 1]) { counts[i]++; break; }
      }
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, metric]);
  const maxBucket = Math.max(1, ...buckets);

  function bump(delta) {
    setTh((t) => {
      const v = Math.max(0, Math.round((t[metric][tab] + delta) * 100) / 100);
      return { ...t, [metric]: { ...t[metric], [tab]: v } };
    });
  }

  function goToThreshold() {
    if (list.length === 0) return;
    const row = Math.max(0, Math.floor(flagged / COLS) - 1);
    listRef.current?.scrollToIndex({ index: row, animated: true });
  }

  const pct = list.length ? Math.round((flagged / list.length) * 100) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <View style={{ paddingHorizontal: S.pad }}>
        {/* En-tête */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 }}>
          <BackButton mode="menage" onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>[DEV] Calibrage du flou</Text>
            <Text style={{ fontSize: 11.5, color: C.textMuted }}>
              {status === "done" ? "Analyse terminée" : `Analyse ${status === "running" ? "en cours" : "en pause"} : ${total ? Math.round((done / total) * 100) : 0} %`}
            </Text>
          </View>
        </View>

        {/* Mesure qui décide */}
        <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
          {BLUR_METRIC_KEYS.map((k) => {
            const on = metric === k;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => setMetric(k)}
                style={{ flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: "center", backgroundColor: on ? C.text : C.bgCard, borderWidth: 1, borderColor: on ? C.text : C.border }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: on ? "#fff" : C.textMid }}>{BLUR_METRICS[k].label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
          {`${BLUR_METRICS[metric].hint}${metric === BLUR_METRIC ? " · mesure utilisée dans l'app" : ""}`}
        </Text>

        {/* Onglets */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {[
            { key: "normal", label: `Normales (${groups.normal.length})` },
            { key: "wa", label: `WhatsApp (${groups.wa.length})` },
          ].map((t) => {
            const on = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTab(t.key)}
                style={{ flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: "center", backgroundColor: on ? C.accent : C.bgCard, borderWidth: 1, borderColor: on ? C.accent : C.border }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: on ? "#fff" : C.textMid }}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Seuil */}
        <View style={{ marginTop: 12, backgroundColor: C.bgCard, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 13, color: C.textMid }}>Seuil {tab === "wa" ? "WhatsApp" : "normal"}</Text>
            <Text style={{ fontSize: 24, fontWeight: "700", color: C.text }}>{formatScore(threshold)}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
            {(isRatio(metric) ? [-0.05, -0.01, 0.01, 0.05] : [-50, -10, 10, 50]).map((d) => (
              <StepButton key={d} label={`${d > 0 ? "+" : "−"}${Math.abs(d)}`} onPress={() => bump(d)} />
            ))}
          </View>
          <Text style={{ fontSize: 12.5, color: C.textMid, marginTop: 8 }}>
            <Text style={{ fontWeight: "700", color: C.red }}>{flagged}</Text>
            {` photo${flagged > 1 ? "s" : ""} signalée${flagged > 1 ? "s" : ""} floue${flagged > 1 ? "s" : ""} sur ${list.length} (${pct} %)`}
          </Text>

          {/* Répartition */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 46, marginTop: 10 }}>
            {buckets.map((n, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: 46 }}>
                <View style={{ width: "100%", height: Math.max(2, Math.round((n / maxBucket) * 38)), borderRadius: 3, backgroundColor: EDGES[i + 1] <= threshold ? C.red : C.sage3 }} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 3, marginTop: 2 }}>
            {buckets.map((n, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ fontSize: 8.5, color: C.textMuted }}>{bucketLabel(EDGES[i], EDGES[i + 1])}</Text>
                <Text style={{ fontSize: 8.5, color: C.textMuted }}>{n}</Text>
              </View>
            ))}
          </View>

          <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>
            {`À mettre dans constants/blurConfig.js : BLUR_METRIC = "${metric}" · BLUR_THRESHOLDS.${metric} = { normal: ${th[metric].normal}, wa: ${th[metric].wa} }`}
          </Text>
        </View>

        {/* Navigation dans la liste */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10, marginBottom: 8 }}>
          <TouchableOpacity onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: C.bgMuted, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ fontSize: 12.5, fontWeight: "600", color: C.text }}>Plus floues</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToThreshold} style={{ flex: 1.3, paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: C.sage, borderWidth: 1, borderColor: C.sage2 }}>
            <Text style={{ fontSize: 12.5, fontWeight: "700", color: C.accent }}>Aller au seuil</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Grille : de la plus floue à la plus nette. Bord rouge = signalée floue par le seuil. */}
      <FlatList
        ref={listRef}
        data={list}
        numColumns={COLS}
        keyExtractor={(x) => x.photo.id}
        contentContainerStyle={{ paddingHorizontal: S.pad, paddingBottom: 30 }}
        columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
        getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
        initialNumToRender={18}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={
          <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 30 }}>
            Aucune photo mesurée dans cet onglet (l'analyse est peut-être encore en cours).
          </Text>
        }
        renderItem={({ item }) => {
          const isBlurry = item.score < threshold;
          return (
            <TouchableOpacity activeOpacity={0.85} onPress={() => setOpened(item)} style={{ width: CELL, height: CELL }}>
              <Image
                source={{ uri: item.photo.url }}
                recyclingKey={item.photo.id}
                contentFit="cover"
                style={{ width: CELL, height: CELL, borderRadius: 8, backgroundColor: C.bgMuted, borderWidth: isBlurry ? 2 : 0, borderColor: C.red }}
              />
              <View style={{ position: "absolute", left: 4, bottom: 4, backgroundColor: isBlurry ? C.red : "rgba(0,0,0,0.6)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>{formatScore(item.score)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Photo en grand : pour juger à l'œil si elle est vraiment floue */}
      <Modal visible={!!opened} transparent animationType="fade" onRequestClose={() => setOpened(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setOpened(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center" }}>
          {opened && (
            <>
              <Image source={{ uri: opened.photo.url }} contentFit="contain" style={{ width: SW, height: "78%" }} />
              <View style={{ alignItems: "center", marginTop: 14 }}>
                <Text style={{ fontSize: 22, fontWeight: "700", color: "#fff" }}>{`${BLUR_METRICS[metric].label} : ${formatScore(opened.score)}`}</Text>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
                  {`${opened.photo.filename} · ${opened.photo.width}×${opened.photo.height}`}
                </Text>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
                  {opened.score < threshold ? "Signalée floue avec ce seuil" : "Jugée nette avec ce seuil"} · toucher pour fermer
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
