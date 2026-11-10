// État EN MÉMOIRE de l'analyse de netteté (rien de persisté ici : le disque, c'est
// services/photoAnalysisCache.js). Alimenté par services/photoAnalysisQueue.js.
import { create } from "zustand";

export const useBlurStore = create(() => ({
  // "idle" (rien lancé) | "running" | "done" | "unavailable" (module natif absent : rebuild nécessaire)
  status: "idle",
  total: 0,        // photos à mesurer en tout (hors screenshots)
  done: 0,         // photos déjà traitées (mesurées, ou illisibles ce coup-ci)
  // Étiquettes de contenu (« plage », « chien »…) : même file, une 2ᵉ passe après la netteté.
  labelsStatus: "idle", // "idle" | "running" | "done" | "unavailable" (module natif absent)
  labelsTotal: 0,
  labelsDone: 0,
  scores: {},      // le cache { id: { m, blur: {…}, tags: { l: [[texte, %]], v } } } — MÊME objet que celui de la file (modifié sur place)
  rev: 0,          // +1 à chaque publication : sert à re-déclencher les écrans qui lisent `scores`
  whatsapp: { ids: new Set(), albums: [] }, // albums WhatsApp trouvés (voir services/photoSource.js)
}));
