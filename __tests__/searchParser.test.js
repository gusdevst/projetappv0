// Tests de services/searchParser.js : lecture d'une phrase de recherche (« l'été 2026 à la plage »).
// On utilise les VRAIES données (dictionnaire, pays, villes) : ça vérifie aussi que ces fichiers restent cohérents.
// L'horloge est injectée (`now`) : « aujourd'hui » = mardi 17 novembre 2026, sauf indication contraire.
import { parseQuery, describeQuery, matchPeriod, normFr, duplicateWords } from "../services/searchParser";
import { CONCEPTS, GROUPS, STOPWORDS } from "../constants/searchVocabulary";

const NOW = new Date(2026, 10, 17, 12, 0, 0);
const at = (y, m, d = 1, h = 12) => new Date(y, m - 1, d, h).getTime(); // m = 1..12
const parse = (txt, now = NOW) => parseQuery(txt, now);
const ids = (r) => r.concepts.map((c) => c.id);

describe("normFr", () => {
  test("minuscules, sans accents, ponctuation → espaces", () => {
    expect(normFr("Été")).toBe("ete");
    expect(normFr("L'Île-de-France !")).toBe("l ile de france");
    expect(normFr("œuf  ")).toBe("oeuf");
    expect(normFr("  Noël,  2025 ")).toBe("noel 2025");
  });
  test("null / undefined = chaîne vide", () => {
    expect(normFr(null)).toBe("");
    expect(normFr(undefined)).toBe("");
  });
});

describe("contenu (dictionnaire)", () => {
  test("un mot connu", () => {
    const r = parse("la plage");
    expect(ids(r)).toEqual(["plage"]);
    expect(r.period).toBeNull();
    expect(r.unknown).toEqual([]);
    expect(r.places).toEqual([]);
  });

  test("accents, majuscules et pluriels sans importance", () => {
    expect(ids(parse("LES CHIENS"))).toEqual(["chien"]);
    expect(ids(parse("des chats"))).toEqual(["chat"]);
  });

  test("pluriel d'un mot qui n'est écrit qu'au singulier dans le dictionnaire (on retire le « s »)", () => {
    expect(ids(parse("plages"))).toEqual(["plage"]);
    expect(ids(parse("montagnes"))).toEqual(["montagne"]);
  });

  test("plusieurs sujets = « l'un OU l'autre » par défaut", () => {
    const r = parse("chiens et chats");
    expect(ids(r).sort()).toEqual(["chat", "chien"]);
    expect(r.mode).toBe("or");
  });

  test("un même sujet cité deux fois n'est compté qu'une fois", () => {
    expect(ids(parse("chien chiens"))).toEqual(["chien"]);
  });

  test("expression de plusieurs mots (« coucher de soleil »)", () => {
    expect(ids(parse("un coucher de soleil"))).toContain("coucher_soleil");
  });

  test("formules de demande ignorées", () => {
    const r = parse("je veux faire un album sur les chiens");
    expect(ids(r)).toEqual(["chien"]);
    expect(r.unknown).toEqual([]);
  });

  test("mots-outils seuls : rien de compris, rien d'inconnu", () => {
    const r = parse("de la");
    expect(r.concepts).toEqual([]);
    expect(r.unknown).toEqual([]);
  });

  test("phrase vide ou absente : pas de plantage", () => {
    for (const t of ["", "   ", null, undefined]) {
      const r = parse(t);
      expect(r.concepts).toEqual([]);
      expect(r.period).toBeNull();
      expect(r.unknown).toEqual([]);
    }
  });
});

describe("mots inconnus et « Tu voulais dire… ? »", () => {
  test("un mot inconnu est listé, le reste est compris", () => {
    const r = parse("xyzzyq plage");
    expect(r.unknown).toEqual(["xyzzyq"]);
    expect(ids(r)).toEqual(["plage"]);
  });

  test("début de mot : « plag » propose la plage", () => {
    const r = parse("plag");
    expect(r.unknown).toEqual(["plag"]);
    expect(r.suggestions.map((s) => s.id)).toContain("plage");
  });

  test("faute de frappe : « plagee » propose la plage", () => {
    expect(parse("plagee").suggestions.map((s) => s.id)).toContain("plage");
  });

  test("moins de 3 lettres : aucune suggestion", () => {
    expect(parse("zq").suggestions).toEqual([]);
  });

  test("pas plus de 5 suggestions", () => {
    expect(parse("pa").suggestions.length).toBeLessThanOrEqual(5);
    expect(parse("par").suggestions.length).toBeLessThanOrEqual(5);
  });
});

