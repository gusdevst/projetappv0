// services/achievements.js
// Galons (grades selon les photos triées) + badges. Calculs purs, pas d'UI.
//
import { computeStreak, STREAK_MIN, fmtDuration } from "./progressStats";
import { printedMapOf, nextMonthKey } from "./printSelection";
import { useSubscriptionStore } from "../store/useSubscriptionStore";

// Un galon / badge débloqué est mémorisé dans le store (achievements = { id: timestamp })
// → il reste acquis même si la donnée redescend (ex. coups de cœur retirés).

// ─── Galons ───────────────────────────────────────────────────────────────
// metal : bronze / silver / gold · chevrons : 1 à 3 (0 = étoile, grade ultime)
export const RANKS = [
  { id: "rank-1",  name: "Recrue",           min: 25,    metal: "bronze", chevrons: 1 },
  { id: "rank-2",  name: "Apprenti",         min: 50,    metal: "bronze", chevrons: 2 },
  { id: "rank-3",  name: "Trieur",           min: 100,   metal: "bronze", chevrons: 3 },
  { id: "rank-4",  name: "Trieur confirmé",  min: 250,   metal: "silver", chevrons: 1 },
  { id: "rank-5",  name: "Pro du tri",       min: 500,   metal: "silver", chevrons: 2 },
  { id: "rank-6",  name: "Expert",           min: 1000,  metal: "silver", chevrons: 3 },
  { id: "rank-7",  name: "Maître du tri",    min: 2000,  metal: "gold",   chevrons: 1 },
  { id: "rank-8",  name: "Grand maître",     min: 3500,  metal: "gold",   chevrons: 2 },
  { id: "rank-9",  name: "Légende",          min: 5000,  metal: "gold",   chevrons: 3 },
  { id: "rank-10", name: "Légende vivante",  min: 10000, metal: "gold",   chevrons: 0 },
];

// Grade actuel (null avant 25 photos) + suivant + avancement 0→1 vers le suivant.
export function rankInfo(totalSorted) {
  let idx = -1;
  RANKS.forEach((r, i) => { if (totalSorted >= r.min) idx = i; });
  const current = idx >= 0 ? RANKS[idx] : null;
  const next = RANKS[idx + 1] || null;
  const from = current ? current.min : 0;
  const progress = next ? (totalSorted - from) / (next.min - from) : 1;
  return { current, next, level: idx + 1, left: next ? next.min - totalSorted : 0, progress: Math.max(0, Math.min(1, progress)) };
}

