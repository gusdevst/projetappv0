// [DEV] Test du module d'étiquettes : analyse quelques photos au hasard et affiche
// leurs étiquettes (anglais) + le temps de calcul. Affiché seulement en __DEV__ (Réglages).
import { useState, useMemo } from "react";
import { View, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { Image } from "expo-image";
import Text from "../AppText";
import { C } from "../../constants/theme";
import { LABELS_SEARCH_MIN_CONF } from "../../constants/labelsConfig";
import { usePhotoStore } from "../../store/usePhotoStore";
import { useBlurStore } from "../../store/useBlurStore";
import { getLabels, isLabelsAvailable } from "../../services/imageLabels";
import { searchByLabels, labelFrequencies } from "../../services/labelSearch";
import { parseQuery, describeQuery } from "../../services/searchParser";
import { searchContent } from "../../services/contentSearch";
import { restartPhotoAnalysis } from "../../services/photoAnalysisQueue";

const SAMPLE = 8;

export default function LabelsDevTest() {
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState([]);
  const [avgMs, setAvgMs] = useState(null);

  async function run() {
    if (running) return;
    setRunning(true);
    setRows([]);
    setAvgMs(null);
    const pool = libraryPhotos.filter((p) => !p.isScreenshot);
    const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, SAMPLE);
    const out = [];
    let totalMs = 0;
    for (const p of picks) {
      const t0 = Date.now();
      let res = null;
      let err = null;
      try {
        res = await getLabels(p.id);
      } catch (e) {
        err = String(e?.message || e);
      }
      const ms = Date.now() - t0;
      totalMs += ms;
      out.push({ photo: p, labels: res ? res.labels : null, ms, err });
      setRows([...out]);
    }
    setAvgMs(picks.length ? Math.round(totalMs / picks.length) : null);
    setRunning(false);
  }

  return (
    <View style={{ backgroundColor: C.bgCard, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginTop: 10 }}>
      <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>[DEV] Test des étiquettes</Text>
      <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
        {isLabelsAvailable
          ? `Analyse ${SAMPLE} photos au hasard. Étiquettes en anglais, confiance en %.`
          : "Module natif absent : il faut reconstruire l'app (rebuild)."}
      </Text>

      <TouchableOpacity
        onPress={run}
        disabled={!isLabelsAvailable || running || libraryPhotos.length === 0}
        style={{
          marginTop: 10, borderRadius: 12, paddingVertical: 11, alignItems: "center",
          backgroundColor: isLabelsAvailable ? C.accent : C.border,
        }}
      >
        {running
          ? <ActivityIndicator color="#fff" />
          : <Text style={{ color: "#fff", fontWeight: "700" }}>Analyser {SAMPLE} photos</Text>}
      </TouchableOpacity>

      {rows.map((r) => (
        <View key={r.photo.id} style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <Image source={{ uri: r.photo.url }} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: C.bgMuted }} contentFit="cover" />
          <View style={{ flex: 1 }}>
            {r.err ? (
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.red }}>{r.err}</Text>
            ) : r.labels == null ? (
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.text }}>Illisible (iCloud ?)</Text>
            ) : (
              <Text style={{ fontSize: 13, color: C.text }}>
                {r.labels.length
                  ? r.labels.slice(0, 6).map((l) => `${l.text} ${Math.round(l.confidence * 100)}%`).join(" · ")
                  : "Aucune étiquette"}
              </Text>
            )}
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }} numberOfLines={1}>
              {`${r.photo.filename} · ${r.ms} ms`}
            </Text>
          </View>
        </View>
      ))}

      {avgMs != null && (
        <Text style={{ fontSize: 12, color: C.textMid, marginTop: 10 }}>Moyenne : {avgMs} ms par photo</Text>
      )}

      <LabelsSearchDev />
    </View>
  );
}

