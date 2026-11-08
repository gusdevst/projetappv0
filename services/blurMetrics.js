// Les « mesures de netteté » disponibles. Le module natif renvoie 4 nombres par photo :
//   lap  = variance du Laplacien de toute l'image (la mesure d'origine)
//   top  = idem, mais seulement sur la zone la plus nette de l'image
//   lap2 / lap4 = la même chose sur l'image réduite 2 fois / 4 fois
// Une mesure en est tirée (ci-dessous). Toutes : GRAND = net, PETIT = flou.
//
// Pourquoi plusieurs ? Une seule mesure se trompe selon la scène : un portrait net sur fond lisse
// score bas, une photo floue mais très texturée (feuillage, bruit de nuit) score haut.
//  - top  corrige le premier cas (on regarde la zone nette, pas la moyenne) ;
//  - r12 / r24 comparent le détail fin au détail plus grossier de la MÊME photo : une photo floue
//    n'a presque plus de détail fin, quelle que soit la scène. C'est une mesure « relative ».
// Laquelle est utilisée dans l'app : BLUR_METRIC dans constants/blurConfig.js.
const EPS = 1e-6;

export const BLUR_METRICS = {
  lap: { label: "Laplacien", hint: "mesure d'origine", value: (b) => b.lap },
  top: { label: "Zone nette", hint: "quart le plus net", value: (b) => b.top },
  r12: { label: "Fin/moyen", hint: "détail fin ÷ détail moyen", value: (b) => b.lap / Math.max(b.lap2, EPS) },
  r24: { label: "Moyen/gros", hint: "détail moyen ÷ gros détail", value: (b) => b.lap2 / Math.max(b.lap4, EPS) },
};

export const BLUR_METRIC_KEYS = Object.keys(BLUR_METRICS);

/** Valeur d'une mesure pour une photo (blur = entry.blur du cache). null si absente. */
export function metricValue(blur, metric) {
  const def = BLUR_METRICS[metric];
  if (!def || !blur || !Number.isFinite(blur.lap)) return null;
  const v = def.value(blur);
  return Number.isFinite(v) ? v : null;
}

/** Affichage d'un score : plus de décimales quand il est petit (les ratios). */
export function formatScore(v) {
  if (v == null) return "—";
  if (v >= 100) return String(Math.round(v));
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