// ─── Badges ───────────────────────────────────────────────────────────────
// value(ctx) = où en est l'user · goal = cible · fmt(v, goal, ctx) = affichage de l'avancement
// fn = FONCTION de l'app : "tri" | "album" | "labo" ("all" = Légende, le sommet). Posé plus bas pour les 24 anciens badges.
// Badges du Labo : step = marche (decouvrir → commander → fidelite) · tag = produit · cta = bouton qui ouvre le produit
// (to : prints | book | poster | abo | labo ; l'écran fait la navigation, pas ce fichier).
const GO = 1024; // Mo
const fmtGo = (mo) => `${(mo / GO).toFixed(1).replace(".", ",")}`;
// Avancement des badges sprint : record actuel (rempli par buildContext).
let lastBest20 = null;
const sprintFmt = () => (lastBest20 ? `Record : ${fmtDuration(lastBest20)}` : "Pas encore de sprint");
export const BADGES = [
  { id: "clean-1",  emoji: "🧹", name: "Coup de balai",              desc: "1 Go libéré",  goal: 1 * GO,  value: (c) => c.freedMo, fmt: (v, g) => `${fmtGo(v)} / ${g / GO} Go` },
  { id: "clean-3",  emoji: "🌀", name: "Coup d'aspirateur",          desc: "3 Go libérés", goal: 3 * GO,  value: (c) => c.freedMo, fmt: (v, g) => `${fmtGo(v)} / ${g / GO} Go` },
  { id: "clean-5",  emoji: "🧽", name: "Grand ménage de printemps",  desc: "5 Go libérés", goal: 5 * GO,  value: (c) => c.freedMo, fmt: (v, g) => `${fmtGo(v)} / ${g / GO} Go` },
  { id: "clean-10", emoji: "✨", name: "Nickel chrome",              desc: "10 Go libérés", goal: 10 * GO, value: (c) => c.freedMo, fmt: (v, g) => `${fmtGo(v)} / ${g / GO} Go` },
  { id: "flash",    emoji: "⚡", name: "Éclair",                     desc: "20 photos en moins de 1 min 30 (moyenne d'une journée)", goal: 1, value: (c) => (c.hadFlashDay ? 1 : 0), fmt: () => "< 1 min 30 / 20" },
  { id: "hearts",   emoji: "❤️", name: "Cœur d'or",                  desc: "50 coups de cœur", goal: 50, value: (c) => c.keptCount, fmt: (v, g) => `${v} / ${g}` },
  { id: "album",    emoji: "📕", name: "Premier album",              desc: "1 album créé", goal: 1, value: (c) => c.albumCount, fmt: (v, g) => `${v} / ${g}` },
  { id: "clear",    emoji: "🏁", name: "Galerie nette",              desc: "Toute la photothèque triée au moins une fois", goal: 100, value: (c) => c.sortedPct, fmt: (v) => `${v} %` },

  // Régularité A : jours d'affilée (record de série, joker compris)
  { id: "streak-3",  emoji: "🔥", name: "Étincelle", desc: "3 jours d'affilée",  goal: 3,  value: (c) => c.bestStreak, fmt: (v, g) => `${v} / ${g} j` },
  { id: "streak-7",  emoji: "🕯️", name: "Flamme",    desc: "7 jours d'affilée",  goal: 7,  value: (c) => c.bestStreak, fmt: (v, g) => `${v} / ${g} j` },
  { id: "streak-30", emoji: "🌋", name: "Volcan",    desc: "30 jours d'affilée", goal: 30, value: (c) => c.bestStreak, fmt: (v, g) => `${v} / ${g} j` },

  // Régularité B : journées validées au total (même non consécutives)
  { id: "days-10",  emoji: "📅", name: "Habitué", desc: "10 journées validées",  goal: 10,  value: (c) => c.validatedDays, fmt: (v, g) => `${v} / ${g}` },
  { id: "days-30",  emoji: "🗓️", name: "Assidu",  desc: "30 journées validées",  goal: 30,  value: (c) => c.validatedDays, fmt: (v, g) => `${v} / ${g}` },
  { id: "days-100", emoji: "🏅", name: "Fidèle",  desc: "100 journées validées", goal: 100, value: (c) => c.validatedDays, fmt: (v, g) => `${v} / ${g}` },

  // ── Ajoutés le 31 oct. 2026 ──
  // Intensité : photos triées en une seule journée
  { id: "day-100", emoji: "💯", name: "Centurion",   desc: "100 photos triées en une journée", goal: 100, value: (c) => c.bestDay, fmt: (v, g) => `${Math.min(v, g)} / ${g}` },
  { id: "day-300", emoji: "🏃", name: "Marathonien", desc: "300 photos triées en une journée", goal: 300, value: (c) => c.bestDay, fmt: (v, g) => `${Math.min(v, g)} / ${g}` },
  { id: "turbo",   emoji: "🚀", name: "Turbo",       desc: "20 photos en moins de 1 min (moyenne d'une journée)", goal: 1, value: (c) => (c.hadTurboDay ? 1 : 0), fmt: () => "< 1 min / 20" },
  // Sprint : 20 swipes d'affilée (record best20Ms, cassé par pause > 60 s, ↩ ou sortie du tri)
  { id: "sprint-90", emoji: "🐆", name: "Guépard",      desc: "20 swipes d'affilée en moins de 1 min 30", goal: 1, value: (c) => (c.best20Ms && c.best20Ms < 90 * 1000 ? 1 : 0), fmt: (v) => sprintFmt(v) },
  { id: "sprint-60", emoji: "🏎️", name: "Bolide",       desc: "20 swipes d'affilée en moins de 1 min",    goal: 1, value: (c) => (c.best20Ms && c.best20Ms < 60 * 1000 ? 1 : 0), fmt: (v) => sprintFmt(v) },
  { id: "sprint-45", emoji: "☄️", name: "Supersonique", desc: "20 swipes d'affilée en moins de 45 s",     goal: 1, value: (c) => (c.best20Ms && c.best20Ms < 45 * 1000 ? 1 : 0), fmt: (v) => sprintFmt(v) },
  // Albums & coups de cœur
  { id: "albums-5",   emoji: "🗂️", name: "Collectionneur",   desc: "5 albums créés", goal: 5, value: (c) => c.albumCount, fmt: (v, g) => `${v} / ${g}` },
  { id: "archive",    emoji: "📚", name: "Archiviste",       desc: "100 photos rangées dans des albums", goal: 100, value: (c) => c.photosInAlbums, fmt: (v, g) => `${v} / ${g}` },
  { id: "hearts-200", emoji: "💘", name: "Grand romantique", desc: "200 coups de cœur", goal: 200, value: (c) => c.keptCount, fmt: (v, g) => `${v} / ${g}` },
  // Ménage
  { id: "purge-1000", emoji: "🗑️", name: "Sans pitié", desc: "1 000 photos supprimées définitivement", goal: 1000, value: (c) => c.purgedCount, fmt: (v, g) => `${v} / ${g}` },
  // Régularité
  { id: "weekend", emoji: "🛋️", name: "Week-end studieux", desc: "Samedi et dimanche validés le même week-end", goal: 1, value: (c) => (c.hadStudiousWeekend ? 1 : 0), fmt: () => "sam. + dim." },
  // Aléatoire
  { id: "shuffle-10", emoji: "🎲", name: "Joueur", desc: "10 tris aléatoires lancés", goal: 10, value: (c) => c.shuffleLaunches, fmt: (v, g) => `${v} / ${g}` },

  // ── Badges du LABO (14 nov. 2026) : accompagnent l'user jusqu'à la commande ──
  // DÉCOUVRIR : l'envie, sans payer
  { id: "lab-ready",  fn: "labo", step: "decouvrir", tag: "TIRAGES", emoji: "🎞️", name: "Prêt à développer", desc: "20 coups de cœur à imprimer (un lot complet de tirages)",
    goal: 20, value: (c) => c.keptToPrint, fmt: (v, g) => `${Math.min(v, g)} / ${g}`, cta: { label: "Choisir mes 20 tirages", to: "prints" } },
  { id: "lab-book-start", fn: "labo", step: "decouvrir", tag: "LIVRE", emoji: "✍️", name: "Page blanche", desc: "Commencer un livre photo",
    goal: 1, value: (c) => c.booksStarted, fmt: (v, g) => `${Math.min(v, g)} / ${g}`, cta: { label: "Créer un livre", to: "labo" } },
  { id: "lab-book-full", fn: "labo", step: "decouvrir", tag: "LIVRE", emoji: "📖", name: "Chef-d'œuvre", desc: "Remplir toutes les pages d'un livre",
    goal: 1, value: (c) => (c.bookFill.total ? c.bookFill.filled / c.bookFill.total : 0), fmt: (v, g, c) => (c.bookFill.total ? `${c.bookFill.filled} / ${c.bookFill.total} p.` : "Pas encore de livre"), cta: { label: "Continuer mon livre", to: "labo" } },
  { id: "lab-collage", fn: "labo", step: "decouvrir", tag: "POSTER", emoji: "🧩", name: "Pêle-mêle", desc: "Composer un poster de 6 photos ou plus",
    goal: 6, value: (c) => c.collageMax, fmt: (v, g) => `${Math.min(v, g)} / ${g}`, cta: { label: "Composer un poster", to: "poster" } },
  { id: "lab-ar", fn: "labo", step: "decouvrir", tag: "POSTER", emoji: "🛋️", name: "Œil de décorateur", desc: "Voir un poster chez toi en réalité augmentée",
    goal: 1, value: (c) => (c.arTried ? 1 : 0), fmt: () => "à essayer", cta: { label: "Essayer avec un poster", to: "poster" } },
  // COMMANDER : le premier passage à l'acte (orders = commandes réelles, 0 tant que le suivi des commandes n'est pas branché)
  { id: "lab-first-print", fn: "labo", step: "commander", tag: "TIRAGES", emoji: "🖼️", name: "Première épreuve", desc: "Recevoir ton premier tirage",
    goal: 1, value: (c) => (c.orders.prints > 0 ? 1 : 0), fmt: (v, g) => `${v} / ${g}`, cta: { label: "Choisir mes 20 tirages", to: "prints" } },
  { id: "lab-sub", fn: "labo", step: "commander", tag: "ABONNEMENT", emoji: "📬", name: "Abonné", desc: "Démarrer l'abonnement Coups de cœur",
    goal: 1, value: (c) => c.subCount, fmt: (v, g) => `${Math.min(v, g)} / ${g}`, cta: { label: "Découvrir l'abonnement", to: "abo" } },
  { id: "lab-gift", fn: "labo", step: "commander", tag: "CADEAU", emoji: "💌", name: "Facteur de bonheur", desc: "Envoyer des tirages à un proche",
    goal: 1, value: (c) => (c.hasGiftSub ? 1 : 0), fmt: (v, g) => `${v} / ${g}`, cta: { label: "Offrir un abonnement", to: "abo" } },
  { id: "lab-book-order", fn: "labo", step: "commander", tag: "LIVRE", emoji: "📚", name: "Auteur", desc: "Commander ton premier livre photo",
    goal: 1, value: (c) => (c.orders.book > 0 ? 1 : 0), fmt: (v, g) => `${v} / ${g}`, cta: { label: "Voir mes livres", to: "labo" } },
  { id: "lab-poster-order", fn: "labo", step: "commander", tag: "POSTER", emoji: "🪟", name: "Mur habillé", desc: "Commander ton premier poster",
    goal: 1, value: (c) => (c.orders.poster > 0 ? 1 : 0), fmt: (v, g) => `${v} / ${g}`, cta: { label: "Créer un poster", to: "poster" } },
  // FIDÉLITÉ : on revient
  { id: "lab-ritual-3",  fn: "labo", step: "fidelite", tag: "ABONNEMENT", emoji: "🗓️", name: "Rituel du mois",       desc: "3 mois d'envoi d'affilée",  goal: 3,  value: (c) => c.bestMonthRun, fmt: (v, g) => `${Math.min(v, g)} / ${g} mois`, cta: { label: "Voir mon abonnement", to: "abo" } },
  { id: "lab-ritual-6",  fn: "labo", step: "fidelite", tag: "ABONNEMENT", emoji: "📆", name: "Habitude",             desc: "6 mois d'envoi d'affilée",  goal: 6,  value: (c) => c.bestMonthRun, fmt: (v, g) => `${Math.min(v, g)} / ${g} mois` },
  { id: "lab-ritual-12", fn: "labo", step: "fidelite", tag: "ABONNEMENT", emoji: "🎉", name: "Un an de souvenirs",   desc: "12 mois d'envoi d'affilée", goal: 12, value: (c) => c.bestMonthRun, fmt: (v, g) => `${Math.min(v, g)} / ${g} mois` },
  { id: "lab-hundred", fn: "labo", step: "fidelite", tag: "TIRAGES", emoji: "🎴", name: "Cent tirages", desc: "100 photos imprimées",
    goal: 100, value: (c) => c.printedCount, fmt: (v, g) => `${Math.min(v, g)} / ${g}`, cta: { label: "Choisir mes tirages", to: "prints" } },
  { id: "lab-all3", fn: "labo", step: "fidelite", tag: "3 PRODUITS", emoji: "🎨", name: "Touche-à-tout", desc: "Un tirage, un livre et un poster commandés",
    goal: 3, value: (c) => c.productsOrdered, fmt: (v, g) => `${v} / ${g}` },
  { id: "lab-master", fn: "labo", step: "fidelite", tag: "LABO", emoji: "🔴", name: "Maître du labo", desc: "Tous les autres badges du Labo",
    goal: 17, value: (c) => c.laboWon, fmt: (v, g) => `${v} / ${g}` },

  // Le dernier : tous les badges Tri + Album (les badges du Labo n'en font pas partie : il ne faut pas payer pour l'obtenir)
  { id: "legend", fn: "all", emoji: "🏆", name: "Légende", desc: "Tous les badges Tri et Album obtenus", goal: 23, value: (c) => c.badgesWon, fmt: (v, g) => `${v} / ${g}` },
];

