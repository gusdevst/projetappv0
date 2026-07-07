// store/usePhotoStore.js
import { create } from "zustand";
import { subscribeWithSelector, persist, createJSONStorage } from "zustand/middleware";
import { InteractionManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as PhotoLibrary from "../services/photoLibrary";
import { loadGpsCache, saveGpsCache } from "../services/gpsCache";

const GEO_SCAN_BATCH = 50;

// Flag pour désactiver facilement le pré-chargement GPS en arrière-plan
// (étape 3) sans toucher au scan déclenché manuellement depuis MapScreen.
const ENABLE_BACKGROUND_GEO_PRELOAD = true;

// Verrou anti double-exécution de scanGeo(). Variable de module (pas dans le
// store) : c'est un détail d'implémentation interne, pas un état à observer.
let geoScanRunning = false;

export const usePhotoStore = create(
  persist(
    subscribeWithSelector((set, get) => ({
      // ─── État du tri (persisté) ─────────────────────────────────────────
      kept:      [], // "Photos coup de cœur" — favoris
      deleted:   [], // Corbeille (décision destructrice prioritaire — vide les autres piles)
      printed:   [], // À imprimer / album souvenirs
      skipped:   [], // MÉNAGE : photos "Conservées" — décision définitive, ne reviennent jamais
      hesitated: [], // "Je déciderai plus tard" — l'user hésite entre garder et supprimer
      // Albums créés par l'utilisateur dans "Album souvenirs".
      // Format : [{ id, name, photoIds: [] }]
      albums:  [],

      // Filtres combinés du mode ALBUM (transitoires, NON persistés).
      // Chaque filtre restreint la sélection en INTERSECTION (ET).
      // Format : [{ id, type: "date"|"lieu"|"coeur", label, photoIds: [] }]
      albumFilters: [],

      // Mappings swipe pour le mode MÉNAGE (nettoyer la photothèque).
      // Actions possibles : "skip" | "delete" | "favorite" | "hesitate" | "none"
      // up = "skip" : conserver la photo. Le bouton ❤️ est l'unique moyen d'ajouter aux coups de cœur.
      swipeMappingsMenage: {
        up:    "skip",
        down:  "delete",
        left:  "hesitate",
        right: "skip",
      },

      // Mappings swipe pour le mode ALBUM (construire un album).
      // Pas de suppression en mode album. Actions possibles : "album" | "skip" | "hesitate" | "none"
      // up=envoyer dans l'album, down/right="skip"=ne pas envoyer (photo conservée, pourra
      // revenir pour un prochain album), left=je déciderai plus tard.
      swipeMappingsAlbum: {
        up:    "album",
        down:  "skip",
        left:  "hesitate",
        right: "skip",
      },

      // Fréquence des rappels push. Persistée.
      // "off" | "daily" | "every2days" | "weekly"
      notificationFrequency: "off",

      // Heure du rappel (0-23). Persistée. Utilisée pour les triggers DAILY et WEEKLY.
      notificationHour: 9,
      setNotificationHour: (h) => set({ notificationHour: h }),

      // Minutes du rappel (0-59). Persistées.
      notificationMinute: 0,
      setNotificationMinute: (m) => set({ notificationMinute: m }),

      // 2e créneau pour le mode "twice_daily"
      notificationHour2: 21,
      setNotificationHour2: (h) => set({ notificationHour2: h }),
      notificationMinute2: 0,
      setNotificationMinute2: (m) => set({ notificationMinute2: m }),

      // A-t-on déjà proposé d'activer les rappels au 1er usage du mode aléatoire ?
      // Persisté → l'Alert ne s'affiche qu'une seule fois. (Le bilan reste un filet
      // de secours tant que les notifs sont sur "off".)
      notifPromptSeen: false,
      setNotifPromptSeen: (v) => set({ notifPromptSeen: v }),

      // A-t-on déjà montré le tuto de la 1re session ? (un par mode)
      // Persisté → l'overlay explicatif ne s'affiche qu'une seule fois.
      swipeTutoSeen: false,                              // mode TRI (ménage)
      setSwipeTutoSeen: (v) => set({ swipeTutoSeen: v }),
      albumTutoSeen: false,                              // mode ALBUM
      setAlbumTutoSeen: (v) => set({ albumTutoSeen: v }),

      // ─── État de la photothèque (NON persisté — rechargé à chaque ouverture) ─
      permission:      "undetermined", // "undetermined" | "granted" | "denied"
      libraryPhotos:     [],
      libraryTotalCount: 0,            // total réel sur le téléphone (peut dépasser MAX_PHOTOS)
      libraryLoading:    false,
      libraryError:      null,

      // ─── Tri par lieu (GPS) — état de session (NON persisté) ────────────
      // Reconstruit depuis le cache disque (services/gpsCache.js) via scanGeo(),
      // jamais depuis le store persisté (voir partialize plus bas) : la
      // photothèque elle-même n'est pas persistée, cet état ne doit pas l'être
      // non plus sous peine d'incohérence.
      geoPhotos:       [],     // photos avec {lat,lng} trouvées jusqu'ici (peut inclure des photos depuis supprimées, filtrées à l'affichage)
      geoScanStatus:   "idle", // "idle" | "scanning" | "done"
      geoScanProgress: null,   // {scanned, total} pendant le scan des photos non-cachées, sinon null

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

      // addSkipped = "Conserver la photo" (ménage) : je garde sur le téléphone, décision
      // définitive. Persisté et jamais réinitialisé → la photo ne revient plus en tri ménage.
      addSkipped: (photo) => set((state) =>
        state.skipped.some((p) => p.id === photo.id)
          ? state
          : { skipped: [...state.skipped, photo] }
      ),

      // addHesitated = "je déciderai plus tard". L'user n'est pas prêt à choisir.
      // Retire la photo de deleted/kept si elle y était (décision suspendue).
      addHesitated: (photo) => set((state) => {
        if (state.hesitated.some((p) => p.id === photo.id)) return state;
        return {
          hesitated: [...state.hesitated, photo],
          deleted:   state.deleted.filter((p) => p.id !== photo.id),
          kept:      state.kept.filter((p) => p.id !== photo.id),
        };
      }),

      // Réinitialise la pile hesitated (appelé quand l'user relance un tri sur ces photos)
      resetHesitated: () => set({ hesitated: [] }),

      // Réinitialise la pile "skipped" (utilitaire). Non utilisé automatiquement :
      // en ménage les photos conservées doivent rester décidées. restartTri() s'en charge.
      resetSkipped: () => set({ skipped: [] }),

      // Réinitialise les coups de cœur (kept). Utilisé depuis Paramètres.
      resetKept: () => set({ kept: [] }),

      // Modifie le mapping d'une direction pour un mode donné ("menage" ou "album").
      setSwipeMapping: (mode, direction, action) => set((state) => {
        const key = mode === "album" ? "swipeMappingsAlbum" : "swipeMappingsMenage";
        return { [key]: { ...state[key], [direction]: action } };
      }),

      // Modifie la fréquence des rappels (utilisé par Settings).
      setNotificationFrequency: (freq) => set({ notificationFrequency: freq }),

      // Taille de la session aléatoire (par défaut 30, ajustable).
      randomCount: 30,
      setRandomCount: (n) => set({ randomCount: n }),

      // Priorité de tri pour les sessions déclenchées par la notification.
      // type: "random" | "native_album" | "duplicates"
      // nativeAlbumId / nativeAlbumTitle : dossier natif sélectionné
      sortPriority: { type: "random", nativeAlbumId: null, nativeAlbumTitle: null },
      setSortPriority: (p) => set({ sortPriority: p }),

      // Remet les mappings de swipe par défaut pour un mode donné (ou les deux).
      resetSwipeMappings: (mode) => {
        if (mode === "album") {
          set({ swipeMappingsAlbum: { up: "album", down: "skip", left: "hesitate", right: "skip" } });
        } else if (mode === "menage") {
          // up = "skip" : conserver la photo (PAS coup de cœur — ça, c'est le bouton ❤️).
          set({ swipeMappingsMenage: { up: "skip", down: "delete", left: "hesitate", right: "skip" } });
        } else {
          // reset les deux
          set({
            swipeMappingsMenage: { up: "skip",  down: "delete", left: "hesitate", right: "skip" },
            swipeMappingsAlbum:  { up: "album", down: "skip",  left: "hesitate", right: "skip" },
          });
        }
      },

      undoLast: (keptSnap, deletedSnap, printedSnap, skippedSnap, hesitatedSnap) => set((state) => ({
        kept:      keptSnap,
        deleted:   deletedSnap,
        printed:   printedSnap,
        skipped:   skippedSnap   !== undefined ? skippedSnap   : state.skipped,
        hesitated: hesitatedSnap !== undefined ? hesitatedSnap : state.hesitated,
      })),

      reset: () => set({ kept: [], deleted: [], printed: [], skipped: [], hesitated: [], albums: [] }),

      // Relance le tri depuis zéro : renvoie dans la file à trier toutes les
      // photos non supprimées qui avaient été classées (pile album, passées,
      // hésitations). CONSERVE volontairement les coups de cœur (kept), la
      // corbeille (deleted) et les albums souvenirs créés.
      restartTri: () => set({ printed: [], skipped: [], hesitated: [] }),

      // Retire une photo d'une section (kept/deleted/printed). Elle redevient
      // disponible pour le tri dans la file principale.
      restorePhoto: (photoId, section) => set((state) => ({
        [section]: state[section].filter((p) => p.id !== photoId),
      })),

      // ─── Filtres combinés (mode album) ──────────────────────────────────
      // Ajoute un filtre. Si un filtre du même id existe déjà, on le remplace
      // (ex. re-sélectionner les coups de cœur met juste à jour la liste).
      addAlbumFilter: (filter) => set((state) => ({
        albumFilters: [
          ...state.albumFilters.filter((f) => f.id !== filter.id),
          filter,
        ],
      })),
      removeAlbumFilter: (id) => set((state) => ({
        albumFilters: state.albumFilters.filter((f) => f.id !== id),
      })),
      clearAlbumFilters: () => set({ albumFilters: [] }),

      // ─── Actions albums ─────────────────────────────────────────────────
      createAlbum: (name) => set((state) => ({
        albums: [
          ...state.albums,
          { id: `album-${Date.now()}`, name: name.trim() || "Album sans nom", photoIds: [] },
        ],
      })),

      deleteAlbum: (albumId) => set((state) => {
        // On supprime l'album…
        const updatedAlbums = state.albums.filter((a) => a.id !== albumId);
        // …puis on retire de "printed" les photos qui ne sont plus dans aucun autre album.
        // Une photo dans plusieurs albums reste dans "printed" tant qu'elle a au moins un album.
        const stillReferenced = new Set(updatedAlbums.flatMap((a) => a.photoIds));
        return {
          albums:  updatedAlbums,
          printed: state.printed.filter((p) => stillReferenced.has(p.id)),
        };
      }),

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

      removePhotoFromAlbum: (albumId, photoId) => set((state) => {
        const updatedAlbums = state.albums.map((a) =>
          a.id === albumId
            ? { ...a, photoIds: a.photoIds.filter((id) => id !== photoId) }
            : a
        );
        // Si la photo n'appartient plus à aucun album, la sortir de printed
        // et la mettre dans skipped (= déjà triée, invisible dans le menu album).
        const stillInAlbum = updatedAlbums.some((a) => a.photoIds.includes(photoId));
        if (stillInAlbum) return { albums: updatedAlbums };
        const photo = state.printed.find((p) => p.id === photoId);
        return {
          albums:  updatedAlbums,
          printed: state.printed.filter((p) => p.id !== photoId),
          skipped: photo ? [...state.skipped, photo] : state.skipped,
        };
      }),

      // ─── Vider la corbeille (vraie suppression via MediaLibrary) ────────
      // Retourne true si la suppression a réussi, false sinon.
      emptyTrash: async () => {
        const { deleted } = get();
        if (deleted.length === 0) return true;
        try {
          const ok = await PhotoLibrary.deletePhotos(deleted.map((p) => p.id));
          if (ok) {
            set({ deleted: [] });
            // ⚠️ Recharger la photothèque : sans ça, les photos supprimées restent
            // dans libraryPhotos et réapparaissent dans la file de tri (écran noir).
            await get().loadLibrary();
          }
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

          // Étape 3 : pré-chargement GPS en arrière-plan. Fire-and-forget —
          // ne bloque jamais loadLibrary, et une erreur ici ne doit JAMAIS
          // impacter le reste de l'app (d'où le try/catch dédié, en plus de
          // celui déjà présent dans scanGeo lui-même).
          if (ENABLE_BACKGROUND_GEO_PRELOAD) {
            InteractionManager.runAfterInteractions(() => {
              try {
                get().scanGeo().catch((err) => {
                  console.warn("scanGeo (préchargement arrière-plan) failed:", err);
                });
              } catch (err) {
                console.warn("scanGeo (préchargement arrière-plan) failed:", err);
              }
            });
          }
        } catch (err) {
          console.warn("loadLibrary failed:", err);
          set({ libraryError: String(err), libraryLoading: false });
        }
      },

      // ─── Scan GPS (Tri par lieu) ─────────────────────────────────────────
      // Lit le cache négatif, ne scanne que les photos jamais vues, met à jour
      // geoPhotos par batches. Peut être appelée plusieurs fois sans risque :
      // le verrou empêche toute exécution concurrente, et le cache (étape 1)
      // garantit qu'une photo déjà scannée n'est jamais retraitée.
      scanGeo: async () => {
        if (geoScanRunning) return;
        geoScanRunning = true;
        set({ geoScanStatus: "scanning" });

        try {
          const { libraryPhotos, deleted } = get();
          const deletedIds = new Set(deleted.map((p) => p.id));
          const activePhotos = libraryPhotos.filter((p) => !deletedIds.has(p.id));

          const cache = await loadGpsCache();

          // known / toScan : cf. règle du cache négatif dans services/gpsCache.js
          const known = [];
          const toScan = [];
          activePhotos.forEach((p) => {
            if (Object.prototype.hasOwnProperty.call(cache, p.id)) {
              const entry = cache[p.id];
              if (entry) known.push({ ...p, lat: entry.lat, lng: entry.lng });
            } else {
              toScan.push(p);
            }
          });

          set({ geoPhotos: known });

          if (toScan.length === 0) {
            set({ geoScanStatus: "done", geoScanProgress: null });
            return;
          }

          set({ geoScanProgress: { scanned: 0, total: toScan.length } });

          for (let i = 0; i < toScan.length; i += GEO_SCAN_BATCH) {
            const chunk = toScan.slice(i, i + GEO_SCAN_BATCH);
            const enriched = await Promise.all(
              chunk.map(async (p) => {
                const loc = await PhotoLibrary.loadPhotoLocation(p.id);
                // Cache négatif : on mémorise aussi l'absence de GPS (null).
                cache[p.id] = loc ? { lat: loc.lat, lng: loc.lng } : null;
                return loc ? { ...p, lat: loc.lat, lng: loc.lng } : null;
              })
            );

            const found = enriched.filter(Boolean);
            if (found.length > 0) {
              set((state) => ({ geoPhotos: [...state.geoPhotos, ...found] }));
            }
            set({ geoScanProgress: { scanned: Math.min(i + GEO_SCAN_BATCH, toScan.length), total: toScan.length } });

            // Micro-pause : rend la main au thread JS entre deux batches, pour
            // que l'UI (navigation, animations) reste fluide pendant un scan
            // de plusieurs milliers de photos, notamment en arrière-plan (étape 3).
            await new Promise((resolve) => setTimeout(resolve, 0));
          }

          await saveGpsCache(cache);
          set({ geoScanStatus: "done", geoScanProgress: null });
        } catch (err) {
          console.warn("scanGeo failed:", err);
          set({ geoScanStatus: "done", geoScanProgress: null });
        } finally {
          geoScanRunning = false;
        }
      },
    })),
    {
      name: "phototri-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // v1 : "favorite" n'est plus une action de swipe (coup de cœur = bouton ❤️ seul) → "skip".
      // v2 : pas de suppression en mode album → tout swipe "delete" de l'album devient "skip"
      //      ("ne pas envoyer dans l'album", photo conservée).
      version: 2,
      migrate: (persisted) => {
        if (!persisted) return persisted;
        const mapVals = (m, fn) =>
          m ? Object.fromEntries(Object.entries(m).map(([dir, action]) => [dir, fn(action)])) : m;
        // favorite → skip (les deux modes)
        persisted.swipeMappingsMenage = mapVals(persisted.swipeMappingsMenage, (a) => (a === "favorite" ? "skip" : a));
        persisted.swipeMappingsAlbum  = mapVals(persisted.swipeMappingsAlbum,  (a) => (a === "favorite" ? "skip" : a));
        // album : delete → skip
        persisted.swipeMappingsAlbum  = mapVals(persisted.swipeMappingsAlbum,  (a) => (a === "delete" ? "skip" : a));
        return persisted;
      },
      // On persiste UNIQUEMENT le tri + les albums + le mapping swipe.
      // La photothèque est rechargée à chaque ouverture.
      partialize: (state) => ({
        kept:                    state.kept,
        deleted:                 state.deleted,
        printed:                 state.printed,
        skipped:                 state.skipped,
        hesitated:               state.hesitated,
        albums:                  state.albums,
        swipeMappingsMenage:     state.swipeMappingsMenage,
        swipeMappingsAlbum:      state.swipeMappingsAlbum,
        notificationFrequency:   state.notificationFrequency,
        notificationHour:        state.notificationHour,
        notificationMinute:      state.notificationMinute,
        notificationHour2:       state.notificationHour2,
        notificationMinute2:     state.notificationMinute2,
        notifPromptSeen:         state.notifPromptSeen,
        swipeTutoSeen:           state.swipeTutoSeen,
        albumTutoSeen:           state.albumTutoSeen,
        randomCount:             state.randomCount,
        sortPriority:            state.sortPriority,
      }),
    }
  )
);
