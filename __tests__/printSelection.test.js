// Tests de services/printSelection.js : tirage mensuel des coups de cœur (abonnement).
import {
  monthKey, monthName, nextMonthKey, shortDate, subStatus, stageIndex, printedMapOf, sentIdsFor,
  pickRandom, reconcile, replaceAt,
} from "../services/printSelection";

describe("mois", () => {
  test("monthKey en heure locale", () => {
    expect(monthKey(new Date(2026, 10, 30, 23, 59))).toBe("2026-11");
    expect(monthKey(new Date(2027, 0, 1, 0, 1))).toBe("2027-01");
  });
  test("nextMonthKey passe l'année", () => {
    expect(nextMonthKey("2026-11")).toBe("2026-12");
    expect(nextMonthKey("2026-12")).toBe("2027-01");
    expect(nextMonthKey("2026-01")).toBe("2026-02");
  });
  test("monthName / shortDate", () => {
    expect(monthName("2026-02")).toBe("février");
    expect(monthName("2026-12")).toBe("décembre");
    expect(shortDate(new Date(2026, 10, 7).getTime())).toBe("7 nov.");
  });
});

describe("subStatus : où en est un abonnement ce mois-ci", () => {
  const now = (day) => new Date(2026, 10, day, 12);
  const sub = { selectionDay: 5, sendDay: 25 };

  test("en pause, prioritaire sur tout", () => {
    expect(subStatus({ ...sub, status: "paused" }, { status: "validated" }, now(10)).kind).toBe("paused");
  });
  test("sélection validée", () => {
    const r = subStatus(sub, { status: "validated", stage: "shipped" }, now(10));
    expect(r.kind).toBe("validated");
    expect(r.stageIdx).toBe(2);
  });
  test("avant le jour de réception : « soon »", () => {
    expect(subStatus(sub, null, now(4)).kind).toBe("soon");
  });
  test("le jour de réception et après : « todo »", () => {
    expect(subStatus(sub, null, now(5)).kind).toBe("todo");
    expect(subStatus(sub, null, now(20)).kind).toBe("todo");
  });
  test("renvoie les jours choisis et le mois court", () => {
    const r = subStatus(sub, null, now(10));
    expect(r).toMatchObject({ selectionDay: 5, sendDay: 25, monthShort: "nov." });
  });
});

describe("stageIndex", () => {
  test("absent = validée (0) ; inconnu = 0 ; connu = son rang", () => {
    expect(stageIndex({})).toBe(0);
    expect(stageIndex(undefined)).toBe(0);
    expect(stageIndex({ stage: "bizarre" })).toBe(0);
    expect(stageIndex({ stage: "printing" })).toBe(1);
    expect(stageIndex({ stage: "delivered" })).toBe(3);
  });
});

describe("photos déjà imprimées / envoyées", () => {
  const selections = {
    subA: {
      "2026-10": { status: "validated", photoIds: ["p1", "p2"], validatedAt: 111 },
      "2026-11": { status: "draft", photoIds: ["p3"] },
    },
    subB: { "2026-11": { status: "validated", photoIds: ["p2", "p4"], validatedAt: 222 } },
  };

  test("sentIdsFor : seulement les sélections VALIDÉES d'un abonnement", () => {
    expect([...sentIdsFor(selections.subA)].sort()).toEqual(["p1", "p2"]);
    expect(sentIdsFor(undefined).size).toBe(0);
  });

  test("printedMapOf : marques existantes + sélections validées, sans écraser une marque", () => {
    const printed = { p1: { at: 1, subId: "subX", month: "2026-01" } };
    const map = printedMapOf(printed, selections);
    expect(Object.keys(map).sort()).toEqual(["p1", "p2", "p4"]);
    expect(map.p1.subId).toBe("subX"); // la marque d'origine est gardée
    expect(map.p2.subId).toBe("subA"); // la 1re sélection rencontrée gagne
    expect(map.p3).toBeUndefined(); // brouillon = pas imprimé
  });

  test("entrées vides : pas de plantage", () => {
    expect(printedMapOf()).toEqual({});
    expect(printedMapOf({}, { subA: null })).toEqual({});
  });
});

describe("tirage au hasard", () => {
  const pool = Array.from({ length: 30 }, (_, i) => `p${i}`);

  test("pickRandom : n photos, sans doublon, toutes dans le lot", () => {
    for (let t = 0; t < 50; t++) {
      const r = pickRandom(pool, 10);
      expect(r).toHaveLength(10);
      expect(new Set(r).size).toBe(10);
      r.forEach((id) => expect(pool).toContain(id));
    }
  });
  test("pickRandom : pas plus que ce qui existe, et ne modifie pas l'entrée", () => {
    const copy = [...pool];
    expect(pickRandom(["a", "b"], 5)).toHaveLength(2);
    pickRandom(pool, 10);
    expect(pool).toEqual(copy);
  });

  test("reconcile : retire les photos disparues et complète jusqu'à `size`", () => {
    const out = reconcile(["p1", "gone", "p2"], pool, 5);
    expect(out).toHaveLength(5);
    expect(out).not.toContain("gone");
    expect(out).toContain("p1");
    expect(out).toContain("p2");
    expect(new Set(out).size).toBe(5);
  });
  test("reconcile : trop de photos → on coupe à `size`", () => {
    expect(reconcile(["p1", "p2", "p3", "p4"], pool, 2)).toEqual(["p1", "p2"]);
  });
  test("reconcile : pas assez de photos dispo → on envoie ce qu'il y a", () => {
    expect(reconcile([], ["a", "b"], 5).sort()).toEqual(["a", "b"]);
  });

  test("replaceAt : remplace la place voulue par une photo NON déjà prise", () => {
    const current = ["p0", "p1", "p2"];
    for (let t = 0; t < 30; t++) {
      const out = replaceAt(current, 1, ["p0", "p1", "p2", "p9"]);
      expect(out).toEqual(["p0", "p9", "p2"]);
    }
    expect(current).toEqual(["p0", "p1", "p2"]); // l'original n'est pas modifié
  });
  test("replaceAt : plus aucune photo disponible → null", () => {
    expect(replaceAt(["a", "b"], 0, ["a", "b"])).toBeNull();
  });
});
