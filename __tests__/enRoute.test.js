// Tests de services/enRoute.js : le bloc « En route » du Labo (tout ce qui est parti à l'impression).
// Fonction PURE : elle reçoit les commandes + les abonnements et renvoie des lignes prêtes à afficher.
// Horloge injectée (`now`) : « maintenant » = mardi 17 nov. 2026, midi UTC.
// (Le fichier importe bookOrder, qui importe Supabase : on le remplace par le faux serveur, voir helpers/fakeBackend.js.)
jest.mock("../services/supabase", () => require("./helpers/fakeBackend").supabaseModule);
jest.mock("expo-file-system/legacy", () => require("./helpers/fakeBackend").fileSystemModule);
jest.mock("../services/addresses", () => ({ addressSnapshot: (a) => a }));

import { buildEnRoute, DELIVERED_KEEP_DAYS } from "../services/enRoute";

const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 17, 12, 0, 0);
const iso = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();
const build = (args) => buildEnRoute({ now: NOW, ...args });

// Une commande de livre « transmise il y a 3 jours »
const order = (extra = {}) => ({ id: "o1", kind: "book", status: "transmitted", product: "a4", pages: 24, title: "Été 2026", album_id: "alb1", created_at: iso(3), updated_at: iso(3), ...extra });

describe("commandes de livres, posters et tirages", () => {
  test("rien du tout : liste vide", () => {
    expect(build({})).toEqual([]);
    expect(build({ orders: [], subs: [], selections: {} })).toEqual([]);
  });

  test("une commande annulée n'apparaît JAMAIS", () => {
    expect(build({ orders: [order({ status: "cancelled" })] })).toEqual([]);
  });

  test("livre transmis : en cours, 1re étape, avec titre, détail et date de commande", () => {
    const [it] = build({ orders: [order()] });
    expect(it).toMatchObject({
      key: "book-o1", type: "book", tone: "go", step: 0, title: "Été 2026",
      subtitle: "Livre photo · 24 pages · commandé le 14 nov.", statusLabel: "Transmise à l'imprimeur", albumId: "alb1",
      nav: { name: "OrderTracking", params: { orderId: "o1" } },
    });
  });

  test("avancement : imprimée = étape 1, expédiée = étape 2 (avec « Colissimo »), livrée = étape 3", () => {
    expect(build({ orders: [order({ status: "printed" })] })[0]).toMatchObject({ step: 1, statusLabel: "Imprimée" });
    expect(build({ orders: [order({ status: "mailed" })] })[0]).toMatchObject({ step: 2, statusLabel: "Expédiée · Colissimo", tone: "go" });
    expect(build({ orders: [order({ status: "delivered", updated_at: iso(1) })] })[0]).toMatchObject({ step: 3, tone: "ok", statusLabel: "✓ Livrée le 16 nov." });
  });

  describe("livrée : visible 14 jours, puis seulement dans « Mes commandes »", () => {
    test("la limite", () => {
      expect(DELIVERED_KEEP_DAYS).toBe(14);
      expect(build({ orders: [order({ status: "delivered", updated_at: iso(13) })] })).toHaveLength(1);
      expect(build({ orders: [order({ status: "delivered", updated_at: iso(14) })] })).toHaveLength(1); // pile 14 jours : encore là
      expect(build({ orders: [order({ status: "delivered", updated_at: iso(14.1) })] })).toEqual([]);
      expect(build({ orders: [order({ status: "delivered", updated_at: iso(60) })] })).toEqual([]);
    });
    test("une commande NON livrée, même très ancienne, reste affichée", () => {
      expect(build({ orders: [order({ status: "mailed", created_at: iso(90), updated_at: iso(90) })] })).toHaveLength(1);
    });
  });

  describe("commande à reprendre (brouillon, « à transmettre », échec)", () => {
    test.each([
      ["draft", "Commande non envoyée"],
      ["file_ready", "Commande à transmettre"],
      ["failed", "Commande à reprendre"],
    ])("%s → orange, étape -1, bouton « reprendre »", (status, label) => {
      const o = order({ status });
      const [it] = build({ orders: [o] });
      expect(it).toMatchObject({ tone: "todo", step: -1, statusLabel: label, resume: true, subtitle: "Livre photo · 24 pages" });
      expect(it.order).toEqual(o); // la commande est jointe (pour « Abandonner »)
    });

    test("chaque type rouvre SON écran de reprise, avec l'id de la commande", () => {
      const items = build({ orders: [
        order({ id: "b", kind: "book" }),
        order({ id: "p", kind: "poster", status: "draft", product: "a3", quantity: 1 }),
        order({ id: "t", kind: "print", status: "file_ready", product: "10x15", quantity: 20 }),
      ].map((o) => (o.id === "b" ? { ...o, status: "draft" } : o)) });
      const nav = Object.fromEntries(items.map((i) => [i.type, i.nav]));
      expect(nav.book).toEqual({ name: "BookOrderProgress", params: { orderId: "b", albumId: "alb1" } });
      expect(nav.poster.name).toBe("PosterOrderProgress");
      expect(nav.print.name).toBe("PrintOrderProgress");
      expect(nav.poster.params.orderId).toBe("p");
    });
  });

  describe("poster et tirages « reçus » (enregistrés chez Pellicule, pas transmis)", () => {
    test("poster", () => {
      const [it] = build({ orders: [order({ id: "p", kind: "poster", status: "received", product: "a3", quantity: 2, title: "Mer" })] });
      expect(it).toMatchObject({
        key: "poster-p", type: "poster", tone: "go", step: 0, title: "Mer", statusLabel: "Commande reçue",
        subtitle: "Poster A3 × 2 · commandé le 14 nov.", nav: { name: "OrderTracking", params: { orderId: "p" } },
      });
    });
    test("poster d'un seul exemplaire : pas de « × 1 »", () => {
      const [it] = build({ orders: [order({ kind: "poster", status: "received", product: "a1", quantity: 1, title: "" })] });
      expect(it.subtitle).toBe("Poster A1 · commandé le 14 nov.");
      expect(it.title).toBe("Poster"); // titre de secours
    });
    test("tirages", () => {
      const [it] = build({ orders: [order({ kind: "print", status: "received", product: "10x15", quantity: 40, title: "" })] });
      expect(it).toMatchObject({ type: "print", title: "Tirages", statusLabel: "Commande reçue", subtitle: "Tirages 10 × 15 cm · 40 · commandé le 14 nov." });
    });
    test("livre sans titre : « Livre photo »", () => {
      expect(build({ orders: [order({ title: "" })] })[0].title).toBe("Livre photo");
    });
  });

  test("dates absentes ou illisibles : pas de plantage (on prend « maintenant »)", () => {
    const [it] = build({ orders: [order({ created_at: null, updated_at: undefined })] });
    expect(it.subtitle).toContain("commandé le 17 nov.");
  });

  describe("ordre d'affichage : à reprendre, puis en cours (récent en haut), puis livrées", () => {
    test("mélange de tout", () => {
      const items = build({ orders: [
        order({ id: "livree", status: "delivered", updated_at: iso(1), created_at: iso(20) }),
        order({ id: "ancienne", status: "mailed", created_at: iso(10) }),
        order({ id: "reprise", status: "failed", created_at: iso(30) }),
        order({ id: "recente", status: "printed", created_at: iso(1) }),
      ] });
      expect(items.map((i) => i.key)).toEqual(["book-reprise", "book-recente", "book-ancienne", "book-livree"]);
    });
    test("plusieurs livrées : la plus récemment livrée d'abord", () => {
      const items = build({ orders: [
        order({ id: "a", status: "delivered", updated_at: iso(10) }),
        order({ id: "b", status: "delivered", updated_at: iso(2) }),
      ] });
      expect(items.map((i) => i.key)).toEqual(["book-b", "book-a"]);
    });
  });
});

