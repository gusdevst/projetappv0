// store/usePhotoStore.js
import { create } from "zustand";
import { subscribeWithSelector, persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as PhotoLibrary from "../services/photoLibrary";

export const usePhotoStore = create(
  persist(
    subscribeWithSelector((set, get) => ({
      // ─── État du tri (persisté) ─────────────────────────────────────────
      kept:    [],
      deleted: [],
      printed: [],

      // ─── État de la photothèque (NON persisté — rechargé à chaque ouverture) ─
      permission:      "undetermined", // "undetermined" | "granted" | "denied"
      libraryPhotos:   [],
      libraryLoading:  false,
      libraryError:    null,

      // ─── Actions de tri ─────────────────────────────────────────────────
      addKept:    (photo) => set((state) => ({ kept:    [...state.kept,    photo] })),
      addDeleted: (photo) => set((state) => ({ deleted: [...state.deleted, photo] })),
      addPrinted: (photo) => set((state) => ({ printed: [...state.printed, photo] })),

      undoLast: (keptSnap, deletedSnap, printedSnap) => set({
        kept:    keptSnap,
        deleted: deletedSnap,
        printed: printedSnap,
      }),

      reset: () => set({ kept: [], deleted: [], printed: [] }),

      // ─── Vider la corbeille (vraie suppression via MediaLibrary) ────────
      // Retourne true si la suppression a réussi, false sinon.
      emptyTrash: async () => {
        const { deleted } = get();
        if (deleted.length === 0) return true;
        try {
          const ok = await PhotoLibrary.deletePhotos(deleted.map((p) => p.id));
          if (ok) set({ deleted: [] });
          return ok;
        } catch (err) {
          console.warn("emptyTrash failed:", err);
          return false;
        }
      },

      // ─── Permission ─────────────────────────────────────────────────────
      setPermission: (status) => set({ permission: status }),

      checkPermission: async () => {
        const status = await PhotoLibrary.getPermissionStatus();
        set({ permission: status });
        return status;
      },

      requestPermission: async () => {
        const status = await PhotoLibrary.requestPermission();
        set({ permission: status });
        return status;
      },

      // ─── Chargement de la photothèque ───────────────────────────────────
      loadLibrary: async () => {
        const { permission } = get();
        if (permission !== "granted") return;
        set({ libraryLoading: true, libraryError: null });
        try {
          const photos = await PhotoLibrary.loadPhotos();
          set({ libraryPhotos: photos, libraryLoading: false });
        } catch (err) {
          console.warn("loadLibrary failed:", err);
          set({ libraryError: String(err), libraryLoading: false });
        }
      },
    })),
    {
      name: "phototri-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // On persiste UNIQUEMENT le tri — la photothèque est rechargée à chaque ouverture.
      partialize: (state) => ({
        kept:    state.kept,
        deleted: state.deleted,
        printed: state.printed,
      }),
    }
  )
);
