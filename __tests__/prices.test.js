// Tests des PRIX : livre (bookProducts), poster (posterProducts), tirage simple (printProducts).
// Les marges attendues sont celles notées dans CLAUDE.md (§5, §21) après la hausse du port à 5,90 € HT.
// Si un de ces tests tombe après un changement de tarif VOULU : met à jour le chiffre ici ET dans CLAUDE.md.
import {
  BOOK_PRODUCTS, BOOK_PRODUCT_KEYS, SHIPPING_COST_CENTS, bookSpec, bookPriceCents, bookCostCents, bookMarginCents,
} from "../services/bookProducts";
import {
  POSTER_FORMATS, POSTER_FORMAT_KEYS, posterPriceCents, posterCostCents, posterMarginCents,
  posterQuality, posterQualityLevel, bestPosterFormat, posterIsLandscape, posterDims, posterSizeLabel,
} from "../services/posterProducts";
import { PRINT_PRODUCT, printOneShotCents } from "../services/printProducts";

describe("livre photo", () => {
  const a4 = { product: "a4" };
  const paysage = { product: "paysage" };

  test("prix de base : 34,90 € (A4) et 29,90 € (paysage) pour 24 pages", () => {
    expect(bookPriceCents(a4, 24)).toBe(3490);
    expect(bookPriceCents(paysage, 24)).toBe(2990);
  });

  test("0,65 € par page en plus, par 2 pages jusqu'à 120", () => {
    expect(bookPriceCents(a4, 26)).toBe(3490 + 2 * 65);
    expect(bookPriceCents(a4, 120)).toBe(3490 + 96 * 65);
  });

  test("moins de 24 pages : jamais en dessous du prix de base", () => {
    expect(bookPriceCents(a4, 10)).toBe(3490);
  });

  test("nombre de pages inconnu : null (pas NaN)", () => {
    expect(bookPriceCents(a4, undefined)).toBeNull();
    expect(bookCostCents(a4, NaN)).toBeNull();
    expect(bookMarginCents(a4, undefined)).toBeNull();
  });

  test("le prix suit book.format quand on ne donne pas de pages", () => {
    expect(bookPriceCents({ product: "a4", format: 30 })).toBe(3490 + 6 * 65);
  });

  test("coût = impression + port (5,90 €)", () => {
    expect(SHIPPING_COST_CENTS).toBe(590);
    expect(bookCostCents(a4, 24)).toBe(1690 + 590);
    expect(bookCostCents(paysage, 24)).toBe(1490 + 590);
  });

  test("marges documentées (HT, avant frais de paiement) : 24 pages et 120 pages", () => {
    expect(bookMarginCents(a4, 24)).toBe(628);        // 6,28 €
    expect(bookMarginCents(paysage, 24)).toBe(412);   // 4,12 €
    expect(bookMarginCents(a4, 120)).toBe(2084);      // 20,84 €
    expect(bookMarginCents(paysage, 120)).toBe(1868); // 18,68 €
  });

  test("on ne vend JAMAIS à perte, quel que soit le nombre de pages", () => {
    for (const key of BOOK_PRODUCT_KEYS) {
      const { min, max, step } = BOOK_PRODUCTS[key].pages;
      for (let n = min; n <= max; n += step) expect(bookMarginCents({ product: key }, n)).toBeGreaterThan(0);
    }
  });

  test("bookSpec : un ancien livre sans `product` suit son orientation", () => {
    expect(bookSpec({ orientation: "landscape" }).key).toBe("paysage");
    expect(bookSpec({ orientation: "portrait" }).key).toBe("a4");
    expect(bookSpec(undefined).key).toBe("a4");
    expect(bookSpec({ product: "inconnu" }).key).toBe("a4");
  });
});

