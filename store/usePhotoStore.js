// store/usePhotoStore.js
import { create } from "zustand";
import { subscribeWithSelector, persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as PhotoLibrary from "../services/photoLibrary";

export const usePhotoStore = create(
  persist(
    subscribeWithSelector((set, get) => ({
      // ─── État du tri (persisté) ─────────────────────────────────────────
      kept:    [], // "Photos coup de cœur" — favoris (additif, ne change pas la décision de tri)
      deleted: [], // Corbeille (décision destructrice prioritaire — vide les autres piles)
      printed: [], // À imprimer / album souvenirs
      skipped: [], // Photos passées en revue mais sans décision — exclues de la file
                   // jusqu'à la fin d'un tri complet (auto-reset au SummaryScreen)
      // Albums créés par l'utilisateur dans "Album souvenirs".
      // Format : [{ id, name, photoIds: [] }]
      albums:  [],

      // Mapping des 4 directions de swipe vers une action. Customisable via Settings.
      // Actions possibles : "skip" | "delete" | "album" | "favorite" | "none"
      swipeMappings: {
        up:    "skip",
        down:  "delete",
        left:  "none",
        right: "album",
      },

      // ─── État de la photothèque (NON persisté — rechargé à chaque ouverture) ─
      permission:      "undetermined", // "undetermined" | "granted" | "denied"
      libraryPhotos:     [],
      libraryTotalCount: 0,            // total réel sur le téléphone (peut dépasser MAX_PHOTOS)
      libraryLoading:    false,
      libraryError:      null,

      // ─── Actions de tri (idempotentes — pas de doublon si déjà présent) ──
      // addKept = "coup de cœur" : additif. Retire juste de deleted si présente
      // (incohérent d'avoir une favorite dans la corbeille).
      addKept: (photo) => set((state) => {
        if (state.kept.some((p) => p.id === photo.id)) return state;
        return {
          kept:    [...state.kept, photo],
          deleted: state.deleted.filter((p) => p.id !== photo.id),
        };
      }),

      // addDeleted = corbeille : décision destructrice, vide kept + printed pour cette photo.
      addDeleted: (photo) => set((state) => {
        if (state.deleted.some((p) => p.id === photo.id)) return state;
        return {
          deleted: [...state.deleted, photo],
          kept:    state.kept.filter((p) => p.id !== photo.id),
          printed: state.printed.filter((p) => p.id !== photo.id),
        };
      }),

      // addPrinted = album : retire de deleted (album = "garder").
      addPrinted: (photo) => set((state) => {
        if (state.printed.some((p) => p.id === photo.id)) return state;
        return {
          printed: [...state.printed, photo],
          deleted: state.deleted.filter((p) => p.id !== photo.id),
        };
      }),

      // addSkipped = "j'ai vu, je garde sur le téléphone sans tag". Additif, neutre.
      addSkipped: (photo) => set((state) =>
        state.skipped.some((p) => p.id === photo.id)
          ? state
          : { skipped: [...state.skipped, photo] }
      ),

      // Réinitialise la pile "skipped" — appelé automatiquement à la fin d'un tri complet
      // (SummaryScreen). Permet aux photos passées de revenir dans la file la prochaine fois.
      resetSkipped: () => set({ skipped: [] }),

      // Modifie le mapping d'une direction de swipe (utilisé par Settings).
      setSwipeMapping: (direction, action) => set((state) => ({
        swipeMappings: { ...state.swipeMappings, [direction]: action },
      })),

      // Remet les mappings de swipe par défaut.
      resetSwipeMappings: () => set({
        swipeMappings: {
          up:    "skip",
          down:  "delete",
          left:  "none",
          right: "album",
        },
      }),

      undoLast: (keptSnap, deletedSnap, printedSnap, skippedSnap) => set((state) => ({
        kept:    keptSnap,
        deleted: deletedSnap,
        printed: printedSnap,
        // skippedSnap est optionnel (rétrocompat avec snapshots pré-skip)
        skipped: skippedSnap !== undefined ? skippedSnap : state.skipped,
      })),

      reset: () => set({ kept: [], deleted: [], printed: [], skipped: [], albums: [] }),

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
      // On persiste UNIQUEMENT le tri + les albums + le mapping swipe.
      // La photothèque est rechargée à chaque ouverture.
      partialize: (state) => ({
        kept:           state.kept,
        deleted:        state.deleted,
        printed:        state.printed,
        skipped:        state.skipped,
        albums:         state.albums,
        swipeMappings:  state.swipeMappings,
      }),
    }
  )
);
