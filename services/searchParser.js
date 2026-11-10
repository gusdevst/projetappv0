// Lecture d'une phrase de recherche en français : « l'été 2026 à la plage », « chiens et chats »,
// « Noël dernier ». Fonctions pures, sans I/O (on peut les tester seules).
//
// Résultat de parseQuery :
//   {
//     concepts:    idées de contenu comprises (voir constants/searchVocabulary.js),
//     mode:        "or" (par défaut : plusieurs sujets = l'un OU l'autre) — la feuille de recherche peut le passer à "and",
//     places:      pays compris (« Maroc », « au Japon »), [{ id, fr, words }] — FILTRE comme la période : plusieurs pays = l'un OU l'autre,
//                  et le tout se combine avec la période et les sujets en ET (voir services/countryLookup.js),
//     period:      { label, parts } ou null (voir matchPeriod) = le FILTRE de date (année, « été 2026 », « Noël dernier »…),
//     seasons:     saisons / mois cités À PART dans une phrase qui a déjà une année (« 2026, voyage, été ») :
//                  ils se comptent comme des sujets (l'un OU l'autre) à l'intérieur de la période. [{ id, fr, part }]
//     unknown:     mots qu'on n'a pas compris,
//     suggestions: idées proches des mots inconnus (pour proposer « Tu voulais dire… ? »),
//   }
import { CONCEPTS, STOPWORDS } from "../constants/searchVocabulary";
import { listPlaces } from "./countryLookup";
import { listCityPlaces } from "./cityLookup";

