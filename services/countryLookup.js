// services/countryLookup.js
// « Dans quel pays ce point GPS se trouve-t-il ? » — HORS LIGNE : aucune coordonnée ne quitte le téléphone.
// Source : constants/countries-50m.json (frontières Natural Earth, paquet npm « world-atlas », ISC / domaine public).
// Fichier au format TopoJSON : les arcs sont stockés en différences, on les décode une fois, au premier appel.
//
// Fonctions pures + un cache en mémoire (une case de ~2 km → un pays). Aucune I/O.
import { COUNTRY_NAMES } from "../constants/countryNames";

let SHAPES = null; // [{ placeId, bbox:[minLon,minLat,maxLon,maxLat], rings:[ [ [lon,lat]… ], … ] }]  (1er anneau = contour, les autres = trous)

/** Identifiant stable d'un lieu = son nom affiché, sans accent ni majuscule (« maroc »). */
export function placeIdOf(displayName) {
  return String(displayName).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function load() {
  if (SHAPES) return SHAPES;
  const topo = require("../constants/countries-50m.json");
  const { scale, translate } = topo.transform;

  // 1) arcs : suites de points en différences → coordonnées réelles
  const arcs = topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx; y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
  // 2) un anneau = une suite d'arcs (un nombre négatif = arc pris à l'envers)
  const ring = (idxs) => {
    const pts = [];
    for (const i of idxs) {
      const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse();
      for (let k = pts.length ? 1 : 0; k < a.length; k++) pts.push(a[k]);
    }
    return pts;
  };
  const bboxOf = (r) => {
    let a = 180, b = 90, c = -180, d = -90;
    for (const [x, y] of r) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
    return [a, b, c, d];
  };

  const shapes = [];
  for (const g of topo.objects.countries.geometries) {
    const names = COUNTRY_NAMES[g.properties?.name];
    if (!names) continue; // petit territoire sans nom français : ignoré
    const placeId = placeIdOf(names[0]);
    const polys = g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : [];
    for (const p of polys) {
      const rings = p.map(ring);
      shapes.push({ placeId, bbox: bboxOf(rings[0]), rings });
    }
  }
  SHAPES = shapes;
  return shapes;
}

// Point dans un anneau (méthode du rayon).
function inRing(lon, lat, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Distance (km, approximative) d'un point à un segment — suffisante pour « le rivage est à moins de 25 km ».
function distToSegKm(lon, lat, a, b) {
  const k = Math.cos((lat * Math.PI) / 180);
  const px = lon * k, py = lat;
  const ax = a[0] * k, ay = a[1], bx = b[0] * k, by = b[1];
  const dx = bx - ax, dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) * 111.2;
}

const COAST_KM = 25; // une photo juste en mer (plage, bateau, trait de côte simplifié) est rattachée au pays le plus proche

function compute(lat, lng) {
  const shapes = load();
  for (const s of shapes) {
    const [a, b, c, d] = s.bbox;
    if (lng < a || lng > c || lat < b || lat > d) continue;
    if (!inRing(lng, lat, s.rings[0])) continue;
    if (s.rings.slice(1).some((h) => inRing(lng, lat, h))) continue; // dans un trou (enclave)
    return s.placeId;
  }
  // Hors de toute terre : le pays le plus proche, s'il est à moins de COAST_KM.
  const pad = COAST_KM / 111 + 0.1;
  let best = null, bestKm = COAST_KM;
  for (const s of shapes) {
    const [a, b, c, d] = s.bbox;
    if (lng < a - pad || lng > c + pad || lat < b - pad || lat > d + pad) continue;
    const r = s.rings[0];
    for (let i = 1; i < r.length; i++) {
      const km = distToSegKm(lng, lat, r[i - 1], r[i]);
      if (km < bestKm) { bestKm = km; best = s.placeId; }
    }
  }
  return best;
}

const memo = new Map();

/** Identifiant du pays (« maroc ») où se trouve ce point, ou null (haute mer, territoire non listé). */
export function countryAt(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const key = `${Math.round(lat * 50)}_${Math.round(lng * 50)}`; // cases de 0,02° ≈ 2 km
  if (memo.has(key)) return memo.get(key);
  const v = compute(Math.round(lat * 50) / 50, Math.round(lng * 50) / 50);
  memo.set(key, v);
  return v;
}

/** Liste des lieux cherchables : [{ id, fr, words[] }] (un lieu par nom affiché). */
export function listPlaces() {
  const byId = new Map();
  for (const names of Object.values(COUNTRY_NAMES)) {
    const id = placeIdOf(names[0]);
    const p = byId.get(id) ?? { id, fr: names[0], words: [] };
    for (const n of names) if (!p.words.includes(n)) p.words.push(n);
    byId.set(id, p);
  }
  return [...byId.values()];
}
