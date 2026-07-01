// services/photoAnalysis.js
// Analyses pures sur un tableau de photos — pas d'I/O, juste du calcul.
// Tout tourne sur le téléphone, instantané pour <500 photos.

// ─── Doublons ─────────────────────────────────────────────────────────────
// Heuristique : 2 photos sont des "doublons probables" si elles ont été prises
// à moins de 5 secondes d'écart ET ont les mêmes dimensions.
// Ça couvre ~80% des cas réels : mode rafale, double appui sur le bouton, etc.
// Limites : ne détecte pas les photos quasi-identiques prises plus tard (selfies),
// ni les recadrages. Pour ça il faudrait du perceptual hashing → Phase 4.

const DUPLICATE_TIME_WINDOW_MS = 5000;

/**
 * Trouve les groupes de doublons dans une liste de photos.
 * @param {Photo[]} photos
 * @returns {Array<{photos: Photo[]}>} groupes ayant au moins 2 photos
 */
export function findDuplicates(photos) {
  if (photos.length < 2) return [];

  // Trier par creationTime croissant pour faciliter la détection séquentielle
  const sorted = [...photos].sort((a, b) => a.creationTime - b.creationTime);

  const groups = [];
  let currentGroup = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentGroup[currentGroup.length - 1];
    const curr = sorted[i];
    const timeDiff = curr.creationTime - prev.creationTime;
    const sameSize = curr.width === prev.width && curr.height === prev.height;

    if (timeDiff <= DUPLICATE_TIME_WINDOW_MS && sameSize) {
      currentGroup.push(curr);
    } else {
      if (currentGroup.length >= 2) groups.push({ photos: currentGroup });
      currentGroup = [curr];
    }
  }
  if (currentGroup.length >= 2) groups.push({ photos: currentGroup });

  return groups;
}

// ─── Moments ──────────────────────────────────────────────────────────────
// Heuristique : on regroupe les photos prises dans une même "session" — défini
// comme un intervalle de moins de 12h sans nouvelle photo. Au-delà, on crée un
// nouveau moment. Ça matche bien les usages : une journée, un week-end, une soirée.

const MOMENT_GAP_HOURS = 12;
const MOMENT_GAP_MS = MOMENT_GAP_HOURS * 60 * 60 * 1000;

/**
 * Groupe les photos en "moments" temporels.
 * @param {Photo[]} photos
 * @returns {Array<{id: string, startDate: Date, endDate: Date, label: string, photos: Photo[]}>}
 */
export function groupByMoment(photos) {
  if (photos.length === 0) return [];

  const sorted = [...photos].sort((a, b) => a.creationTime - b.creationTime);
  const moments = [];
  let currentPhotos = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentPhotos[currentPhotos.length - 1];
    const curr = sorted[i];
    const gap = curr.creationTime - prev.creationTime;

    if (gap <= MOMENT_GAP_MS) {
      currentPhotos.push(curr);
    } else {
      moments.push(buildMoment(currentPhotos));
      currentPhotos = [curr];
    }
  }
  moments.push(buildMoment(currentPhotos));

  // Tri du plus récent au plus ancien
  return moments.reverse();
}

function buildMoment(photos) {
  const start = new Date(photos[0].creationTime);
  const end = new Date(photos[photos.length - 1].creationTime);
  return {
    id: `moment-${photos[0].creationTime}`,
    startDate: start,
    endDate: end,
    label: formatMomentLabel(start, end),
    photos,
  };
}

function formatMomentLabel(start, end) {
  const sameDay = start.toDateString() === end.toDateString();
  const opts = { day: "numeric", month: "long", year: "numeric" };
  if (sameDay) {
    return start.toLocaleDateString("fr-FR", opts);
  }
  // Plage : "12 → 15 mars 2024"
  const startOpts = { day: "numeric", month: "long" };
  const endOpts = { day: "numeric", month: "long", year: "numeric" };
  return `${start.toLocaleDateString("fr-FR", startOpts)} → ${end.toLocaleDateString("fr-FR", endOpts)}`;
}
