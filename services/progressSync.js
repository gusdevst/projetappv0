// services/progressSync.js
// Sauvegarde de la progression sur Supabase (table `progress`, 1 ligne par compte).
//
// Ce qui est synchronisé : seulement des CHIFFRES (série, galons, badges, historique).
// Jamais de photos, ni coups de cœur / albums (liés aux identifiants des photos de CE téléphone).
//   dailyLog · lifetimeSorted · achievements · shuffleLaunchCount · best20Ms
//
// Fusion (pour ne jamais rien perdre, ni écraser) :
//   • dailyLog : jour par jour, on garde le plus grand de chaque compteur
//   • achievements : union, avec la date la plus ancienne
//   • lifetimeSorted, shuffleLaunchCount : le plus grand
//   • best20Ms : le plus petit (meilleur chrono)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { usePhotoStore } from "../store/usePhotoStore";
import { useAuthStore } from "../store/useAuthStore";

const LAST_USER_KEY = "pellicule.sync.lastUserId";
const PUSH_DELAY_MS = 5000;

// ── Fusion (fonctions pures, sans réseau) ────────────────────────────────────

const maxN = (a, b) => Math.max(a ?? 0, b ?? 0);

export function mergeDailyLog(a = {}, b = {}) {
  const out = {};
  for (const day of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const da = a?.[day] || {};
    const db = b?.[day] || {};
    const merged = {};
    for (const f of new Set([...Object.keys(da), ...Object.keys(db)])) merged[f] = maxN(da[f], db[f]);
    out[day] = merged;
  }
  return out;
}

export function mergeAchievements(a = {}, b = {}) {
  const out = { ...(a || {}) };
  for (const [id, ts] of Object.entries(b || {})) {
    out[id] = out[id] ? Math.min(out[id], ts) : ts;
  }
  return out;
}

// local / remote : { dailyLog, lifetimeSorted, achievements, shuffleLaunchCount, best20Ms }
export function mergeProgress(local = {}, remote = {}) {
  const lifetimes = [local.lifetimeSorted, remote.lifetimeSorted].filter((v) => v != null);
  const bests = [local.best20Ms, remote.best20Ms].filter((v) => v);
  return {
    dailyLog: mergeDailyLog(local.dailyLog, remote.dailyLog),
    lifetimeSorted: lifetimes.length ? Math.max(...lifetimes) : null,
    achievements: mergeAchievements(local.achievements, remote.achievements),
    shuffleLaunchCount: maxN(local.shuffleLaunchCount, remote.shuffleLaunchCount),
    best20Ms: bests.length ? Math.min(...bests) : null,
  };
}

const pickProgress = (s) => ({
  dailyLog: s.dailyLog,
  lifetimeSorted: s.lifetimeSorted,
  achievements: s.achievements,
  shuffleLaunchCount: s.shuffleLaunchCount,
  best20Ms: s.best20Ms,
});

// ── Réseau ───────────────────────────────────────────────────────────────────

let syncedFor = null;   // id du compte pour lequel la récupération initiale est faite
let lastPushed = "";    // dernier contenu envoyé (évite les envois inutiles)
let pushTimer = null;
let pulling = false;

async function push(userId) {
  const data = pickProgress(usePhotoStore.getState());
  const json = JSON.stringify(data);
  if (json === lastPushed) return;
  const { error } = await supabase
    .from("progress")
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() });
  if (!error) lastPushed = json; // en cas d'erreur (hors-ligne), on réessaiera au prochain changement
}

// Récupère la progression du compte, la fusionne avec celle du téléphone, puis renvoie le résultat.
async function pullAndMerge(userId) {
  if (pulling) return;
  pulling = true;
  try {
    const { data: row, error } = await supabase
      .from("progress").select("data").eq("user_id", userId).maybeSingle();
    if (error) return; // hors-ligne : on réessaiera plus tard

    // Un autre compte s'était servi de ce téléphone : sa progression locale n'est pas la nôtre.
    const lastUser = await AsyncStorage.getItem(LAST_USER_KEY);
    const localIsForeign = !!lastUser && lastUser !== userId;
    const local = localIsForeign ? {} : pickProgress(usePhotoStore.getState());

    const merged = mergeProgress(local, row?.data || {});
    usePhotoStore.setState(merged);
    await AsyncStorage.setItem(LAST_USER_KEY, userId);
    syncedFor = userId;
    lastPushed = ""; // force un premier envoi du résultat fusionné
    await push(userId);
  } catch (e) {
    // silencieux : la synchro est un confort, elle ne doit jamais bloquer l'app
  } finally {
    pulling = false;
  }
}

function schedulePush() {
  const userId = useAuthStore.getState().session?.user?.id;
  if (!userId || syncedFor !== userId) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => push(userId).catch(() => {}), PUSH_DELAY_MS);
}

// Après suppression du compte, le téléphone « oublie » à qui appartenait la progression locale :
// le prochain compte pourra la reprendre.
export async function forgetSyncedUser() {
  syncedFor = null;
  lastPushed = "";
  clearTimeout(pushTimer);
  await AsyncStorage.removeItem(LAST_USER_KEY).catch(() => {});
}

let started = false;

// À appeler une fois au démarrage (App.js).
export function startProgressSync() {
  if (started) return;
  started = true;

  // Connexion / déconnexion / lancement avec une session déjà là.
  const onSession = (session) => {
    const userId = session?.user?.id;
    if (!userId) { syncedFor = null; clearTimeout(pushTimer); return; }
    if (syncedFor !== userId) pullAndMerge(userId);
  };
  useAuthStore.subscribe((s) => onSession(s.session));
  onSession(useAuthStore.getState().session);

  // Chaque changement de progression → envoi différé (regroupé sur 5 s).
  usePhotoStore.subscribe(
    (s) => [s.dailyLog, s.lifetimeSorted, s.achievements, s.shuffleLaunchCount, s.best20Ms],
    schedulePush,
    { equalityFn: (a, b) => a.every((v, i) => v === b[i]) }
  );
}

// Envoi immédiat (ex. quand l'app passe en arrière-plan).
export function flushProgress() {
  const userId = useAuthStore.getState().session?.user?.id;
  if (!userId || syncedFor !== userId) return;
  clearTimeout(pushTimer);
  push(userId).catch(() => {});
}
