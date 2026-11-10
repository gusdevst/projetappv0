// services/cityLookup.js
// Villes pour la recherche (« Marrakech », « Londres ») — HORS LIGNE, comme les pays (services/countryLookup.js).
// Source : constants/cities.json = GeoNames (CC BY 4.0), villes de plus de 30 000 habitants, fabriqué par
// scripts/build-cities.mjs. Noms français : constants/cityNames.js.
//
// Une photo est rattachée à TOUTES les villes dont elle est « proche » : à moins d'un rayon qui grandit avec la
// population (30 000 hab. ≈ 9 km, 300 000 ≈ 20 km, 3 millions ≈ 31 km, plafond 40 km). Une photo prise à Versailles
// compte donc pour « Versailles » ET pour « Paris ». Hors de tout rayon : pas de ville (mais elle garde son pays).
//
// Fonctions pures + cache mémoire (une case de ~2 km → ses villes). Aucune I/O.
import { CITY_NAMES } from "../constants/cityNames";
import { placeIdOf } from "./countryLookup";

let CITIES = null; // [{ name, fr, id, lat, lng, r }]
let GRID = null;   // Map « case de 1° » → indices dans CITIES

const radiusKm = (pop) => Math.min(40, 9 + 11 * Math.log10(pop / 30000));
const cellKey = (la, lo) => `${la}_${lo}`;

function load() {
  if (CITIES) return CITIES;
  const raw = require("../constants/cities.json");
  CITIES = raw.rows.map(([name, lat, lng, popK]) => {
    const fr = CITY_NAMES[name]?.[0] ?? name;
    return { name, fr, id: `v:${placeIdOf(fr)}`, lat, lng, r: radiusKm(popK * 1000) };
  });
  GRID = new Map();
  CITIES.forEach((c, i) => {
    const k = cellKey(Math.floor(c.lat), Math.floor(c.lng));
    const l = GRID.get(k);
    if (l) l.push(i); else GRID.set(k, [i]);
  });
  return CITIES;
}

/**
 * Les villes cherchables : [{ id: "v:marrakech", kind: "city", fr: "Marrakech", words: [...] }].
 * Les villes de même nom (Valencia en Espagne et au Venezuela) forment UN seul lieu : on cherche autour de chacune.
 * Triées de la plus peuplée à la moins peuplée (pour que, sur un mot commun, la plus grande l'emporte).
 */
export function listCityPlaces() {
  const cities = load();
  const byId = new Map();
  for (const c of cities) {
    let p = byId.get(c.id);
    if (!p) { p = { id: c.id, kind: "city", fr: c.fr, words: [] }; byId.set(c.id, p); }
    for (const w of CITY_NAMES[c.name] ?? [c.name]) if (!p.words.includes(w)) p.words.push(w);
    if (!p.words.includes(c.name)) p.words.push(c.name);
  }
  return [...byId.values()];
}

/** Identifiants (« v:marrakech ») de toutes les villes proches de ce point. */
const memo = new Map();
export function cityKeysAt(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const key = `${Math.round(lat * 50)}_${Math.round(lng * 50)}`; // cases de 0,02° ≈ 2 km
  const hit = memo.get(key);
  if (hit) return hit;
  const cities = load();
  const la = Math.round(lat * 50) / 50, lo = Math.round(lng * 50) / 50;
  const k = Math.cos((la * Math.PI) / 180);
  const out = [];
  const cla = Math.floor(la), clo = Math.floor(lo);
  for (let dla = -1; dla <= 1; dla++) {
    for (let dlo = -2; dlo <= 2; dlo++) {
      const list = GRID.get(cellKey(cla + dla, clo + dlo));
      if (!list) continue;
      for (const i of list) {
        const c = cities[i];
        const km = Math.hypot((c.lng - lo) * k, c.lat - la) * 111.2;
        if (km <= c.r && !out.includes(c.id)) out.push(c.id);
      }
    }
  }
  memo.set(key, out);
  return out;
}
