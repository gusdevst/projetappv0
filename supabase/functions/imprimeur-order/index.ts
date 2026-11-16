// supabase/functions/imprimeur-order/index.ts
// Fonction serveur (Deno) : transmet une commande de LIVRE PHOTO à imprimeur.fr, puis relit son avancement.
// TIRAGES SIMPLES (kind = 'print', 16 nov. 2026) : même principe que les posters (vérifie, recalcule le prix, « received », rien chez imprimeur.fr).
// POSTERS (kind = 'poster', ajouté le 16 nov. 2026) : « submit » vérifie la commande (compte, fichier, adresse), RECALCULE le prix
// et la passe en « received » (Reçue par Pellicule). ELLE N'EST PAS ENVOYÉE À imprimeur.fr (décision d'Augustin) : aucun appel
// à l'API imprimeur pour un poster, quelle que soit la clé. Le jour où l'envoi sera branché, c'est ici qu'il se fera.
//
//   POST { action: "submit",  orderId }  → vérifie, recalcule le prix, crée la commande chez imprimeur.fr
//   POST { action: "refresh", orderId }  → relit le statut + le numéro de suivi chez imprimeur.fr
//
// Ce que l'app a déjà fait avant « submit » : une ligne `orders` en « draft » (adresse recopiée), le PDF déposé dans le
// dossier privé `print-files`, la ligne passée en « file_ready » (voir supabase/sql/orders_et_adresses.sql).
//
// SÉCURITÉ
//  · Déployer SANS `--no-verify-jwt` : seul un compte connecté peut appeler. On re-vérifie en plus que la commande lui appartient.
//  · Le PRIX est recalculé ici (table PRICING) : l'app ne l'envoie jamais.
//  · GARDE-FOU CLÉ LIVE : avec une clé `impr_live_*`, la fonction REFUSE de commander tant que le secret
//    ORDERS_LIVE n'est pas « true ». Une clé live mise par erreur ne peut donc pas lancer une vraie commande.
//  · Aucune clé imprimeur.fr ne quitte ce serveur.
//
// Secrets utilisés : ImprimeurFR_API_Key (déjà là) · ORDERS_LIVE (facultatif) · SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (fournis par Supabase).
// Déployer :  npx supabase functions deploy imprimeur-order
//
// ⚠️ Doc imprimeur.fr : `siret_required` (403) peut aussi toucher les clés de TEST tant que le SIRET n'est pas saisi chez eux.
//    Dans ce cas la commande reste « file_ready » avec un message clair, rien n'est perdu : on réessaiera.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE = "https://imprimeur.fr/api/v1";
const BUCKET = "print-files";
const SIGNED_URL_SECONDS = 60 * 60 * 6; // lien de téléchargement du PDF valable 6 h (imprimeur.fr le récupère tout de suite)

// Produit de l'app → produit imprimeur.fr (layflat, couverture rigide, ouverture à plat).
const PRODUCTS: Record<string, { format_code: string; finition_code: string }> = {
  a4:      { format_code: "21x29.7cm", finition_code: "layflat" },
  paysage: { format_code: "21x15cm",   finition_code: "layflat" },
};

// Prix de vente TTC en centimes, livraison comprise (miroir de services/bookProducts.js, décidé par Augustin le 9 nov. 2026).
// 24 pages incluses, puis un prix par page en plus. À garder identique côté app.
const PRICING: Record<string, { base: number; extra: number; minPages: number; maxPages: number }> = {
  a4:      { base: 3490, extra: 65, minPages: 24, maxPages: 120 },
  paysage: { base: 2990, extra: 65, minPages: 24, maxPages: 120 },
};

// Posters : prix de vente TTC par exemplaire, livraison comprise (miroir de services/posterProducts.js). À garder identique côté app.
const POSTER_PRICING: Record<string, number> = { a4: 1490, a3: 1790, a2: 2790, a1: 3490 };
const POSTER_MAX_QTY = 10;
// Tirages simples (kind = 'print') : 20 tirages minimum, 1 490 € TTC pour 20 + 0,35 € par tirage en plus (EXEMPLE d'Augustin, miroir de
// services/printProducts.js : à garder identique côté app).
const PRINT_FORMATS = ["10x15", "10x10"];
const PRINT_MIN = 20, PRINT_MAX = 1000, PRINT_BASE_CENTS = 1490, PRINT_EXTRA_CENTS = 35;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