// Fonction des 24 badges d'avant le Labo. Cœur d'or et Grand romantique alimentent les tirages : ils passent dans le Labo.
const ALBUM_IDS = new Set(["album", "albums-5", "archive"]);
const HEARTS_IDS = new Set(["hearts", "hearts-200"]);
BADGES.forEach((b) => {
  if (b.fn) return;
  b.fn = ALBUM_IDS.has(b.id) ? "album" : HEARTS_IDS.has(b.id) ? "labo" : "tri";
  if (HEARTS_IDS.has(b.id)) { b.step = "decouvrir"; b.tag = "TIRAGES"; }
});
// Objectifs des deux badges « tous les autres » (hors eux-mêmes).
const LABO_IDS = BADGES.filter((b) => b.fn === "labo");
BADGES.find((b) => b.id === "lab-master").goal = LABO_IDS.length - 1;
BADGES.find((b) => b.id === "legend").goal = BADGES.filter((b) => b.fn === "tri" || b.fn === "album").length;

export const FUNCTIONS = ["tri", "album", "labo"];
export const LABO_STEPS = [
  { key: "decouvrir", label: "DÉCOUVRIR" },
  { key: "commander", label: "COMMANDER" },
  { key: "fidelite",  label: "FIDÉLITÉ" },
];
// Badges d'une fonction, dans l'ordre d'affichage (Labo : marche par marche).
export function badgesOf(fn) {
  const list = BADGES.filter((b) => b.fn === fn);
  if (fn !== "labo") return list;
  const rank = (b) => LABO_STEPS.findIndex((s) => s.key === b.step);
  return [...list].sort((a, b) => rank(a) - rank(b)); // tri stable : l'ordre d'écriture est gardé dans une marche
}

