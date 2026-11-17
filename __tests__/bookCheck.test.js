// Tests de services/bookCheck.js : les contrôles « Vérifier ton livre » avant impression.
// Règles d'imprimeur.fr (CLAUDE.md §21) : 150 dpi minimum, 24 → 120 pages de 2 en 2, fond perdu dans le format fini.
//
// Pixels attendus sur une page A4 (21 cm de large) à 150 dpi, pour avoir des chiffres « à la main » :
//   cadre pleine largeur (90 % de la page = 18,9 cm) → 18,9 / 2,54 × 150 = 1 116 px
//   demi-largeur (45 % = 9,45 cm)                    →                      558 px
//   double page (1,9 page = 39,9 cm)                 →                    2 356 px
//   couverture pleine (21 cm)                        →                    1 240 px · photo centrée / polaroïd (72 %) → 893 px
import { checkBook } from "../services/bookCheck";
import {
  createBook, setLayout, setCrop, setDouble, placePhoto, setCover, setCoverCrop, setFormat, setProduct, PELE_LAYOUT, setPeleCount,
} from "../services/photoBook";

const ids = (n) => Array.from({ length: n }, (_, i) => `p${i}`);
const BIG = { width: 4000, height: 3000 }; // 3 000 px de petit côté : assez pour tout sauf les très grands cadrages
// photoById où toutes les photos ont la même taille
const sized = (list, size = BIG) => Object.fromEntries(list.map((id) => [id, { ...size }]));
const newBook = (n = 4, product = "a4") => createBook({ id: "a", name: "T", photoIds: ids(n) }, product);
const check = (book, album = ids(4), photos = sized(ids(60))) => checkBook(book, album, photos);

describe("nombre de pages accepté", () => {
  test("24 → 120, pair : accepté (A4 et paysage)", () => {
    for (const product of ["a4", "paysage"]) {
      const b = newBook(4, product);
      for (const n of [24, 26, 60, 118, 120]) expect(check(setFormat(b, n)).pagesOk).toBe(true);
    }
  });

  test("impair, trop petit ou trop grand : refusé", () => {
    const b = newBook();
    for (const n of [22, 23, 25, 121, 122, 0]) expect(check({ ...b, format: n }).pagesOk).toBe(false);
  });

  test("renvoie les limites du format pour les afficher", () => {
    const r = check(newBook());
    expect(r.pagesMin).toBe(24);
    expect(r.pagesMax).toBe(120);
  });

  test("un ancien livre sans `product` est contrôlé avec le format qui lui correspond", () => {
    const { product, ...legacy } = newBook();
    expect(check({ ...legacy, format: 30 }).pagesOk).toBe(true);
    expect(check({ ...legacy, format: 31 }).pagesOk).toBe(false);
  });
});

describe("couverture : y a-t-il une photo ?", () => {
  test("photo présente sur le téléphone : ok", () => {
    expect(check(newBook()).coverOk).toBe(true);
  });
  test("pas de photo de couverture : pas ok", () => {
    expect(check(setCover(newBook(), { photoId: null })).coverOk).toBe(false);
  });
  test("photo de couverture disparue du téléphone : pas ok", () => {
    expect(checkBook(newBook(), ids(4), {}).coverOk).toBe(false);
  });
  test("style « Titre seul » : pas de photo, donc toujours ok", () => {
    const b = setCover(newBook(), { photoId: null, style: "titre" });
    expect(check(b).coverOk).toBe(true);
    expect(check(b).coverLow).toBeNull();
  });
});

describe("couverture : la photo est-elle assez grande ?", () => {
  const photosOf = (size) => ({ p0: size });

  test("pleine page : il faut 1 240 px de petit côté", () => {
    const b = newBook();
    expect(checkBook(b, ids(4), photosOf({ width: 1240, height: 1800 })).coverLow).toBeNull(); // pile assez
    expect(checkBook(b, ids(4), photosOf({ width: 1239, height: 1800 })).coverLow).toEqual({ have: 1239, need: 1240 });
  });

  test("c'est le PETIT côté qui compte, quel que soit le sens de la photo", () => {
    const b = newBook();
    expect(checkBook(b, ids(4), photosOf({ width: 3000, height: 1000 })).coverLow).toEqual({ have: 1000, need: 1240 });
    expect(checkBook(b, ids(4), photosOf({ width: 1000, height: 3000 })).coverLow).toEqual({ have: 1000, need: 1240 });
  });

  test("photo centrée et polaroïd : la photo ne fait que 72 % de la largeur (893 px)", () => {
    for (const style of ["centree", "polaroid"]) {
      const b = setCover(newBook(), { style });
      expect(checkBook(b, ids(4), photosOf({ width: 893, height: 2000 })).coverLow).toBeNull();
      expect(checkBook(b, ids(4), photosOf({ width: 892, height: 2000 })).coverLow).toEqual({ have: 892, need: 893 });
    }
  });

  test("bandeau et cadre fin : toute la largeur (1 240 px)", () => {
    for (const style of ["bandeau", "cadre"]) {
      const b = setCover(newBook(), { style });
      expect(checkBook(b, ids(4), photosOf({ width: 1100, height: 2000 })).coverLow).toEqual({ have: 1100, need: 1240 });
    }
  });

  test("zoomer le recadrage demande plus de pixels", () => {
    const b = setCoverCrop(newBook(), { scale: 2 });
    expect(checkBook(b, ids(4), photosOf({ width: 2000, height: 2500 })).coverLow).toEqual({ have: 2000, need: 2480 });
  });

  test("paysage (21 × 15) : la largeur de page est la même → mêmes 1 240 px", () => {
    const b = newBook(4, "paysage");
    expect(checkBook(b, ids(4), photosOf({ width: 1239, height: 3000 })).coverLow).toEqual({ have: 1239, need: 1240 });
  });

  test("taille de la photo inconnue : on ne dit rien", () => {
    expect(checkBook(newBook(), ids(4), { p0: {} }).coverLow).toBeNull();
  });
});

