// scripts/build-cities.mjs
// Fabrique constants/cities.json (villes pour la recherche « Marrakech ») à partir de GeoNames.
//
//   1. Télécharger https://download.geonames.org/export/dump/cities15000.zip et le décompresser
//   2. node scripts/build-cities.mjs /chemin/vers/cities15000.txt [population minimale, 30000 par défaut]
//
// Source : GeoNames (https://www.geonames.org), licence CC BY 4.0 → crédit affiché dans Réglages.
// Sortie : { source, minPop, rows: [[nom, latitude, longitude, population en milliers], …] } triée par population.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const input = process.argv[2];
const minPop = Number(process.argv[3] ?? 30000);
if (!input) { console.error("Usage : node scripts/build-cities.mjs cities15000.txt [populationMin]"); process.exit(1); }

const rows = [];
for (const line of fs.readFileSync(input, "utf8").split("\n")) {
  const c = line.split("\t");
  if (c.length < 15) continue;
  const [, name, , , lat, lon, fclass, fcode, country, , , admin2, , , pop] = c;
  const population = Number(pop);
  if (fclass !== "P" || population < minPop) continue;
  if (fcode === "PPLX") continue; // quartier d'une ville (« Gare », « Picpus ») : la ville le couvre déjà
  if (country === "FR" && admin2 === "75" && name !== "Paris") continue; // quartiers de Paris (« Gare », « Roquette »…)
  if (/\d/.test(name)) continue; // « Paris 15 Vaugirard », « Lyon 03 » : des quartiers, pas des villes
  rows.push([name, Math.round(Number(lat) * 100) / 100, Math.round(Number(lon) * 100) / 100, Math.round(population / 1000)]);
}
rows.sort((a, b) => b[3] - a[3]);

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "constants", "cities.json");
fs.writeFileSync(out, JSON.stringify({ source: "GeoNames cities15000 (CC BY 4.0)", minPop, rows }));
console.log(`${rows.length} villes (≥ ${minPop} hab.) → ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} Ko)`);
