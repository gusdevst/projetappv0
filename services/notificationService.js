// services/notificationService.js
// Gère les rappels locaux "Pense à trier tes photos".
//
// Fonctions exportées :
//   requestPermission()          → demande la permission (retourne true/false)
//   scheduleReminder(frequency)  → programme le rappel selon la fréquence choisie
//   cancelReminders()            → annule tous les rappels en cours
//
// Fréquences supportées :
//   "off"        → aucun rappel
//   "daily"      → chaque jour à 9h
//   "every2days" → toutes les 48h
//   "weekly"     → chaque semaine

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Comment les notifications s'affichent quand l'app est ouverte
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Quelques messages variés pour que le rappel ne soit pas toujours identique
const REMINDER_MESSAGES = [
  "Tu as des photos qui attendent d'être triées 📸",
  "Quelques swipes et ta galerie sera au top !",
  "Tes souvenirs méritent d'être bien rangés 🌸",
  "Un petit tri de photos ça fait du bien !",
];

function randomMessage() {
  return REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
}

// ── Demande la permission (à appeler avant de programmer un rappel) ──────────
export async function requestPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// ── Programme le rappel selon la fréquence ───────────────────────────────────
// Annule d'abord les rappels existants pour éviter les doublons.
export async function scheduleReminder(frequency) {
  // On commence toujours par tout annuler
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (frequency === "off") return { success: true };

  // Demande la permission si pas encore accordée
  const granted = await requestPermission();
  if (!granted) return { success: false, reason: "permission_denied" };

  // Calcul du déclencheur selon la fréquence
  // On utilise un intervalle en secondes — simple et cross-platform.
  // Le premier rappel part à la même heure que l'activation.
  const secondsMap = {
    daily:      24 * 60 * 60,        // 24h
    every2days: 2 * 24 * 60 * 60,    // 48h
    weekly:     7 * 24 * 60 * 60,    // 7 jours
  };

  const seconds = secondsMap[frequency];
  if (!seconds) return { success: false, reason: "unknown_frequency" };

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Phototri 📷",
        body: randomMessage(),
        // Sur Android, le son par défaut de l'OS est utilisé
        sound: Platform.OS === "android" ? true : false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: true,
      },
    });
    return { success: true };
  } catch (err) {
    // Fallback pour les versions d'expo-notifications sans SchedulableTriggerInputTypes
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Phototri 📷",
          body: randomMessage(),
        },
        trigger: { seconds, repeats: true },
      });
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