// Statut imprimeur.fr → statut de l'app.
const STATUS_MAP: Record<string, string> = {
  "new": "transmitted", "not-paid": "transmitted", "transmitted": "transmitted",
  "printed": "printed", "mailed": "mailed", "delivered": "delivered", "cancelled": "cancelled",
};

const parse = async (res: Response) => {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
};

// « Camille Martin » → prénom « Camille », nom « Martin » ; un seul mot → il sert pour les deux (l'API exige les deux).
function splitName(full: string): { first_name: string; last_name: string } {
  const parts = String(full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: parts[0] };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, code: "method", error: "POST seulement." }, 405);

  const apiKey = Deno.env.get("ImprimeurFR_API_Key");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !url || !serviceKey) return json({ ok: false, code: "config", error: "Secrets serveur manquants." }, 500);

  const keyMode = apiKey.startsWith("impr_live_") ? "live" : apiKey.startsWith("impr_test_") ? "test" : "unknown";
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1. Qui appelle ? (jeton de connexion de l'app)
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ ok: false, code: "unauthorized", error: "Connexion requise." }, 401);
  const uid = userData.user.id;

  let body: { action?: string; orderId?: string };
  try { body = await req.json(); } catch { return json({ ok: false, code: "bad_request", error: "Corps JSON attendu." }, 400); }
  const action = body.action ?? "submit";
  const orderId = body.orderId;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) return json({ ok: false, code: "bad_request", error: "orderId invalide." }, 400);

  // 2. La commande doit exister et appartenir à l'appelant.
  const { data: order, error: orderErr } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (orderErr || !order) return json({ ok: false, code: "not_found", error: "Commande introuvable." }, 404);
  if (order.user_id !== uid) return json({ ok: false, code: "forbidden", error: "Cette commande n'est pas la tienne." }, 403);

  const headers = { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };

  // ── Relire l'avancement ─────────────────────────────────────────────────────
  if (action === "refresh") {
    if (!order.supplier_ref) return json({ ok: true, order });
    try {
      const res = await fetch(`${BASE}/orders/${encodeURIComponent(order.supplier_ref)}`, { headers });
      const data = await parse(res);
      if (!res.ok) return json({ ok: true, order, warning: `Suivi indisponible (${res.status}).` });
      const status = STATUS_MAP[data?.status] ?? order.status;
      const tracking = data?.shipping?.tracking_number ?? order.tracking_number ?? null;
      const { data: updated } = await admin.from("orders")
        .update({ status, tracking_number: tracking, updated_at: new Date().toISOString() })
        .eq("id", orderId).select("*").single();
      return json({ ok: true, order: updated ?? order });
    } catch (e) {
      return json({ ok: true, order, warning: `Suivi injoignable : ${(e as Error).message}` });
    }
  }

  if (action !== "submit") return json({ ok: false, code: "bad_request", error: "action inconnue." }, 400);

  // ── Tirages simples : on enregistre, on N'ENVOIE PAS à imprimeur.fr ───────────
  if (order.kind === "print") {
    if (["received", "transmitted", "printed", "mailed", "delivered"].includes(order.status)) return json({ ok: true, order, already: true });
    if (order.status === "cancelled") return json({ ok: false, code: "cancelled", error: "Commande annulée." }, 409);
    if (!order.file_path) return json({ ok: false, code: "no_file", error: "Les photos n'ont pas encore été envoyées." }, 409);
    if (!PRINT_FORMATS.includes(order.product)) return json({ ok: false, code: "bad_product", error: "Format de tirage inconnu." }, 422);
    const n = Number(order.quantity);
    if (!Number.isInteger(n) || n < PRINT_MIN || n > PRINT_MAX) return json({ ok: false, code: "bad_quantity", error: `Nombre de tirages invalide (${PRINT_MIN} à ${PRINT_MAX}).` }, 422);
    const ta = order.address ?? {};
    if ((ta.country ?? "FR") !== "FR") return json({ ok: false, code: "country", error: "Livraison en France seulement pour le moment." }, 422);
    if (!ta.name || !ta.street || !ta.postal_code || !ta.city || !ta.phone) return json({ ok: false, code: "bad_address", error: "Adresse incomplète." }, 422);
    // Toutes les photos sont-elles bien dans le dossier ? (une par tirage)
    const files: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: page, error: listErr } = await admin.storage.from(BUCKET).list(order.file_path, { limit: 1000, offset });
      if (listErr) return json({ ok: false, code: "no_file", error: "Dossier des photos illisible." }, 409);
      files.push(...(page ?? []).filter((f) => f.name).map((f) => f.name));
      if (!page || page.length < 1000) break;
    }
    if (files.length < n) {
      await admin.from("orders").update({ status: "draft", error: `Photos manquantes (${files.length} / ${n}).`, updated_at: new Date().toISOString() }).eq("id", orderId);
      return json({ ok: false, code: "no_file", error: `Il manque des photos (${files.length} sur ${n}) : il faut les renvoyer.` }, 409);
    }
    const price = PRINT_BASE_CENTS + Math.max(0, n - PRINT_MIN) * PRINT_EXTRA_CENTS;
    const { data: heldPrint } = await admin.from("orders").update({
      status: "received", price_cents: price, supplier: null, supplier_ref: null,
      test: keyMode !== "live", error: null, updated_at: new Date().toISOString(),
    }).eq("id", orderId).select("*").single();
    return json({ ok: true, order: heldPrint, held: true });
  }

  // ── Poster : on enregistre, on N'ENVOIE PAS à imprimeur.fr ───────────────────
  if (order.kind === "poster") {
    if (["received", "transmitted", "printed", "mailed", "delivered"].includes(order.status)) return json({ ok: true, order, already: true });
    if (order.status === "cancelled") return json({ ok: false, code: "cancelled", error: "Commande annulée." }, 409);
    if (!order.file_path) return json({ ok: false, code: "no_file", error: "Le fichier du poster n'a pas encore été envoyé." }, 409);
    const unit = POSTER_PRICING[order.product];
    if (!unit) return json({ ok: false, code: "bad_product", error: "Format de poster inconnu." }, 422);
    const qty = Number(order.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > POSTER_MAX_QTY) return json({ ok: false, code: "bad_quantity", error: "Quantité invalide (1 à 10)." }, 422);
    const pa = order.address ?? {};
    if ((pa.country ?? "FR") !== "FR") return json({ ok: false, code: "country", error: "Livraison en France seulement pour le moment." }, 422);
    if (!pa.name || !pa.street || !pa.postal_code || !pa.city || !pa.phone) return json({ ok: false, code: "bad_address", error: "Adresse incomplète." }, 422);
    // Le fichier est-il bien dans le stockage ? (on ne garde qu'une commande dont le fichier existe)
    const { error: fileErr } = await admin.storage.from(BUCKET).createSignedUrl(order.file_path, 60);
    if (fileErr) {
      await admin.from("orders").update({ status: "draft", error: "Fichier introuvable dans le stockage.", updated_at: new Date().toISOString() }).eq("id", orderId);
      return json({ ok: false, code: "no_file", error: "Fichier introuvable : il faut le renvoyer." }, 409);
    }
    const { data: held } = await admin.from("orders").update({
      status: "received", price_cents: unit * qty, supplier: null, supplier_ref: null,
      test: keyMode !== "live", error: null, updated_at: new Date().toISOString(),
    }).eq("id", orderId).select("*").single();
    return json({ ok: true, order: held, held: true });
  }

  // ── Transmettre ─────────────────────────────────────────────────────────────
  // Déjà transmise : on renvoie telle quelle (rejouer « submit » ne commande jamais deux fois).
  if (["transmitted", "printed", "mailed", "delivered"].includes(order.status)) return json({ ok: true, order, already: true });
  if (order.status === "cancelled") return json({ ok: false, code: "cancelled", error: "Commande annulée." }, 409);
  if (!order.file_path) return json({ ok: false, code: "no_file", error: "Le fichier du livre n'a pas encore été envoyé." }, 409);

  // Garde-fou : une clé live ne commande que si ORDERS_LIVE = "true".
  if (keyMode === "live" && Deno.env.get("ORDERS_LIVE") !== "true") {
    return json({ ok: false, code: "orders_disabled", error: "Les commandes réelles ne sont pas activées (secret ORDERS_LIVE)." }, 403);
  }
  if (keyMode === "unknown") return json({ ok: false, code: "config", error: "Clé imprimeur.fr de type inconnu." }, 500);

  const product = PRODUCTS[order.product];
  const pricing = PRICING[order.product];
  if (!product || !pricing) return json({ ok: false, code: "bad_product", error: "Produit inconnu." }, 422);
  const pages = Number(order.pages);
  if (!Number.isInteger(pages) || pages < pricing.minPages || pages > pricing.maxPages || pages % 2 !== 0) {
    return json({ ok: false, code: "bad_pages", error: `Nombre de pages invalide (${pricing.minPages} à ${pricing.maxPages}, pair).` }, 422);
  }
  // Prix recalculé ICI (TTC, livraison comprise).
  const priceCents = pricing.base + Math.max(0, pages - pricing.minPages) * pricing.extra;

  // Adresse de livraison (France seulement au début).
  const a = order.address ?? {};
  if ((a.country ?? "FR") !== "FR") return json({ ok: false, code: "country", error: "Livraison en France seulement pour le moment." }, 422);
  if (!a.name || !a.street || !a.postal_code || !a.city || !a.phone) {
    return json({ ok: false, code: "bad_address", error: "Adresse incomplète." }, 422);
  }
  const street = a.complement ? `${a.street}, ${a.complement}` : a.street;

  // Lien temporaire pour que imprimeur.fr télécharge le PDF.
  const { data: signed, error: signErr } = await admin.storage.from(BUCKET).createSignedUrl(order.file_path, SIGNED_URL_SECONDS);
  if (signErr || !signed?.signedUrl) {
    await admin.from("orders").update({ status: "draft", error: "Fichier introuvable dans le stockage.", updated_at: new Date().toISOString() }).eq("id", orderId);
    return json({ ok: false, code: "no_file", error: "Fichier introuvable : il faut le renvoyer." }, 409);
  }

  const payload = {
    external_id: order.id,
    items: [{
      product_id: "album",
      format_code: product.format_code,
      finition_code: product.finition_code,
      quantity: 1,
      file_urls: [signed.signedUrl],
    }],
    shipping: {
      carrier: "colissimo",
      express: false,
      address: { ...splitName(a.name), street, postal_code: a.postal_code, city: a.city, country: "FR", phone: a.phone },
    },
  };

  let res: Response;
  try {
    res = await fetch(`${BASE}/orders`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", "Idempotency-Id": `pellicule-${order.id}` },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return json({ ok: false, code: "network", error: `imprimeur.fr injoignable : ${(e as Error).message}` }, 502);
  }
  const data = await parse(res);

  // Déjà passée chez eux (rejeu) : on récupère la référence et on continue comme un succès.
  if (res.status === 409 && data?.error?.order_id) {
    const { data: updated } = await admin.from("orders").update({
      status: "transmitted", supplier: "imprimeur", supplier_ref: String(data.error.order_id),
      price_cents: priceCents, test: keyMode !== "live", error: null, updated_at: new Date().toISOString(),
    }).eq("id", orderId).select("*").single();
    return json({ ok: true, order: updated, already: true });
  }

  if (!res.ok) {
    const code = data?.error?.code ?? `http_${res.status}`;
    const message = data?.error?.message ?? data?.message ?? `Refus d'imprimeur.fr (${res.status})`;
    // On garde « file_ready » : rien n'est perdu, l'app pourra réessayer.
    await admin.from("orders").update({ status: "file_ready", error: `${code} : ${message}`.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", orderId);
    const clientStatus = res.status === 422 ? 422 : res.status === 403 ? 403 : 502;
    return json({ ok: false, code, error: message, details: res.status === 422 ? data?.errors : undefined }, clientStatus);
  }

  const { data: updated } = await admin.from("orders").update({
    status: STATUS_MAP[data?.status] ?? "transmitted",
    supplier: "imprimeur",
    supplier_ref: String(data?.id ?? ""),
    price_cents: priceCents,
    test: (data?.environment ?? keyMode) !== "live",
    error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", orderId).select("*").single();

  return json({ ok: true, order: updated });
});