// ── Texte : minuscules, sans accents, sans ponctuation ─────────────────────
export function normFr(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe").replace(/æ/g, "ae")
    .replace(/['’`´\-_]/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Index des mots du dictionnaire ─────────────────────────────────────────
let INDEX = null;     // Map « mot normalisé » → idée
let PLACE_INDEX = null; // Map « mot normalisé » → pays {id, fr, words}
let MAX_GRAM = 1;     // plus longue expression du dictionnaire (en mots)

function buildIndex() {
  const map = new Map();
  let max = 1;
  for (const c of CONCEPTS) {
    for (const w of c.words) {
      const k = normFr(w);
      if (!k) continue;
      if (!map.has(k)) map.set(k, c); // en cas de doublon, la 1re idée du fichier gagne
      max = Math.max(max, k.split(" ").length);
    }
  }
  const pmap = new Map();
  for (const pl of listPlaces()) {
    for (const w of pl.words) {
      const k = normFr(w);
      if (!k) continue;
      if (!pmap.has(k)) pmap.set(k, pl);
      max = Math.max(max, k.split(" ").length);
    }
  }
  // Villes (GeoNames, > 30 000 hab.) : APRÈS les pays et les idées du dictionnaire, qui gagnent toujours
  // (un mot déjà pris, un mot-outil, un mois, une année ne devient jamais une ville). Les plus peuplées d'abord.
  // Mots de tous les jours qui sont aussi des villes (Orange, Salé) : on préfère ne pas les prendre pour un lieu.
  const COMMON_WORDS = new Set(["orange", "sale"]);
  const reserved = (k) => COMMON_WORDS.has(k) || map.has(k) || STOPWORDS.has(k) || MONTHS[k] || SEASONS[k] || ISYEAR(k) || k === "noel"
    || k === "ou" || k === "et" || k === "ci" || k === "annee" || k === "mois" || THIS_WORDS.has(k) || LAST_WORDS.has(k);
  for (const pl of listCityPlaces()) {
    for (const w of pl.words) {
      const k = normFr(w);
      if (k.length < 3 || pmap.has(k) || reserved(k)) continue;
      pmap.set(k, pl);
      max = Math.max(max, k.split(" ").length);
    }
  }
  INDEX = map;
  PLACE_INDEX = pmap;
  MAX_GRAM = max;
}

/** [DEV/test] Mots présents dans deux idées différentes (le 2ᵉ est ignoré). */
export function duplicateWords() {
  const seen = new Map();
  const dups = [];
  for (const c of CONCEPTS) {
    for (const w of c.words) {
      const k = normFr(w);
      if (seen.has(k) && seen.get(k) !== c.id) dups.push(`${k} (${seen.get(k)} / ${c.id})`);
      else seen.set(k, c.id);
    }
  }
  return dups;
}

// Mot ou expression → idée. On essaie aussi sans « s » / « x » final (pluriels).
function lookup(phrase) {
  return INDEX.get(phrase) || INDEX.get(phrase.replace(/(s|x)$/, "")) || null;
}
// Idem pour les pays (« etats unis » tel quel ; pas de pluriel à retirer : « mali » ne doit pas devenir « mal »).
function lookupPlace(phrase) {
  return PLACE_INDEX.get(phrase) || null;
}

// ── Périodes ───────────────────────────────────────────────────────────────
const MONTHS = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};
const MONTH_LABELS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
// « été » = juillet et août (décision d'Augustin, 8 nov.). Les autres saisons : mois entiers.
const SEASONS = {
  ete: { label: "été", months: [7, 8] },
  printemps: { label: "printemps", months: [3, 4, 5] },
  automne: { label: "automne", months: [9, 10, 11] },
  hiver: { label: "hiver", months: [12, 1, 2], winter: true }, // « hiver 2026 » = déc. 2025 → fév. 2026
};
const NOEL = { label: "Noël", months: [12], dayFrom: 20, dayTo: 26 };

const LAST_WORDS = new Set(["dernier", "derniere", "passe", "passee"]);
const THIS_WORDS = new Set(["cet", "cette", "ce"]);

const startOf = (y, m, d = 1) => new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
const endOfMonth = (y, m) => new Date(y, m, 0, 23, 59, 59, 999).getTime();

/** Une saison / un mois / Noël pour une année donnée → { from, to } (millisecondes). */
function rangeFor(def, year) {
  if (def === NOEL) return { from: startOf(year, 12, 20), to: new Date(year, 11, 26, 23, 59, 59, 999).getTime() };
  if (def.winter) return { from: startOf(year - 1, 12), to: endOfMonth(year, 2) };
  const ms = def.months;
  return { from: startOf(year, ms[0]), to: endOfMonth(year, ms[ms.length - 1]) };
}

/**
 * « cet été » (rel = 0) : l'occurrence la plus récente DÉJÀ COMMENCÉE (en cours ou passée).
 * « l'été dernier » (rel = −1) : la plus récente DÉJÀ TERMINÉE.
 * (En novembre 2026, les deux donnent l'été 2026 ; en août 2026, « cet été » = 2026 et « dernier » = 2025.)
 */
function occurrence(def, rel, now) {
  const y0 = now.getFullYear() + 1;
  for (let y = y0; y > y0 - 8; y--) {
    const r = rangeFor(def, y);
    if (rel === 0 ? r.from <= now.getTime() : r.to < now.getTime()) return r;
  }
  return rangeFor(def, now.getFullYear() + rel);
}

const fmtYear = (y) => String(y);

function partFor(def, label, { year, rel }, now) {
  if (year != null) return { label: `${label} ${fmtYear(year)}`, ranges: [rangeFor(def, year)] };
  if (rel != null) {
    const r = occurrence(def, rel, now);
    const y = new Date(r.to).getFullYear();
    return { label: `${label} ${fmtYear(y)}`, ranges: [r] };
  }
  // ni année ni « dernier » : toutes les années
  return { label: `chaque ${label}`, recurring: { months: def.months, dayFrom: def.dayFrom, dayTo: def.dayTo } };
}

/** La date (millisecondes) est-elle dans la période ? */
export function matchPeriod(period, ms) {
  if (!period) return true;
  if (!Number.isFinite(ms) || ms <= 0) return false;
  return period.parts.some((p) => {
    if (p.ranges) return p.ranges.some((r) => ms >= r.from && ms <= r.to);
    if (p.recurring) {
      const d = new Date(ms);
      if (!p.recurring.months.includes(d.getMonth() + 1)) return false;
      if (p.recurring.dayFrom != null) return d.getDate() >= p.recurring.dayFrom && d.getDate() <= p.recurring.dayTo;
      return true;
    }
    return false;
  });
}

// ── Analyse de la phrase ───────────────────────────────────────────────────
const ISYEAR = (t) => /^(19|20)\d{2}$/.test(t);

/**
 * @param text  ce que l'utilisateur a tapé
 * @param now   Date (injectable pour les tests)
 */
export function parseQuery(text, now = new Date()) {
  if (!INDEX) buildIndex();
  // La phrase est découpée aux virgules / points-virgules : une saison n'est rattachée à une année
  // que si les deux sont dans le même morceau (« l'été 2026, la plage » ≠ « 2026, voyage, été »).
  const tokens = [];
  const seg = []; // numéro de morceau de chaque mot
  String(text ?? "").split(/[,;\n]+/).forEach((chunk, k) => {
    for (const t of normFr(chunk).split(" ")) if (t) { tokens.push(t); seg.push(k); }
  });
  const sameSeg = (a, b) => seg[a] === seg[b];
  const used = new Array(tokens.length).fill(false);

  // 1) Contenu : mots / expressions du dictionnaire (les plus longues d'abord) + pays.
  const concepts = [];
  const places = [];
  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue;
    for (let n = Math.min(MAX_GRAM, tokens.length - i); n >= 1; n--) {
      if (!sameSeg(i, i + n - 1)) continue;
      const phrase = tokens.slice(i, i + n).join(" ");
      const c = lookup(phrase);
      const pl = c ? null : lookupPlace(phrase);
      // un mot-outil seul (« de », « la ») ne compte jamais comme contenu
      if ((c || pl) && !(n === 1 && STOPWORDS.has(tokens[i]))) {
        if (c && !concepts.includes(c)) concepts.push(c);
        if (pl && !places.includes(pl)) places.push(pl);
        for (let k = i; k < i + n; k++) used[k] = true;
        i += n - 1;
        break;
      }
    }
  }

  // 2) Période : saisons, mois, Noël, années, « cet été », « l'été dernier »…
  const parts = [];
  const periodLabels = [];
  const recurring = []; // saisons / mois sans année : on décidera plus bas s'ils sont une période ou un sujet
  const usedAsPeriod = new Set();
  const yearNear = (i) => {
    for (let d = 1; d <= 3; d++) {
      for (const j of [i + d, i - d]) {
        if (j >= 0 && j < tokens.length && !used[j] && sameSeg(i, j) && ISYEAR(tokens[j])) return { year: Number(tokens[j]), at: j };
      }
    }
    return null;
  };
  const relNear = (i) => {
    for (const j of [i - 1, i - 2]) if (j >= 0 && sameSeg(i, j) && THIS_WORDS.has(tokens[j]) && !used[j]) return { rel: 0, at: j };
    for (const j of [i + 1, i + 2]) if (j < tokens.length && sameSeg(i, j) && LAST_WORDS.has(tokens[j]) && !used[j]) return { rel: -1, at: j };
    return null;
  };
  const yearsUsed = new Set();

  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue;
    const t = tokens[i];
    let def = null;
    let label = null;
    if (SEASONS[t]) { def = SEASONS[t]; label = SEASONS[t].label; }
    else if (MONTHS[t]) { def = { months: [MONTHS[t]] }; label = MONTH_LABELS[MONTHS[t] - 1]; }
    else if (t === "noel") { def = NOEL; label = "Noël"; }
    if (!def) continue;
    const y = yearNear(i);
    const r = y ? null : relNear(i);
    const part = partFor(def, label, { year: y ? y.year : null, rel: r ? r.rel : null }, now);
    if (part.recurring) recurring.push({ label, part });
    else { parts.push(part); periodLabels.push(part.label); }
    used[i] = true;
    if (y) yearsUsed.add(y.at);
    if (r) usedAsPeriod.add(r.at);
  }
  for (const j of yearsUsed) used[j] = true;
  for (const j of usedAsPeriod) used[j] = true;

  // « cette année », « année dernière », « ce mois-ci », « le mois dernier »
  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue;
    if (tokens[i] === "annee" || tokens[i] === "mois") {
      const r = relNear(i);
      if (!r) continue;
      if (tokens[i] === "annee") {
        const y = now.getFullYear() + r.rel;
        parts.push({ label: String(y), ranges: [{ from: startOf(y, 1), to: endOfMonth(y, 12) }] });
        periodLabels.push(r.rel === 0 ? "cette année" : "l'année dernière");
      } else {
        const d = new Date(now.getFullYear(), now.getMonth() + r.rel, 1);
        parts.push({ label: "mois", ranges: [{ from: startOf(d.getFullYear(), d.getMonth() + 1), to: endOfMonth(d.getFullYear(), d.getMonth() + 1) }] });
        periodLabels.push(r.rel === 0 ? "ce mois-ci" : "le mois dernier");
      }
      used[i] = true;
      used[r.at] = true;
      // « ce mois-ci » : le « ci » qui suit est un mot-outil
      if (tokens[i + 1] === "ci") used[i + 1] = true;
    }
  }

  // 3) Une année seule (« 2026 ») : toute l'année.
  for (let i = 0; i < tokens.length; i++) {
    if (!used[i] && ISYEAR(tokens[i])) {
      const y = Number(tokens[i]);
      parts.push({ label: String(y), ranges: [{ from: startOf(y, 1), to: endOfMonth(y, 12) }] });
      periodLabels.push(String(y));
      used[i] = true;
    }
  }

  // Une saison / un mois sans année :
  //  · s'il y a déjà une période (une année…) : c'est un SUJET de plus (« 2026, voyage, été » = photos de 2026
  //    qui sont des voyages OU de l'été) ;
  //  · sinon c'est la période elle-même (« la plage en été » = les étés de toutes les années).
  const seasons = [];
  if (parts.length > 0) {
    for (const r of recurring) seasons.push({ id: `saison-${normFr(r.label).replace(/ /g, "-")}`, fr: r.label.charAt(0).toUpperCase() + r.label.slice(1), part: r.part });
  } else {
    for (const r of recurring) { parts.push(r.part); periodLabels.push(r.part.label); }
  }

  // 4) Mots-outils ignorés ; le reste est inconnu.
  // Plusieurs sujets = « l'un OU l'autre » par défaut (« des paysages, des photos de groupe et d'amis » :
  // on veut l'ensemble). L'utilisateur peut passer à « les deux à la fois » dans la feuille de recherche.
  const mode = "or";
  const unknown = [];
  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue;
    const t = tokens[i];
    if (t === "ou" || t === "et" || t === "ci" || t === "annee" || t === "mois" || STOPWORDS.has(t) || THIS_WORDS.has(t) || LAST_WORDS.has(t)) continue;
    unknown.push(t);
  }

  return {
    concepts,
    places,
    mode,
    seasons,
    period: parts.length ? { label: periodLabels.join(" + "), parts } : null,
    unknown,
    suggestions: suggestFor(unknown),
  };
}

