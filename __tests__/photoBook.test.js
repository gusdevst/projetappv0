// Tests de services/photoBook.js : la logique du livre photo (création, pages, doubles pages, pêle-mêle, couverture).
// Règle d'or du fichier : chaque fonction renvoie un NOUVEAU livre et ne modifie JAMAIS l'ancien (Zustand en dépend).
import {
  createBook, clampPages, setFormat, setProduct, upgradeLegacyBook, setOrientation, setLayout, setPeleCount, setPelePositions,
  placePhoto, clearSlot, autofill, completeBook, placedMap, setCrop, resetCrop, getCrop, setDouble, clearDouble, canDouble,
  isDoubleLeft, isDoubleRight, doubleLeftIndex, pagePhotoIds, syncWithAlbum, bookStats, setCoverStyle, setCover, setPageTitle,
  autoTitleXY, isLightHex, layoutRows, pickFormat, PELE_LAYOUT,
} from "../services/photoBook";

const ids = (n, prefix = "p") => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
const album = (n, name = "Été 2026") => ({ id: "alb1", name, photoIds: ids(n) });
// Un livre vide (aucune photo) de `format` pages ; pratique pour tester les pages une à une.
const emptyBook = (product = "a4", format = 24) => {
  const b = createBook({ id: "a", name: "x", photoIds: [] }, product);
  return format === 24 ? b : setFormat(b, format);
};
const clone = (x) => JSON.parse(JSON.stringify(x));
const photosOf = (book) => book.pages.flatMap((p) => p.slots).filter(Boolean);

describe("createBook", () => {
  test("démarre TOUJOURS à 24 pages, même avec un gros album", () => {
    expect(createBook(album(500)).pages).toHaveLength(24);
    expect(createBook(album(3)).format).toBe(24);
  });

  test("2 photos par page, dans l'ordre de l'album ; couverture = 1re photo ; titre = nom de l'album", () => {
    const b = createBook(album(10));
    expect(b.pages[0].slots).toEqual(["p0", "p1"]);
    expect(b.pages[4].slots).toEqual(["p8", "p9"]);
    expect(b.pages[5].slots).toEqual([null, null]);
    expect(b.cover.photoId).toBe("p0");
    expect(b.cover.title).toBe("Été 2026");
  });

  test("les photos en trop ne sont pas placées (album de 100 photos, 48 cadres)", () => {
    expect(photosOf(createBook(album(100)))).toHaveLength(48);
  });

  test("format paysage → orientation horizontale ; produit inconnu → A4 vertical", () => {
    const l = createBook(album(2), "paysage");
    expect(l.product).toBe("paysage");
    expect(l.orientation).toBe("landscape");
    const x = createBook(album(2), "nimporte-quoi");
    expect(x.product).toBe("a4");
    expect(x.orientation).toBe("portrait");
  });

  test("album vide : couverture sans photo, pas de plantage", () => {
    const b = createBook({ id: "a", name: "Vide", photoIds: [] });
    expect(b.cover.photoId).toBeNull();
    expect(photosOf(b)).toHaveLength(0);
  });
});

describe("clampPages / pickFormat", () => {
  const b = { product: "a4" };
  test("paire, entre 24 et 120", () => {
    expect(clampPages(10, b)).toBe(24);
    expect(clampPages(200, b)).toBe(120);
    expect(clampPages(31, b)).toBe(32);
    expect(clampPages(24, b)).toBe(24);
    expect(clampPages("abc", b)).toBe(24);
    expect(clampPages(undefined, b)).toBe(24);
  });
  test("pickFormat : 2 photos par page dans les limites", () => {
    expect(pickFormat(10, b)).toBe(24);
    expect(pickFormat(100, b)).toBe(50);
    expect(pickFormat(1000, b)).toBe(120);
  });
});

describe("setFormat", () => {
  test("plus de pages : on ajoute des pages vides", () => {
    const b = setFormat(createBook(album(4)), 30);
    expect(b.format).toBe(30);
    expect(b.pages).toHaveLength(30);
    expect(b.pages[29].slots).toEqual([null, null]);
  });

  test("moins de pages : les photos des pages coupées sortent du livre (elles restent dans l'album)", () => {
    const big = setFormat(emptyBook(), 30);
    const full = autofill(big, ids(60)); // 30 pages × 2
    const small = setFormat(full, 26);
    expect(small.pages).toHaveLength(26);
    expect(photosOf(small)).toHaveLength(52);
    expect(placedMap(small).p59).toBeUndefined();
  });

  test("valeur impossible ramenée dans les limites", () => {
    expect(setFormat(emptyBook(), 500).format).toBe(120);
    expect(setFormat(emptyBook(), 3).format).toBe(24);
  });

  test("ne modifie pas le livre d'origine", () => {
    const b = createBook(album(10));
    const before = clone(b);
    setFormat(b, 40);
    expect(clone(b)).toEqual(before);
  });
});

