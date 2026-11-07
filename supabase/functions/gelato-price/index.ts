// supabase/functions/gelato-price/index.ts
// Fonction serveur (Deno) : demande à Gelato le COÛT d'impression du livre photo 21×28 cm
// (prix que Pellicule paie à Gelato, hors TVA, hors marge) + les modes de livraison.
//
// La clé Gelato est dans les secrets Supabase (GELATO_API_KEY) : elle ne quitte jamais le serveur.
// Le produit est fixé ici (livres photo uniquement).
//
// Appels :
//   GET .../functions/v1/gelato-price                      → tableau pour 30, 40, 60, 80, 100, 120, 150, 200 pages
//   GET .../functions/v1/gelato-price?all=1                → tableau pour 30 → 200 pages, de 2 en 2 (86 appels)
//   GET .../functions/v1/gelato-price?pageCount=60         → une seule taille
//   Options : &country=FR (défaut FR) · &currency=EUR (défaut EUR)
//             &quote=1 → ajoute `quotes` : devis complet (impression + livraison) via orders:quote
//
// Réponse : { ok, country, currency, productUid, prices: [{ pageCount, raw }], shipping, errors }
//   `raw` = réponse brute de Gelato (on la lit d'abord telle quelle, on la nettoiera ensuite).
//
// ⚠️ Version d'essai : déployée sans vérification de connexion (--no-verify-jwt), comme gelato-cover.
//    À protéger par une connexion avant la mise en ligne publique.

const PRODUCT_UID =
  "photobooks-hardcover_pf_210x280-mm-8x11-inch_pt_170-gsm-65lb-coated-silk_cl_4-4_ccl_4-4_bt_glued-left_ct_matt-lamination_prt_1-0_cpt_130-gsm-65-lb-cover-coated-silk_ver";

const PAGES = { min: 30, max: 200, step: 2 };
const DEFAULT_SIZES = [30, 40, 60, 80, 100, 120, 150, 200];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const parse = async (res: Response) => {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
};

const validPages = (n: number) =>
  Number.isInteger(n) && n >= PAGES.min && n <= PAGES.max && n % PAGES.step === 0;

Deno.serve(async (req) => {
  const apiKey = Deno.env.get("GELATO_API_KEY");
  if (!apiKey) {
    return json({ ok: false, error: "Secret GELATO_API_KEY introuvable dans Supabase (Edge Functions → Secrets)." }, 500);
  }
  const headers = { "X-API-KEY": apiKey };
  const q = new URL(req.url).searchParams;

  const country = (q.get("country") ?? "FR").toUpperCase();
  const currency = (q.get("currency") ?? "EUR").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country) || !/^[A-Z]{3}$/.test(currency)) {
    return json({ ok: false, error: "country = 2 lettres (ex. FR), currency = 3 lettres (ex. EUR)." }, 400);
  }

  // Quelles tailles de livre ?
  let sizes = DEFAULT_SIZES;
  if (q.get("all")) {
    sizes = [];
    for (let n = PAGES.min; n <= PAGES.max; n += PAGES.step) sizes.push(n);
  }
  if (q.get("pageCount")) {
    const n = Number(q.get("pageCount"));
    if (!validPages(n)) {
      return json({ ok: false, error: `pageCount doit être un nombre pair entre ${PAGES.min} et ${PAGES.max} (reçu : ${q.get("pageCount")}).` }, 400);
    }
    sizes = [n];
  }

  const errors: unknown[] = [];

  // Coût d'impression : on appelle par paquets de 10 pour ne pas saturer Gelato.
  const prices: { pageCount: number; raw: unknown }[] = [];
  for (let i = 0; i < sizes.length; i += 10) {
    const batch = sizes.slice(i, i + 10);
    const results = await Promise.all(batch.map(async (pageCount) => {
      const url = `https://product.gelatoapis.com/v3/products/${PRODUCT_UID}/prices?country=${country}&currency=${currency}&pageCount=${pageCount}`;
      try {
        const res = await fetch(url, { headers });
        const raw = await parse(res);
        if (!res.ok) { errors.push({ pageCount, status: res.status, gelato: raw }); return null; }
        return { pageCount, raw };
      } catch (e) {
        errors.push({ pageCount, error: (e as Error).message });
        return null;
      }
    }));
    for (const r of results) if (r) prices.push(r);
  }

  // Modes de livraison (même réponse pour tous les nombres de pages).
  let shipping: unknown = null;
  try {
    const res = await fetch(`https://shipment.gelatoapis.com/v1/shipment-methods?country=${country}`, { headers });
    const raw = await parse(res);
    if (res.ok) shipping = raw;
    else errors.push({ shipping: true, status: res.status, gelato: raw });
  } catch (e) {
    errors.push({ shipping: true, error: (e as Error).message });
  }

  // Devis complet (impression + livraison) : seulement si ?quote=1.
  // Adresse FICTIVE (aucune commande créée : « orders:quote » ne fait que calculer un prix).
  const quotes: { pageCount: number; raw: unknown }[] = [];
  if (q.get("quote")) {
    for (let i = 0; i < sizes.length; i += 5) {
      const batch = sizes.slice(i, i + 5);
      const results = await Promise.all(batch.map(async (pageCount) => {
        const body = {
          orderReferenceId: `quote-${pageCount}`,
          customerReferenceId: "pellicule-quote",
          currency,
          allowMultipleQuotes: true,
          recipient: {
            country,
            firstName: "Test",
            lastName: "Pellicule",
            addressLine1: "10 rue de Rivoli",
            city: "Paris",
            postCode: "75001",
            email: "test@example.com",
          },
          products: [{ itemReferenceId: "livre-1", productUid: PRODUCT_UID, pageCount, quantity: 1 }],
        };
        try {
          const res = await fetch("https://order.gelatoapis.com/v4/orders:quote", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const raw = await parse(res);
          if (!res.ok) { errors.push({ quote: true, pageCount, status: res.status, gelato: raw }); return null; }
          return { pageCount, raw };
        } catch (e) {
          errors.push({ quote: true, pageCount, error: (e as Error).message });
          return null;
        }
      }));
      for (const r of results) if (r) quotes.push(r);
    }
  }

  return json({ ok: prices.length > 0, country, currency, productUid: PRODUCT_UID, prices, shipping, quotes, errors }, prices.length > 0 ? 200 : 502);
});
