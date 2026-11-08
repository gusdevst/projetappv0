// Réglages de la détection de photos floues. Tout ce qu'on peut vouloir ajuster est ici.
//
// Le score vient du module natif (modules/pellicule-sharpness) : variance du Laplacien
// d'une miniature de 512 px. GRAND score = photo nette, PETIT score = photo floue.
// Une photo est « floue » quand son score est SOUS le seuil.

// Numéro de version de la formule. Si tu changes l'algorithme (Swift + Kotlin) ou
// la taille de miniature : augmente ce nombre → toutes les photos sont recalculées.
export const BLUR_ALGO_VERSION = 1;

// Seuil des photos normales : score < BLUR_THRESHOLD → floue.
// ⚠️ Valeurs de départ, à régler à l'étape 3 avec le panneau de calibrage.
export const BLUR_THRESHOLD = 100;

// Seuil des photos WhatsApp (réglé par Augustin le 8 nov. avec l'écran de calibrage : 150).
export const BLUR_THRESHOLD_WHATSAPP = 150;

// Analyse en arrière-plan (app ouverte).
export const ANALYSIS_START_DELAY_MS = 2500; // attend un peu après le chargement : l'accueil s'affiche d'abord
export const ANALYSIS_CONCURRENCY = 2;       // photos mesurées en même temps
export const ANALYSIS_PAUSE_MS = 15;         // petite pause entre deux photos : laisse respirer l'interface / le swipe
export const ANALYSIS_PUBLISH_EVERY = 25;    // l'interface est prévenue tous les N résultats
export const ANALYSIS_SAVE_EVERY = 150;      // sauvegarde sur disque tous les N résultats (et à l'arrêt)