describe("périodes", () => {
  test("« l'été 2026 » = juillet et août 2026 (décision d'Augustin)", () => {
    const r = parse("l'été 2026 à la plage");
    expect(r.period.label).toBe("été 2026");
    expect(ids(r)).toEqual(["plage"]);
    expect(matchPeriod(r.period, at(2026, 7, 1, 0))).toBe(true);
    expect(matchPeriod(r.period, at(2026, 8, 31, 23))).toBe(true);
    expect(matchPeriod(r.period, at(2026, 6, 30))).toBe(false);
    expect(matchPeriod(r.period, at(2026, 9, 1, 0))).toBe(false);
    expect(matchPeriod(r.period, at(2025, 7, 14))).toBe(false);
  });

  test("une saison sans année = chaque année (la période elle-même)", () => {
    const r = parse("la plage en été");
    expect(r.period.label).toBe("chaque été");
    expect(r.seasons).toEqual([]);
    expect(matchPeriod(r.period, at(2019, 7, 14))).toBe(true);
    expect(matchPeriod(r.period, at(2024, 8, 3))).toBe(true);
    expect(matchPeriod(r.period, at(2024, 11, 3))).toBe(false);
  });

  test("printemps = mars à mai ; automne = septembre à novembre", () => {
    const p = parse("printemps 2025").period;
    expect(matchPeriod(p, at(2025, 3, 1, 0))).toBe(true);
    expect(matchPeriod(p, at(2025, 5, 31, 23))).toBe(true);
    expect(matchPeriod(p, at(2025, 6, 1, 1))).toBe(false);
    const a = parse("automne 2025").period;
    expect(matchPeriod(a, at(2025, 9, 15))).toBe(true);
    expect(matchPeriod(a, at(2025, 12, 1, 1))).toBe(false);
  });

  test("« hiver 2026 » = décembre 2025 → février 2026", () => {
    const p = parse("hiver 2026").period;
    expect(matchPeriod(p, at(2025, 12, 15))).toBe(true);
    expect(matchPeriod(p, at(2026, 1, 20))).toBe(true);
    expect(matchPeriod(p, at(2026, 2, 28, 23))).toBe(true);
    expect(matchPeriod(p, at(2025, 11, 30))).toBe(false);
    expect(matchPeriod(p, at(2026, 12, 15))).toBe(false);
  });

  test("un mois avec année", () => {
    const r = parse("août 2025");
    expect(r.period.label).toBe("août 2025");
    expect(matchPeriod(r.period, at(2025, 8, 10))).toBe(true);
    expect(matchPeriod(r.period, at(2025, 9, 1, 1))).toBe(false);
  });

  test("une année seule = toute l'année", () => {
    const r = parse("2026");
    expect(r.period.label).toBe("2026");
    expect(matchPeriod(r.period, at(2026, 1, 1, 0))).toBe(true);
    expect(matchPeriod(r.period, at(2026, 12, 31, 23))).toBe(true);
    expect(matchPeriod(r.period, at(2025, 12, 31, 23))).toBe(false);
    expect(matchPeriod(r.period, at(2027, 1, 1, 1))).toBe(false);
  });

  test("un nombre qui n'est pas une année reste inconnu", () => {
    expect(parse("1850").unknown).toEqual(["1850"]);
    expect(parse("3000").unknown).toEqual(["3000"]);
    expect(parse("1850").period).toBeNull();
  });

  describe("Noël = 20 → 26 décembre", () => {
    test("avec année", () => {
      const p = parse("Noël 2025").period;
      expect(matchPeriod(p, at(2025, 12, 20, 0))).toBe(true);
      expect(matchPeriod(p, at(2025, 12, 26, 23))).toBe(true);
      expect(matchPeriod(p, at(2025, 12, 19))).toBe(false);
      expect(matchPeriod(p, at(2025, 12, 27, 1))).toBe(false);
    });
    test("sans année : tous les Noëls", () => {
      const p = parse("Noël").period;
      expect(p.label).toBe("chaque Noël");
      expect(matchPeriod(p, at(2018, 12, 25))).toBe(true);
      expect(matchPeriod(p, at(2018, 12, 19))).toBe(false);
      expect(matchPeriod(p, at(2018, 11, 25))).toBe(false);
    });
    test("sans année : les bornes sont les mêmes qu'avec une année (20 et 26 inclus, 27 exclu)", () => {
      const p = parse("Noël").period;
      expect(matchPeriod(p, at(2018, 12, 20, 0))).toBe(true);
      expect(matchPeriod(p, at(2018, 12, 26, 23))).toBe(true);
      expect(matchPeriod(p, at(2018, 12, 27, 1))).toBe(false);
    });
    test("« Noël dernier » en novembre 2026 = Noël 2025", () => {
      expect(parse("Noël dernier").period.label).toBe("Noël 2025");
    });
  });

  describe("« cet été » / « l'été dernier » selon la date du jour", () => {
    test("en novembre 2026 : les deux donnent l'été 2026", () => {
      expect(parse("cet été").period.label).toBe("été 2026");
      expect(parse("l'été dernier").period.label).toBe("été 2026");
    });
    test("en juin 2026 (avant l'été) : les deux donnent l'été 2025", () => {
      const now = new Date(2026, 5, 10);
      expect(parse("cet été", now).period.label).toBe("été 2025");
      expect(parse("l'été dernier", now).period.label).toBe("été 2025");
    });
    test("en plein été 2026 (15 août) : « cet été » = 2026, « dernier » = 2025", () => {
      const now = new Date(2026, 7, 15);
      expect(parse("cet été", now).period.label).toBe("été 2026");
      expect(parse("l'été dernier", now).period.label).toBe("été 2025");
    });
  });

  describe("année et mois relatifs", () => {
    test("cette année / l'année dernière", () => {
      const cette = parse("cette année").period;
      expect(matchPeriod(cette, at(2026, 3, 3))).toBe(true);
      expect(matchPeriod(cette, at(2025, 3, 3))).toBe(false);
      const derniere = parse("l'année dernière").period;
      expect(matchPeriod(derniere, at(2025, 3, 3))).toBe(true);
      expect(matchPeriod(derniere, at(2026, 3, 3))).toBe(false);
    });
    test("ce mois-ci / le mois dernier (nous sommes le 17 novembre 2026)", () => {
      const ce = parse("ce mois-ci");
      expect(ce.period.label).toBe("ce mois-ci");
      expect(ce.unknown).toEqual([]); // le « ci » est un mot-outil
      expect(matchPeriod(ce.period, at(2026, 11, 1, 1))).toBe(true);
      expect(matchPeriod(ce.period, at(2026, 10, 31))).toBe(false);
      const dernier = parse("le mois dernier").period;
      expect(matchPeriod(dernier, at(2026, 10, 15))).toBe(true);
      expect(matchPeriod(dernier, at(2026, 11, 2))).toBe(false);
    });
    test("« le mois dernier » en janvier = décembre de l'année d'avant", () => {
      const p = parse("le mois dernier", new Date(2026, 0, 10)).period;
      expect(matchPeriod(p, at(2025, 12, 20))).toBe(true);
    });
  });

  test("plusieurs périodes : l'une OU l'autre", () => {
    const r = parse("2024 2026");
    expect(r.period.label).toBe("2024 + 2026");
    expect(matchPeriod(r.period, at(2024, 5, 5))).toBe(true);
    expect(matchPeriod(r.period, at(2026, 5, 5))).toBe(true);
    expect(matchPeriod(r.period, at(2025, 5, 5))).toBe(false);
  });
});

