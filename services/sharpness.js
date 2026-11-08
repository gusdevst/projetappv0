// Enveloppe JS du module natif `modules/pellicule-sharpness` (Swift + Kotlin).
// Mesure la netteté d'UNE photo : variance du Laplacien sur une miniature de 512 px.
// Score bas = flou. Pas d'IA, juste du calcul.
//
// `requireOptionalNativeModule` : si l'app n'a pas été reconstruite avec le module,
// on obtient `null` au lieu d'un plantage → `isSharpnessAvailable` = false.
import { requireOptionalNativeModule } from "expo-modules-core";

const Native = requireOptionalNativeModule("PelliculeSharpness");

export const isSharpnessAvailable = Native != null;

/**
 * @param {string} photoId  asset.id d'expo-media-library (photo.id dans l'app)
 * @returns {Promise<{score:number,width:number,height:number}|null>}
 *   null = photo illisible (absente, ou seulement sur iCloud) ou module absent.
 */
export async function getSharpness(photoId) {
  if (!Native) return null;
  return Native.getSharpness(photoId);
}