// [DEV] Analyse de fond des étiquettes + recherche par mot (anglais pour l'instant : le dictionnaire
// français viendra ensuite) + étiquettes les plus fréquentes (pour construire ce dictionnaire).
function LabelsSearchDev() {
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const deleted = usePhotoStore((s) => s.deleted);
  const { labelsStatus, labelsTotal, labelsDone, scores, rev } = useBlurStore();
  const [query, setQuery] = useState("");
  const [minPct, setMinPct] = useState(Math.round(LABELS_SEARCH_MIN_CONF * 100));

  const pct = labelsTotal > 0 ? Math.round((labelsDone / labelsTotal) * 100) : 0;
  const statusLabel = {
    idle: "en pause / pas lancée",
    running: "en cours",
    done: "terminée",
    unavailable: "module natif absent (rebuild)",
  }[labelsStatus] || labelsStatus;

  const parsed = useMemo(() => parseQuery(query), [query]);
  // Phrase non comprise (aucune idée, aucune période) : on tente les mots tels quels comme étiquettes anglaises.
  const rawEnglish = query.trim() !== "" && parsed.concepts.length === 0 && !parsed.period;

  const { found, notAnalyzed } = useMemo(() => {
    if (!query.trim()) return { found: [], notAnalyzed: 0 };
    const deletedIds = new Set(deleted.map((p) => p.id));
    if (rawEnglish) {
      const terms = query.split(/[,\s]+/).filter(Boolean);
      return { found: searchByLabels(libraryPhotos, scores, terms, { minPct, deletedIds }), notAnalyzed: 0 };
    }
    const r = searchContent(parsed, libraryPhotos, scores, { minPct, deletedIds });
    return { found: r.results, notAnalyzed: r.notAnalyzed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, parsed, rawEnglish, minPct, libraryPhotos, deleted, rev]);

  const freq = useMemo(
    () => labelFrequencies(libraryPhotos, scores, { minPct, limit: 50 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minPct, libraryPhotos, rev]
  );

  const line = { fontSize: 12, color: C.textMid, marginTop: 3 };
  const btn = { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgMuted };
  const SHOWN = 48;

  return (
    <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }}>
      <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>Analyse de fond des étiquettes</Text>
      <Text style={line}>{`${labelsDone} / ${labelsTotal} photos (${pct} %) · ${statusLabel}`}</Text>
      <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
        Elle démarre après celle du flou. Les photos les plus récentes passent en premier.
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <TouchableOpacity style={btn} onPress={restartPhotoAnalysis}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: C.text }}>Relancer</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ fontSize: 13, fontWeight: "700", color: C.text, marginTop: 14 }}>Chercher (en français)</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="l'été 2026 à la plage, chiens, Noël dernier…"
        placeholderTextColor={C.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          marginTop: 6, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12,
          paddingVertical: 9, fontSize: 14, color: C.text, backgroundColor: C.bgMuted,
        }}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
        <Text style={{ fontSize: 12, color: C.textMid }}>Confiance minimale : {minPct} %</Text>
        <TouchableOpacity style={btn} onPress={() => setMinPct((v) => Math.max(15, v - 10))}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: C.text }}>−10</Text>
        </TouchableOpacity>
        <TouchableOpacity style={btn} onPress={() => setMinPct((v) => Math.min(95, v + 10))}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: C.text }}>+10</Text>
        </TouchableOpacity>
      </View>

      {query.trim() !== "" && (
        <>
          {/* Ce que l'app a compris (comme le futur « J'ai compris » de l'écran de recherche) */}
          <View style={{ marginTop: 10, backgroundColor: C.sage, borderRadius: 10, padding: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: C.accent }}>
              {rawEnglish ? "Mot cherché tel quel (étiquette anglaise)" : `J'ai compris : ${describeQuery(parsed) || "—"}`}
            </Text>
            {!rawEnglish && parsed.period != null && parsed.concepts.length === 0 && (
              <Text style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>Période seule : toutes les photos de cette période.</Text>
            )}
            {parsed.concepts.map((c) => (
              <Text key={c.id} style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>
                {`${c.fr}${c.approx ? " (approximatif)" : ""} → ${c.labels.filter((l) => l[0] === l[0].toUpperCase()).slice(0, 6).join(", ")}`}
              </Text>
            ))}
            {parsed.unknown.length > 0 && !rawEnglish && (
              <Text style={{ fontSize: 11, color: C.red, marginTop: 2 }}>{`Pas compris : ${parsed.unknown.join(", ")}`}</Text>
            )}
            {parsed.suggestions.length > 0 && (
              <Text style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>{`Tu voulais dire : ${parsed.suggestions.map((c) => c.fr).join(", ")} ?`}</Text>
            )}
          </View>
          <Text style={{ fontSize: 12, color: C.textMid, marginTop: 10 }}>
            {`${found.length} photo${found.length > 1 ? "s" : ""} trouvée${found.length > 1 ? "s" : ""}${found.length > SHOWN ? ` (les ${SHOWN} premières affichées)` : ""}`}
            {notAnalyzed > 0 ? ` · ${notAnalyzed} pas encore analysée${notAnalyzed > 1 ? "s" : ""}` : ""}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {found.slice(0, SHOWN).map((r) => (
              <View key={r.photo.id} style={{ width: 72, height: 72, borderRadius: 8, overflow: "hidden", backgroundColor: C.bgMuted }}>
                <Image source={{ uri: r.photo.url }} style={{ width: 72, height: 72 }} contentFit="cover" />
                <View style={{ position: "absolute", left: 3, bottom: 3, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{r.pct == null ? "·" : `${r.pct}%`}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      <Text style={{ fontSize: 13, fontWeight: "700", color: C.text, marginTop: 16 }}>
        Étiquettes les plus fréquentes (≥ {minPct} %)
      </Text>
      <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
        Sert à compléter le dictionnaire (constants/searchVocabulary.js). Touche une étiquette pour la chercher telle quelle.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {freq.length === 0 && <Text style={line}>Rien encore : l'analyse n'a pas commencé.</Text>}
        {freq.map((f) => (
          <TouchableOpacity key={f.text} style={btn} onPress={() => setQuery(f.text)}>
            <Text style={{ fontSize: 12, color: C.text }}>{`${f.text} · ${f.count}`}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
