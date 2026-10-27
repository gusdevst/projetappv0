// services/notificationService.js
// Gère les rappels locaux "Pense à trier tes photos".
//
// Fonctions exportées :
//   requestPermission()                      → demande la permission (retourne true/false)
//   scheduleReminder(frequency, stats?)      → programme le rappel selon la fréquence choisie
//   cancelReminders()                        → annule tous les rappels en cours
//
// stats (optionnel) : { remainingCount, randomCount, notificationHour, notificationMinute, notificationHour2, notificationMinute2 }
//   remainingCount + randomCount → message personnalisé avec nb de sessions restantes
//   notificationHour/2 (0-23), notificationMinute/2 (0-59) → heures précises
//   data.action = "start_menage_random" → l'app lance une session au tap
//
// Fréquences supportées :
//   "off"          → aucun rappel
//   "twice_daily"  → rappels DATÉS sur 30 j aux 2 heures choisies (1er = message série 🔥)
//   "daily"        → rappels DATÉS sur 30 j à notificationHour (1er = message série 🔥)
//                    reprogrammés par refreshReminders() à chaque passage en arrière-plan
//   "every2days"   → trigger TIME_INTERVAL 48h — heure approximative (48h depuis activation)
//   "weekly"       → trigger WEEKLY — heure exacte, jour = jour courant de la semaine

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { usePhotoStore } from "../store/usePhotoStore";
import { computeStreak, STREAK_MIN } from "./progressStats";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const REMINDER_MESSAGES = [
  "Tu as des photos qui attendent d'être triées 📸",
  "Quelques swipes et ta galerie sera au top !",
  "Tes souvenirs méritent d'être bien rangés 🌸",
  "Un petit tri de photos ça fait du bien !",
];

function randomMessage() {
  return REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
}

// Construit un message personnalisé si on connaît le nb de photos restantes
function buildNotifBody(remainingCount, randomCount) {
  if (!remainingCount || !randomCount) return randomMessage();
  if (remainingCount <= 0) return "Ta galerie est au top 🌸 Bravo !";
  const sessions = Math.ceil(remainingCount / randomCount);
  return `Il te reste ${sessions} session${sessions > 1 ? "s" : ""} pour terminer le tri de tes photos 📸`;
}

// ── Message "série 🔥" ───────────────────────────────────────────────────────
// Utilisé pour le PROCHAIN rappel seulement (les suivants restent génériques :
// on ne sait pas si l'user aura trié d'ici là).
// Retourne null s'il n'y a pas de série en cours → message classique.
function buildStreakBody(streak) {
  if (!streak || streak.current <= 0) return null;
  const n = streak.current;
  const jours = `${n} jour${n > 1 ? "s" : ""}`;
  if (streak.todayDone) return `Ta série de ${jours} t'attend 🔥 On continue ?`;
  if (streak.todayLeft < STREAK_MIN) {
    return `Plus que ${streak.todayLeft} photo${streak.todayLeft > 1 ? "s" : ""} pour garder ta série de ${jours} 🔥`;
  }
  return `Ta série de ${jours} t'attend 🔥 Trie ${STREAK_MIN} photos pour la garder.`;
}

// Prochaines dates de rappel (quotidien / 2x par jour) sur PLAN_DAYS jours.
// Si la journée est déjà validée, on n'envoie pas le rappel du jour (inutile).
const PLAN_DAYS = 30; // 30 j × 2 rappels = 60 < limite iOS de 64 notifs programmées
function planDates(slots, skipToday) {
  const now = new Date();
  const dates = [];
  for (let i = 0; i < PLAN_DAYS; i++) {
    if (i === 0 && skipToday) continue;
    for (const [h, m] of slots) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m, 0, 0);
      if (d > now) dates.push(d);
    }
  }
  return dates.sort((a, b) => a - b);
}