describe("virgules : période ou sujet ?", () => {
  test("« l'été 2026, la plage » : l'été est rattaché à 2026, pas de sujet saison", () => {
    const r = parse("l'été 2026, la plage");
    expect(r.period.label).toBe("été 2026");
    expect(r.seasons).toEqual([]);
    expect(ids(r)).toEqual(["plage"]);
  });

  test("« 2026, plage, été » : 2026 = la période ; l'été cité à part = un SUJET de plus", () => {
    const r = parse("2026, plage, été");
    expect(r.period.label).toBe("2026");
    expect(ids(r)).toEqual(["plage"]);
    expect(r.seasons).toHaveLength(1);
    expect(r.seasons[0].id).toBe("saison-ete");
    expect(r.seasons[0].fr).toBe("Été");
  });

  test("sans virgules, « 2026 plage été » reste « été 2026 » (rattachement par proximité)", () => {
    const r = parse("2026 plage été");
    expect(r.period.label).toBe("été 2026");
    expect(r.seasons).toEqual([]);
  });

  test("point-virgule et retour à la ligne coupent aussi", () => {
    expect(parse("2026; plage; été").seasons).toHaveLength(1);
    expect(parse("2026\nplage\nété").seasons).toHaveLength(1);
  });
});

describe("pays et villes (hors ligne)", () => {
  test("un pays", () => {
    const r = parse("Maroc");
    expect(r.places.map((p) => p.id)).toEqual(["maroc"]);
    expect(r.unknown).toEqual([]);
  });

  test("« au Japon » : le « au » est ignoré", () => {
    expect(parse("au Japon").places.map((p) => p.id)).toEqual(["japon"]);
  });

  test("un pays qui ressemble à un mot (« Mali » ne devient pas « mal »)", () => {
    expect(parse("Mali").places.map((p) => p.id)).toEqual(["mali"]);
  });

  test("une grande ville, avec son nom français", () => {
    const r = parse("Marrakech");
    expect(r.places).toHaveLength(1);
    expect(r.places[0].id).toBe("v:marrakech");
    expect(r.places[0].kind).toBe("city");
    expect(parse("Londres").places[0].fr).toBe("Londres");
  });

  test("lieu + période + sujet se combinent : « Maroc 2025, plage »", () => {
    const r = parse("Maroc 2025, plage");
    expect(r.places.map((p) => p.id)).toEqual(["maroc"]);
    expect(r.period.label).toBe("2025");
    expect(ids(r)).toEqual(["plage"]);
  });

  test("plusieurs pays = l'un OU l'autre", () => {
    expect(parse("Maroc ou Japon").places.map((p) => p.id).sort()).toEqual(["japon", "maroc"]);
  });

  test("un mois n'est JAMAIS pris pour une ville (« mars », « mai »)", () => {
    const r = parse("mars 2026");
    expect(r.places).toEqual([]);
    expect(r.period.label).toBe("mars 2026");
    expect(parse("mai 2026").places).toEqual([]);
  });

  test("les villes ne passent pas avant le dictionnaire : « plage » reste une idée", () => {
    const r = parse("plage");
    expect(ids(r)).toEqual(["plage"]);
    expect(r.places).toEqual([]);
  });
});

