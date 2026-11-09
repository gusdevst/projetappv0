// Réglages de la détection de photos floues. Tout ce qu'on peut vouloir ajuster est ici.
//
// Les scores viennent du module natif (modules/pellicule-sharpness), sur une miniature de 512 px.
// Il renvoie 4 mesures (voir services/blurMetrics.js) ; BLUR_METRIC choisit celle qui décide.
// GRAND score = photo nette, PETIT score = photo floue. Une photo est « floue » quand son score est SOUS le seuil.

// Numéro de version de la formule. Si tu changes l'algorithme (Swift + Kotlin) ou
// la taille de miniature : augmente ce nombre → toutes les photos sont recalculées.
export const BLUR_ALGO_VERSION = 2; // 2 = 4 mesures (dette n°15, 9 nov.)

// Mesure qui décide (dette n°15) : "top" = la zone la plus nette de la photo.
// Un portrait net sur fond lisse n'est plus signalé flou à cause de son fond.
// Autres choix possibles : "lap" (mesure d'origine), "r12", "r24" (comparaisons de détail).
export const BLUR_METRIC = "top";

// Seuils par mesure : score < seuil → floue. normal = photos de l'appareil, wa = photos WhatsApp.
// Tous réglés par Augustin le 9 nov. avec l'écran de calibrage [DEV] (après le rebuild à 4 mesures).
export const BLUR_THRESHOLDS = {
  lap: { normal: 100, wa: 150 },
  top: { normal: 150, wa: 300 },
  r12: { normal: 0.35, wa: 0.45 },
  r24: { normal: 0.3, wa: 0.55 },
};

// Seuils de la mesure choisie (utilisés partout dans l'app).
export const BLUR_THRESHOLD = BLUR_THRESHOLDS[BLUR_METRIC].normal;
export const BLUR_THRESHOLD_WHATSAPP = BLUR_THRESHOLDS[BLUR_METRIC].wa;

// Analyse en arrière-plan (app ouverte).
export const ANALYSIS_START_DELAY_MS = 2500; // attend un peu après le chargement : l'accueil s'affiche d'abord
export const ANALYSIS_CONCURRENCY = 2;       // photos mesurées en même temps
export const ANALYSIS_PAUSE_MS = 15;         // petite pause entre deux photos : laisse respirer l'interface / le swipe
export const ANALYSIS_PUBLISH_EVERY = 25;    // l'interface est prévenue tous les N résultats
export const ANALYSIS_SAVE_EVERY = 150;      // sauvegarde sur disque tous les N résultats (et à l'arrêt)