describe("poster", () => {
  test("prix de vente TTC : A4 14,90 · A3 17,90 · A2 27,90 · A1 34,90", () => {
    expect(POSTER_FORMAT_KEYS.map((k) => posterPriceCents(k))).toEqual([1490, 1790, 2790, 3490]);
  });

  test("quantité : prix × n ; mais UN SEUL port par commande", () => {
    expect(posterPriceCents("a3", 3)).toBe(1790 * 3);
    expect(posterCostCents("a3", 3)).toBe(486 * 3 + 590);
  });

  test("quantité 0 ou négative = 1 exemplaire", () => {
    expect(posterPriceCents("a4", 0)).toBe(1490);
    expect(posterPriceCents("a4", -2)).toBe(1490);
  });

  test("format inconnu : on retombe sur l'A3 (format par défaut)", () => {
    expect(posterPriceCents("zzz")).toBe(1790);
  });

  test("marges documentées à 1 exemplaire : A4 3,30 · A3 4,16 · A2 6,37 · A1 8,18 €", () => {
    expect(POSTER_FORMAT_KEYS.map((k) => posterMarginCents(k))).toEqual([330, 416, 637, 818]);
  });

  test("jamais à perte, de 1 à 10 exemplaires", () => {
    for (const k of POSTER_FORMAT_KEYS) for (let q = 1; q <= 10; q++) expect(posterMarginCents(k, q)).toBeGreaterThan(0);
  });

  test("tailles réelles A4 / A3 / A2 / A1 (mm)", () => {
    expect(POSTER_FORMAT_KEYS.map((k) => [POSTER_FORMATS[k].widthMm, POSTER_FORMATS[k].heightMm])).toEqual([
      [210, 297], [297, 420], [420, 594], [590, 840],
    ]);
  });

  test("sens : une photo horizontale donne un poster horizontal (dimensions échangées)", () => {
    expect(posterIsLandscape({ width: 4000, height: 3000 })).toBe(true);
    expect(posterIsLandscape({ width: 3000, height: 4000 })).toBe(false);
    expect(posterIsLandscape({ width: 3000, height: 3000 })).toBe(false);
    expect(posterIsLandscape(null)).toBe(false);
    expect(posterDims("a4", true)).toEqual({ widthMm: 297, heightMm: 210 });
    expect(posterSizeLabel("a4")).toBe("21 × 29,7 cm");
    expect(posterSizeLabel("a4", true)).toBe("29,7 × 21 cm");
  });

  describe("qualité d'une photo", () => {
    // 12 Mpx portrait (3000 × 4000) sur un A4 (210 × 297 mm) : on remplit le poster (« cover »), donc c'est le côté
    // le plus « juste » qui compte : min(3000/210, 4000/297) = 13,47 px/mm × 25,4 = 342 dpi.
    const photo = { width: 3000, height: 4000 };

    test("dpi et part coupée", () => {
      const q = posterQuality(photo, "a4");
      expect(q.dpi).toBe(342);
      expect(q.lossPct).toBe(6); // ratio photo 0,75 vs poster 0,707 → 94 % de la photo gardée
    });

    test("zoomer divise la résolution ; dézoomer (< 1) est ignoré", () => {
      expect(posterQuality(photo, "a4", 2).dpi).toBe(171);
      expect(posterQuality(photo, "a4", 0.5).dpi).toBe(342);
    });

    test("un plus grand format baisse la résolution", () => {
      expect(posterQuality(photo, "a1").dpi).toBeLessThan(posterQuality(photo, "a2").dpi);
      expect(posterQuality(photo, "a2").dpi).toBeLessThan(posterQuality(photo, "a3").dpi);
    });

    test("taille de la photo inconnue : null", () => {
      expect(posterQuality({}, "a4")).toBeNull();
      expect(posterQuality(null, "a4")).toBeNull();
    });

    test("niveaux : seuils 200 / 150 / 100 dpi", () => {
      expect(posterQualityLevel(250).key).toBe("perfect");
      expect(posterQualityLevel(200).key).toBe("perfect");
      expect(posterQualityLevel(199).key).toBe("good");
      expect(posterQualityLevel(150).key).toBe("good");
      expect(posterQualityLevel(149).key).toBe("tight");
      expect(posterQualityLevel(100).key).toBe("tight");
      expect(posterQualityLevel(99).key).toBe("low");
      expect(posterQualityLevel(null).key).toBe("unknown");
    });

    test("format proposé d'office : le plus grand ≥ 150 dpi jusqu'à A2, jamais A1", () => {
      expect(bestPosterFormat({ width: 6000, height: 8000 })).toBe("a2"); // même en 24 Mpx, A1 n'est pas présélectionné
      expect(bestPosterFormat({ width: 3000, height: 4000 })).toBe("a2"); // 171 dpi sur A2
      expect(bestPosterFormat({ width: 2000, height: 2667 })).toBe("a3"); // 114 dpi sur A2, 161 sur A3
      expect(bestPosterFormat({ width: 1500, height: 2000 })).toBe("a4"); // 121 dpi sur A3, 171 sur A4
    });

    test("photo minuscule : A4 par défaut ; taille inconnue : A3", () => {
      expect(bestPosterFormat({ width: 800, height: 600 })).toBe("a4");
      expect(bestPosterFormat({})).toBe("a3");
    });
  });
});

describe("tirage simple (prix EXEMPLE, à fixer par Augustin)", () => {
  test("20 tirages = 14,90 € ; 0,35 € par tirage en plus", () => {
    expect(printOneShotCents(20)).toBe(1490);
    expect(printOneShotCents(21)).toBe(1525);
    expect(printOneShotCents(100)).toBe(1490 + 80 * 35);
  });
  test("sous le minimum : 0 (pas de commande possible)", () => {
    expect(printOneShotCents(19)).toBe(0);
    expect(printOneShotCents(0)).toBe(0);
  });
  test("formats et limites", () => {
    expect(PRINT_PRODUCT.formats.map((f) => f.key)).toEqual(["10x15", "10x10"]);
    expect(PRINT_PRODUCT.minCount).toBe(20);
    expect(PRINT_PRODUCT.maxCount).toBe(1000);
  });
});
