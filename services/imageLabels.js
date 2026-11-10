// Enveloppe JS du module natif `modules/pellicule-labels` (Vision sur iOS, ML Kit sur Android).
// Donne les étiquettes de contenu d'UNE photo : « Beach », « Dog », « Child »… (en anglais),
// avec un niveau de confiance de 0 à 1. Tout se calcule sur le téléphone.
//
// `requireOptionalNativeModule` : si l'app n'a pas été reconstruite avec le module,
// on obtient `null` au lieu d'un plantage → `isLabelsAvailable` = false.
import { requireOptionalNativeModule } from "expo-modules-core";

const Native = requireOptionalNativeModule("PelliculeLabels");

export const isLabelsAvailable = Native != null;

/**
 * @param {string} photoId  asset.id d'expo-media-library (photo.id dans l'app)
 * @returns {Promise<{labels:{text:string,confidence:number}[],width:number,height:number}|null>}
 *   null = photo illisible (absente, ou seulement sur iCloud) ou module absent.
 */
export async function getLabels(photoId) {
  if (!Native) return null;
  return Native.getLabels(photoId);
}
