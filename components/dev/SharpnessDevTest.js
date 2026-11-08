// [DEV] Test minimal du module de netteté : mesure quelques photos au hasard et
// affiche leur score + le temps de calcul. Affiché seulement en __DEV__ (Réglages).
// Sera remplacé par l'écran de calibrage (étape 3).
import { useState } from "react";
import { View, TouchableOpacity, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import Text from "../AppText";
import { C } from "../../constants/theme";
import { usePhotoStore } from "../../store/usePhotoStore";
import { getSharpness, isSharpnessAvailable } from "../../services/sharpness";

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
    </View>
  );
}
