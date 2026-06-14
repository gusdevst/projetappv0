// services/notificationService.js
// Gère les rappels locaux "Pense à trier tes photos".
//
// Fonctions exportées :
//   requestPermission()                      → demande la permission (retourne true/false)
//   scheduleReminder(frequency, stats?)      → programme le rappel selon la fréquence choisie
//   cancelReminders()                        → annule tous les rappels en cours
//
// stats (optionnel) : { remainingCount, randomCount, notificationHour }
//   remainingCount + randomCount → message personnalisé avec nb de sessions restantes
//   notificationHour (0-23)      → heure précise pour DAILY et WEEKLY
//   data.action = "start_menage_random" → l'app lance une session au tap
//
// Fréquences supportées :
//   "off"        → aucun rappel
//   "daily"      → trigger DAILY  — heure exacte = notificationHour
//   "every2days" → trigger TIME_INTERVAL 48h — heure approximative (48h depuis activation)
//   "weekly"     → trigger WEEKLY — heure exacte, jour = jour courant de la semaine

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
  return `Il te reste ${sessions} session${sessions > 1 ? "s" : ""} de ${randomCount} photos à trier 📸`;
}

// ── Demande la permission ────────────────────────────────────────────────────
export async function requestPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// ── Programme le rappel ──────────────────────────────────────────────────────
// stats = { remainingCount, randomCount, notificationHour }
export async function scheduleReminder(frequency, stats = {}) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (frequency === "off") return { success: true };

  const granted = await requestPermission();
  if (!granted) return { success: false, reason: "permission_denied" };

  const { remainingCount = null, randomCount = 50, notificationHour = 9 } = stats;
  const body = buildNotifBody(remainingCount, randomCount);

  const content = {
    title: "Phototri 📷",
    body,
    // L'app lit ce champ au tap pour lancer une session ménage aléatoire
    data: { action: "start_menage_random" },
    sound: Platform.OS === "android" ? true : false,
  };

  // JS getDay() : 0=Dim … 6=Sam  →  Expo weekday : 1=Dim … 7=Sam
  const expoWeekday = new Date().getDay() + 1;

  try {
    const TT = Notifications.SchedulableTriggerInputTypes;

    let trigger;
    if (frequency === "daily") {
      // Heure exacte chaque jour
      trigger = { type: TT.DAILY, hour: notificationHour, minute: 0 };
    } else if (frequency === "weekly") {
      // Heure exacte, même jour de la semaine que l'activation
      trigger = { type: TT.WEEKLY, weekday: expoWeekday, hour: notificationHour, minute: 0 };
    } else {
      // every2days : TIME_INTERVAL 48h (pas de trigger "toutes les N heures à HH:MM" natif)
      trigger = { type: TT.TIME_INTERVAL, seconds: 2 * 24 * 60 * 60, repeats: true };
    }

    await Notifications.scheduleNotificationAsync({ content, trigger });
    return { success: true };

  } catch (err) {
    // Fallback pour les versions d'expo-notifications sans SchedulableTriggerInputTypes
    try {
      let trigger;
      if (frequency === "daily") {
        trigger = { hour: notificationHour, minute: 0, repeats: true };
      } else if (frequency === "weekly") {
        trigger = { weekday: expoWeekday, hour: notificationHour, minute: 0, repeats: true };
      } else {
        trigger = { seconds: 2 * 24 * 60 * 60, repeats: true };
      }
      await Notifications.scheduleNotificationAsync({ content, trigger });
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
