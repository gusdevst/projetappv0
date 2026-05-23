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
      // Albums créés par l'utilisateur dans "Album souvenirs".
      // Format : [{ id, name, photoIds: [] }]
      albums:  [],

      // ─── État de la photothèque (NON persisté — rechargé à chaque ouverture) ─
      permission:      "undetermined", // "undetermined" | "granted" | "denied"
      libraryPhotos:     [],
      libraryTotalCount: 0,            // total réel sur le téléphone (peut dépasser MAX_PHOTOS)
      libraryLoading:    false,
      libraryError:      null,

      // ─── Actions de tri ─────────────────────────────────────────────────
      addKept:    (photo) => set((state) => ({ kept:    [...state.kept,    photo] })),
      addDeleted: (photo) => set((state) => ({ deleted: [...state.deleted, photo] })),
      addPrinted: (photo) => set((state) => ({ printed: [...state.printed, photo] })),

      undoLast: (keptSnap, deletedSnap, printedSnap) => set({
        kept:    keptSnap,
        deleted: deletedSnap,
        printed: printedSnap,
      }),

      reset: () => set({ kept: [], deleted: [], printed: [], albums: [] }),

      // Retire une photo d'une section (kept/deleted/printed). Elle redevient
      // disponible pour le tri dans la file principale.
      restorePhoto: (photoId, section) => set((state) => ({
        [section]: state[section].filter((p) => p.id !== photoId),
      })),

      // ─── Actions albums ─────────────────────────────────────────────────
      createAlbum: (name) => set((state) => ({
        albums: [
          ...state.albums,
          { id: `album-${Date.now()}`, name: name.trim() || "Album sans nom", photoIds: [] },
        ],
      })),

      deleteAlbum: (albumId) => set((state) => ({
        albums: state.albums.filter((a) => a.id !== albumId),
      })),

      renameAlbum: (albumId, newName) => set((state) => ({
        albums: state.albums.map((a) =>
          a.id === albumId ? { ...a, name: newName.trim() || a.name } : a
        ),
      })),

      addPhotoToAlbum: (albumId, photoId) => set((state) => ({
        albums: state.albums.map((a) =>
          a.id === albumId && !a.photoIds.includes(photoId)
            ? { ...a, photoIds: [...a.photoIds, photoId] }
            : a
        ),
      })),

      removePhotoFromAlbum: (albumId, photoId) => set((state) => ({
        albums: state.albums.map((a) =>
          a.id === albumId
            ? { ...a, photoIds: a.photoIds.filter((id) => id !== photoId) }
            : a
        ),
      })),

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
          const { photos, totalInLibrary } = await PhotoLibrary.loadPhotos();
          set({
            libraryPhotos:     photos,
            libraryTotalCount: totalInLibrary,
            libraryLoading:    false,
          });
        } catch (err) {
          console.warn("loadLibrary failed:", err);
          set({ libraryError: String(err), libraryLoading: false });
        }
      },
    })),
    {
      name: "phototri-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // On persiste UNIQUEMENT le tri + les albums — la photothèque est rechargée à chaque ouverture.
      partialize: (state) => ({
        kept:    state.kept,
        deleted: state.deleted,
        printed: state.printed,
        albums:  state.albums,
      }),
    }
  )
);
