// [DEV] Test minimal du module de netteté : mesure quelques photos au hasard et
// affiche leur score + le temps de calcul. Affiché seulement en __DEV__ (Réglages).
// Sera remplacé par l'écran de calibrage (étape 3).
import { useState, useMemo } from "react";
import { View, TouchableOpacity, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import Text from "../AppText";
import { C } from "../../constants/theme";
import { BLUR_THRESHOLD, BLUR_THRESHOLD_WHATSAPP } from "../../constants/blurConfig";
import { usePhotoStore } from "../../store/usePhotoStore";
import { useBlurStore } from "../../store/useBlurStore";
import { getSharpness, isSharpnessAvailable } from "../../services/sharpness";
import { restartPhotoAnalysis, resetPhotoAnalysis } from "../../services/photoAnalysisQueue";
import { blurryPhotos } from "../../services/blurDetection";
import { isWhatsAppName } from "../../services/photoSource";

const SAMPLE = 8;

export default function SharpnessDevTest() {
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
        res = await getSharpness(p.id);
      } catch (e) {
        err = String(e?.message || e);
      }
      const ms = Date.now() - t0;
      totalMs += ms;
      out.push({ photo: p, score: res ? res.score : null, size: res ? `${res.width}×${res.height}` : null, ms, err });
      setRows([...out]);
    }
    // Les plus floues (score bas) en premier.
    out.sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity));
    setRows(out);
    setAvgMs(picks.length ? Math.round(totalMs / picks.length) : null);
    setRunning(false);
  }

  return (
    <View style={{ backgroundColor: C.bgCard, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginTop: 10 }}>
      <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>[DEV] Test de netteté</Text>
      <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
        {isSharpnessAvailable
          ? `Mesure ${SAMPLE} photos au hasard. Score bas = floue.`
          : "Module natif absent : il faut reconstruire l'app (rebuild)."}
      </Text>

      <TouchableOpacity
        onPress={run}
        disabled={!isSharpnessAvailable || running || libraryPhotos.length === 0}
        style={{
          marginTop: 10, borderRadius: 12, paddingVertical: 11, alignItems: "center",
          backgroundColor: isSharpnessAvailable ? C.accent : C.border,
        }}
      >
        {running
          ? <ActivityIndicator color="#fff" />
          : <Text style={{ color: "#fff", fontWeight: "700" }}>Mesurer {SAMPLE} photos</Text>}
      </TouchableOpacity>

      {rows.map((r) => (
        <View key={r.photo.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
          <Image source={{ uri: r.photo.url }} style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: C.bgMuted }} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: r.err ? C.red : C.text }}>
              {r.err ? "Erreur" : r.score == null ? "Illisible (iCloud ?)" : `Score ${r.score.toFixed(1)}`}
            </Text>
            <Text style={{ fontSize: 11, color: C.textMuted }} numberOfLines={1}>
              {r.err || `${r.photo.filename} · ${r.size ?? "—"} · ${r.ms} ms`}
            </Text>
          </View>
        </View>
      ))}

      {avgMs != null && (
        <Text style={{ fontSize: 12, color: C.textMid, marginTop: 10 }}>Moyenne : {avgMs} ms par photo</Text>
      )}

      <AnalysisDiagnostic />
    </View>
  );
}

// [DEV] Suivi de l'analyse de fond (services/photoAnalysisQueue.js) + ce que la détection WhatsApp trouve vraiment.
function AnalysisDiagnostic() {
  const navigation = useNavigation();
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const deleted = usePhotoStore((s) => s.deleted);
  const { status, total, done, scores, rev, whatsapp } = useBlurStore();

  const stats = useMemo(() => {
    const deletedIds = new Set(deleted.map((p) => p.id));
    const blurry = blurryPhotos(libraryPhotos, scores, { waIds: whatsapp.ids, deletedIds });
    let byName = 0, byAlbum = 0, suspects = 0;
    for (const p of libraryPhotos) {
      if (p.isScreenshot) continue;
      const n = isWhatsAppName(p.filename);
      const a = whatsapp.ids.has(p.id);
      if (n) byName++;
      if (a) byAlbum++;
      // iOS : pas détectée, pas de date de prise de vue, petite taille → ressemble à une photo reçue par message
      if (!n && !a && p.dateIsReceived && Math.max(p.width, p.height) <= 1700) suspects++;
    }
    return {
      blurry: blurry.length,
      blurryWa: blurry.filter((b) => b.whatsapp).length,
      measured: Object.keys(scores).length,
      byName, byAlbum, suspects,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryPhotos, deleted, rev, whatsapp]);

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const statusLabel = {
    idle: "en pause / pas lancée",
    running: "en cours",
    done: "terminée",
    unavailable: "module natif absent (rebuild)",
  }[status] || status;

  const line = { fontSize: 12, color: C.textMid, marginTop: 3 };
  const btn = { borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgMuted };

  return (
    <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }}>
      <TouchableOpacity
        onPress={() => navigation.navigate("BlurCalibration")}
        style={{ borderRadius: 12, paddingVertical: 11, alignItems: "center", backgroundColor: C.sage, borderWidth: 1, borderColor: C.sage2, marginBottom: 12 }}
      >
        <Text style={{ fontWeight: "700", color: C.accent }}>Ouvrir le calibrage des seuils ›</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>Analyse de fond</Text>
      <Text style={line}>{`${done} / ${total} photos (${pct} %) · ${statusLabel}`}</Text>
      <Text style={line}>{`Résultats gardés sur le téléphone : ${stats.measured}`}</Text>
      <Text style={line}>{`Photos floues (seuils ${BLUR_THRESHOLD} / ${BLUR_THRESHOLD_WHATSAPP} WhatsApp) : ${stats.blurry}, dont ${stats.blurryWa} WhatsApp`}</Text>

      <Text style={{ fontSize: 13, fontWeight: "700", color: C.text, marginTop: 12 }}>Détection WhatsApp</Text>
      <Text style={line}>{`Par nom de fichier (IMG-…-WA0003) : ${stats.byName}`}</Text>
      <Text style={line}>{`Par dossier : ${stats.byAlbum}`}</Text>
      <Text style={line}>
        {whatsapp.albums.length
          ? `Dossiers trouvés : ${whatsapp.albums.map((a) => `${a.title} (${a.count})`).join(", ")}`
          : "Dossiers trouvés : aucun"}
      </Text>
      <Text style={line}>{`Suspectes non détectées (sans date de prise de vue, ≤ 1700 px) : ${stats.suspects}`}</Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <TouchableOpacity style={btn} onPress={restartPhotoAnalysis}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: C.text }}>Relancer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={btn} onPress={resetPhotoAnalysis}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: C.red }}>Tout effacer et recalculer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
