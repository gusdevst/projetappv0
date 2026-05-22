// store/usePhotoStore.js
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export const usePhotoStore = create(
  subscribeWithSelector((set) => ({
    kept:    [],
    deleted: [],
    printed: [],

    addKept:    (photo) => set((state) => ({ kept:    [...state.kept,    photo] })),
    addDeleted: (photo) => set((state) => ({ deleted: [...state.deleted, photo] })),
    addPrinted: (photo) => set((state) => ({ printed: [...state.printed, photo] })),

    undoLast: (keptSnap, deletedSnap, printedSnap) => set({
      kept:    keptSnap,
      deleted: deletedSnap,
      printed: printedSnap,
    }),

    emptyTrash: () => set({ deleted: [] }),
    reset: () => set({ kept: [], deleted: [], printed: [] }),
  }))
);