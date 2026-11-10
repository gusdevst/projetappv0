// Résultats d'analyse des photos, gardés sur le téléphone (fichier JSON).
// Un fichier plutôt qu'AsyncStorage : des dizaines de milliers de photos = plusieurs Mo,
// AsyncStorage (surtout Android) n'aime pas les très grosses valeurs.
//
// Format : { [photoId]: { m: modificationTime, blur: { lap, top, lap2, lap4, v: versionAlgo },
//                         tags: { l: [["Beach", 87], …], v: versionAlgo } } }
// Chaque analyse a sa propre clé (`blur`, `tags`…) et sa propre version `v`.
import * as FileSystem from "expo-file-system/legacy";

const FILE = `${FileSystem.documentDirectory}photo-analysis-v1.json`;
const TMP = `${FILE}.tmp`;

export async function loadAnalysisCache() {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return {};
    const raw = await FileSystem.readAsStringAsync(FILE);
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {}; // fichier absent ou abîmé : on repart de zéro (les photos seront remesurées)
  }
}

export async function saveAnalysisCache(cache) {
  try {
    // On écrit dans un fichier temporaire puis on le déplace : jamais de fichier à moitié écrit.
    await FileSystem.writeAsStringAsync(TMP, JSON.stringify(cache));
    await FileSystem.deleteAsync(FILE, { idempotent: true });
    await FileSystem.moveAsync({ from: TMP, to: FILE });
  } catch {}
}

export async function clearAnalysisCache() {
  try {
    await FileSystem.deleteAsync(FILE, { idempotent: true });
    await FileSystem.deleteAsync(TMP, { idempotent: true });
  } catch {}
}
