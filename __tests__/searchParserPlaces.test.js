// Tests de la PRIORITÉ entre mots dans searchParser : un mois, une saison, une année, un mot du dictionnaire ou un pays
// ne doivent JAMAIS être pris pour une ville, même si une ville porte ce nom.
// Avec les vraies données aucune ville ne s'appelle comme un mois : on la FABRIQUE ici avec une liste de villes simulée.
jest.mock("../services/cityLookup", () => ({
  listCityPlaces: () => [
    { id: "v:mai", kind: "city", fr: "Mai", words: ["Mai"] },
    { id: "v:mars", kind: "city", fr: "Mars", words: ["Mars"] },
    { id: "v:ete", kind: "city", fr: "Été", words: ["Été"] },
    { id: "v:2026", kind: "city", fr: "2026", words: ["2026"] },
    { id: "v:plage", kind: "city", fr: "Plage", words: ["Plage"] },
    { id: "v:maroc", kind: "city", fr: "Maroc", words: ["Maroc"] },
    { id: "v:orange", kind: "city", fr: "Orange", words: ["Orange"] },
    { id: "v:sale", kind: "city", fr: "Salé", words: ["Salé"] },
    { id: "v:dernier", kind: "city", fr: "Dernier", words: ["Dernier"] },
    { id: "v:xy", kind: "city", fr: "Xy", words: ["Xy"] },
    { id: "v:paris", kind: "city", fr: "Paris", words: ["Paris"] },
    { id: "v:lyon", kind: "city", fr: "Lyon", words: ["Lyon"] },
  ],
  cityKeysAt: () => [],
}));

import { parseQuery } from "../services/searchParser";

const NOW = new Date(2026, 10, 17, 12);
const parse = (t) => parseQuery(t, NOW);
const placeIds = (r) => r.places.map((p) => p.id);

describe("une ville qui s'appelle comme un autre mot ne le remplace pas", () => {
  test("une ville normale est bien reconnue (le test est valide)", () => {
    expect(placeIds(parse("Paris"))).toEqual(["v:paris"]);
    expect(placeIds(parse("Lyon"))).toEqual(["v:lyon"]);
  });

  test("un mois reste un mois", () => {
    const r = parse("mai 2026");
    expect(r.places).toEqual([]);
    expect(r.period.label).toBe("mai 2026");
    expect(parse("mars").places).toEqual([]);
  });

  test("une saison reste une saison", () => {
    const r = parse("été 2026");
    expect(r.places).toEqual([]);
    expect(r.period.label).toBe("été 2026");
  });

  test("une année reste une année", () => {
    const r = parse("2026");
    expect(r.places).toEqual([]);
    expect(r.period.label).toBe("2026");
  });

  test("un mot du dictionnaire reste une idée", () => {
    const r = parse("plage");
    expect(r.places).toEqual([]);
    expect(r.concepts.map((c) => c.id)).toEqual(["plage"]);
  });

  test("un pays gagne sur une ville du même nom", () => {
    expect(placeIds(parse("Maroc"))).toEqual(["maroc"]);
  });

  test("les mots de tous les jours (Orange, Salé) ne deviennent pas un lieu", () => {
    for (const w of ["orange", "salé"]) {
      const r = parse(w);
      expect(r.places).toEqual([]);
    }
  });

  test("mots de « dernier / cet » : jamais un lieu", () => {
    const r = parse("l'été dernier");
    expect(r.places).toEqual([]);
    expect(r.period.label).toBe("été 2026");
  });

  test("un nom de moins de 3 lettres n'est jamais une ville", () => {
    expect(parse("xy").places).toEqual([]);
  });
});
