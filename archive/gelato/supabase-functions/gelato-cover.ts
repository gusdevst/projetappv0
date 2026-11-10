// supabase/functions/gelato-cover/index.ts
// Fonction serveur (Deno) : demande à Gelato les dimensions de la couverture à plat
// (largeur du dos, couverture avant / arrière, fond perdu) du livre photo 21×28 cm.
//
// La clé Gelato est dans les secrets Supabase (GELATO_API_KEY) : elle ne quitte jamais le serveur.
// L'app n'envoie QUE le nombre de pages ; le produit est fixé ici (pas de choix côté client).
//
// Appel :  GET .../functions/v1/gelato-cover?pageCount=30
// Réponse : { ok: true, pageCount, productUid, gelato: <réponse brute de Gelato> }
//           ou { ok: false, error, status?, gelato? }
//
// ⚠️ Version d'essai : déployée sans vérification de connexion (--no-verify-jwt) pour pouvoir la tester
//    avec curl. Avant la mise en ligne publique, elle exigera un compte connecté (voir CLAUDE.md).

const PRODUCT_UID =
  "photobooks-hardcover_pf_210x280-mm-8x11-inch_pt_170-gsm-65lb-coated-silk_cl_4-4_ccl_4-4_bt_glued-left_ct_matt-lamination_prt_1-0_cpt_130-gsm-65-lb-cover-coated-silk_ver";

const PAGES = { min: 30, max: 200, step: 2 };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

Deno.serve(async (req) => {
  const apiKey = Deno.env.get("GELATO_API_KEY");
  if (!apiKey) {
    return json({ ok: false, error: "Secret GELATO_API_KEY introuvable dans Supabase (Edge Functions → Secrets)." }, 500);
  }

  // Nombre de pages : entier pair entre 30 et 200 (même règle que l'app).
  const raw = new URL(req.url).searchParams.get("pageCount");
  const pageCount = Number(raw);
  if (!Number.isInteger(pageCount) || pageCount < PAGES.min || pageCount > PAGES.max || pageCount % PAGES.step !== 0) {
    return json({ ok: false, error: `pageCount doit être un nombre pair entre ${PAGES.min} et ${PAGES.max} (reçu : ${raw}).` }, 400);
  }

  const url = `https://product.gelatoapis.com/v3/products/${PRODUCT_UID}/cover-dimensions?pageCount=${pageCount}`;
  try {
    const res = await fetch(url, { headers: { "X-API-KEY": apiKey } });
    const text = await res.text();
    let gelato: unknown = text;
    try { gelato = JSON.parse(text); } catch { /* réponse non JSON : on la renvoie telle quelle */ }

    if (!res.ok) {
      return json({ ok: false, error: `Gelato a répondu ${res.status}.`, status: res.status, gelato }, 502);
    }
    return json({ ok: true, pageCount, productUid: PRODUCT_UID, gelato });
  } catch (e) {
    return json({ ok: false, error: `Impossible de joindre Gelato : ${(e as Error).message}` }, 502);
  }
});
