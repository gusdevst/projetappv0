// File d'analyse des photos, en arrière-plan, app ouverte.
// Aujourd'hui : la netteté (photos floues). Demain : les étiquettes « plage / chien… » passeront
// par la même chaîne (même cache, même file).
//
// Comment ça marche, avec l'image d'un trieur à la chaîne :
//  - on ne mesure QUE les photos pas encore vues (cache : id + date de modification + version de la formule) ;
//  - 2 photos à la fois, avec une micro-pause entre chaque : le swipe et l'interface restent fluides ;
//  - on s'arrête quand l'app passe en arrière-plan, on reprend au retour ;
//  - on sauvegarde sur disque régulièrement : rien n'est perdu si l'app est fermée.
// Une photo illisible (ex. seulement sur iCloud) n'est pas enregistrée : elle sera réessayée au prochain lancement.
import { AppState } from "react-native";
import { usePhotoStore } from "../store/usePhotoStore";
import { useBlurStore } from "../store/useBlurStore";
import { getSharpness, isSharpnessAvailable } from "./sharpness";
import { loadAnalysisCache, saveAnalysisCache, clearAnalysisCache } from "./photoAnalysisCache";
import { loadWhatsAppAlbumInfo } from "./photoSource";
import { isAnalyzable, isBlurFresh } from "./blurDetection";
import {
  BLUR_ALGO_VERSION,
  ANALYSIS_START_DELAY_MS,
  ANALYSIS_CONCURRENCY,
  ANALYSIS_PAUSE_MS,
  ANALYSIS_PUBLISH_EVERY,
  ANALYSIS_SAVE_EVERY,
} from "../constants/blurConfig";

let started = false;
let runId = 0;          // chaque lancement prend un numéro ; un lancement plus ancien s'arrête de lui-même
let startTimer = null;
let cache = null;       // { [photoId]: { m, blur: { s, v } } }
let cachePromise = null;
let saveChain = Promise.resolve();
const failedThisSession = new Set(); // photos illisibles : pas de nouvel essai avant le prochain lancement de l'app

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ensureCache() {
  if (!cachePromise) {
    cachePromise = loadAnalysisCache().then((c) => {
      cache = c;
      return c;
    });
  }
  return cachePromise;
}

// Prévient l'interface (compteurs, % d'avancement).
function publish(patch) {
  useBlurStore.setState((s) => ({ ...patch, scores: cache ?? s.scores, rev: s.rev + 1 }));
}

// Sauvegardes l'une après l'autre (jamais deux écritures en même temps).
function persist() {
  saveChain = saveChain.then(() => (cache ? saveAnalysisCache(cache) : undefined));
  return saveChain;
}

function schedule(delayMs = ANALYSIS_START_DELAY_MS) {
  clearTimeout(startTimer);
  startTimer = setTimeout(run, delayMs);
}

async function run() {
  if (!isSharpnessAvailable) {
    publish({ status: "unavailable" });
    return;
  }
  if (AppState.currentState !== "active") return;
  const photos = usePhotoStore.getState().libraryPhotos.filter(isAnalyzable);
  if (photos.length === 0) return;

  const myRun = ++runId;
  await ensureCache();
  if (myRun !== runId) return;

  // Albums WhatsApp : sert aux seuils et au diagnostic. Pas d'attente : l'analyse démarre sans.
  loadWhatsAppAlbumInfo().then((info) => {
    useBlurStore.setState((s) => ({ whatsapp: info, rev: s.rev + 1 }));
  });

  // Les plus récentes d'abord : ce sont celles qu'on voit en premier.
  const todo = photos
    .filter((p) => !isBlurFresh(cache[p.id], p) && !failedThisSession.has(p.id))
    .sort((a, b) => (b.creationTime || 0) - (a.creationTime || 0));

  let done = photos.length - todo.length;
  publish({ status: todo.length ? "running" : "done", total: photos.length, done });
  if (todo.length === 0) return;

  let next = 0;
  let sinceSave = 0;
  let sincePublish = 0;

  async function worker() {
    while (myRun === runId && next < todo.length) {
      const p = todo[next++];
      try {
        const res = await getSharpness(p.id);
        if (res && Number.isFinite(res.score)) {
          cache[p.id] = {
            m: p.modificationTime ?? null,
            blur: { s: Math.round(res.score * 100) / 100, v: BLUR_ALGO_VERSION },
          };
          sinceSave++;
        } else {
          failedThisSession.add(p.id); // illisible (iCloud…)
        }
      } catch {
        failedThisSession.add(p.id);
      }
      done++;
      sincePublish++;
      if (sincePublish >= ANALYSIS_PUBLISH_EVERY) {
        sincePublish = 0;
        publish({ done });
      }
      if (sinceSave >= ANALYSIS_SAVE_EVERY) {
        sinceSave = 0;
        persist();
      }
      await sleep(ANALYSIS_PAUSE_MS);
    }
  }

  await Promise.all(Array.from({ length: ANALYSIS_CONCURRENCY }, worker));

  persist(); // fin normale ou arrêt : on sauvegarde ce qui a été mesuré
  if (myRun === runId) publish({ status: "done", done });
}

/** À appeler UNE fois au démarrage (App.js). */
export function startPhotoAnalysis() {
  if (started) return;
  started = true;

  // Les résultats déjà connus sont disponibles tout de suite (avant même la fin du chargement).
  ensureCache().then(() => publish({}));

  // Photothèque (re)chargée → on regarde s'il reste des photos à mesurer.
  usePhotoStore.subscribe((state, prev) => {
    if (state.libraryPhotos !== prev.libraryPhotos && state.libraryPhotos.length > 0) schedule();
  });

  AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") {
      schedule();
    } else if (nextState === "background") {
      runId++; // arrête les mesures en cours
      persist();
      if (useBlurStore.getState().status === "running") publish({ status: "idle" });
    }
  });

  schedule();
}

/** [DEV] Relance tout de suite (ne refait que les photos pas encore mesurées). */
export function restartPhotoAnalysis() {
  failedThisSession.clear();
  schedule(0);
}

/** [DEV] Efface tous les résultats et recommence de zéro. */
export async function resetPhotoAnalysis() {
  runId++;
  cache = {};
  cachePromise = Promise.resolve(cache);
  failedThisSession.clear();
  await clearAnalysisCache();
  publish({ status: "idle", done: 0 });
  schedule(0);
}
