// Les photos floues repérées, prêtes à afficher (accueil, écran « Photos floues »).
// Combine : photothèque + résultats d'analyse (store/useBlurStore) + seuils (constants/blurConfig)
// + exclusions (corbeille ; plus tard les photos gardées à la main).
import { useMemo } from "react";
import { usePhotoStore } from "../store/usePhotoStore";
import { useBlurStore } from "../store/useBlurStore";
import { blurryPhotos } from "../services/blurDetection";

/**
 * @returns {{
 *   items: {photo, score, whatsapp}[],  // de la plus floue à la moins floue
 *   count: number,
 *   analyzing: boolean,                 // l'analyse de fond tourne
 *   pct: number,                        // avancement de l'analyse, 0-100
 * }}
 */
export function useBlurryPhotos() {
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const deleted = usePhotoStore((s) => s.deleted);
  const kept = usePhotoStore((s) => s.kept);
  const skipped = usePhotoStore((s) => s.skipped);
  const printed = usePhotoStore((s) => s.printed);
  const blurKeptIds = usePhotoStore((s) => s.blurKeptIds);
  const { scores, rev, whatsapp, status, total, done } = useBlurStore();

  const items = useMemo(() => {
    // Exclues : corbeille · photos déjà décidées « à garder » (❤️, conservées, album) · gardées depuis l'écran Photos floues.
    const deletedIds = new Set(deleted.map((p) => p.id));
    const keptIds = new Set([
      ...kept.map((p) => p.id),
      ...skipped.map((p) => p.id),
      ...printed.map((p) => p.id),
      ...(blurKeptIds || []),
    ]);
    return blurryPhotos(libraryPhotos, scores, { waIds: whatsapp.ids, deletedIds, keptIds });
    // `rev` change à chaque publication de nouveaux résultats (scores est modifié sur place)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryPhotos, deleted, kept, skipped, printed, blurKeptIds, rev, whatsapp]);

  return {
    items,
    count: items.length,
    analyzing: status === "running",
    pct: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0,
  };
}