describe("pages vides", () => {
  test("liste les numéros (à partir de 0) des pages sans aucune photo", () => {
    const r = check(newBook(4)); // 4 photos = 2 pages remplies (0 et 1), 22 vides
    expect(r.emptyPages).toHaveLength(22);
    expect(r.emptyPages[0]).toBe(2);
    expect(r.emptyPages.at(-1)).toBe(23);
  });

  test("une page avec UNE seule photo sur 2 n'est pas vide", () => {
    const b = setLayout(newBook(1), 0, 2); // [p0, null]
    expect(check(b, ids(1)).emptyPages).not.toContain(0);
  });

  test("livre plein : aucune page vide", () => {
    expect(check(newBook(48), ids(48)).emptyPages).toEqual([]);
  });

  test("double page VIDE : les 2 moitiés sont signalées ; double page avec photo : aucune", () => {
    let b = setDouble(newBook(48), 1); // double page (1, 2), vidée par setDouble
    expect(check(b, ids(48)).emptyPages).toEqual(expect.arrayContaining([1, 2]));
    b = placePhoto(b, 1, 0, "p0");
    expect(check(b, ids(48)).emptyPages).not.toContain(1);
    expect(check(b, ids(48)).emptyPages).not.toContain(2);
  });
});

describe("photos de l'album non placées", () => {
  test("compte les photos de l'album qui ne sont pas dans le livre", () => {
    expect(check(newBook(4), ids(10)).unplaced).toBe(6);
  });
  test("album entièrement placé : 0", () => {
    expect(check(newBook(4), ids(4)).unplaced).toBe(0);
  });
  test("une photo placée mais retirée de l'album ne fausse pas le compte", () => {
    expect(check(newBook(4), ["p0", "p1"]).unplaced).toBe(0);
  });
  test("une photo d'une double page est comptée comme placée", () => {
    let b = placePhoto(setDouble(newBook(0), 1), 1, 0, "p0");
    expect(check(b, ["p0"]).unplaced).toBe(0);
  });
});