describe("placePhoto / clearSlot", () => {
  test("une photo déjà placée ailleurs se DÉPLACE (jamais 2 fois dans le livre)", () => {
    const b = createBook(album(4)); // p0 p1 | p2 p3
    const moved = placePhoto(b, 5, 0, "p0");
    expect(moved.pages[0].slots).toEqual([null, "p1"]);
    expect(moved.pages[5].slots[0]).toBe("p0");
    expect(photosOf(moved).filter((id) => id === "p0")).toHaveLength(1);
  });

  test("placer une photo neuve dans un cadre occupé remplace l'ancienne", () => {
    const b = placePhoto(createBook(album(2)), 0, 0, "nouvelle");
    expect(b.pages[0].slots).toEqual(["nouvelle", "p1"]);
    expect(placedMap(b).p0).toBeUndefined();
  });

  test("clearSlot vide le cadre et efface le recadrage de cette photo", () => {
    let b = createBook(album(2));
    b = setCrop(b, 0, "p0", { scale: 2 });
    expect(b.pages[0].crops.p0.scale).toBe(2);
    b = clearSlot(b, 0, 0);
    expect(b.pages[0].slots[0]).toBeNull();
    expect(b.pages[0].crops.p0).toBeUndefined();
  });
});

describe("recadrage", () => {
  test("valeurs par défaut, puis réglage partiel", () => {
    const b = createBook(album(2));
    expect(getCrop(b.pages[0], "p0")).toEqual({ scale: 1, x: 0, y: 0, rot: 0, tilt: 0 });
    const c = setCrop(b, 0, "p0", { scale: 2.5, x: 0.1 });
    expect(getCrop(c.pages[0], "p0")).toEqual({ scale: 2.5, x: 0.1, y: 0, rot: 0, tilt: 0 });
  });
  test("resetCrop remet tout à zéro SAUF le quart de tour", () => {
    let b = setCrop(createBook(album(2)), 0, "p0", { scale: 3, x: 0.2, y: -0.1, rot: 90, tilt: 7 });
    b = resetCrop(b, 0, "p0");
    expect(getCrop(b.pages[0], "p0")).toEqual({ scale: 1, x: 0, y: 0, rot: 90, tilt: 0 });
  });
});

describe("mise en page", () => {
  test("passer de 2 à 1 photo : la 2e sort du livre", () => {
    const b = setLayout(createBook(album(2)), 0, 1);
    expect(b.pages[0].slots).toEqual(["p0"]);
    expect(placedMap(b).p1).toBeUndefined();
  });

  test("passer à 4 photos : on garde les photos et on ajoute des cadres vides", () => {
    const b = setLayout(createBook(album(2)), 0, 4);
    expect(b.pages[0].slots).toEqual(["p0", "p1", null, null]);
  });

  test("titre « milieu » impossible avec 1 seule ligne de photos : il passe en bas", () => {
    let b = setPageTitle(createBook(album(2)), 0, { text: "Plage", pos: "milieu" });
    b = setLayout(b, 0, 1);
    expect(b.pages[0].title.pos).toBe("bas");
  });

  test("layoutRows : 1 photo = 1 ligne ; 2 photos = 2 lignes en portrait, 1 en paysage ; pêle-mêle = 1", () => {
    expect(layoutRows(1, false)).toBe(1);
    expect(layoutRows(2, false)).toBe(2);
    expect(layoutRows(2, true)).toBe(1);
    expect(layoutRows(4, true)).toBe(2);
    expect(layoutRows(PELE_LAYOUT, false)).toBe(1);
  });

  test("setPageTitle fusionne avec le titre existant", () => {
    let b = setPageTitle(createBook(album(2)), 0, { text: "Plage" });
    b = setPageTitle(b, 0, { size: "L" });
    expect(b.pages[0].title).toEqual({ text: "Plage", pos: "bas", size: "L" });
  });
});