describe("envois de l'abonnement Coups de cœur", () => {
  const sub = { id: "s1", kind: "gift", name: "Mamie" };
  const sel = (extra = {}) => ({ status: "validated", sentAt: NOW - 2 * DAY, validatedAt: NOW - 2 * DAY, ...extra });
  const keys = ["s1|2026-11"];
  const go = (selection, serverKeys = keys, s = sub) => build({ subs: [s], selections: { [s.id]: { "2026-11": selection } }, serverKeys });

  test("un envoi validé, parti et présent sur le serveur : affiché, en cours", () => {
    const [it] = go(sel());
    expect(it).toMatchObject({
      key: "sub-s1-2026-11", type: "sub", tone: "go", step: 0, title: "Coups de cœur · novembre",
      subtitle: "Abonnement · pour Mamie", statusLabel: "Validée", nav: { name: "SubscriptionTracking", params: { subId: "s1", month: "2026-11" } },
    });
  });

  test("« pour moi » quand l'abonnement est pour soi", () => {
    expect(go(sel(), keys, { id: "s1", kind: "self" })[0].subtitle).toBe("Abonnement · pour moi");
  });

  test("les étapes du suivi : impression, expédiée, livrée", () => {
    expect(go(sel({ stage: "printing" }))[0]).toMatchObject({ step: 1, statusLabel: "En impression", tone: "go" });
    expect(go(sel({ stage: "shipped" }))[0]).toMatchObject({ step: 2, statusLabel: "Expédiée" });
    expect(go(sel({ stage: "delivered" }))[0]).toMatchObject({ step: 3, tone: "ok", statusLabel: "✓ Livrée" });
  });

  describe("on n'affiche QUE ce que le serveur confirme (une ligne fantôme est pire qu'une ligne absente)", () => {
    test("pas de clés du serveur (pas connecté / pas lu) : rien", () => {
      expect(go(sel(), null)).toEqual([]);
      // clés non fournies du tout (n'utilise pas `go`, dont la valeur par défaut remplacerait `undefined`)
      expect(build({ subs: [sub], selections: { s1: { "2026-11": sel() } } })).toEqual([]);
    });
    test("l'envoi n'est pas dans les clés du serveur (ligne supprimée à la main, autre compte) : rien", () => {
      expect(go(sel(), [])).toEqual([]);
      expect(go(sel(), ["s1|2026-10"])).toEqual([]);
      expect(go(sel(), ["s2|2026-11"])).toEqual([]);
    });
    test("sélection seulement brouillon : rien", () => {
      expect(go({ status: "draft", sentAt: NOW })).toEqual([]);
      expect(go(undefined)).toEqual([]);
    });
    test("validée sur le téléphone mais JAMAIS envoyée (ancienne version) : rien ; « restaurée » depuis le serveur : affichée", () => {
      expect(go({ status: "validated", validatedAt: NOW - DAY })).toEqual([]);
      expect(go({ status: "validated", restored: true, validatedAt: NOW - DAY })).toHaveLength(1);
    });
  });

  describe("disparition avec le temps", () => {
    test("un envoi jamais mis à jour disparaît après 45 jours", () => {
      expect(go(sel({ validatedAt: NOW - 44 * DAY }))).toHaveLength(1);
      expect(go(sel({ validatedAt: NOW - 45 * DAY }))).toHaveLength(1);
      expect(go(sel({ validatedAt: NOW - 46 * DAY }))).toEqual([]);
    });
    test("un envoi livré reste 7 + 14 = 21 jours", () => {
      expect(go(sel({ stage: "delivered", validatedAt: NOW - 21 * DAY }))).toHaveLength(1);
      expect(go(sel({ stage: "delivered", validatedAt: NOW - 22 * DAY }))).toEqual([]);
    });
    test("date de validation absente : on prend « maintenant »", () => {
      expect(go({ status: "validated", sentAt: 1 })[0].sortAt).toBe(NOW);
    });
  });

  test("plusieurs mois et plusieurs abonnements ; tri avec les commandes de livres", () => {
    const items = build({
      subs: [sub, { id: "s2", kind: "self" }],
      selections: {
        s1: { "2026-10": sel({ stage: "delivered", validatedAt: NOW - 20 * DAY }), "2026-11": sel({ validatedAt: NOW - 1 * DAY }) },
        s2: { "2026-11": sel({ validatedAt: NOW - 5 * DAY }) },
      },
      serverKeys: ["s1|2026-10", "s1|2026-11", "s2|2026-11"],
      orders: [order({ id: "x", status: "draft" })],
    });
    expect(items.map((i) => i.key)).toEqual(["book-x", "sub-s1-2026-11", "sub-s2-2026-11", "sub-s1-2026-10"]);
  });

  test("abonnement sans aucune sélection : rien, sans plantage", () => {
    expect(build({ subs: [sub], selections: {}, serverKeys: keys })).toEqual([]);
  });
});
