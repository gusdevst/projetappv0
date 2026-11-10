// File d'analyse des photos, en arrière-plan, app ouverte.
// Deux analyses, l'une après l'autre, par la même chaîne (même cache, même file) :
//   1. la netteté (photos floues) ;
//   2. les étiquettes de contenu (« plage », « chien »… : voir services/imageLabels.js).
//
// Comment ça marche, avec l'image d'un trieur à la chaîne :
//  - on ne traite QUE les photos pas encore vues (cache : id + date de modification + version de la formule) ;
//  - 2 photos à la fois, avec une micro-pause entre chaque : le swipe et l'interface restent fluides ;
//  - on s'arrête quand l'app passe en arrière-plan, on reprend au retour ;
//  - on sauvegarde sur disque régulièrement : rien n'est perdu si l'app est fermée.
// Une photo illisible (ex. seulement sur iCloud) n'est pas enregistrée : elle sera réessayée au prochain lancement.
import { AppState } from "react-native";
import { usePhotoStore } from "../store/usePhotoStore";
import { useBlurStore } from "../store/useBlurStore";
import { getSharpness, isSharpnessAvailable } from "./sharpness";
import { getLabels, isLabelsAvailable } from "./imageLabels";
import { loadAnalysisCache, saveAnalysisCache, clearAnalysisCache } from "./photoAnalysisCache";
import { loadWhatsAppAlbumInfo } from "./photoSource";
import { isAnalyzable, isBlurFresh } from "./blurDetection";
import { isLabelsFresh } from "./labelSearch";
import {
  BLUR_ALGO_VERSION,
  ANALYSIS_START_DELAY_MS,
  ANALYSIS_CONCURRENCY,
  ANALYSIS_PAUSE_MS,
  ANALYSIS_PUBLISH_EVERY,
  ANALYSIS_SAVE_EVERY,
} from "../constants/blurConfig";
import {
  LABELS_ALGO_VERSION,
  LABELS_KEEP,
  LABELS_KEEP_MIN_CONF,
  LABELS_CONCURRENCY,
  LABELS_PAUSE_MS,
  LABELS_PUBLISH_EVERY,
  LABELS_SAVE_EVERY,
} from "../constants/labelsConfig";

let started = false;
let runId = 0;          // chaque lancement prend un numéro ; un lancement plus ancien s'arrête de lui-même
let startTimer = null;
let cache = null;       // { [photoId]: { m, blur: { lap, top, lap2, lap4, v }, tags: { l: [[texte, %]], v } } }
let cachePromise = null;
let saveChain = Promise.resolve();
const failedThisSession = new Set();       // photos illisibles (netteté) : pas de nouvel essai avant le prochain lancement
const failedLabelsThisSession = new Set(); // idem pour les étiquettes

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

// Ajoute un résultat à la fiche d'une photo SANS écraser les autres analyses.
// Si la photo a été modifiée depuis, les anciens résultats (de toutes les analyses) sont périmés : on les jette.
function putEntry(photo, patch) {
  const m = photo.modificationTime ?? null;
  const old = cache[photo.id];
  const base = old && (old.m ?? null) === m ? old : {};
  cache[photo.id] = { ...base, m, ...patch };
}

function schedule(delayMs = ANALYSIS_START_DELAY_MS) {
  clearTimeout(startTimer);
  startTimer = setTimeout(run, delayMs);
}

async function run() {
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
  const recentFirst = (a, b) => (b.creationTime || 0) - (a.creationTime || 0);

  if (isSharpnessAvailable) await runBlur(myRun, photos, recentFirst);
  else publish({ status: "unavailable" });
  if (myRun !== runId) return;

  if (isLabelsAvailable) await runLabels(myRun, photos, recentFirst);
  else publish({ labelsStatus: "unavailable" });
}

