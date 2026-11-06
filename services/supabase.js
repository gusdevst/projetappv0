// Connexion à Supabase (comptes, plus tard : progression, albums, PDF).
// La clé "publishable" est faite pour être dans l'app : elle n'ouvre rien toute seule,
// c'est la sécurité des tables (RLS) côté Supabase qui protège les données.
// JAMAIS la clé "secret" / "service_role" ici.
import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xemwkqqpgvefumfvcehj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YR0X3Wuttb7n6oaGIjUmKQ_SnHO2K9N";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage, // la session reste mémorisée entre deux lancements
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // pas de navigateur ici
  },
});

// Le renouvellement de session ne tourne que quand l'app est au premier plan.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