describe("matchPeriod : cas limites", () => {
  test("pas de période = tout passe", () => {
    expect(matchPeriod(null, at(2020, 1, 1))).toBe(true);
    expect(matchPeriod(undefined, 0)).toBe(true);
  });
  test("date absente ou invalide = refusée", () => {
    const p = parse("2026").period;
    expect(matchPeriod(p, 0)).toBe(false);
    expect(matchPeriod(p, NaN)).toBe(false);
    expect(matchPeriod(p, undefined)).toBe(false);
    expect(matchPeriod(p, -5)).toBe(false);
  });
});

describe("describeQuery : le texte « J'ai compris »", () => {
  test("pays · période · sujets", () => {
    expect(describeQuery(parse("Maroc 2025, plage"))).toBe("Maroc · 2025 · Plage");
  });
  test("plusieurs sujets : « ou »", () => {
    expect(describeQuery(parse("chiens et chats"))).toMatch(/^(Chien ou Chat|Chat ou Chien)$/);
  });
  test("saison citée à part = un sujet de plus", () => {
    expect(describeQuery(parse("2026, plage, été"))).toBe("2026 · Plage ou Été");
  });
  test("rien compris : texte vide", () => {
    expect(describeQuery(parse("xyzzyq"))).toBe("");
  });
});

describe("le dictionnaire lui-même (fichier à relire et corriger souvent)", () => {
  test("aucun mot ne désigne deux idées différentes (le 2ᵉ serait ignoré en silence)", () => {
    expect(duplicateWords()).toEqual([]);
  });

  test("chaque idée a un id unique, un nom, une rubrique connue, des mots et des étiquettes", () => {
    const seen = new Set();
    for (const c of CONCEPTS) {
      expect(typeof c.id).toBe("string");
      expect(c.id).not.toMatch(/\s/);
      expect(seen.has(c.id)).toBe(false);
      seen.add(c.id);
      expect(c.fr).toBeTruthy();
      expect(GROUPS).toContain(c.group);
      expect(c.words.length).toBeGreaterThan(0);
      expect(c.labels.length).toBeGreaterThan(0);
      if (c.minPct != null) expect(c.minPct).toBeGreaterThan(0);
    }
  });

  test("chaque mot du dictionnaire est retrouvé par le parseur (et pas avalé par un mot-outil ou une période)", () => {
    const lost = [];
    for (const c of CONCEPTS) {
      for (const w of c.words) {
        const r = parse(w);
        if (!r.concepts.some((x) => x.id === c.id)) lost.push(`${w} → ${c.id}`);
      }
    }
    expect(lost).toEqual([]);
  });

  test("aucun mot-outil n'est un mot du dictionnaire (« de », « la » ne doivent pas chercher quelque chose)", () => {
    const clash = [];
    for (const c of CONCEPTS) for (const w of c.words) if (STOPWORDS.has(normFr(w))) clash.push(`${w} (${c.id})`);
    expect(clash).toEqual([]);
  });
});