describe("photos de faible qualité dans les pages", () => {
  const at = (px) => ({ p0: { width: px, height: px * 1.5 } });

  test("cadre pleine largeur (1 photo par page) : 1 116 px", () => {
    const b = setLayout(newBook(1), 0, 1);
    expect(checkBook(b, ["p0"], at(1116)).lowQuality).toEqual([]);
    expect(checkBook(b, ["p0"], at(1115)).lowQuality).toEqual([{ photoId: "p0", pageIndex: 0, have: 1115, need: 1116 }]);
  });

  test("2 photos portrait : chacune pleine largeur (1 116 px)", () => {
    const r = checkBook(newBook(2), ids(2), at(1000));
    expect(r.lowQuality.map((q) => q.need)).toEqual([1116]);
  });

  // Page 0 en mise en page `layout` avec `n` photos (livre d'abord vidé : createBook range 2 photos par page).
  const pageWith = (layout, n, product = "a4") => {
    let b = setLayout(newBook(0, product), 0, layout);
    for (let i = 0; i < n; i++) b = placePhoto(b, 0, i, `p${i}`);
    return b;
  };

  test("4 photos : chacune une demi-largeur (558 px)", () => {
    const b = pageWith(4, 4);
    expect(b.pages[0].slots).toEqual(ids(4));
    expect(checkBook(b, ids(4), sized(ids(4), { width: 600, height: 800 })).lowQuality).toEqual([]);
    expect(checkBook(b, ids(4), sized(ids(4), { width: 558, height: 800 })).lowQuality).toEqual([]);
    expect(checkBook(b, ids(4), sized(ids(4), { width: 557, height: 800 })).lowQuality).toHaveLength(4);
  });

  test("3 photos : la 1re (grande) 1 116 px, les 2 petites 558 px", () => {
    const b = pageWith(3, 3);
    expect(b.pages[0].slots).toEqual(ids(3));
    const photos = sized(ids(3), { width: 700, height: 900 }); // ok pour les petites, pas pour la grande
    expect(checkBook(b, ids(3), photos).lowQuality).toEqual([{ photoId: "p0", pageIndex: 0, have: 700, need: 1116 }]);
  });

  test("format paysage : 2 photos côte à côte = demi-largeur chacune (558 px)", () => {
    const b = newBook(2, "paysage");
    expect(checkBook(b, ids(2), sized(ids(2), { width: 600, height: 900 })).lowQuality).toEqual([]);
    expect(checkBook(b, ids(2), sized(ids(2), { width: 500, height: 900 })).lowQuality.map((q) => q.need)).toEqual([558, 558]);
  });

  test("le zoom du recadrage multiplie le besoin", () => {
    let b = setLayout(newBook(1), 0, 1);
    b = setCrop(b, 0, "p0", { scale: 2 });
    expect(checkBook(b, ["p0"], at(2000)).lowQuality).toEqual([{ photoId: "p0", pageIndex: 0, have: 2000, need: 2232 }]);
    expect(checkBook(b, ["p0"], at(2232)).lowQuality).toEqual([]);
  });

  test("double page : 2 356 px (1,9 page de large)", () => {
    const b = placePhoto(setDouble(newBook(0), 1), 1, 0, "p0");
    expect(checkBook(b, ["p0"], at(2356)).lowQuality).toEqual([]);
    expect(checkBook(b, ["p0"], at(2355)).lowQuality).toEqual([{ photoId: "p0", pageIndex: 1, have: 2355, need: 2356 }]);
  });

  test("la moitié droite d'une double page n'est pas contrôlée une 2ᵉ fois", () => {
    const b = placePhoto(setDouble(newBook(0), 1), 1, 0, "p0");
    expect(checkBook(b, ["p0"], at(100)).lowQuality).toHaveLength(1);
  });

  test("taille de photo inconnue : pas d'alerte (on ne devine pas)", () => {
    expect(checkBook(newBook(2), ids(2), { p0: {}, p1: { width: 0, height: 0 } }).lowQuality).toEqual([]);
  });

  test("photo absente du téléphone : pas d'alerte qualité (c'est un autre contrôle)", () => {
    expect(checkBook(newBook(2), ids(2), {}).lowQuality).toEqual([]);
  });

  test("le petit côté compte, pas le grand", () => {
    const b = setLayout(newBook(1), 0, 1);
    expect(checkBook(b, ["p0"], { p0: { width: 6000, height: 800 } }).lowQuality).toHaveLength(1);
    expect(checkBook(b, ["p0"], { p0: { width: 800, height: 6000 } }).lowQuality).toHaveLength(1);
  });

  test("le numéro de page rapporté est bien celui de la page", () => {
    let b = newBook(0);
    b = placePhoto(setLayout(b, 7, 1), 7, 0, "pz");
    const r = checkBook(b, ["pz"], { pz: { width: 300, height: 300 } });
    expect(r.lowQuality).toEqual([{ photoId: "pz", pageIndex: 7, have: 300, need: 1116 }]);
  });

  describe("pêle-mêle", () => {
    const pele = (count) => {
      let b = setLayout(newBook(count), 0, PELE_LAYOUT);
      b = setPeleCount(b, 0, count);
      return Array.from({ length: count }, (_, i) => `p${i}`).reduce((acc, id, i) => placePhoto(acc, 0, i, id), b);
    };

    test("jamais plus exigeant qu'une photo pleine largeur ; plus il y a de tirages, moins il faut de pixels", () => {
      const needFor = (n) => {
        const ids_ = Array.from({ length: n }, (_, i) => `p${i}`);
        const r = checkBook(pele(n), ids_, sized(ids_, { width: 10, height: 10 })); // toutes trop petites
        return Math.max(...r.lowQuality.map((q) => q.need));
      };
      expect(needFor(3)).toBeLessThan(1116);
      expect(needFor(9)).toBeLessThan(needFor(3));
    });

    test("une grande photo passe toujours, même à 9 tirages", () => {
      const ids_ = Array.from({ length: 9 }, (_, i) => `p${i}`);
      expect(checkBook(pele(9), ids_, sized(ids_)).lowQuality).toEqual([]);
    });
  });
});

describe("livre sain : tout est vert", () => {
  test("couverture, pages, qualité, rien de vide, tout placé", () => {
    const r = check(newBook(48), ids(48));
    expect(r.coverOk).toBe(true);
    expect(r.coverLow).toBeNull();
    expect(r.pagesOk).toBe(true);
    expect(r.emptyPages).toEqual([]);
    expect(r.lowQuality).toEqual([]);
    expect(r.unplaced).toBe(0);
  });

  test("changer de format de produit garde un livre valide", () => {
    const b = setProduct(newBook(8), "paysage");
    expect(check(b, ids(8)).pagesOk).toBe(true);
  });
});
