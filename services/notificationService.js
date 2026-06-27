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
//   "twice_daily"  → deux triggers DAILY : heure exacte + heure+12h
//   "daily"        → trigger DAILY  — heure exacte = notificationHour
//   "every2days"   → trigger TIME_INTERVAL 48h — heure approximative (48h depuis activation)
//   "weekly"       → trigger WEEKLY — heure exacte, jour = jour courant de la semaine

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

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

    if (frequency === "twice_daily") {
      await Notifications.scheduleNotificationAsync({
        content, trigger: { type: TT.DAILY, hour: notificationHour, minute: notificationMinute },
      });
      await Notifications.scheduleNotificationAsync({
        content: { ...content, body: buildNotifBody(remainingCount, randomCount) },
        trigger: { type: TT.DAILY, hour: notificationHour2, minute: notificationMinute2 },
      });
    } else if (frequency === "daily") {
      await Notifications.scheduleNotificationAsync({
        content, trigger: { type: TT.DAILY, hour: notificationHour, minute: notificationMinute },
      });
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
      if (frequency === "twice_daily") {
        await Notifications.scheduleNotificationAsync({ content, trigger: { hour: notificationHour, minute: notificationMinute, repeats: true } });
        await Notifications.scheduleNotificationAsync({ content: { ...content, body: buildNotifBody(remainingCount, randomCount) }, trigger: { hour: notificationHour2, minute: notificationMinute2, repeats: true } });
      } else if (frequency === "daily") {
        await Notifications.scheduleNotificationAsync({ content, trigger: { hour: notificationHour, minute: notificationMinute, repeats: true } });
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
