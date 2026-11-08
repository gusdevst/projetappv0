// store/useSubscriptionStore.js
// Abonnements mensuels « Coups de cœur » (sur ce téléphone pour l'instant).
// Un abonnement :
//   { id, kind: "self" | "gift", userId, name, recipient, address, message, count,
//     validateEach, status: "active" | "paused" | "cancelled", createdAt }
// - selectionDay : jour du mois où l'on reçoit la sélection (notification, 1 par défaut)
// - sendDay : jour d'envoi à l'impression = dernier jour pour valider (25 par défaut), toujours > selectionDay
// - recipient : nom sur l'enveloppe · address : adresse (2ᵉ ligne = complément, facultatif)
// - self : « pour moi » (un seul) · gift : « pour un proche » (autant qu'on veut)
// - validateEach : true = rien ne part sans validation de la sélection du mois
// Les sélections du mois : selections[subId]["2026-11"] = { photoIds, size, status, createdAt, validatedAt }
// printedPhotos[photoId] = marque « déjà imprimée » (voir plus bas)
// (voir services/printSelection.js). Le paiement et l'envoi des photos ne sont pas encore branchés.
// Persisté dans AsyncStorage ; la clé est versionnée pour pouvoir migrer plus tard.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useSubscriptionStore = create(
  persist(
    (set) => ({
      subs: [],
      selections: {},
      // Marque « déjà imprimée » posée sur chaque photo envoyée : { photoId: { at, subId, month, product } }.
      // Sauvegardée avec le reste : la photo ne reviendra plus dans une sélection à imprimer.
      printedPhotos: {},

      addSub: (sub) =>
        set((s) => ({
          subs: [
            ...s.subs,
            { status: "active", createdAt: Date.now(), ...sub, id: `sub-${Date.now()}` },
          ],
        })),

      updateSub: (id, patch) =>
        set((s) => ({ subs: s.subs.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

      removeSub: (id) =>
        set((s) => {
          const { [id]: _gone, ...rest } = s.selections;
          // On garde la marque « imprimée » des photos déjà envoyées par cet abonnement.
          const printed = { ...s.printedPhotos };
          Object.entries(_gone ?? {}).forEach(([month, sel]) => {
            if (sel?.status === "validated") sel.photoIds.forEach((pid) => { if (!printed[pid]) printed[pid] = { at: sel.validatedAt, subId: id, month }; });
          });
          return { subs: s.subs.filter((x) => x.id !== id), selections: rest, printedPhotos: printed };
        }),

      // Enregistre la sélection brouillon d'un mois (ne touche pas à une sélection déjà validée).
      setSelection: (subId, month, photoIds, size) =>
        set((s) => {
          const old = s.selections[subId]?.[month];
          if (old?.status === "validated") return s;
          const sel = { createdAt: old?.createdAt ?? Date.now(), ...old, photoIds, size: size ?? old?.size ?? photoIds.length, status: "draft" };
          return { selections: { ...s.selections, [subId]: { ...s.selections[subId], [month]: sel } } };
        }),

      // L'utilisateur valide : la sélection est figée.
      // `extra` : champs en plus (ex. { sentAt } quand les photos sont bien parties sur le serveur).
      validateSelection: (subId, month, extra = {}) =>
        set((s) => {
          const old = s.selections[subId]?.[month];
          if (!old) return s;
          const now = Date.now();
          const sel = { ...old, ...extra, status: "validated", validatedAt: now };
          // Chaque photo envoyée reçoit sa marque « imprimée » (on garde la 1re : date de la 1re impression).
          const product = s.subs.find((x) => x.id === subId)?.product ?? "prints";
          const printed = { ...s.printedPhotos };
          old.photoIds.forEach((pid) => { if (!printed[pid]) printed[pid] = { at: now, subId, month, product }; });
          return { selections: { ...s.selections, [subId]: { ...s.selections[subId], [month]: sel } }, printedPhotos: printed };
        }),

      // Étape de suivi donnée par le serveur ("validated" | "printing" | "shipped" | "delivered").
      setStage: (subId, month, stage) =>
        set((s) => {
          const old = s.selections[subId]?.[month];
          if (!old || old.status !== "validated" || old.stage === stage) return s;
          return { selections: { ...s.selections, [subId]: { ...s.selections[subId], [month]: { ...old, stage } } } };
        }),
    }),
    {
      name: "pellicule.subscriptions.v1",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
