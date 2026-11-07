// hooks/useSubscriptionTodo.js
// Nombre de sélections « À valider » ce mois-ci (abonnements actifs dont le jour de réception est arrivé
// et dont la sélection n'est pas encore validée). Sert au point orange sur l'onglet Galerie.

import { useSubscriptionStore } from "../store/useSubscriptionStore";
import { monthKey, subStatus } from "../services/printSelection";

export function useSubscriptionTodo() {
  return useSubscriptionStore((s) => {
    const month = monthKey();
    return s.subs.filter((x) => x.status === "active" && subStatus(x, s.selections[x.id]?.[month]).kind === "todo").length;
  });
}
