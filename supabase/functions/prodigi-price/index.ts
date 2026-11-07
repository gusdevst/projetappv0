// supabase/functions/prodigi-price/index.ts
// Fonction serveur (Deno) : interroge l'API Prodigi pour COMPARER avec Gelato (livres photo uniquement).
// Lecture seule : fiche produit, devis (impression + livraison), largeur du dos. Aucune commande n'est créée.
//
// La clé est dans les secrets Supabase (PRODIGI_API_KEY) : elle ne quitte jamais le serveur.
// Prodigi a deux environnements avec deux clés différentes : « sandbox » (essai) et « live » (réel).
// On essaie d'abord sandbox ; si la clé est refusée (401), on essaie live. La réponse dit lequel a marché (`env`).
//
// Appels (le SKU est obligatoire : on le copie depuis le catalogue du tableau de bord Prodigi) :
//   GET .../functions/v1/prodigi-price?sku=BOOK-FE-...                          → fiche produit (dimensions, variantes, zones d'impression)
//   GET .../functions/v1/prodigi-price?sku=...&quote=1&pageCount=30             → devis pour 30 pages
//   GET .../functions/v1/prodigi-price?sku=...&quote=1&all=1                    → devis 30 → 200 pages, de 2 en 2
//   GET .../functions/v1/prodigi-price?sku=...&spine=1&pageCount=30             → largeur du dos
//   Options : &country=FR (défaut FR) · &currency=EUR (défaut EUR)
//
// Réponse : réponses brutes de Prodigi (on les lit d'abord telles quelles, on les nettoiera ensuite).
//
// ⚠️ Version d'essai : déployée sans vérification de connexion (--no-verify-jwt), comme gelato-price.
//    À protéger par une connexion avant la mise en ligne publique.

const BASES = {
  sandbox: "https://api.sandbox.prodigi.com/v4.0",
  live: "https://api.prodigi.com/v4.0",
} as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const parse = async (res: Response) => {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
};

Deno.serve(async (req) => {
  const apiKey = Deno.env.get("PRODIGI_API_KEY");
  if (!apiKey) {
    return json({ ok: false, error: "Secret PRODIGI_API_KEY introuvable dans Supabase (Edge Functions → Secrets)." }, 500);
  }
  const q = new URL(req.url).searchParams;

  const sku = q.get("sku") ?? "";
  if (!/^[A-Za-z0-9_.-]{3,120}$/.test(sku)) {
    return json({ ok: false, error: "Paramètre sku manquant ou invalide (ex. ?sku=BOOK-FE-...). À copier depuis le catalogue Prodigi." }, 400);
  }
  const country = (q.get("country") ?? "FR").toUpperCase();
  const currency = (q.get("currency") ?? "EUR").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country) || !/^[A-Z]{3}$/.test(currency)) {
    return json({ ok: false, error: "country = 2 lettres (ex. FR), currency = 3 lettres (ex. EUR)." }, 400);
  }

  const headers = { "X-API-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" };

  // 1. Fiche produit — sert aussi à trouver quel environnement accepte la clé.
  let env: keyof typeof BASES = "sandbox";
  let productRes = await fetch(`${BASES.sandbox}/products/${encodeURIComponent(sku)}`, { headers });
  if (productRes.status === 401 || productRes.status === 403) {
    env = "live";
    productRes = await fetch(`${BASES.live}/products/${encodeURIComponent(sku)}`, { headers });
  }
  const product = await parse(productRes);
  if (!productRes.ok) {
    return json({
      ok: false, env, sku,
      error: productRes.status === 404
        ? "SKU inconnu chez Prodigi : vérifie-le dans le catalogue."
        : `Prodigi a répondu ${productRes.status}.`,
      status: productRes.status, prodigi: product,
    }, 502);
  }
  const base = BASES[env];

  const wantQuote = !!q.get("quote");
  const wantSpine = !!q.get("spine");
  if (!wantQuote && !wantSpine) {
    return json({ ok: true, env, sku, product });
  }

  // Quelles tailles ?
  let sizes: number[] = [];
  if (q.get("pageCount")) {
    const n = Number(q.get("pageCount"));
    if (!Number.isInteger(n) || n < 2 || n > 500 || n % 2 !== 0) {
      return json({ ok: false, error: `pageCount doit être un nombre pair (reçu : ${q.get("pageCount")}).` }, 400);
    }
    sizes = [n];
  } else if (q.get("all")) {
    for (let n = 30; n <= 200; n += 2) sizes.push(n);
  } else {
    sizes = [30, 40, 60, 80, 100, 120, 150, 200];
  }

  const errors: unknown[] = [];

  // Zones d'impression du produit (ex. « default », ou couverture / pages) : on y met le nombre de pages.
  const printAreas = Object.keys((product as any)?.product?.printAreas ?? {});
  // Attributs : si le SKU n'a qu'une variante, on reprend ses attributs ; sinon, à préciser plus tard.
  const variants = (product as any)?.product?.variants ?? [];
  const attributes = variants.length === 1 ? (variants[0]?.attributes ?? {}) : {};

  // Prodigi limite à 30 appels par 30 s (erreur 429) : lots de 5, pause entre les lots, et on réessaie après un 429.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const call = async (url: string, body: unknown) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (res.status !== 429) return res;
      await sleep(10_000);
    }
    return await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  };

  const results: { pageCount: number; raw: unknown }[] = [];
  for (let i = 0; i < sizes.length; i += 5) {
    if (i > 0 && sizes.length > 10) await sleep(5_500);
    const batch = sizes.slice(i, i + 5);
    const out = await Promise.all(batch.map(async (pageCount) => {
      try {
        let res: Response;
        if (wantSpine) {
          res = await call(`${base}/products/spine`, { sku, destinationCountryCode: country, numberOfPages: pageCount, pageCount });
        } else {
          const assets = (printAreas.length ? printAreas : ["default"]).map((printArea) => ({ printArea, pageCount }));
          res = await call(`${base}/quotes`, {
            destinationCountryCode: country,
            currencyCode: currency,
            items: [{ sku, copies: 1, attributes, assets }],
          });
        }
        const raw = await parse(res);
        if (!res.ok) { errors.push({ pageCount, status: res.status, prodigi: raw }); return null; }
        return { pageCount, raw };
      } catch (e) {
        errors.push({ pageCount, error: (e as Error).message });
        return null;
      }
    }));
    for (const r of out) if (r) results.push(r);
  }

  return json({
    ok: results.length > 0, env, sku, country, currency,
    mode: wantSpine ? "spine" : "quote",
    printAreas, attributes,
    results, errors,
  }, results.length > 0 ? 200 : 502);
});