// ─── Contexte : toutes les mesures utiles, lues depuis l'état du store ────
const FLASH_MIN_SAMPLES = 20;   // au moins 20 décisions chronométrées dans la journée
const FLASH_MAX_MS_PER_20 = 90 * 1000; // Éclair : 1 min 30 en moyenne sur la journée

// Mois d'envoi validés d'affilée (le plus long enchaînement, tous abonnements confondus).
function bestMonthRun(selections = {}) {
  let best = 0;
  Object.values(selections).forEach((byMonth) => {
    const months = Object.entries(byMonth || {}).filter(([, sel]) => sel?.status === "validated").map(([k]) => k).sort();
    let run = 0, prev = null;
    months.forEach((k) => { run = prev && nextMonthKey(prev) === k ? run + 1 : 1; prev = k; best = Math.max(best, run); });
  });
  return best;
}
// Le livre le plus avancé : pages dont TOUS les cadres ont une photo (la moitié droite d'une double page ne compte pas).
function bestBookFill(books = {}) {
  let best = { filled: 0, total: 0 };
  Object.values(books).forEach((b) => {
    const own = (b?.pages || []).filter((p) => p?.double !== "right");
    if (!own.length) return;
    const filled = own.filter((p) => p.slots?.length && p.slots.every(Boolean)).length;
    if (!best.total || filled / own.length > best.filled / best.total) best = { filled, total: own.length };
  });
  return best;
}