describe("pêle-mêle", () => {
  test("1re fois : 6 photos ; les photos existantes sont gardées", () => {
    const b = setLayout(createBook(album(2)), 0, PELE_LAYOUT);
    expect(b.pages[0].layout).toBe(PELE_LAYOUT);
    expect(b.pages[0].slots).toEqual(["p0", "p1", null, null, null, null]);
  });

  test("setPeleCount : 3 à 9 ; en réduisant, les dernières photos sortent du livre", () => {
    let b = setLayout(createBook(album(6)), 0, PELE_LAYOUT);
    b = autofill(b, ids(6)); // remplit les 6 cadres
    expect(b.pages[0].slots).toHaveLength(6);
    const small = setPeleCount(b, 0, 3);
    expect(small.pages[0].slots).toHaveLength(3);
    expect(placedMap(small)[b.pages[0].slots[5]]).toBeUndefined();
    expect(setPeleCount(b, 0, 99).pages[0].slots).toHaveLength(9);
    expect(setPeleCount(b, 0, 1).pages[0].slots).toHaveLength(3);
  });

  test("valeur de 0 : traitée comme « pas de valeur » → 6 photos (comportement de clampPele, l'écran n'envoie jamais 0)", () => {
    const b = setLayout(createBook(album(2)), 0, PELE_LAYOUT);
    expect(setPeleCount(b, 0, 0).pages[0].slots).toHaveLength(6);
  });

  test("setPeleCount ne touche pas une page qui n'est pas en pêle-mêle", () => {
    const b = createBook(album(2));
    expect(setPeleCount(b, 0, 5).pages[0].slots).toHaveLength(2);
  });

  test("changer le nombre de photos efface les positions déplacées à la main (la taille change)", () => {
    let b = setLayout(createBook(album(2)), 0, PELE_LAYOUT);
    b = setPelePositions(b, 0, { 0: { x: 0.1, y: 0.1 } });
    expect(b.pages[0].pos).toBeDefined();
    expect(setPeleCount(b, 0, 4).pages[0].pos).toBeUndefined();
    expect(setPelePositions(b, 0, null).pages[0].pos).toBeUndefined();
  });

  test("setPelePositions n'a aucun effet sur une page normale", () => {
    const b = setPelePositions(createBook(album(2)), 0, { 0: { x: 0, y: 0 } });
    expect(b.pages[0].pos).toBeUndefined();
  });

  test("changer d'orientation efface les positions (la zone change de forme)", () => {
    let b = setLayout(createBook(album(2)), 0, PELE_LAYOUT);
    b = setPelePositions(b, 0, { 0: { x: 0.1, y: 0.1 } });
    expect(setOrientation(b, "landscape").pages[0].pos).toBeUndefined();
  });
});

describe("doubles pages", () => {
  test("canDouble : pas la page 1 (index 0), pas la dernière (nombre pair de pages)", () => {
    const b = emptyBook();
    expect(canDouble(b, 0)).toBe(false);
    expect(canDouble(b, 1)).toBe(true);
    expect(canDouble(b, 2)).toBe(true);  // même double page que l'index 1
    expect(canDouble(b, 22)).toBe(true);
    expect(canDouble(b, 23)).toBe(false);
  });

  test("setDouble : 2 pages face à face deviennent gauche + droite, une seule photo", () => {
    let b = setDouble(emptyBook(), 2); // la double page est (1, 2)
    expect(isDoubleLeft(b.pages[1])).toBe(true);
    expect(isDoubleRight(b.pages[2])).toBe(true);
    expect(doubleLeftIndex(b, 1)).toBe(1);
    expect(doubleLeftIndex(b, 2)).toBe(1);
    expect(doubleLeftIndex(b, 3)).toBeNull();
    b = placePhoto(b, 1, 0, "grande");
    expect(pagePhotoIds(b, 1)).toEqual(["grande"]);
    expect(pagePhotoIds(b, 2)).toEqual(["grande"]); // la moitié droite montre la même photo
  });

  test("setDouble : impossible sur la page 1 → livre inchangé", () => {
    const b = emptyBook();
    expect(setDouble(b, 0)).toBe(b);
  });

  test("clearDouble sépare en 2 pages vides ; sans effet hors double page", () => {
    let b = setDouble(emptyBook(), 1);
    b = clearDouble(b, 2);
    expect(isDoubleLeft(b.pages[1])).toBe(false);
    expect(isDoubleRight(b.pages[2])).toBe(false);
    expect(b.pages[1].slots).toEqual([null, null]);
    expect(clearDouble(b, 5)).toBe(b);
  });

  test("changer la mise en page d'une double page la sépare", () => {
    let b = placePhoto(setDouble(emptyBook(), 1), 1, 0, "grande");
    b = setLayout(b, 1, 2);
    expect(isDoubleLeft(b.pages[1])).toBe(false);
    expect(isDoubleRight(b.pages[2])).toBe(false);
  });

  test("réduire le livre en coupant une double page en deux la sépare (pas de moitié orpheline)", () => {
    let b = setFormat(emptyBook(), 28);
    b = setDouble(b, 25); // double page (25, 26)
    expect(isDoubleRight(b.pages[26])).toBe(true);
    b = setFormat(b, 26); // il ne reste plus que les pages 0..25 : la moitié droite disparaît
    expect(isDoubleLeft(b.pages[25])).toBe(false);
  });

  test("autofill et completeBook ne mettent jamais de photo sur la moitié droite", () => {
    const b = setDouble(emptyBook(), 1);
    const filled = autofill(b, ids(100));
    expect(filled.pages[2].slots).toEqual([null]);
    const completed = completeBook(b, ids(100), { order: "album" });
    expect(completed.pages[2].slots).toEqual([null]);
  });

  test("bookStats : la moitié droite ne compte ni comme cadre ni comme page vide", () => {
    const b = setDouble(emptyBook(), 1);
    expect(bookStats(b, []).emptyPages).toBe(23);
  });
});

