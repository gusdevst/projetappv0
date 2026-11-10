// Lecture d'une phrase de recherche en français : « l'été 2026 à la plage », « chiens et chats »,
// « Noël dernier ». Fonctions pures, sans I/O (on peut les tester seules).
//
// Résultat de parseQuery :
//   {
//     concepts:    idées de contenu comprises (voir constants/searchVocabulary.js),
//     mode:        "or" (par défaut : plusieurs sujets = l'un OU l'autre) — la feuille de recherche peut le passer à "and",
//     period:      { label, parts } ou null (voir matchPeriod),
//     unknown:     mots qu'on n'a pas compris,
//     suggestions: idées proches des mots inconnus (pour proposer « Tu voulais dire… ? »),
//   }
import { CONCEPTS, STOPWORDS } from "../constants/searchVocabulary";

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
  INDEX = map;
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
  const tokens = normFr(text).split(" ").filter(Boolean);
  const used = new Array(tokens.length).fill(false);

  // 1) Contenu : mots / expressions du dictionnaire (les plus longues d'abord).
  const concepts = [];
  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue;
    for (let n = Math.min(MAX_GRAM, tokens.length - i); n >= 1; n--) {
      const c = lookup(tokens.slice(i, i + n).join(" "));
      // un mot-outil seul (« de », « la ») ne compte jamais comme contenu
      if (c && !(n === 1 && STOPWORDS.has(tokens[i]))) {
        if (!concepts.includes(c)) concepts.push(c);
        for (let k = i; k < i + n; k++) used[k] = true;
        i += n - 1;
        break;
      }
    }
  }

  // 2) Période : saisons, mois, Noël, années, « cet été », « l'été dernier »…
  const parts = [];
  const periodLabels = [];
  const usedAsPeriod = new Set();
  const yearNear = (i) => {
    for (let d = 1; d <= 3; d++) {
      for (const j of [i + d, i - d]) {
        if (j >= 0 && j < tokens.length && !used[j] && ISYEAR(tokens[j])) return { year: Number(tokens[j]), at: j };
      }
    }
    return null;
  };
  const relNear = (i) => {
    for (const j of [i - 1, i - 2]) if (j >= 0 && THIS_WORDS.has(tokens[j]) && !used[j]) return { rel: 0, at: j };
    for (const j of [i + 1, i + 2]) if (j < tokens.length && LAST_WORDS.has(tokens[j]) && !used[j]) return { rel: -1, at: j };
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
    parts.push(part);
    periodLabels.push(part.label);
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
    mode,
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
    for (const [word, concept] of INDEX) {
      if (out.includes(concept)) continue;
      const close = word.startsWith(u) || (u.length >= 4 && u.startsWith(word) && word.length >= 4) || (u.length >= 5 && lev(u, word) <= 2);
      if (close) out.push(concept);
      if (out.length >= 5) return out;
    }
  }
  return out;
}

/** Texte lisible de ce que l'app a compris (pour « J'ai compris »). */
export function describeQuery(parsed) {
  const bits = [];
  if (parsed.period) bits.push(parsed.period.label);
  if (parsed.concepts.length) bits.push(parsed.concepts.map((c) => c.fr).join(parsed.mode === "or" ? " ou " : " + "));
  return bits.join(" · ");
}
