// hooks/useMailbox.js
// Photos REÇUES dans mes albums partagés (propriétaire), par album du téléphone : Map<idAlbumLocal, { albumId, albumName, localAlbumId, total, senders }>.
// Relue à chaque retour sur l'écran. Vide sans compte, hors ligne ou si rien n'a été reçu.
// Sert à l'enveloppe de « Mes albums » (MyAlbums) et à l'action « Trier les photos reçues » (GalleryScreen).
import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "../store/useAuthStore";
import { fetchMailbox } from "../services/sharedMailbox";

export function useMailbox() {
  const session = useAuthStore((s) => s.session);
  const [byLocal, setByLocal] = useState(() => new Map());

  useFocusEffect(useCallback(() => {
    let alive = true;
    if (!session) { setByLocal(new Map()); return undefined; }
    fetchMailbox().then((boxes) => { if (alive) setByLocal(new Map(boxes.map((b) => [String(b.localAlbumId), b]))); });
    return () => { alive = false; };
  }, [session?.user?.id])); // eslint-disable-line react-hooks/exhaustive-deps

  return byLocal;
}
