// hooks/useEnRoute.js
// Données du bloc « En route » du Labo + pastille de l'onglet Labo.
//   useEnRoute()          → lignes à afficher (voir services/enRoute.js)
//   useOrdersBootstrap()  → à appeler UNE fois (barre du bas) : charge les commandes dès qu'on est connecté, les vide à la déconnexion
//   useOrdersTodo()       → nombre de commandes à reprendre (pastille de l'onglet Labo)

import { useEffect, useMemo } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useOrdersStore } from "../store/useOrdersStore";
import { useSubscriptionStore } from "../store/useSubscriptionStore";
import { buildEnRoute } from "../services/enRoute";
import { isIncomplete } from "../services/bookOrder";

export function useEnRoute() {
  const orders     = useOrdersStore((s) => s.orders);
  const subs       = useSubscriptionStore((s) => s.subs);
  const selections = useSubscriptionStore((s) => s.selections);
  const serverKeys = useOrdersStore((s) => s.printOrderKeys);
  return useMemo(() => buildEnRoute({ orders, subs, selections, serverKeys }), [orders, subs, selections, serverKeys]);
}

export function useOrdersBootstrap() {
  const signedIn = !!useAuthStore((s) => s.session);
  useEffect(() => {
    const { load, clear } = useOrdersStore.getState();
    if (signedIn) load({ refresh: false }); else clear();
  }, [signedIn]);
}

export const useOrdersTodo = () => useOrdersStore((s) => s.orders.filter(isIncomplete).length);
