// store/useSubscriptionStore.js
// Abonnements mensuels « Coups de cœur » (sur ce téléphone pour l'instant).
// Un abonnement :
//   { id, kind: "self" | "gift", userId, name, address, message, count,
//     validateEach, status: "active" | "paused", createdAt }
// - self : « pour moi » (un seul) · gift : « pour un proche » (autant qu'on veut)
// - validateEach : true = rien ne part sans validation de la sélection du mois
// Le paiement et l'envoi des photos ne sont pas encore branchés (étapes suivantes).
// Persisté dans AsyncStorage ; la clé est versionnée pour pouvoir migrer plus tard.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useSubscriptionStore = create(
  persist(
    (set) => ({
      subs: [],

      addSub: (sub) =>
        set((s) => ({
          subs: [
            ...s.subs,
            { status: "active", createdAt: Date.now(), ...sub, id: `sub-${Date.now()}` },
          ],
        })),

      updateSub: (id, patch) =>
        set((s) => ({ subs: s.subs.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

      removeSub: (id) => set((s) => ({ subs: s.subs.filter((x) => x.id !== id) })),
    }),
    {
      name: "pellicule.subscriptions.v1",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
