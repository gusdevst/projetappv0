// store/usePhotoStore.js
import { create } from "zustand";
import { subscribeWithSelector, persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const usePhotoStore = create(
  persist(
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
    })),
    {
      name: "phototri-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // On ne persiste que les données, pas les fonctions
      partialize: (state) => ({
        kept:    state.kept,
        deleted: state.deleted,
        printed: state.printed,
      }),
    }
  )
);