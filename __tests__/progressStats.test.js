// Tests de services/progressStats.js : série 🔥, durées, ratio de suppression.
// On fige l'horloge (« aujourd'hui » = mercredi 18 nov. 2026) pour que les résultats ne changent pas avec la date réelle.
import {
  computeStreak, STREAK_MIN, fmtDuration, formatSize, avgFor20, deleteRatio, sumRange, mondayOf,
} from "../services/progressStats";
import { dayKey } from "../services/dateKey";

const TODAY = new Date(2026, 10, 18, 10, 0, 0); // mercredi 18 novembre 2026
beforeAll(() => { jest.useFakeTimers(); jest.setSystemTime(TODAY); });
afterAll(() => jest.useRealTimers());

// log de test : { "2026-11-17": 12, … } → format réel { jour: { sorted } }
const logOf = (byDay) => Object.fromEntries(Object.entries(byDay).map(([k, sorted]) => [k, { sorted }]));
const ago = (n) => dayKey(new Date(2026, 10, 18 - n)); // n jours avant aujourd'hui

describe("computeStreak", () => {
  test("carnet vide : tout à zéro", () => {
    const r = computeStreak({});
    expect(r.current).toBe(0);
    expect(r.todayLeft).toBe(STREAK_MIN);
    expect(r.todayDone).toBe(false);
  });

  test("3 jours validés d'affilée (hier, avant-hier, avant) : série de 3", () => {
    const r = computeStreak(logOf({ [ago(3)]: 10, [ago(2)]: 15, [ago(1)]: 10 }));
    expect(r.current).toBe(3);
    expect(r.best).toBe(3);
  });

  test("aujourd'hui compte quand il est validé", () => {
    const r = computeStreak(logOf({ [ago(1)]: 10, [ago(0)]: 10 }));
    expect(r.current).toBe(2);
    expect(r.todayDone).toBe(true);
    expect(r.todayLeft).toBe(0);
  });

  test("aujourd'hui pas fini ne casse JAMAIS la série", () => {
    const r = computeStreak(logOf({ [ago(2)]: 10, [ago(1)]: 10, [ago(0)]: 3 }));
    expect(r.current).toBe(2);
    expect(r.todayDone).toBe(false);
    expect(r.todayLeft).toBe(STREAK_MIN - 3);
  });

  test("9 photos = jour NON validé (seuil à 10)", () => {
    const r = computeStreak(logOf({ [ago(1)]: STREAK_MIN - 1 }));
    expect(r.current).toBe(0);
  });

  test("un jour raté est rattrapé par le joker de la semaine", () => {
    // lundi 16 ✓, mardi 17 raté, mercredi 18 = aujourd'hui (validé)
    const r = computeStreak(logOf({ "2026-11-15": 10, "2026-11-16": 10, "2026-11-18": 10 }));
    expect(r.jokerDays).toContain("2026-11-17");
    expect(r.current).toBe(3); // 15, 16, (joker 17 ne compte pas), 18 → run 2 + aujourd'hui 1
  });

  test("deux jours ratés la même semaine cassent la série", () => {
    // dimanche 8 ✓ ; lundi 9 ✓ ; mardi 10 raté (joker) ; mercredi 11 raté → casse
    const r = computeStreak(logOf({ "2026-11-08": 10, "2026-11-09": 10 }));
    expect(r.current).toBe(0);
    expect(r.best).toBe(2);
  });

  test("le record (best) survit à une série cassée", () => {
    const r = computeStreak(logOf({
      "2026-11-01": 10, "2026-11-02": 10, "2026-11-03": 10, "2026-11-04": 10, // record 4
      [ago(0)]: 10, // série actuelle : 1
    }));
    expect(r.best).toBe(4);
    expect(r.current).toBe(1);
  });
});

describe("formats", () => {
  test("fmtDuration", () => {
    expect(fmtDuration(0)).toBe("0 s");
    expect(fmtDuration(45_000)).toBe("45 s");
    expect(fmtDuration(65_000)).toBe("1 min 05 s");
    expect(fmtDuration(8 * 60_000)).toBe("8 min");
    expect(fmtDuration(10 * 60_000)).toBe("10 min");
    expect(fmtDuration(72 * 60_000)).toBe("1 h 12");
  });

  test("formatSize", () => {
    expect(formatSize(0.4)).toBe("0 Mo");
    expect(formatSize(340)).toBe("340 Mo");
    expect(formatSize(1434)).toBe("1.4 Go");
  });

  test("avgFor20 : null sous 10 décisions chronométrées", () => {
    expect(avgFor20({ timedCount: 9, activeMs: 90_000 })).toBeNull();
    expect(avgFor20(null)).toBeNull();
    // 10 décisions en 50 s = 5 s chacune → 100 s pour 20
    expect(avgFor20({ timedCount: 10, activeMs: 50_000 })).toBe("1 min 40 s");
    // 10 décisions en 20 s = 2 s chacune → 40 s pour 20
    expect(avgFor20({ timedCount: 10, activeMs: 20_000 })).toBe("40 s");
  });
});

describe("deleteRatio", () => {
  test("null si moins de 10 photos triées ou aucune suppression", () => {
    expect(deleteRatio(9, 5)).toBeNull();
    expect(deleteRatio(50, 0)).toBeNull();
    expect(deleteRatio(0, 0)).toBeNull();
  });

  test("« sur 10 », décimale masquée quand elle est ronde", () => {
    const r = deleteRatio(100, 70);
    expect(r.n).toBe(7);
    expect(r.label).toBe("7 photos sur 10");
    expect(r.verb).toBe("sont supprimées");
  });

  test("décimale avec virgule française et singulier sous 2", () => {
    const r = deleteRatio(100, 15);
    expect(r.label).toBe("1,5 photo sur 10");
    expect(r.verb).toBe("est supprimée");
  });

  test("jamais plus de 10 sur 10", () => {
    expect(deleteRatio(10, 40).n).toBe(10);
  });
});

describe("dates", () => {
  test("mondayOf : le lundi de la semaine (dimanche → lundi d'avant)", () => {
    expect(dayKey(mondayOf(new Date(2026, 10, 18)))).toBe("2026-11-16"); // mercredi
    expect(dayKey(mondayOf(new Date(2026, 10, 22)))).toBe("2026-11-16"); // dimanche
    expect(dayKey(mondayOf(new Date(2026, 10, 16)))).toBe("2026-11-16"); // lundi
  });

  test("sumRange additionne les jours inclus", () => {
    const log = { "2026-11-16": { sorted: 10, freedMo: 5 }, "2026-11-17": { sorted: 20, freedMo: 7 }, "2026-11-20": { sorted: 99 } };
    const r = sumRange(log, new Date(2026, 10, 16), new Date(2026, 10, 18));
    expect(r.sorted).toBe(30);
    expect(r.freedMo).toBe(12);
  });
});