describe("autofill / completeBook", () => {
  test("autofill ne déplace pas les photos déjà placées et ne les duplique pas", () => {
    let b = placePhoto(emptyBook(), 3, 0, "p5");
    b = autofill(b, ids(10));
    expect(photosOf(b).filter((id) => id === "p5")).toHaveLength(1);
    expect(b.pages[3].slots[0]).toBe("p5");
    expect(new Set(photosOf(b)).size).toBe(photosOf(b).length);
  });

  test("completeBook ajoute des pages (2 par 2) quand les cadres ne suffisent pas", () => {
    const b = completeBook(emptyBook(), ids(52), { order: "album" });
    // 48 cadres vides, puis 4 photos de plus → 2 pages de 2 photos
    expect(b.pages).toHaveLength(26);
    expect(b.format).toBe(26);
    expect(photosOf(b)).toHaveLength(52);
  });

  test("completeBook s'arrête à 120 pages", () => {
    const b = completeBook(emptyBook(), ids(500), { order: "album" });
    expect(b.pages).toHaveLength(120);
    expect(photosOf(b)).toHaveLength(240);
  });

  test("completeBook ne coupe jamais en dessous du nombre de pages actuel", () => {
    expect(completeBook(emptyBook("a4", 40), [], { order: "album" }).pages).toHaveLength(40);
  });

  test("ordre « date » : de la plus ancienne à la plus récente ; égalité = ordre de l'album", () => {
    const dates = { p0: 300, p1: 100, p2: 200, p3: 100 };
    const b = completeBook(emptyBook(), ["p0", "p1", "p2", "p3"], { order: "date", dates });
    expect(photosOf(b)).toEqual(["p1", "p3", "p2", "p0"]);
  });

  test("ordre « album » : on garde l'ordre donné", () => {
    const b = completeBook(emptyBook(), ["p2", "p0", "p1"], { order: "album", dates: { p0: 1, p1: 2, p2: 3 } });
    expect(photosOf(b)).toEqual(["p2", "p0", "p1"]);
  });
});

describe("orientation et format de produit", () => {
  test("setOrientation : titre « milieu » → « bas » quand il n'y a plus 2 lignes de photos", () => {
    let b = setPageTitle(createBook(album(2)), 0, { text: "x", pos: "milieu" }); // 2 photos portrait = 2 lignes
    expect(setOrientation(b, "portrait")).toBe(b);
    const l = setOrientation(b, "landscape"); // 2 photos paysage = 1 ligne
    expect(l.orientation).toBe("landscape");
    expect(l.pages[0].title.pos).toBe("bas");
  });

  test("setOrientation ignore une valeur inconnue", () => {
    const b = createBook(album(2));
    expect(setOrientation(b, "diagonale")).toBe(b);
  });

  test("setProduct : l'orientation suit, les photos restent, le nombre de pages est conservé", () => {
    const b = createBook(album(6));
    const p = setProduct(b, "paysage");
    expect(p.product).toBe("paysage");
    expect(p.orientation).toBe("landscape");
    expect(p.pages).toHaveLength(24);
    expect(photosOf(p)).toEqual(photosOf(b));
    expect(setProduct(b, "a4")).toBe(b); // même format : rien ne change
    expect(setProduct(b, "inconnu")).toBe(b);
  });
});