// ── 1. Netteté ──────────────────────────────────────────────────────────────
async function runBlur(myRun, photos, recentFirst) {
  const todo = photos
    .filter((p) => !isBlurFresh(cache[p.id], p) && !failedThisSession.has(p.id))
    .sort(recentFirst);

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
        // Les 4 mesures sont exigées : une app pas encore reconstruite (ancien module, 1 seule mesure)
        // n'écrit rien, et la photo sera mesurée après le rebuild.
        if (res && [res.lap, res.top, res.lap2, res.lap4].every(Number.isFinite)) {
          const r = (x) => Math.round(x * 100) / 100;
          putEntry(p, { blur: { lap: r(res.lap), top: r(res.top), lap2: r(res.lap2), lap4: r(res.lap4), v: BLUR_ALGO_VERSION } });
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

// ── 2. Étiquettes de contenu ────────────────────────────────────────────────
async function runLabels(myRun, photos, recentFirst) {
  const todo = photos
    .filter((p) => !isLabelsFresh(cache[p.id], p) && !failedLabelsThisSession.has(p.id))
    .sort(recentFirst);

  let done = photos.length - todo.length;
  publish({ labelsStatus: todo.length ? "running" : "done", labelsTotal: photos.length, labelsDone: done });
  if (todo.length === 0) return;

  let next = 0;
  let sinceSave = 0;
  let sincePublish = 0;

  async function worker() {
    while (myRun === runId && next < todo.length) {
      const p = todo[next++];
      try {
        const res = await getLabels(p.id);
        if (res && Array.isArray(res.labels)) {
          // On garde les LABELS_KEEP plus sûres au-dessus du seuil, en [texte, % entier] : fichier compact.
          const l = res.labels
            .filter((x) => x && typeof x.text === "string" && x.confidence >= LABELS_KEEP_MIN_CONF)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, LABELS_KEEP)
            .map((x) => [x.text, Math.round(x.confidence * 100)]);
          putEntry(p, { tags: { l, v: LABELS_ALGO_VERSION } });
          sinceSave++;
        } else {
          failedLabelsThisSession.add(p.id); // illisible (iCloud…)
        }
      } catch {
        failedLabelsThisSession.add(p.id);
      }
      done++;
      sincePublish++;
      if (sincePublish >= LABELS_PUBLISH_EVERY) {
        sincePublish = 0;
        publish({ labelsDone: done });
      }
      if (sinceSave >= LABELS_SAVE_EVERY) {
        sinceSave = 0;
        persist();
      }
      await sleep(LABELS_PAUSE_MS);
    }
  }

  await Promise.all(Array.from({ length: LABELS_CONCURRENCY }, worker));

  persist();
  if (myRun === runId) publish({ labelsStatus: "done", labelsDone: done });
}

/** À appeler UNE fois au démarrage (App.js). */
export function startPhotoAnalysis() {
  if (started) return;
  started = true;

  // Les résultats déjà connus sont disponibles tout de suite (avant même la fin du chargement).
  ensureCache().then(() => publish({}));

  // Photothèque (re)chargée → on regarde s'il reste des photos à traiter.
  usePhotoStore.subscribe((state, prev) => {
    if (state.libraryPhotos !== prev.libraryPhotos && state.libraryPhotos.length > 0) schedule();
  });

  AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") {
      schedule();
    } else if (nextState === "background") {
      runId++; // arrête les analyses en cours
      persist();
      const st = useBlurStore.getState();
      if (st.status === "running") publish({ status: "idle" });
      if (st.labelsStatus === "running") publish({ labelsStatus: "idle" });
    }
  });

  schedule();
}

/** [DEV] Relance tout de suite (ne refait que les photos pas encore traitées). */
export function restartPhotoAnalysis() {
  failedThisSession.clear();
  failedLabelsThisSession.clear();
  schedule(0);
}

/** [DEV] Efface tous les résultats (netteté ET étiquettes) et recommence de zéro. */
export async function resetPhotoAnalysis() {
  runId++;
  cache = {};
  cachePromise = Promise.resolve(cache);
  failedThisSession.clear();
  failedLabelsThisSession.clear();
  await clearAnalysisCache();
  publish({ status: "idle", done: 0, labelsStatus: "idle", labelsDone: 0 });
  schedule(0);
}
