// supabase/functions/imprimeur-catalogue/index.ts
// Fonction serveur (Deno) : interroge imprimeur.fr et renvoie en UNE réponse :
//   · le catalogue (produits, formats en mm, finitions, pages min/max/pas, prix unitaire, prix page en plus) ;
//   · les frais de livraison de chaque variante commandable (POST /shipping/rates, adresse FICTIVE : rien n'est commandé) ;
//   · les specs des fichiers à fournir (l'API n'en donne pas : voir `files`, tiré de la doc et des fiches produit).
//
// La clé est dans les secrets Supabase (ImprimeurFR_API_Key) : elle ne quitte jamais le serveur.
// Clé `impr_test_*` = répétition (rien d'imprimé ni facturé) ; `impr_live_*` = vraies commandes.
// Cette fonction ne fait QUE des lectures (GET /products, POST /shipping/rates = simple calcul).
//
// Appels :
//   GET .../functions/v1/imprimeur-catalogue                       → catalogue + livraison (France) + specs
//   Options : ?country=FR (défaut FR) · &postal_code=75001 · &quantity=1 (copies par ligne, défaut 1)
//             &shipping=0 → sans les frais de livraison (plus rapide)
//             &products=album,print → limite les produits (défaut : tous)
//             &raw=1 → ajoute la réponse brute de /products
//
// Limite de l'API : 120 appels / minute / clé → on appelle par paquets de 4.
//
// ⚠️ Version d'essai : déployée sans vérification de connexion (--no-verify-jwt), comme les fonctions Gelato.
//    À protéger par une connexion avant la mise en ligne publique (les prix sont ceux de TON compte).

const BASE = "https://imprimeur.fr/api/v1";
const MAX_SHIPPING_CALLS = 80;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const parse = async (res: Response) => {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
};

// Réessaie un appel quand l'échec est PASSAGER : serveur surchargé (502 / 503 / 504), trop d'appels (429)
// ou coupure réseau. Attente 2 s puis 4 s (3 tentatives en tout). Les vraies erreurs (401, 404, 422…)
// ne sont jamais réessayées. Imprimeur.fr demande parfois 60 s d'attente : trop long pour une fonction, on plafonne.
const RETRY_STATUS = new Set([429, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function fetchRetry(url: string, init: RequestInit, tries = 3): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!RETRY_STATUS.has(res.status) || attempt === tries) return res;
      await res.body?.cancel();
    } catch (e) {
      lastErr = e;
      if (attempt === tries) throw e;
    }
    await sleep(2000 * 2 ** (attempt - 1));
  }
  throw lastErr;
}

// Specs de fichiers : l'API REST n'en publie aucune. Ce bloc vient de la doc (imprimeur.fr/docs/api), des fiches produit
// (imprimeur.fr/catalog/…) et des GABARITS PDF reçus d'imprimeur.fr (9 nov. 2026, 4 formats lus un par un).
const FILES = {
  source: "imprimeur.fr/docs/api + fiches produit (pas d'endpoint API pour les specs)",
  common: {
    delivery: "Les fichiers ne sont PAS envoyés à l'API : on donne des URL http(s) publiques (file_urls) que imprimeur.fr télécharge.",
    redirects: "Les redirections sont suivies.",
    bigFiles: "Au-delà de 8 MiB, le serveur du fichier doit répondre Accept-Ranges: bytes.",
    typeDetection: "Type déduit de Content-Disposition, puis de l'extension, puis de Content-Type.",
    deadLink: "Lien mort → erreur 422 avec la ligne et la position.",
  },
  album: {
    file: "UN SEUL PDF ; le nombre de pages est lu dans le fichier.",
    // Gabarit layflat (livre de 24 pages = PDF de 26 pages) : page 1 = couverture de face · pages 1 → N · dernière page = couverture de dos.
    // Pas de dos / tranche, pas de page blanche, pas de couverture à plat.
    structure: "couverture de face, pages 1 à N une par une, couverture de dos (N + 2 pages au total)",
    // Chaque page du gabarit = le format exact (210×297, 297×210, 210×150, 150×210 mm), MediaBox = TrimBox = BleedBox : pas de fond perdu.
    // La fiche album d'imprimeur.fr parle de « 5 mm de fond perdu » : contradiction → on suit les gabarits, à valider par une commande test.
    bleedMm: 0,
    bleedMmFicheProduit: 5,
    cropMarks: false,
    unknown: ["dpi minimum", "zone de sécurité", "poids max", "profil couleur", "fond perdu réel (gabarit 0 mm vs fiche 5 mm)"],
  },
  print: {
    file: "UN JPG/JPEG/PNG PAR TIRAGE (une URL par photo).",
    ratio: "Si le ratio ne correspond pas au format, l'image est centrée.",
    minPerOrder: 20,
    unknown: ["dpi minimum", "fond perdu", "poids max"],
  },
  poster: { file: "JPG/PNG, une image par exemplaire.", unknown: ["dpi minimum", "fond perdu"] },
  frame: { file: "JPG/PNG, une image par exemplaire.", unknown: ["dpi minimum", "fond perdu"] },
};