describe("upgradeLegacyBook : anciens livres Gelato (sans `product`)", () => {
  const legacy = (orientation, pages) => ({
    albumId: "a", orientation, format: pages,
    cover: { photoId: "p0", title: "Vieux" },
    pages: Array.from({ length: pages }, (_, i) => ({ layout: 2, slots: [`p${2 * i}`, `p${2 * i + 1}`] })),
  });

  test("vertical → A4 ; horizontal → paysage ; 30 pages conservées", () => {
    const v = upgradeLegacyBook(legacy("portrait", 30));
    expect(v.product).toBe("a4");
    expect(v.format).toBe(30);
    expect(upgradeLegacyBook(legacy("landscape", 30)).product).toBe("paysage");
  });

  test("200 pages → ramené à 120", () => {
    const b = upgradeLegacyBook(legacy("portrait", 200));
    expect(b.pages).toHaveLength(120);
    expect(b.format).toBe(120);
  });

  test("un livre déjà converti est rendu tel quel ; null reste null", () => {
    const b = createBook(album(2));
    expect(upgradeLegacyBook(b)).toBe(b);
    expect(upgradeLegacyBook(null)).toBeNull();
  });
});

describe("couverture", () => {
  test("setCoverStyle : style inconnu ou identique = livre inchangé", () => {
    const b = createBook(album(2));
    expect(setCoverStyle(b, "n'existe-pas")).toBe(b);
    expect(setCoverStyle(b, "pleine")).toBe(b);
  });

  test("changer de style remet le titre en couleur et position automatiques", () => {
    let b = setCover(createBook(album(2)), { color: "noir", titleXY: { x: 0.2, y: 0.2 } });
    b = setCoverStyle(b, "polaroid");
    expect(b.cover.style).toBe("polaroid");
    expect(b.cover.color).toBe("auto");
    expect(b.cover.titleXY).toBeUndefined();
  });

  test("position automatique du titre selon le style", () => {
    expect(autoTitleXY({ style: "pleine", pos: "haut" })).toEqual({ x: 0.5, y: 0.14 });
    expect(autoTitleXY({ style: "pleine", pos: "milieu" })).toEqual({ x: 0.5, y: 0.5 });
    expect(autoTitleXY({ style: "titre" })).toEqual({ x: 0.5, y: 0.5 });
    expect(autoTitleXY({ style: "polaroid" })).toEqual({ x: 0.5, y: 0.84 });
    expect(autoTitleXY(undefined)).toEqual({ x: 0.5, y: 0.86 });
  });

  test("isLightHex : crème clair, noir foncé", () => {
    expect(isLightHex("#f1ebdf")).toBe(true);
    expect(isLightHex("#23271f")).toBe(false);
    expect(isLightHex("#4c7a2b")).toBe(false);
  });
});

describe("syncWithAlbum : une photo retirée de l'album sort du livre", () => {
  test("rien ne change → le MÊME livre (pas de réécriture du store)", () => {
    const b = createBook(album(6));
    expect(syncWithAlbum(b, ids(6))).toBe(b);
  });

  test("photo retirée : cadre vidé", () => {
    const b = createBook(album(6));
    const s = syncWithAlbum(b, ids(6).filter((id) => id !== "p3"));
    expect(s).not.toBe(b);
    expect(s.pages[1].slots).toEqual(["p2", null]);
  });

  test("photo de couverture retirée : on prend la 1re de l'album et on repart d'un cadrage neuf", () => {
    let b = createBook(album(6));
    b = setCover(b, { crop: { scale: 2 } });
    const s = syncWithAlbum(b, ["p1", "p2"]);
    expect(s.cover.photoId).toBe("p1");
    expect(s.cover.crop).toBeUndefined();
  });

  test("album vidé : couverture sans photo", () => {
    expect(syncWithAlbum(createBook(album(2)), []).cover.photoId).toBeNull();
  });
});

describe("bookStats", () => {
  test("photos placées, taux de remplissage, pages vides", () => {
    const b = createBook(album(10)); // 10 photos sur 48 cadres, 5 pages pleines, 19 vides
    const s = bookStats(b, ids(12)); // l'album a 12 photos : 2 pas placées
    expect(s.placedCount).toBe(10);
    expect(s.total).toBe(12);
    expect(s.fillRatio).toBeCloseTo(10 / 48);
    expect(s.emptyPages).toBe(19);
  });
});
