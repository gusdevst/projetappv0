// hooks/useNotificationReminder.js
// Centralise la logique d'activation des rappels push, partagée par
// HomeScreen (1er usage du mode aléatoire) et SummaryScreen (bilan de tri).
//
// Expose :
//   notificationsEnabled   → true si une fréquence est active (≠ "off")
//   notifPromptSeen        → a-t-on déjà proposé d'activer les rappels ?
//   markPromptSeen()       → mémorise qu'on a déjà posé la question
//   enableReminders(freq?) → demande la permission + programme le rappel + sauvegarde
//                            freq par défaut : "daily" à 9h (heure modifiable dans Réglages)

import { useMemo } from "react";
import { usePhotoStore } from "../store/usePhotoStore";
import { scheduleReminder } from "../services/notificationService";

export function useNotificationReminder() {
  const notificationFrequency    = usePhotoStore((s) => s.notificationFrequency);
  const setNotificationFrequency = usePhotoStore((s) => s.setNotificationFrequency);
  const notificationHour         = usePhotoStore((s) => s.notificationHour);
  const notificationMinute       = usePhotoStore((s) => s.notificationMinute);
  const notifPromptSeen          = usePhotoStore((s) => s.notifPromptSeen);
  const setNotifPromptSeen       = usePhotoStore((s) => s.setNotifPromptSeen);

  const randomCount    = usePhotoStore((s) => s.randomCount);
  const libraryPhotos  = usePhotoStore((s) => s.libraryPhotos);
  const kept           = usePhotoStore((s) => s.kept);
  const deleted        = usePhotoStore((s) => s.deleted);
  const printed        = usePhotoStore((s) => s.printed);
  const skipped        = usePhotoStore((s) => s.skipped);

  // Photos pas encore triées (même logique que Settings / TriModeScreen)
  const remainingCount = useMemo(() => {
    const triedIds = new Set([
      ...kept.map((p) => p.id),
      ...deleted.map((p) => p.id),
      ...printed.map((p) => p.id),
      ...skipped.map((p) => p.id),
    ]);
    return libraryPhotos.filter((p) => !triedIds.has(p.id)).length;
  }, [libraryPhotos, kept, deleted, printed, skipped]);

  const notificationsEnabled = notificationFrequency !== "off";

  // Active les rappels : permission + programmation + sauvegarde dans le store.
  // Retourne { success: boolean, reason? } — scheduleReminder gère la permission.
  const enableReminders = async (freq = "daily") => {
    const result = await scheduleReminder(freq, {
      remainingCount,
      randomCount,
      notificationHour,
      notificationMinute,
    });
    if (result.success) {
      setNotificationFrequency(freq);
    }
    return result;
  };

  const markPromptSeen = () => setNotifPromptSeen(true);

  return {
    notificationsEnabled,
    notifPromptSeen,
    markPromptSeen,
    enableReminders,
  };
}
