// Garde-fou : les prix sont écrits DEUX FOIS (dans l'app, et dans la fonction Supabase `imprimeur-order` qui les recalcule
// côté serveur). Si l'un change sans l'autre, un client verrait un prix et la commande en enregistrerait un autre.
// Ce test lit le fichier de la fonction (texte) et compare avec l'app.
import fs from "fs";
import path from "path";
import { BOOK_PRODUCTS } from "../services/bookProducts";
import { POSTER_FORMATS } from "../services/posterProducts";
import { PRINT_PRODUCT } from "../services/printProducts";

const SRC = fs.readFileSync(path.join(__dirname, "..", "supabase", "functions", "imprimeur-order", "index.ts"), "utf8");

describe("la fonction Supabase imprimeur-order a les mêmes prix que l'app", () => {
  test("livres : base, prix par page, pages min / max", () => {
    for (const [key, p] of Object.entries(BOOK_PRODUCTS)) {
      const m = SRC.match(new RegExp(`${key}:\\s*\\{\\s*base:\\s*(\\d+),\\s*extra:\\s*(\\d+),\\s*minPages:\\s*(\\d+),\\s*maxPages:\\s*(\\d+)`));
      expect(m).not.toBeNull();
      expect(Number(m[1])).toBe(p.sale.baseCents);
      expect(Number(m[2])).toBe(p.sale.extraPageCents);
      expect(Number(m[3])).toBe(p.pages.min);
      expect(Number(m[4])).toBe(p.pages.max);
    }
  });

  test("posters : prix de chaque format", () => {
    const line = SRC.match(/POSTER_PRICING[^=]*=\s*\{([^}]*)\}/);
    expect(line).not.toBeNull();
    for (const [key, f] of Object.entries(POSTER_FORMATS)) {
      const m = line[1].match(new RegExp(`${key}:\\s*(\\d+)`));
      expect(m).not.toBeNull();
      expect(Number(m[1])).toBe(f.saleCents);
    }
  });

  test("tirages simples : minimum, maximum, base, prix en plus, formats", () => {
    const num = (name) => Number(SRC.match(new RegExp(`${name}\\s*=\\s*(\\d+)`))[1]);
    expect(num("PRINT_MIN")).toBe(PRINT_PRODUCT.minCount);
    expect(num("PRINT_MAX")).toBe(PRINT_PRODUCT.maxCount);
    expect(num("PRINT_BASE_CENTS")).toBe(PRINT_PRODUCT.oneShot.baseCents);
    expect(num("PRINT_EXTRA_CENTS")).toBe(PRINT_PRODUCT.oneShot.extraCents);
    const formats = SRC.match(/PRINT_FORMATS\s*=\s*\[([^\]]*)\]/)[1].match(/"([^"]+)"/g).map((s) => s.replace(/"/g, ""));
    expect(formats).toEqual(PRINT_PRODUCT.formats.map((f) => f.key));
  });
});
