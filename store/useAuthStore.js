// store/useAuthStore.js
// État de connexion. Pas de persist ici : Supabase mémorise déjà la session
// (AsyncStorage, voir services/supabase.js). On la relit au lancement via init().
import { create } from "zustand";
import { supabase } from "../services/supabase";

let started = false;

export const useAuthStore = create((set) => ({
  session: null, // null = pas connecté
  ready: false,  // true une fois la session relue au démarrage

  // À appeler une seule fois (App.js).
  init: async () => {
    if (started) return;
    started = true;
    try {
      const { data } = await supabase.auth.getSession();
      set({ session: data.session ?? null, ready: true });
    } catch (e) {
      set({ ready: true }); // hors-ligne au démarrage : on reste « pas connecté »
    }
    // Se déclenche à chaque connexion / déconnexion / renouvellement.
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session: session ?? null, ready: true });
    });
  },
}));