// ── Demande la permission ────────────────────────────────────────────────────
export async function requestPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// ── Programme le rappel ──────────────────────────────────────────────────────
// stats = { remainingCount, randomCount, notificationHour, notificationMinute }
export async function scheduleReminder(frequency, stats = {}) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (frequency === "off") return { success: true };

  const granted = await requestPermission();
  if (!granted) return { success: false, reason: "permission_denied" };

  const { remainingCount = null, randomCount = 30, notificationHour = 9, notificationMinute = 0, notificationHour2 = 21, notificationMinute2 = 0 } = stats;
  const body = buildNotifBody(remainingCount, randomCount);

  // Série 🔥 calculée depuis le carnet de bord (tous les appelants en profitent).
  const streak = computeStreak(usePhotoStore.getState().dailyLog);
  const streakBody = buildStreakBody(streak);

  // Quotidien / 2x par jour : rappels datés un par un (au lieu d'un rappel répété)
  // → le 1er peut porter le message de série, les suivants restent classiques.
  // Ils sont reprogrammés à chaque fois que l'app passe en arrière-plan (refreshReminders).
  const dated = frequency === "daily" || frequency === "twice_daily";
  const slots = frequency === "twice_daily"
    ? [[notificationHour, notificationMinute], [notificationHour2, notificationMinute2]]
    : [[notificationHour, notificationMinute]];
  const dates = dated ? planDates(slots, streak.todayDone) : [];
  const bodyFor = (i) => (i === 0 && streakBody ? streakBody : i === 0 ? body : buildNotifBody(remainingCount, randomCount));

  const content = {
    title: "Pellicule 📷",
    body,
    // L'app lit ce champ au tap pour lancer une session ménage aléatoire
    data: { action: "start_menage_random" },
    sound: Platform.OS === "android" ? true : false,
  };

  // JS getDay() : 0=Dim … 6=Sam  →  Expo weekday : 1=Dim … 7=Sam
  const expoWeekday = new Date().getDay() + 1;

  try {
    const TT = Notifications.SchedulableTriggerInputTypes;

    if (dated) {
      for (let i = 0; i < dates.length; i++) {
        await Notifications.scheduleNotificationAsync({
          content: { ...content, body: bodyFor(i) },
          trigger: { type: TT.DATE, date: dates[i] },
        });
      }
    } else if (frequency === "weekly") {
      await Notifications.scheduleNotificationAsync({
        content, trigger: { type: TT.WEEKLY, weekday: expoWeekday, hour: notificationHour, minute: notificationMinute },
      });
    } else {
      // every2days
      await Notifications.scheduleNotificationAsync({
        content, trigger: { type: TT.TIME_INTERVAL, seconds: 2 * 24 * 60 * 60, repeats: true },
      });
    }
    return { success: true };

  } catch (err) {
    // Fallback pour les versions d'expo-notifications sans SchedulableTriggerInputTypes
    try {
      if (dated) {
        await Notifications.cancelAllScheduledNotificationsAsync(); // repart propre si le 1er essai a échoué en cours de route
        for (let i = 0; i < dates.length; i++) {
          await Notifications.scheduleNotificationAsync({ content: { ...content, body: bodyFor(i) }, trigger: dates[i] });
        }
      } else if (frequency === "weekly") {
        await Notifications.scheduleNotificationAsync({ content, trigger: { weekday: expoWeekday, hour: notificationHour, minute: notificationMinute, repeats: true } });
      } else {
        await Notifications.scheduleNotificationAsync({ content, trigger: { seconds: 2 * 24 * 60 * 60, repeats: true } });
      }
      return { success: true };
    } catch (err2) {
      console.warn("scheduleReminder failed:", err2);
      return { success: false, reason: String(err2) };
    }
  }
}

// ── Annule tous les rappels ───────────────────────────────────────────────────
export async function cancelReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ── Reprogramme les rappels avec les données du moment ───────────────────────
// Appelé quand l'app passe en arrière-plan (App.js) : la série 🔥 et le nombre
// de photos restantes ont pu changer pendant la session.
// Ne demande JAMAIS la permission (on ne veut pas de pop-up en quittant l'app).
export async function refreshReminders() {
  try {
    const st = usePhotoStore.getState();
    if (!st.notificationFrequency || st.notificationFrequency === "off") return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    // Photos pas encore triées (même logique que useNotificationReminder)
    const triedIds = new Set([...st.kept, ...st.deleted, ...st.printed, ...st.skipped].map((p) => p.id));
    const remainingCount = st.libraryPhotos.filter((p) => !triedIds.has(p.id)).length;

    await scheduleReminder(st.notificationFrequency, {
      remainingCount,
      randomCount:         st.randomCount,
      notificationHour:    st.notificationHour,
      notificationMinute:  st.notificationMinute,
      notificationHour2:   st.notificationHour2,
      notificationMinute2: st.notificationMinute2,
    });
  } catch (err) {
    console.warn("refreshReminders failed:", err);
  }
}