type Variant = {
  format_code: string;
  finition_code: string;
  orderable?: boolean;
  pages?: { min: number | null; max: number | null; step: number | null; base: number | null };
  unit_price?: unknown;
  extra_page_price?: unknown;
};
type Product = {
  id: string;
  name: string;
  pages_unit: string | null;
  formats: { code: string; label: string; width_mm: number; height_mm: number; orientation: string }[];
  finitions: { code: string; label: string }[];
  variants: Variant[];
};

Deno.serve(async (req) => {
  const apiKey = Deno.env.get("ImprimeurFR_API_Key");
  if (!apiKey) {
    return json({ ok: false, error: "Secret ImprimeurFR_API_Key introuvable dans Supabase (Edge Functions → Secrets)." }, 500);
  }
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
  // Seul le préfixe (impr_test_ / impr_live_) est renvoyé, jamais la clé.
  const keyMode = apiKey.startsWith("impr_live_") ? "live" : apiKey.startsWith("impr_test_") ? "test" : "inconnu";

  const q = new URL(req.url).searchParams;
  const country = (q.get("country") ?? "FR").toUpperCase();
  const postalCode = q.get("postal_code") ?? "75001";
  const quantity = Math.max(1, Math.floor(Number(q.get("quantity") ?? 1)) || 1);
  const withShipping = q.get("shipping") !== "0";
  const only = q.get("products")?.split(",").map((s) => s.trim()).filter(Boolean);
  if (!/^[A-Z]{2}$/.test(country)) {
    return json({ ok: false, error: "country = 2 lettres (ex. FR)." }, 400);
  }

  const errors: unknown[] = [];

  // 1. Catalogue
  let rawProducts: { data: Product[] } | null = null;
  try {
    const res = await fetchRetry(`${BASE}/products`, { headers });
    const body = await parse(res);
    if (!res.ok) {
      return json({ ok: false, keyMode, error: "GET /products refusé", status: res.status, imprimeur: body }, res.status === 401 ? 401 : 502);
    }
    rawProducts = body;
  } catch (e) {
    return json({ ok: false, keyMode, error: `GET /products injoignable : ${(e as Error).message}` }, 502);
  }
  let products: Product[] = rawProducts?.data ?? [];
  if (only?.length) products = products.filter((p) => only.includes(p.id));

  // Pour chaque variante : taille du fichier PDF à fournir (format + fond perdu) quand on connaît le fond perdu.
  const catalogue = products.map((p) => {
    const bleed = (FILES as Record<string, { bleedMm?: number }>)[p.id]?.bleedMm;
    const fmt = new Map(p.formats.map((f) => [f.code, f]));
    return {
      id: p.id,
      name: p.name,
      pagesUnit: p.pages_unit,
      formats: p.formats,
      finitions: p.finitions,
      variants: p.variants.map((v) => {
        const f = fmt.get(v.format_code);
        return {
          ...v,
          // Page à fournir = format + fond perdu de chaque côté (gabarits : fond perdu 0 → page = format exact).
          fileMm: f && bleed !== undefined ? { width: f.width_mm + 2 * bleed, height: f.height_mm + 2 * bleed, bleed } : undefined,
        };
      }),
    };
  });

  // 2. Livraison : un tarif par variante commandable (le port est un forfait par commande, fixé par
  //    format + destination + transporteur, pas par nombre d'exemplaires).
  const shipping: { product_id: string; format_code: string; finition_code: string; quantity: number; rates?: unknown; error?: unknown }[] = [];
  if (withShipping) {
    const jobs: { product_id: string; format_code: string; finition_code: string }[] = [];
    for (const p of products) {
      for (const v of p.variants) {
        if (v.orderable === false) continue;
        jobs.push({ product_id: p.id, format_code: v.format_code, finition_code: v.finition_code });
      }
    }
    if (jobs.length > MAX_SHIPPING_CALLS) {
      errors.push({ shipping: true, warning: `${jobs.length} variantes : seules les ${MAX_SHIPPING_CALLS} premières sont chiffrées (limite 120 appels/min). Utilise ?products=…` });
      jobs.length = MAX_SHIPPING_CALLS;
    }
    // Adresse FICTIVE : /shipping/rates ne commande ni ne facture rien.
    const address = {
      first_name: "Test",
      last_name: "Pellicule",
      street: "10 rue de Rivoli",
      postal_code: postalCode,
      city: "Paris",
      country,
      phone: "0600000000",
    };
    for (let i = 0; i < jobs.length; i += 4) {
      const batch = jobs.slice(i, i + 4);
      const results = await Promise.all(batch.map(async (job) => {
        try {
          const res = await fetchRetry(`${BASE}/shipping/rates`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ items: [{ ...job, quantity }], shipping: { address } }),
          });
          const body = await parse(res);
          if (!res.ok) return { ...job, quantity, error: { status: res.status, imprimeur: body } };
          return { ...job, quantity, rates: (body as { rates?: unknown }).rates ?? body, currency: (body as { currency?: string }).currency };
        } catch (e) {
          return { ...job, quantity, error: (e as Error).message };
        }
      }));
      shipping.push(...results);
    }
  }

  return json({
    ok: true,
    keyMode,
    country,
    note: "Prix en HT (EUR), sous forme de texte décimal. Les frais de port sont un forfait par commande.",
    catalogue,
    shipping,
    files: FILES,
    errors,
    ...(q.get("raw") ? { raw: rawProducts } : {}),
  });
});
