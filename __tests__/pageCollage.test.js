// Tests de services/pageCollage.js : la garantie « les tirages ne se superposent JAMAIS » (CLAUDE.md §27).
// Avant, vérifiée par un script jetable ; maintenant elle est rejouée à chaque `npm test`.
import {
  peleCells, peleWindow, resolvePele, placePrint, cellsToPos, clampPele, PELE_MIN, PELE_MAX, PELE_DEFAULT,
} from "../services/pageCollage";

const EPS = 1e-6;
const overlap = (a, b) => a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;
const inside = (c, W, H) => c.x >= -EPS && c.y >= -EPS && c.x + c.w <= W + EPS && c.y + c.h <= H + EPS;

// Zones réalistes : page A4 portrait, A4 paysage, avec et sans bande de titre (hauteur réduite).
const ZONES = [
  { name: "portrait", W: 180, H: 260 },
  { name: "portrait + titre", W: 180, H: 220 },
  { name: "paysage", W: 260, H: 130 },
  { name: "paysage + titre", W: 260, H: 100 },
];

describe("peleCells : rangement automatique", () => {
  for (const { name, W, H } of ZONES) {
    test(`3 à 9 photos, zone ${name} : aucun chevauchement, rien ne dépasse`, () => {
      for (let n = PELE_MIN; n <= PELE_MAX; n++) {
        const cells = peleCells(n, W, H, W * 0.02);
        expect(cells).toHaveLength(n);
        cells.forEach((c) => expect(inside(c, W, H)).toBe(true));
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(overlap(cells[i], cells[j])).toBe(false);
      }
    });
  }

  test("tous les tirages ont la même taille", () => {
    const cells = peleCells(7, 180, 260, 4);
    cells.forEach((c) => { expect(c.w).toBeCloseTo(cells[0].w); expect(c.h).toBeCloseTo(cells[0].h); });
  });

  test("zone nulle ou négative : n cases vides, pas de plantage", () => {
    const cells = peleCells(4, 0, 0, 5);
    expect(cells).toHaveLength(4);
    expect(cells.every((c) => c.w === 0 && c.h === 0)).toBe(true);
  });
});

describe("clampPele", () => {
  test("borne entre 3 et 9, défaut 6 pour une valeur invalide", () => {
    expect(clampPele(1)).toBe(PELE_MIN);
    expect(clampPele(50)).toBe(PELE_MAX);
    expect(clampPele(4.6)).toBe(5);
    expect(clampPele("abc")).toBe(PELE_DEFAULT);
    expect(clampPele(undefined)).toBe(PELE_DEFAULT);
  });
});

describe("peleWindow : zone de la photo dans un tirage", () => {
  test("bords blancs : côtés / haut 6 %, bas 20 % de la largeur", () => {
    const w = peleWindow({ w: 100, h: 120 });
    expect(w).toEqual({ x: 6, y: 6, w: 88, h: 120 - 6 - 20 });
  });
  test("mini = tout le tirage", () => {
    expect(peleWindow({ w: 50, h: 60 }, true)).toEqual({ x: 0, y: 0, w: 50, h: 60 });
  });
});

describe("resolvePele : positions choisies à la main", () => {
  const W = 180, H = 260;
  const auto = peleCells(4, W, H, 4);

  test("pas de positions → rangement automatique", () => {
    expect(resolvePele(auto, null, W, H)).toBe(auto);
  });

  test("positions complètes et valides → utilisées", () => {
    const pos = cellsToPos(auto, W);
    const out = resolvePele(auto, pos, W, H);
    out.forEach((c, i) => { expect(c.x).toBeCloseTo(auto[i].x); expect(c.y).toBeCloseTo(auto[i].y); });
  });

  test("une position manquante → retour au rangement automatique", () => {
    const pos = cellsToPos(auto, W);
    delete pos[2];
    expect(resolvePele(auto, pos, W, H)).toBe(auto);
  });

  test("deux tirages au même endroit → retour au rangement automatique (garantie « jamais superposés »)", () => {
    const pos = cellsToPos(auto, W);
    pos[1] = { ...pos[0] };
    expect(resolvePele(auto, pos, W, H)).toBe(auto);
  });

  test("position non numérique → rangement automatique", () => {
    const pos = cellsToPos(auto, W);
    pos[0] = { x: NaN, y: 0 };
    expect(resolvePele(auto, pos, W, H)).toBe(auto);
  });
});

describe("placePrint : déplacer un tirage sans en recouvrir un autre", () => {
  // Générateur pseudo-aléatoire fixe (mulberry32) : le test reste reproductible.
  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (const { name, W, H } of ZONES) {
    test(`1 500 déplacements au hasard, zone ${name} : 0 chevauchement, 0 sortie`, () => {
      const rand = rng(42);
      const gap = W * 0.02;
      for (let round = 0; round < 25; round++) {
        const n = PELE_MIN + Math.floor(rand() * (PELE_MAX - PELE_MIN + 1));
        let cells = peleCells(n, W, H, gap);
        for (let step = 0; step < 60; step++) {
          const i = Math.floor(rand() * n);
          const p = placePrint(cells, i, (rand() * 1.4 - 0.2) * W, (rand() * 1.4 - 0.2) * H, W, H, gap);
          cells = cells.map((c, j) => (j === i ? { ...c, x: p.x, y: p.y } : c));
          cells.forEach((c) => expect(inside(c, W, H)).toBe(true));
          for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) expect(overlap(cells[a], cells[b])).toBe(false);
        }
      }
    });
  }

  test("déplacer un tirage vers un espace libre le met pile là", () => {
    const W = 200, H = 300;
    const cells = [{ x: 0, y: 0, w: 50, h: 60 }, { x: 100, y: 0, w: 50, h: 60 }];
    expect(placePrint(cells, 0, 30, 200, W, H, 0)).toEqual({ x: 30, y: 200 });
  });

  test("viser sur un autre tirage : ça glisse à côté, sans le recouvrir", () => {
    const W = 200, H = 300;
    const cells = [{ x: 0, y: 0, w: 50, h: 60 }, { x: 100, y: 100, w: 50, h: 60 }];
    const p = placePrint(cells, 0, 110, 110, W, H, 0);
    expect(overlap({ ...cells[0], ...p }, cells[1])).toBe(false);
  });
});
