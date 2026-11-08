// Décision « cette photo est-elle floue ? » — fonctions pures, sans I/O.
import { BLUR_ALGO_VERSION, BLUR_THRESHOLD, BLUR_THRESHOLD_WHATSAPP } from "../constants/blurConfig";
import { isWhatsAppName } from "./photoSource";

/** Photo WhatsApp ? waIds = Set des ids des albums WhatsApp (voir photoSource). */
export function isWhatsAppPhoto(photo, waIds) {
  return isWhatsAppName(photo.filename) || (waIds ? waIds.has(photo.id) : false);
}

export function blurThresholdFor(photo, waIds) {
  return isWhatsAppPhoto(photo, waIds) ? BLUR_THRESHOLD_WHATSAPP : BLUR_THRESHOLD;
}

/** Les photos qu'on mesure : pas les screenshots (déjà nets, autre usage). Les vidéos ne sont jamais chargées. */
export function isAnalyzable(photo) {
  return !photo.isScreenshot;
}

/** Le résultat en cache est-il encore valable ? (même formule, photo non modifiée depuis) */
export function isBlurFresh(entry, photo) {
  return !!entry?.blur
    && entry.blur.v === BLUR_ALGO_VERSION
    && (entry.m ?? null) === (photo.modificationTime ?? null);
}

/** Score d'une photo, ou null si pas (encore) mesurée. */
export function blurScoreOf(entry, photo) {
  return isBlurFresh(entry, photo) ? entry.blur.s : null;
}

/**
 * Liste des photos floues, de la plus floue à la moins floue.
 * @param photos  photos de la photothèque
 * @param scores  cache { [id]: { m, blur: { s, v } } }
 * @param opts    waIds (Set), deletedIds (Set : déjà à la corbeille), keptIds (Set : gardées à la main)
 * @returns {{ photo, score, whatsapp }[]}
 */
export function blurryPhotos(photos, scores, { waIds, deletedIds, keptIds } = {}) {
  const out = [];
  for (const photo of photos) {
    if (!isAnalyzable(photo)) continue;
    if (deletedIds?.has(photo.id) || keptIds?.has(photo.id)) continue;
    const score = blurScoreOf(scores[photo.id], photo);
    if (score == null) continue;
    const whatsapp = isWhatsAppPhoto(photo, waIds);
    if (score < (whatsapp ? BLUR_THRESHOLD_WHATSAPP : BLUR_THRESHOLD)) {
      out.push({ photo, score, whatsapp });
    }
  }
  out.sort((a, b) => a.score - b.score);
  return out;
}