// ── « Tu voulais dire… ? » ─────────────────────────────────────────────────
function lev(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}

function suggestFor(unknown) {
  if (!unknown.length) return [];
  if (!INDEX) buildIndex();
  const out = [];
  for (const u of unknown) {
    if (u.length < 3) continue;
    for (const [word, concept] of [...INDEX, ...PLACE_INDEX]) {
      if (out.includes(concept)) continue;
      // Les villes sont très nombreuses : on ne les propose que pour une faute de frappe (1 lettre), pas pour un début de mot.
      const close = concept.kind === "city"
        ? u.length >= 6 && lev(u, word) <= 1
        : word.startsWith(u) || (u.length >= 4 && u.startsWith(word) && word.length >= 4) || (u.length >= 5 && lev(u, word) <= 2);
      if (close) out.push(concept);
      if (out.length >= 5) return out;
    }
  }
  return out;
}

/** Texte lisible de ce que l'app a compris (pour « J'ai compris »). */
export function describeQuery(parsed) {
  const bits = [];
  if (parsed.places?.length) bits.push(parsed.places.map((p) => p.fr).join(" ou "));
  if (parsed.period) bits.push(parsed.period.label);
  const subjects = [...parsed.concepts.map((c) => c.fr), ...(parsed.seasons ?? []).map((s) => s.fr)];
  if (subjects.length) bits.push(subjects.join(parsed.mode === "or" ? " ou " : " + "));
  return bits.join(" · ");
}
