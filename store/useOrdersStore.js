// store/useOrdersStore.js
// Commandes de livres du compte connecté (table `orders`), EN MÉMOIRE (pas de persist : le serveur fait foi).
// Partagé par le bloc « En route » du Labo, l'écran de suivi et la pastille de l'onglet Labo.
// `load()` relit la liste ; avec `refresh`, relit aussi l'avancement chez l'imprimeur pour les commandes en cours
// (au plus une fois par minute, sauf `force`, pour ne pas appeler la fonction serveur à chaque passage dans le Labo).

import { create } from "zustand";
import { listOrders, refreshBookOrder, isFinal } from "../services/bookOrder";

const REFRESH_EVERY_MS = 60 * 1000;
let lastRefresh = 0;
let inflight = null;

export const useOrdersStore = create((set, get) => ({
  orders: [],
  failed: false,
  loaded: false,
  // Envois d'abonnement connus du SERVEUR (table print_orders), sous forme "subId|mois" ; null = pas encore lu / pas connecté.
  // Renseigné par `syncOrderStatuses`. Le bloc « En route » ne montre que les envois présents ici (voir services/enRoute.js).
  printOrderKeys: null,

  load: async ({ refresh = true, force = false } = {}) => {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const list = await listOrders();
        set({ orders: list, failed: false, loaded: true });
        const due = refresh && (force || Date.now() - lastRefresh > REFRESH_EVERY_MS);
        const live = list.filter((o) => o.supplier_ref && !isFinal(o));
        if (due && live.length) {
          lastRefresh = Date.now();
          const fresh = await Promise.all(live.map((o) => refreshBookOrder(o)));
          const byId = Object.fromEntries(fresh.map((o) => [o.id, o]));
          set({ orders: get().orders.map((o) => byId[o.id] ?? o) });
        }
      } catch (e) {
        // Pas connecté = pas de commandes ; autre erreur = on garde ce qu'on sait et on le signale.
        if (e?.kind === "auth") set({ orders: [], failed: false, loaded: true });
        else set({ failed: true, loaded: true });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  clear: () => set({ orders: [], failed: false, loaded: false, printOrderKeys: null }),
}));
