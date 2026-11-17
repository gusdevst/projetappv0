// store/useSharedStore.js
// Albums partagés, côté invité.
//   · pendingCode : le code tapé AVANT d'avoir un compte. Gardé (persisté) pendant la création du compte,
//     l'écran « Rejoindre un album » le retrouve ensuite.
//   · target : l'album partagé « présélectionné » sur l'accueil mode Album (juste après l'avoir rejoint,
//     ou en le choisissant dans « Dans quel album ? »). En mémoire seulement : { id, name, ownerName }.
//   · selections : les photos que j'ai swipées « à envoyer » pour un album partagé, PAS encore envoyées
//     (« Plus tard » = elles restent ici). { [albumId]: { name, ownerName, ids: [idPhoto…] } }  (persisté)
//   · sorts : le tri en cours (file + position) : on le reprend là où on s'est arrêté. (persisté)
//   · outbox : l'envoi accepté (case cochée) mais pas fini : reprend tout seul au prochain lancement.
//     { [albumId]: { name, ownerName, batchId, ids: [idPhoto restantes…], total } }  (persisté)
//   · sentIds : les photos de CE téléphone déjà envoyées à cet album (jamais proposées ni renvoyées). { [albumId]: [idPhoto…] }  (persisté)
//   · upload : avancement de l'envoi en cours (en mémoire) { albumId, total, done, running, error }.
// Les albums rejoints eux-mêmes ne sont PAS stockés ici : le serveur fait foi (fetchJoinedAlbums).
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useSharedStore = create(
  persist(
    (set, get) => ({
      pendingCode: "",
      setPendingCode: (code) => set({ pendingCode: code }),
      target: null,
      setTarget: (target) => set({ target }),

      // ── Sélection « à envoyer » ──
      selections: {},
      addToSelection: (album, photoId) => set((s) => {
        const cur = s.selections[album.id] ?? { name: album.name, ownerName: album.ownerName, ids: [] };
        if (cur.ids.includes(photoId)) return s;
        return { selections: { ...s.selections, [album.id]: { ...cur, name: album.name, ownerName: album.ownerName, ids: [...cur.ids, photoId] } } };
      }),
      removeFromSelection: (albumId, photoId) => set((s) => {
        const cur = s.selections[albumId];
        if (!cur) return s;
        const ids = cur.ids.filter((id) => id !== photoId);
        const next = { ...s.selections };
        if (ids.length === 0) delete next[albumId]; else next[albumId] = { ...cur, ids };
        return { selections: next };
      }),
      clearSelection: (albumId) => set((s) => {
        const next = { ...s.selections };
        delete next[albumId];
        return { selections: next };
      }),

      // ── Tri en cours pour un album partagé (reprise de là où on s'est arrêté) ──
      // { [albumId]: { name, ownerName, photoIds: [file en cours], idx } } — effacé à la fin du tri.
      sorts: {},
      startSharedSort: (album, photoIds) => set((s) => ({
        sorts: { ...s.sorts, [album.id]: { name: album.name, ownerName: album.ownerName, photoIds, idx: 0 } },
      })),
      setSharedSortIdx: (albumId, idx) => set((s) => (s.sorts[albumId] ? { sorts: { ...s.sorts, [albumId]: { ...s.sorts[albumId], idx } } } : s)),
      clearSharedSort: (albumId) => set((s) => {
        if (!s.sorts[albumId]) return s;
        const next = { ...s.sorts };
        delete next[albumId];
        return { sorts: next };
      }),

      // ── Envoi en cours (reprise) ──
      outbox: {},
      setOutbox: (albumId, entry) => set((s) => {
        const next = { ...s.outbox };
        if (entry) next[albumId] = entry; else delete next[albumId];
        return { outbox: next };
      }),
      // Une photo est partie : on la retire de la file d'envoi et on la mémorise comme envoyée.
      markSent: (albumId, photoId) => set((s) => {
        const box = s.outbox[albumId];
        const sent = new Set(s.sentIds[albumId] ?? []);
        sent.add(photoId);
        const outbox = { ...s.outbox };
        if (box) outbox[albumId] = { ...box, ids: box.ids.filter((id) => id !== photoId) };
        return { outbox, sentIds: { ...s.sentIds, [albumId]: [...sent] } };
      }),
      sentIds: {},
      mergeSentIds: (albumId, ids) => set((s) => {
        const sent = new Set([...(s.sentIds[albumId] ?? []), ...ids]);
        return { sentIds: { ...s.sentIds, [albumId]: [...sent] } };
      }),

      upload: null,
      setUpload: (patch) => set((s) => ({ upload: patch ? { ...(s.upload ?? {}), ...patch } : null })),
    }),
    {
      name: "pellicule.shared.v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ pendingCode: s.pendingCode, selections: s.selections, sorts: s.sorts, outbox: s.outbox, sentIds: s.sentIds }),
    }
  )
);
