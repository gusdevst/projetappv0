// Réglages des étiquettes de contenu (« plage », « chien »…). Tout ce qu'on peut vouloir ajuster est ici.
//
// Les étiquettes viennent du module natif `modules/pellicule-labels` (Vision sur iOS, ML Kit sur Android),
// en anglais, avec une confiance de 0 à 1. Elles sont calculées sur le téléphone, jamais envoyées.

// Numéro de version. Si tu changes ce qu'on garde (nombre d'étiquettes, confiance minimale) ou le
// module natif : augmente ce nombre → toutes les photos sont ré-analysées.
export const LABELS_ALGO_VERSION = 1;

// Ce qu'on GARDE dans le cache (par photo). Large exprès : on peut ensuite régler la recherche
// (LABELS_SEARCH_MIN_CONF) sans tout ré-analyser.
export const LABELS_KEEP = 8;            // nombre d'étiquettes gardées au plus
export const LABELS_KEEP_MIN_CONF = 0.15; // en dessous, on ne garde pas

// Recherche : une photo « a » l'étiquette si sa confiance est au moins égale à ce seuil.
export const LABELS_SEARCH_MIN_CONF = 0.5;

// Analyse en arrière-plan (après celle du flou, app ouverte).
export const LABELS_CONCURRENCY = 2;     // photos analysées en même temps
export const LABELS_PAUSE_MS = 15;       // petite pause entre deux photos
export const LABELS_PUBLISH_EVERY = 25;  // l'interface est prévenue tous les N résultats
export const LABELS_SAVE_EVERY = 400;    // sauvegarde sur disque tous les N résultats (le fichier grossit : on écrit moins souvent)
