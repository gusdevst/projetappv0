// hooks/usePrintedPhotos.js
// Les photos DÉJÀ IMPRIMÉES (abonnement Coups de cœur) : { photoId: { at, subId, month, product } }.
// Sert à (1) ne plus jamais les proposer dans une sélection à imprimer, (2) afficher « Imprimée » dans les coups de cœur.

import { useMemo } from "react";
import { useSubscriptionStore } from "../store/useSubscriptionStore";
import { printedMapOf } from "../services/printSelection";

export function usePrintedPhotos() {
  const printedPhotos = useSubscriptionStore((s) => s.printedPhotos);
  const selections    = useSubscriptionStore((s) => s.selections);
  return useMemo(() => printedMapOf(printedPhotos, selections), [printedPhotos, selections]);
}
