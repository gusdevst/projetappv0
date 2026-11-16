// hooks/useAddresses.js
// Mes adresses enregistrées (compte) : liste + chargement, relue à chaque retour sur l'écran.
// const { addresses, loading, error, reload } = useAddresses(navigation, enabled)
// `enabled` = false tant qu'on n'est pas connecté (rien n'est demandé au serveur).

import { useCallback, useEffect, useRef, useState } from "react";
import { listAddresses } from "../services/addresses";

export function useAddresses(navigation, enabled = true) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const reload = useCallback(async () => {
    if (!enabled) { setAddresses([]); setLoading(false); return []; }
    setLoading(true);
    try {
      const list = await listAddresses();
      if (alive.current) { setAddresses(list); setError(null); }
      return list;
    } catch (e) {
      if (alive.current) setError(e);
      return [];
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    reload();
    const unsub = navigation?.addListener?.("focus", reload);
    return unsub;
  }, [reload, navigation]);

  return { addresses, loading, error, reload };
}
