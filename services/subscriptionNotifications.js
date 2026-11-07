// services/subscriptionNotifications.js
// Notification mensuelle de l'abonnement « Coups de cœur » (maquette validée, écran 5) :
// « Ta sélection de novembre est prête » (une notification par abonnement actif, le jour choisi
// par l'utilisateur pour recevoir sa sélection — le 1er par défaut — à 9 h).
// - un tap ouvre la sélection du mois de cet abonnement (App.js, data.action = "subscription_month")
// - programmées en local (pas de serveur) : on ne garde que la PROCHAINE date de chaque abonnement,
//   reprogrammée au lancement, au passage en arrière-plan et à chaque changement d'abonnement
// - iOS garde au plus 64 notifications programmées, dont ~60 de rappels de tri : on plafonne les nôtres à 4
// - abonnements avec « Je valide chaque envoi » désactivé : pas encore gérés (aucune notification)

import * as Notifications from "expo-notifications";
import { useSubscriptionStore } from "../store/useSubscriptionStore";
import { monthKey, monthName } from "./printSelection";
import { subDays } from "../constants/subscription";

export const SUB_NOTIF_ACTION = "subscription_month";
const MAX_SUB_NOTIFS = 4;
const SEND_HOUR = 9; // 9 h le matin

// Texte d'une notification (le même pour la vraie et pour le test).
function content(s, mois, sendDay) {
  return {
    title: s.kind === "self" ? `Ta sélection de ${mois} est prête` : `Sélection pour ${s.name}`,
    body: s.kind === "self"
      ? `${s.count} coups de cœur à valider avant le ${sendDay}.`
      : `Jette un œil aux ${s.count} photos avant l'envoi.`,
  };
}

// Pure : quelles notifications programmer ? → [{ id, date, title, body, subId }], les plus proches d'abord.
// Chaque abonnement a son jour de réception (`selectionDay`, 1er par défaut) : la prochaine fois que ce jour
// arrive, à 9 h, strictement dans le futur.
export function planSubscriptionNotifications(subs, now = new Date()) {
  return subs
    .filter((s) => s.status === "active" && s.validateEach)
    .map((s) => {
      const { selectionDay, sendDay } = subDays(s);
      let date = new Date(now.getFullYear(), now.getMonth(), selectionDay, SEND_HOUR, 0, 0, 0);
      if (date <= now) date = new Date(now.getFullYear(), now.getMonth() + 1, selectionDay, SEND_HOUR, 0, 0, 0);
      const mois = monthName(monthKey(date));
      return { id: `sub-${s.id}-${monthKey(date)}`, date, subId: s.id, ...content(s, mois, sendDay) };
    })
    .sort((a, b) => a.date - b.date)
    .slice(0, MAX_SUB_NOTIFS);
}

// Pour tester (mode développement) : la même notification, dans 5 secondes, pour un abonnement.
// Marquée `test` : la reprogrammation normale ne l'annule pas. Retourne false si pas de permission.
export async function sendTestSubscriptionNotification(sub) {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return false;
  const { sendDay } = subDays(sub);
  const TIMER = Notifications.SchedulableTriggerInputTypes?.TIME_INTERVAL;
  await Notifications.scheduleNotificationAsync({
    content: { ...content(sub, monthName(monthKey()), sendDay), data: { action: SUB_NOTIF_ACTION, subId: sub.id, test: true } },
    trigger: TIMER ? { type: TIMER, seconds: 5 } : { seconds: 5 },
  });
  return true;
}

// Une seule reprogrammation à la fois (évite que deux appels se marchent dessus).
let chain = Promise.resolve();
export function refreshSubscriptionNotifications() {
  chain = chain.then(doRefresh).catch((e) => console.warn("refreshSubscriptionNotifications failed:", e));
  return chain;
}

async function doRefresh() {
  // 1. On retire nos anciennes notifications (et seulement les nôtres : les rappels de tri restent).
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content?.data?.action === SUB_NOTIF_ACTION && !n.content?.data?.test)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );

  // 2. Pas de pop-up ici : si la permission n'a pas été donnée, on s'arrête.
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  // 3. On reprogramme le prochain 1er de chaque abonnement actif.
  const plan = planSubscriptionNotifications(useSubscriptionStore.getState().subs);
  const DATE = Notifications.SchedulableTriggerInputTypes?.DATE;
  for (const n of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, data: { action: SUB_NOTIF_ACTION, subId: n.subId } },
      trigger: DATE ? { type: DATE, date: n.date } : n.date,
    });
  }
}

// À appeler une fois au démarrage (App.js) : reprogramme maintenant, puis à chaque changement d'abonnement.
let started = false;
export function startSubscriptionNotifications() {
  if (started) return;
  started = true;
  refreshSubscriptionNotifications();
  let timer = null;
  useSubscriptionStore.subscribe((state, prev) => {
    if (state.subs === prev.subs) return;
    clearTimeout(timer);
    timer = setTimeout(refreshSubscriptionNotifications, 800); // laisse finir une série de modifications
  });
}