// `extra` = ce qui vient du store des abonnements (par défaut : son état actuel).
// `extra.orders` = commandes réelles { prints, book, poster } : à brancher sur la table `orders` (pont imprimeur.fr) ; 0 d'ici là.
export function buildContext(state, extra = useSubscriptionStore.getState()) {
  const log = state.dailyLog || {};
  const days = Object.values(log);
  const sumSorted = days.reduce((a, d) => a + (d.sorted || 0), 0);

  const hadFlashDay = days.some((d) =>
    (d.timedCount || 0) >= FLASH_MIN_SAMPLES && (d.activeMs / d.timedCount) * 20 < FLASH_MAX_MS_PER_20
  );

  const lib = state.libraryPhotos || [];
  const tried = new Set([...(state.kept || []), ...(state.deleted || []), ...(state.printed || []), ...(state.skipped || [])].map((p) => p.id));
  const sortedInLib = lib.filter((p) => tried.has(p.id)).length;
  // Photos supprimées pour de bon (corbeille vidée) : comptées comme triées (même calcul que l'accueil).
  const purged = state.purgedCount || 0;
  const sortedPct = lib.length + purged ? Math.floor(((sortedInLib + purged) / (lib.length + purged)) * 100) : 0;

  // Meilleure journée (photos triées) et journée « turbo » (20 photos en < 25 s).
  const bestDay = days.reduce((m, d) => Math.max(m, d.sorted || 0), 0);
  const hadTurboDay = days.some((d) =>
    (d.timedCount || 0) >= FLASH_MIN_SAMPLES && (d.activeMs / d.timedCount) * 20 < 60 * 1000 // Turbo : 1 min
  );
  // Week-end studieux : un samedi ET le dimanche qui suit validés (≥ STREAK_MIN photos).
  const okDay = (k) => (log[k]?.sorted || 0) >= STREAK_MIN;
  const hadStudiousWeekend = Object.keys(log).some((k) => {
    if (!okDay(k)) return false;
    const [y, m, d] = k.split("-").map(Number);
    const sat = new Date(y, m - 1, d, 12);
    if (sat.getDay() !== 6) return false;
    const sun = new Date(y, m - 1, d + 1, 12);
    const kSun = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, "0")}-${String(sun.getDate()).padStart(2, "0")}`;
    return okDay(kSun);
  });
  const photosInAlbums = new Set((state.albums || []).flatMap((a) => a.photoIds)).size;
  // Badges déjà obtenus : « Légende » compte les badges Tri + Album, « Maître du labo » ceux du Labo (chacun hors lui-même).
  const have = state.achievements || {};
  const badgesWon = BADGES.filter((b) => (b.fn === "tri" || b.fn === "album") && have[b.id]).length;
  const laboWon = BADGES.filter((b) => b.fn === "labo" && b.id !== "lab-master" && have[b.id]).length;

  // Labo : ce qui est déjà parti à l'impression, les abonnements, les livres.
  const subs = extra?.subs || [];
  const printedMap = printedMapOf(extra?.printedPhotos, extra?.selections);
  const orders = { prints: 0, book: 0, poster: 0, ...(extra?.orders || {}) };

  lastBest20 = state.best20Ms || null;

  return {
    best20Ms: state.best20Ms || null,
    bestDay, hadTurboDay, hadStudiousWeekend, photosInAlbums, badgesWon, laboWon, orders,
    printedCount:   Object.keys(printedMap).length,
    keptToPrint:    (state.kept || []).filter((p) => !printedMap[p.id]).length,
    booksStarted:   Object.keys(state.books || {}).length,
    bookFill:       bestBookFill(state.books),
    collageMax:     state.posterCollageMax || 0,
    arTried:        !!state.posterArTried,
    subCount:       subs.length,
    hasGiftSub:     subs.some((x) => x.kind === "gift"),
    bestMonthRun:   bestMonthRun(extra?.selections),
    productsOrdered: ["prints", "book", "poster"].filter((k) => orders[k] > 0).length,
    purgedCount:     state.purgedCount || 0,
    shuffleLaunches: state.shuffleLaunchCount || 0,
    totalSorted: state.lifetimeSorted ?? sumSorted,
    freedMo:     state.freedMo || 0,
    keptCount:   (state.kept || []).length,
    albumCount:  (state.albums || []).length,
    hadFlashDay,
    bestStreak:    computeStreak(log).best,
    validatedDays: days.filter((d) => (d.sorted || 0) >= STREAK_MIN).length,
    sortedPct:   lib.length && sortedInLib === lib.length ? 100 : Math.min(99, sortedPct),
  };
}

// Liste des ids (galons + badges) atteints avec le contexte actuel.
export function reachedIds(ctx) {
  const ids = RANKS.filter((r) => ctx.totalSorted >= r.min).map((r) => r.id);
  BADGES.forEach((b) => { if (b.value(ctx) >= b.goal) ids.push(b.id); });
  return ids;
}
