// Tests des COMMANDES : livre (bookOrder), poster (posterOrder), tirages (printOrder), envoi mensuel de l'abonnement (printOrders)
// et « Abandonner cette commande » (orderActions). Le vrai code tourne ; seul l'extérieur est simulé par un FAUX serveur en mémoire
// (__tests__/helpers/fakeBackend.js : tables, stockage, fonctions serveur, session, photothèque). Rien ne sort de la machine.
global.__DEV__ = false;

jest.mock("../services/supabase", () => require("./helpers/fakeBackend").supabaseModule);
jest.mock("expo-file-system/legacy", () => require("./helpers/fakeBackend").fileSystemModule);
jest.mock("expo-media-library", () => require("./helpers/fakeBackend").mediaLibraryModule);
jest.mock("../store/useOrdersStore", () => require("./helpers/fakeBackend").ordersStoreModule);
jest.mock("../store/useSubscriptionStore", () => require("./helpers/fakeBackend").subscriptionStoreModule);
jest.mock("../services/auth", () => ({ accountPhone: () => "", rememberAccountPhone: async () => {} }));
jest.mock("react-native", () => ({ Alert: { alert: jest.fn() } }));

import { Alert } from "react-native";
import { db, ordersStore, subscriptionStore } from "./helpers/fakeBackend";
import {
  fail, isNetworkError, ORDER_STATUS, ORDER_STEPS, ORDER_KIND_LABEL, ORDER_RESUME_ROUTE, orderStepIndex, orderKindOf, orderProductLine,
  isIncomplete, isHeld, isFinal, createBookOrder, getOrder, listOrders, discardOrder, uploadBookPdf, callOrderFunction, submitBookOrder,
  refreshBookOrder, orderErrorText, NOT_SIGNED_IN,
} from "../services/bookOrder";
import {
  posterFilePx, posterOrderTitle, posterOrderSpec, createPosterOrder, uploadPosterFile, submitPosterOrder,
} from "../services/posterOrder";
import {
  printFormatOf, printOrderSpec, printTitle, createPrintOrder, uploadPrintPhotos, submitPrintOrder,
} from "../services/printOrder";
import { submitSelection, syncOrderStatuses } from "../services/printOrders";
import { confirmAbandonOrder } from "../services/orderActions";
import { createBook } from "../services/photoBook";

const address = { name: "Léa Martin", street: "1 rue de Rivoli", complement: "", postalCode: "75001", city: "Paris", phone: "0612345678", id: "a1", label: "Maison", isDefault: true };
const snapshot = { name: "Léa Martin", street: "1 rue de Rivoli", complement: null, postal_code: "75001", city: "Paris", country: "FR", phone: "0612345678" };
const book = () => createBook({ id: "alb1", name: "Été 2026", photoIds: ["p0", "p1", "p2"] }, "a4");
const makeOrder = (extra = {}) => { db.tables.orders.push({ id: "o1", user_id: "u1", kind: "book", status: "draft", ...extra }); return db.tables.orders.at(-1); };

beforeEach(() => { db.reset(); Alert.alert.mockClear(); });

// ═══════════════════════════ 1) Fonctions pures du livre ═══════════════════════════
describe("bookOrder : fonctions pures", () => {
  test("fail : erreur typée avec kind et code facultatif", () => {
    const e = fail("server", "boum", "X1");
    expect(e).toBeInstanceOf(Error);
    expect([e.message, e.kind, e.code]).toEqual(["boum", "server", "X1"]);
    expect(fail("network", "m").code).toBeUndefined();
  });

  test("isNetworkError : reconnaît les messages de coupure, rien d'autre", () => {
    for (const m of ["Network request failed", "Failed to fetch", "The request timed out", "You appear to be offline", "no internet"]) {
      expect(isNetworkError(new Error(m))).toBe(true);
      expect(isNetworkError({ message: m })).toBe(true);
    }
    expect(isNetworkError("Network request failed")).toBe(true);
    expect(isNetworkError(new Error("duplicate key"))).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });

  test("statuts : « incomplète » = draft / file_ready / failed ; « gardée » = received ; « finale » = delivered / cancelled", () => {
    for (const s of ["draft", "file_ready", "failed"]) expect(isIncomplete({ status: s })).toBe(true);
    for (const s of ["received", "transmitted", "printed", "mailed", "delivered", "cancelled"]) expect(isIncomplete({ status: s })).toBe(false);
    expect(isHeld({ status: "received" })).toBe(true);
    expect(isHeld({ status: "draft" })).toBe(false);
    expect(isFinal({ status: "delivered" })).toBe(true);
    expect(isFinal({ status: "cancelled" })).toBe(true);
    expect(isFinal({ status: "mailed" })).toBe(false);
    expect([isIncomplete(null), isHeld(undefined), isFinal(null)]).toEqual([false, false, false]);
  });

  test("les 4 temps du suivi existent tous comme statuts, dans l'ordre transmise → imprimée → expédiée → livrée", () => {
    expect(ORDER_STEPS.map((s) => s.key)).toEqual(["transmitted", "printed", "mailed", "delivered"]);
    for (const s of ORDER_STEPS) expect(ORDER_STATUS[s.key]).toBeDefined();
  });

  test("orderStepIndex : rang dans le suivi ; statut inconnu ou absent = 0", () => {
    expect(["transmitted", "printed", "mailed", "delivered"].map((s) => orderStepIndex({ status: s }))).toEqual([0, 1, 2, 3]);
    expect(orderStepIndex({ status: "draft" })).toBe(0);
    expect(orderStepIndex(undefined)).toBe(0);
  });

  test("orderKindOf : livre par défaut ; chaque type a son libellé ET son écran de reprise", () => {
    expect(orderKindOf({ kind: "poster" })).toBe("poster");
    expect(orderKindOf({ kind: "print" })).toBe("print");
    expect(orderKindOf({ kind: "book" })).toBe("book");
    expect(orderKindOf({})).toBe("book");
    expect(orderKindOf(null)).toBe("book");
    expect(Object.keys(ORDER_KIND_LABEL).sort()).toEqual(Object.keys(ORDER_RESUME_ROUTE).sort());
    expect(ORDER_RESUME_ROUTE).toEqual({ book: "BookOrderProgress", poster: "PosterOrderProgress", print: "PrintOrderProgress" });
  });

  test("orderProductLine : la ligne affichée selon le type", () => {
    expect(orderProductLine({ kind: "book", product: "a4", pages: 24 })).toBe("24 pages · 21 × 29,7 cm");
    expect(orderProductLine({ kind: "book", product: "paysage", pages: 60 })).toBe("60 pages · 21 × 15 cm");
    expect(orderProductLine({ product: "a4", pages: 24 })).toBe("24 pages · 21 × 29,7 cm");
    expect(orderProductLine({ kind: "poster", product: "a3", quantity: 1 })).toBe("Poster A3 · 29,7 × 42 cm");
    expect(orderProductLine({ kind: "poster", product: "a2", quantity: 2 })).toBe("Poster A2 · 42 × 59,4 cm × 2");
    expect(orderProductLine({ kind: "print", product: "10x15", quantity: 40 })).toBe("40 tirages 10 × 15 cm");
    expect(orderProductLine({ kind: "print", product: "10x10", quantity: 20 })).toBe("20 tirages 10 × 10 cm");
  });

  test("orderErrorText : jamais de jargon, et on rassure (« ta commande est enregistrée »)", () => {
    for (const code of ["siret_required", "payment_method_required", "orders_disabled"]) {
      expect(orderErrorText(fail("supplier", "x", code))).toMatch(/pas encore ouvertes/);
    }
    expect(orderErrorText(fail("network", "x"))).toMatch(/connexion/);
    expect(orderErrorText(fail("auth", "x"))).toMatch(/Reconnecte-toi/);
    expect(orderErrorText(fail("server", "FK violation xyz"))).toMatch(/réessayer/);
    expect(orderErrorText(undefined)).toMatch(/réessayer/);
    for (const e of [fail("network", "x"), fail("server", "SQL 42P01 boum"), fail("supplier", "x", "siret_required")]) {
      expect(orderErrorText(e)).not.toMatch(/SQL|42P01|FK|boum/);
      expect(orderErrorText(e)).toMatch(/enregistrée/);
    }
  });
});

// ═══════════════════════════ 2) Livre : créer, lire, lister ═══════════════════════════
describe("livre : createBookOrder / getOrder / listOrders", () => {
  test("crée un brouillon avec le compte, le format, le nombre de pages et une COPIE de l'adresse", async () => {
    const o = await createBookOrder({ albumId: "alb1", book: book(), albumName: "Été 2026", address });
    expect(o.status).toBe("draft");
    const row = db.rows("orders")[0];
    expect(row).toMatchObject({ user_id: "u1", kind: "book", album_id: "alb1", product: "a4", pages: 24, title: "Été 2026" });
    expect(row.address).toEqual(snapshot); // pas l'objet de l'app : une copie figée (champs du serveur, pays FR)
    expect(row.address.id).toBeUndefined();
  });

  test("titre : celui de la couverture, sinon le nom de l'album, sinon vide", async () => {
    const b = book();
    await createBookOrder({ albumId: "a", book: { ...b, cover: { ...b.cover, title: "Nos vacances" } }, albumName: "Album", address });
    await createBookOrder({ albumId: "a", book: { ...b, cover: { ...b.cover, title: "" } }, albumName: "Album", address });
    await createBookOrder({ albumId: "a", book: { ...b, cover: { ...b.cover, title: "" } }, address });
    expect(db.rows("orders").map((r) => r.title)).toEqual(["Nos vacances", "Album", ""]);
  });

  test("un livre paysage est commandé en « paysage »", async () => {
    const b = createBook({ id: "a", name: "x", photoIds: [] }, "paysage");
    await createBookOrder({ albumId: "a", book: b, address });
    expect(db.rows("orders")[0].product).toBe("paysage");
  });

  test("pas connecté : erreur « auth » et RIEN n'est écrit", async () => {
    db.session = null;
    await expect(createBookOrder({ albumId: "a", book: book(), address })).rejects.toMatchObject({ kind: "auth", code: NOT_SIGNED_IN });
    expect(db.calls).toEqual([]);
  });

  test("refus du serveur → erreur « server » avec le code ; coupure → « network »", async () => {
    db.errors["orders.insert"] = { message: "new row violates policy", code: "42501" };
    await expect(createBookOrder({ albumId: "a", book: book(), address })).rejects.toMatchObject({ kind: "server", message: expect.stringContaining("42501") });
    db.errors["orders.insert"] = { message: "Network request failed" };
    await expect(createBookOrder({ albumId: "a", book: book(), address })).rejects.toMatchObject({ kind: "network" });
  });

  test("getOrder : la commande, ou null si elle n'existe pas ; une panne lève une erreur", async () => {
    makeOrder({ id: "o7" });
    expect((await getOrder("o7")).id).toBe("o7");
    expect(await getOrder("zzz")).toBeNull();
    db.errors["orders.select"] = { message: "boom" };
    await expect(getOrder("o7")).rejects.toMatchObject({ kind: "server" });
  });

  test("listOrders : les plus récentes d'abord ; exige d'être connecté", async () => {
    for (const id of ["o1", "o2", "o3"]) await createBookOrder({ albumId: id, book: book(), address });
    const list = await listOrders();
    expect(list.map((o) => o.album_id)).toEqual(["o3", "o2", "o1"]);
    db.session = null;
    await expect(listOrders()).rejects.toMatchObject({ kind: "auth" });
  });
});

// ═══════════════════════════ 3) Abandonner une commande (discardOrder) ═══════════════════════════
describe("discardOrder : on ne supprime QUE ce qui n'est jamais parti", () => {
  test("brouillon avec PDF : le fichier puis la ligne disparaissent", async () => {
    const o = makeOrder({ status: "file_ready", file_path: "u1/o1.pdf" });
    db.files["print-files"] = ["u1/o1.pdf"];
    expect(await discardOrder(o)).toBe(true);
    expect(db.rows("orders")).toEqual([]);
    expect(db.files["print-files"]).toEqual([]);
  });

  test("brouillon sans fichier : aucun appel au stockage", async () => {
    const o = makeOrder();
    expect(await discardOrder(o)).toBe(true);
    expect(db.callsOf("storage.remove")).toEqual([]);
    expect(db.callsOf("storage.list")).toEqual([]);
  });

  test("commande de TIRAGES : tout le dossier de photos est supprimé", async () => {
    const o = makeOrder({ kind: "print", status: "file_ready", file_path: "u1/o1" });
    db.files["print-files"] = ["u1/o1/1.jpg", "u1/o1/2.heic", "u1/o1/3.jpg", "u1/autre/1.jpg"];
    expect(await discardOrder(o)).toBe(true);
    expect(db.files["print-files"]).toEqual(["u1/autre/1.jpg"]); // le dossier d'une AUTRE commande n'est pas touché
  });

  test("jamais une commande déjà transmise, ni reçue, ni livrée, ni annulée", async () => {
    for (const status of ["received", "transmitted", "printed", "mailed", "delivered", "cancelled"]) {
      db.reset();
      const o = makeOrder({ status });
      expect(await discardOrder(o)).toBe(false);
      expect(db.rows("orders")).toHaveLength(1);
    }
  });

  test("jamais une commande qui a un numéro chez l'imprimeur (supplier_ref), même « à reprendre »", async () => {
    const o = makeOrder({ status: "failed", supplier_ref: "IMP-42" });
    expect(await discardOrder(o)).toBe(false);
    expect(db.rows("orders")).toHaveLength(1);
    expect(db.callsOf("delete")).toEqual([]);
  });

  test("commande absente ou sans id : false, sans rien appeler", async () => {
    expect(await discardOrder(null)).toBe(false);
    expect(await discardOrder({ status: "draft" })).toBe(false);
    expect(db.calls).toEqual([]);
  });

  test("règle de sécurité du serveur pas à jour (0 ligne supprimée, SANS erreur) : false, la commande reste", async () => {
    // supabase/sql/orders_annulation.sql pas encore lancé : le serveur répond « ok » mais ne supprime rien
    const o = makeOrder();
    db.blockDelete = true;
    expect(await discardOrder(o)).toBe(false);
    expect(db.rows("orders")).toHaveLength(1);
  });

  test("suppression refusée AVEC une erreur : false aussi", async () => {
    const o = makeOrder();
    db.errors["orders.delete"] = { message: "permission denied" };
    expect(await discardOrder(o)).toBe(false);
    expect(db.rows("orders")).toHaveLength(1);
  });

  test("le fichier orphelin n'empêche pas de supprimer la ligne (échec du stockage ignoré)", async () => {
    const o = makeOrder({ status: "file_ready", file_path: "u1/o1.pdf" });
    db.errors["storage.remove"] = { message: "storage down" };
    expect(await discardOrder(o)).toBe(true);
    expect(db.rows("orders")).toEqual([]);
  });

  test("une exception inattendue (liste des photos) : false, jamais de plantage", async () => {
    const o = makeOrder({ kind: "print", status: "file_ready", file_path: "u1/o1" });
    db.errors["storage.list"] = { message: "boom" };
    expect(await discardOrder(o)).toBe(false);
  });
});

// ═══════════════════════════ 4) Livre : envoi du PDF et transmission ═══════════════════════════
describe("livre : uploadBookPdf", () => {
  test("dépose le PDF dans le dossier du compte avec les bons en-têtes, puis passe en « file_ready »", async () => {
    makeOrder();
    const o = await uploadBookPdf({ id: "o1" }, "file:///tmp/livre.pdf");
    expect(db.uploads).toHaveLength(1);
    const { url, uri, options } = db.uploads[0];
    expect(url).toBe("https://test.supabase.co/storage/v1/object/print-files/u1/o1.pdf");
    expect(uri).toBe("file:///tmp/livre.pdf");
    expect(options).toMatchObject({
      httpMethod: "POST", uploadType: "BINARY_CONTENT",
      headers: { Authorization: "Bearer tok", apikey: "pk_test", "Content-Type": "application/pdf", "x-upsert": "true" },
    });
    expect(o).toMatchObject({ status: "file_ready", file_path: "u1/o1.pdf", error: null });
    expect(db.rows("orders")[0].status).toBe("file_ready");
  });

  test("le serveur refuse le fichier : erreur « server » et la commande N'AVANCE PAS", async () => {
    makeOrder();
    db.uploadImpl = async () => ({ status: 413, body: "x".repeat(500) });
    const err = await uploadBookPdf({ id: "o1" }, "file:///a.pdf").catch((e) => e);
    expect(err).toMatchObject({ kind: "server" });
    expect(err.message).toMatch(/Livre refusé \(413\)/);
    expect(err.message.length).toBeLessThan(220); // le corps est coupé à 160 caractères
    expect(db.rows("orders")[0].status).toBe("draft");
  });

  test("coupure pendant l'envoi : « network » ; autre panne : « server »", async () => {
    makeOrder();
    db.uploadImpl = async () => { throw new Error("Network request failed"); };
    await expect(uploadBookPdf({ id: "o1" }, "f")).rejects.toMatchObject({ kind: "network" });
    db.uploadImpl = async () => { throw new Error("disk full"); };
    await expect(uploadBookPdf({ id: "o1" }, "f")).rejects.toMatchObject({ kind: "server" });
  });

  test("fichier envoyé mais ligne non mise à jour : erreur claire (on pourra réessayer, le 2ᵉ envoi remplace le 1er)", async () => {
    makeOrder();
    db.errors["orders.update"] = { message: "row locked" };
    await expect(uploadBookPdf({ id: "o1" }, "f")).rejects.toMatchObject({ kind: "server", message: expect.stringContaining("Commande non mise à jour") });
    expect(db.uploads[0].options.headers["x-upsert"]).toBe("true");
  });

  test("pas connecté : rien n'est envoyé", async () => {
    db.session = null;
    await expect(uploadBookPdf({ id: "o1" }, "f")).rejects.toMatchObject({ kind: "auth" });
    expect(db.uploads).toEqual([]);
  });

  test("un 2ᵉ essai après un échec repart de zéro et réussit", async () => {
    makeOrder();
    db.uploadImpl = async () => ({ status: 500, body: "" });
    await expect(uploadBookPdf({ id: "o1" }, "f")).rejects.toBeTruthy();
    db.uploadImpl = null;
    expect((await uploadBookPdf({ id: "o1" }, "f")).status).toBe("file_ready");
  });
});

describe("fonction serveur imprimeur-order : callOrderFunction / submit / refresh", () => {
  test("appelle la fonction avec l'action et l'id, rend la commande", async () => {
    db.invokeImpl = async () => ({ data: { ok: true, order: { id: "o1", status: "transmitted" } }, error: null });
    expect(await submitBookOrder("o1")).toEqual({ id: "o1", status: "transmitted" });
    expect(db.callsOf("invoke")[0]).toMatchObject({ name: "imprimeur-order", body: { action: "submit", orderId: "o1" } });
  });

  test("pas connecté : la fonction n'est même pas appelée", async () => {
    db.session = null;
    await expect(submitBookOrder("o1")).rejects.toMatchObject({ kind: "auth" });
    expect(db.callsOf("invoke")).toEqual([]);
  });

  test("réponse « pas ok » : erreur « server » avec le code", async () => {
    db.invokeImpl = async () => ({ data: { ok: false, error: "Prix invalide", code: "bad_price" }, error: null });
    await expect(callOrderFunction("submit", "o1")).rejects.toMatchObject({ kind: "server", message: "Prix invalide", code: "bad_price" });
  });

  test("réponse vide : message générique", async () => {
    db.invokeImpl = async () => ({ data: null, error: null });
    await expect(callOrderFunction("submit", "o1")).rejects.toMatchObject({ kind: "server", message: "Réponse inattendue du serveur." });
  });

  test("imprimeur.fr n'ouvre pas encore les commandes (SIRET / paiement) : erreur « supplier »", async () => {
    for (const code of ["siret_required", "payment_method_required"]) {
      db.invokeImpl = async () => ({ data: null, error: { message: "Edge Function returned a non-2xx", context: { json: async () => ({ error: "SIRET manquant", code }) } } });
      await expect(callOrderFunction("submit", "o1")).rejects.toMatchObject({ kind: "supplier", code, message: "SIRET manquant" });
    }
  });

  test("autre refus du serveur avec un corps lisible : « server » avec SON message", async () => {
    db.invokeImpl = async () => ({ data: null, error: { message: "non-2xx", context: { json: async () => ({ error: "Adresse hors France", code: "bad_address" }) } } });
    await expect(callOrderFunction("submit", "o1")).rejects.toMatchObject({ kind: "server", message: "Adresse hors France", code: "bad_address" });
  });

  test("erreur sans corps lisible : coupure réseau → « network », sinon « server »", async () => {
    db.invokeImpl = async () => ({ data: null, error: { message: "Failed to fetch", context: { json: async () => { throw new Error("pas de JSON"); } } } });
    await expect(callOrderFunction("submit", "o1")).rejects.toMatchObject({ kind: "network" });
    db.invokeImpl = async () => ({ data: null, error: { message: "Internal error" } });
    await expect(callOrderFunction("submit", "o1")).rejects.toMatchObject({ kind: "server" });
  });

  test("refreshBookOrder : demande « refresh » ; en cas d'échec, silencieux et on garde la commande connue", async () => {
    db.invokeImpl = async () => ({ data: { ok: true, order: { id: "o1", status: "mailed", tracking: "6A123" } }, error: null });
    expect((await refreshBookOrder({ id: "o1", status: "printed" })).status).toBe("mailed");
    expect(db.callsOf("invoke")[0].body.action).toBe("refresh");
    const known = { id: "o1", status: "printed" };
    db.invokeImpl = async () => { throw new Error("boom"); };
    expect(await refreshBookOrder(known)).toBe(known);
  });
});

// ═══════════════════════════ 5) Poster ═══════════════════════════
describe("poster", () => {
  test("posterFilePx : taille du fichier à 150 dpi pour chaque feuille (portrait)", () => {
    expect(posterFilePx("a4")).toEqual({ w: 1240, h: 1754 });
    expect(posterFilePx("a3")).toEqual({ w: 1754, h: 2480 });
    expect(posterFilePx("a2")).toEqual({ w: 2480, h: 3508 });
    expect(posterFilePx("a1")).toEqual({ w: 3484, h: 4961 });
    expect(posterFilePx("a4", 300)).toEqual({ w: 2480, h: 3508 });
    expect(posterFilePx("a4", 75)).toEqual({ w: 620, h: 877 });
  });

  test("posterOrderTitle : titre saisi (nettoyé), sinon nom par défaut", () => {
    expect(posterOrderTitle({ title: { text: "  Bretagne  " }, format: "a3" })).toBe("Bretagne");
    expect(posterOrderTitle({ title: { text: "   " }, format: "a3" })).toBe("Poster A3");
    expect(posterOrderTitle({ format: "a2" })).toBe("Poster A2");
    expect(posterOrderTitle({ collage: { title: " Famille " }, format: "a1" })).toBe("Famille");
    expect(posterOrderTitle({ collage: { title: "" }, format: "a1" })).toBe("Poster pêle-mêle A1");
    expect(posterOrderTitle({ collage: {}, format: "a4" })).toBe("Poster pêle-mêle A4");
  });

  describe("posterOrderSpec : ce qu'il faut pour refaire le fichier", () => {
    test("une photo verticale", () => {
      const s = posterOrderSpec({ params: { photoId: "p1", crop: { scale: 2, x: 0, y: 0 }, title: { text: "Hi" } }, format: "a3", quantity: 2, photo: { width: 3000, height: 4000 } });
      expect(s).toMatchObject({
        product: "poster", kind: "single", format: "a3", formatName: "A3", sheetMm: { width: 297, height: 420 },
        sizeLabel: "29,7 × 42 cm", landscape: false, photos: 1, quantity: 2,
      });
      expect(s.source).toEqual({ photoId: "p1", crop: { scale: 2, x: 0, y: 0 }, title: { text: "Hi" }, collage: null });
    });

    test("une photo horizontale : poster horizontal, la FEUILLE reste verticale", () => {
      const s = posterOrderSpec({ params: { photoId: "p1" }, format: "a3", quantity: 1, photo: { width: 4000, height: 3000 } });
      expect(s.landscape).toBe(true);
      expect(s.sizeLabel).toBe("42 × 29,7 cm");
      expect(s.sheetMm).toEqual({ width: 297, height: 420 });
    });

    test("un pêle-mêle : toujours vertical, nombre de photos, collage conservé", () => {
      const collage = { photoIds: ["a", "b", "c", "d"], style: "pelemele", title: "Été" };
      const s = posterOrderSpec({ params: { collage }, format: "a2", quantity: 1, photo: { width: 4000, height: 3000 } });
      expect(s).toMatchObject({ kind: "collage", photos: 4, landscape: false });
      expect(s.source.collage).toEqual(collage);
      expect(s.source.photoId).toBeNull();
    });

    test("champs absents : valeurs « null » (jamais undefined, pour que le JSON serveur soit stable)", () => {
      const s = posterOrderSpec({ params: {}, format: "a4", quantity: 1, photo: null });
      expect(s.source).toEqual({ photoId: null, crop: null, title: null, collage: null });
    });
  });

  test("createPosterOrder : ligne « poster » avec format, quantité, spec et copie de l'adresse", async () => {
    const params = { photoId: "p1", title: { text: "Mer" } };
    await createPosterOrder({ params, format: "a3", quantity: 2, address, photo: { width: 3000, height: 4000 } });
    expect(db.rows("orders")[0]).toMatchObject({
      user_id: "u1", kind: "poster", album_id: null, title: "Mer", product: "a3", pages: null, quantity: 2, address: snapshot, status: "draft",
    });
    expect(db.rows("orders")[0].spec).toMatchObject({ kind: "single", format: "a3", quantity: 2 });
  });

  test("createPosterOrder : pas connecté → rien écrit ; refus → erreur typée", async () => {
    db.session = null;
    await expect(createPosterOrder({ params: {}, format: "a3", quantity: 1, address })).rejects.toMatchObject({ kind: "auth" });
    db.session = { user: { id: "u1" }, access_token: "t" };
    db.errors["orders.insert"] = { message: "check constraint", code: "23514" };
    await expect(createPosterOrder({ params: {}, format: "a3", quantity: 1, address })).rejects.toMatchObject({ kind: "server", message: expect.stringContaining("23514") });
    expect(db.rows("orders")).toEqual([]);
  });

  describe("uploadPosterFile", () => {
    const fileInfo = { px: { w: 1754, h: 2480 }, dpi: 150, rotated90: false };

    test("dépose le JPEG, garde la spec existante et y ajoute la taille réelle du fichier", async () => {
      makeOrder({ kind: "poster", spec: { kind: "single", format: "a3", quantity: 2 } });
      const o = await uploadPosterFile({ id: "o1", spec: { kind: "single", format: "a3", quantity: 2 } }, "file:///tmp/p.jpg", fileInfo);
      expect(db.uploads[0].url).toBe("https://test.supabase.co/storage/v1/object/print-files/u1/o1.jpg");
      expect(db.uploads[0].options.headers["Content-Type"]).toBe("image/jpeg");
      expect(o.status).toBe("file_ready");
      expect(o.file_path).toBe("u1/o1.jpg");
      expect(o.spec).toEqual({ kind: "single", format: "a3", quantity: 2, file: { mime: "image/jpeg", px: { w: 1754, h: 2480 }, dpi: 150, rotated90: false, bytes: 12345 } });
    });

    test("taille du fichier illisible : bytes = null, sans gravité", async () => {
      makeOrder({ kind: "poster" });
      db.fileInfo = async () => { throw new Error("nope"); };
      const o = await uploadPosterFile({ id: "o1" }, "file:///p.jpg", fileInfo);
      expect(o.spec.file.bytes).toBeNull();
      expect(o.status).toBe("file_ready");
    });

    test("poster horizontal : l'information « tourné de 90° » est conservée", async () => {
      makeOrder({ kind: "poster" });
      const o = await uploadPosterFile({ id: "o1" }, "f", { ...fileInfo, rotated90: true });
      expect(o.spec.file.rotated90).toBe(true);
    });

    test("refus du serveur : erreur « Poster refusé » et la commande n'avance pas ; coupure : « network »", async () => {
      makeOrder({ kind: "poster" });
      db.uploadImpl = async () => ({ status: 500, body: "oups" });
      await expect(uploadPosterFile({ id: "o1" }, "f", fileInfo)).rejects.toMatchObject({ kind: "server", message: expect.stringContaining("Poster refusé (500)") });
      expect(db.rows("orders")[0].status).toBe("draft");
      db.uploadImpl = async () => { throw new Error("The request timed out"); };
      await expect(uploadPosterFile({ id: "o1" }, "f", fileInfo)).rejects.toMatchObject({ kind: "network" });
    });
  });

  test("submitPosterOrder passe par la fonction serveur « submit »", async () => {
    await submitPosterOrder("o9");
    expect(db.callsOf("invoke")[0]).toMatchObject({ name: "imprimeur-order", body: { action: "submit", orderId: "o9" } });
  });
});

// ═══════════════════════════ 6) Tirages simples ═══════════════════════════
describe("tirages simples", () => {
  test("printFormatOf : le format demandé, sinon le premier (10 × 15)", () => {
    expect(printFormatOf("10x10").key).toBe("10x10");
    expect(printFormatOf("zzz").key).toBe("10x15");
    expect(printFormatOf(undefined).key).toBe("10x15");
  });

  test("printOrderSpec / printTitle", () => {
    expect(printOrderSpec({ format: "10x10", photoIds: ["a", "b"] })).toEqual({
      product: "print", format: "10x10", formatLabel: "10 × 10 cm", sheetMm: { width: 100, height: 100 }, crop: "cover", count: 2, source: { photoIds: ["a", "b"] },
    });
    expect(printTitle("10x15", 40)).toBe("40 tirages 10 × 15 cm");
  });

  test("createPrintOrder : quantité = nombre de photos ; l'identifiant des photos est gardé pour reprendre", async () => {
    await createPrintOrder({ format: "10x15", photoIds: ["a", "b", "c"], address });
    expect(db.rows("orders")[0]).toMatchObject({ kind: "print", product: "10x15", quantity: 3, title: "3 tirages 10 × 15 cm", album_id: null, address: snapshot });
    expect(db.rows("orders")[0].spec.source.photoIds).toEqual(["a", "b", "c"]);
  });

  describe("uploadPrintPhotos", () => {
    const ids = ["p1", "p2", "p3"];

    test("chaque photo va dans le dossier de la commande, numérotée ; le dossier et le détail sont enregistrés", async () => {
      makeOrder({ kind: "print", spec: { product: "print", format: "10x15" } });
      db.assets = {
        p1: { localUri: "file:///a/IMG_1.HEIC", width: 3000, height: 4000 },
        p2: { localUri: "file:///a/IMG_2.jpg?x=1", width: 4000, height: 3000 },
        p3: { localUri: "file:///a/IMG_3.png", width: 3000, height: 3010 },
      };
      const o = await uploadPrintPhotos({ id: "o1", spec: { product: "print", format: "10x15" } }, ids);
      expect(db.uploads.map((u) => u.url.split("/object/print-files/")[1])).toEqual(["u1/o1/1.heic", "u1/o1/2.jpg", "u1/o1/3.png"]);
      expect(db.uploads.map((u) => u.options.headers["Content-Type"])).toEqual(["image/heic", "image/jpeg", "image/png"]);
      expect(o.status).toBe("file_ready");
      expect(o.file_path).toBe("u1/o1");
      expect(o.spec.photos).toEqual([
        { path: "u1/o1/1.heic", w: 3000, h: 4000, shape: "portrait" },
        { path: "u1/o1/2.jpg", w: 4000, h: 3000, shape: "landscape" },
        { path: "u1/o1/3.png", w: 3000, h: 3010, shape: "square" }, // moins de 2 % d'écart = carrée
      ]);
      expect(o.spec.format).toBe("10x15"); // la spec d'origine est conservée
    });

    test("extension inconnue ou absente → JPEG ; majuscules acceptées", async () => {
      makeOrder({ kind: "print" });
      db.assets = { p1: { localUri: "file:///a/photo.tiff", width: 10, height: 10 }, p2: { localUri: "file:///a/photo", width: 10, height: 20 }, p3: { localUri: "file:///a/X.JPEG", width: 20, height: 10 } };
      await uploadPrintPhotos({ id: "o1" }, ids);
      expect(db.uploads.map((u) => u.url.split("/").pop())).toEqual(["1.jpg", "2.jpg", "3.jpeg"]);
      expect(db.uploads.map((u) => u.options.headers["Content-Type"])).toEqual(["image/jpeg", "image/jpeg", "image/jpeg"]);
    });

    test("dimensions inconnues : forme « null »", async () => {
      makeOrder({ kind: "print" });
      db.assets = { p1: { localUri: "file:///a/1.jpg", width: undefined, height: undefined } };
      const o = await uploadPrintPhotos({ id: "o1" }, ["p1"]);
      expect(o.spec.photos[0]).toEqual({ path: "u1/o1/1.jpg", w: null, h: null, shape: null });
    });

    test("la barre d'avancement : 0, 1, 2… puis « terminé »", async () => {
      makeOrder({ kind: "print" });
      const seen = [];
      await uploadPrintPhotos({ id: "o1" }, ids, { onProgress: (d, t) => seen.push([d, t]) });
      expect(seen).toEqual([[0, 3], [1, 3], [2, 3], [3, 3]]);
    });

    test("annulation (« shouldStop ») : on s'arrête tout de suite, la commande n'avance pas", async () => {
      makeOrder({ kind: "print" });
      let n = 0;
      const err = await uploadPrintPhotos({ id: "o1" }, ids, { shouldStop: () => n++ >= 1 }).catch((e) => e);
      expect(err).toMatchObject({ code: "cancelled" });
      expect(db.uploads).toHaveLength(1);
      expect(db.rows("orders")[0].status).toBe("draft");
    });

    test("photo introuvable sur le téléphone : erreur « photo », rien de plus n'est envoyé", async () => {
      makeOrder({ kind: "print" });
      db.assets = { p2: { localUri: null } };
      await expect(uploadPrintPhotos({ id: "o1" }, ids)).rejects.toMatchObject({ kind: "photo" });
      expect(db.uploads).toHaveLength(1);
      expect(db.rows("orders")[0].status).toBe("draft");
    });

    test("refus du serveur : message avec le NUMÉRO de la photo ; coupure : « network » avec le numéro", async () => {
      makeOrder({ kind: "print" });
      db.uploadImpl = async (u, f, o, n) => (n === 2 ? { status: 500, body: "x" } : { status: 200 });
      await expect(uploadPrintPhotos({ id: "o1" }, ids)).rejects.toMatchObject({ kind: "server", message: expect.stringContaining("Photo 2 refusée (500)") });
      db.uploads = [];
      db.uploadImpl = async () => { throw new Error("Network request failed"); };
      await expect(uploadPrintPhotos({ id: "o1" }, ids)).rejects.toMatchObject({ kind: "network", message: expect.stringContaining("photo 1") });
    });

    test("photos toutes envoyées mais commande non mise à jour : erreur claire", async () => {
      makeOrder({ kind: "print" });
      db.errors["orders.update"] = { message: "locked" };
      await expect(uploadPrintPhotos({ id: "o1" }, ids)).rejects.toMatchObject({ message: expect.stringContaining("Commande non mise à jour") });
    });

    test("pas connecté : rien n'est envoyé", async () => {
      db.session = null;
      await expect(uploadPrintPhotos({ id: "o1" }, ids)).rejects.toMatchObject({ kind: "auth" });
      expect(db.uploads).toEqual([]);
    });
  });

  test("submitPrintOrder passe par la fonction serveur « submit »", async () => {
    await submitPrintOrder("o3");
    expect(db.callsOf("invoke")[0].body).toEqual({ action: "submit", orderId: "o3" });
  });
});

// ═══════════════════════════ 7) Abonnement : envoi mensuel (printOrders) ═══════════════════════════
describe("abonnement : submitSelection", () => {
  const sub = { id: "s1", kind: "gift", name: "Mamie", recipient: "Jeanne", address: "3 rue X 69001 Lyon", addressData: { name: "Jeanne", street: "3 rue X", zip: "69001", city: "Lyon", phone: "0612345678" }, message: "Bises" };
  const ids = ["p1", "p2"];

  test("dépose chaque photo dans print-photos/<compte>/<abonnement>/<mois>/<n> puis écrit UNE ligne print_orders", async () => {
    db.assets = { p1: { localUri: "file:///a/1.heic", width: 3000, height: 4000 }, p2: { localUri: "file:///a/2.jpg", width: 4000, height: 3000 } };
    const progress = [];
    const paths = await submitSelection({ sub, month: "2026-11", photoIds: ids, onProgress: (d, t) => progress.push([d, t]) });
    expect(paths).toEqual(["u1/s1/2026-11/1.heic", "u1/s1/2026-11/2.jpg"]);
    expect(db.uploads.map((u) => u.url.split("/object/")[1])).toEqual(["print-photos/u1/s1/2026-11/1.heic", "print-photos/u1/s1/2026-11/2.jpg"]);
    expect(progress).toEqual([[0, 2], [1, 2], [2, 2]]);
    expect(db.rows("print_orders")).toHaveLength(1);
    expect(db.rows("print_orders")[0]).toEqual({
      user_id: "u1", sub_id: "s1", month: "2026-11", kind: "gift", recipient: "Jeanne", address: "3 rue X 69001 Lyon", address_data: sub.addressData,
      message: "Bises", photo_count: 2, photos: paths,
      photo_info: [{ path: paths[0], w: 3000, h: 4000, shape: "portrait" }, { path: paths[1], w: 4000, h: 3000, shape: "landscape" }],
      product: "prints", spec: { widthMm: 100, heightMm: 150, crop: "cover", finish: "gloss", minDpi: 150 },
    });
    expect(db.callsOf("upsert", "print_orders")[0].opts).toEqual({ onConflict: "user_id,sub_id,month" });
  });

  test("valeurs de repli : destinataire = prénom, sinon vide ; petit mot vide = null ; sans adresse structurée = null", async () => {
    await submitSelection({ sub: { id: "s2", kind: "self", address: "x", message: "" }, month: "2026-11", photoIds: ["p1"] });
    await submitSelection({ sub: { id: "s3", kind: "gift", name: "Tom", address: "x" }, month: "2026-11", photoIds: ["p1"] });
    const [a, b] = db.rows("print_orders");
    expect([a.recipient, a.message, a.address_data]).toEqual(["", null, null]);
    expect(b.recipient).toBe("Tom");
  });

  test("renvoyer le même mois REMPLACE la ligne (un seul envoi par abonnement et par mois)", async () => {
    await submitSelection({ sub, month: "2026-11", photoIds: ["p1"] });
    await submitSelection({ sub, month: "2026-11", photoIds: ["p1", "p2"] });
    expect(db.rows("print_orders")).toHaveLength(1);
    expect(db.rows("print_orders")[0].photo_count).toBe(2);
    await submitSelection({ sub, month: "2026-12", photoIds: ["p1"] });
    expect(db.rows("print_orders")).toHaveLength(2);
  });

  test("pas connecté : erreur NOT_SIGNED_IN, rien n'est envoyé", async () => {
    db.session = null;
    await expect(submitSelection({ sub, month: "2026-11", photoIds: ids })).rejects.toThrow(NOT_SIGNED_IN);
    expect(db.uploads).toEqual([]);
  });

  test("UNE photo qui échoue = AUCUNE ligne écrite (la sélection reste modifiable côté app)", async () => {
    db.uploadImpl = async (u, f, o, n) => (n === 2 ? { status: 500, body: "" } : { status: 200 });
    await expect(submitSelection({ sub, month: "2026-11", photoIds: ["p1", "p2", "p3"] })).rejects.toMatchObject({ kind: "server" });
    expect(db.rows("print_orders")).toEqual([]);
    db.assets = { p2: { localUri: null } };
    db.uploadImpl = null;
    await expect(submitSelection({ sub, month: "2026-11", photoIds: ids })).rejects.toMatchObject({ kind: "photo" });
    expect(db.rows("print_orders")).toEqual([]);
  });

  test("table refusée : « server » avec le code ; coupure : « network »", async () => {
    db.errors["print_orders.upsert"] = { message: "column product does not exist", code: "42703" };
    await expect(submitSelection({ sub, month: "2026-11", photoIds: ["p1"] })).rejects.toMatchObject({ kind: "server", message: expect.stringContaining("42703") });
    db.errors["print_orders.upsert"] = { message: "Network request failed" };
    await expect(submitSelection({ sub, month: "2026-11", photoIds: ["p1"] })).rejects.toMatchObject({ kind: "network" });
  });
});

describe("abonnement : syncOrderStatuses", () => {
  test("met à jour le suivi de chaque envoi et mémorise lesquels existent VRAIMENT sur le serveur", async () => {
    db.tables.print_orders = [{ sub_id: "s1", month: "2026-10", status: "delivered" }, { sub_id: "s1", month: "2026-11", status: "printing" }];
    await syncOrderStatuses();
    expect(ordersStore.getState().printOrderKeys).toEqual(["s1|2026-10", "s1|2026-11"]);
    expect(subscriptionStore.getState().setStage.mock.calls).toEqual([["s1", "2026-10", "delivered"], ["s1", "2026-11", "printing"]]);
  });

  test("pas connecté : les clés restent « null » (une ligne fantôme est pire qu'une ligne absente)", async () => {
    db.session = null;
    db.tables.print_orders = [{ sub_id: "s1", month: "2026-10", status: "shipped" }];
    await syncOrderStatuses();
    expect(ordersStore.getState().printOrderKeys).toBeNull();
  });

  test("lecture impossible : on garde ce qu'on sait, sans erreur ni changement", async () => {
    ordersStore.setState({ printOrderKeys: ["a|2026-01"] });
    db.errors["print_orders.select"] = { message: "offline" };
    await expect(syncOrderStatuses()).resolves.toBeUndefined();
    expect(ordersStore.getState().printOrderKeys).toEqual(["a|2026-01"]);
    expect(subscriptionStore.getState().setStage).not.toHaveBeenCalled();
  });

  test("aucun envoi sur le serveur : liste vide (et non « null »)", async () => {
    await syncOrderStatuses();
    expect(ordersStore.getState().printOrderKeys).toEqual([]);
  });
});

// ═══════════════════════════ 7 bis) Les 4 envois de fichiers ont les MÊMES règles ═══════════════════════════
describe("envois de fichiers (livre, poster, tirages, abonnement) : mêmes en-têtes, même méthode", () => {
  const flows = {
    "livre (PDF)": async () => { makeOrder(); await uploadBookPdf({ id: "o1" }, "file:///a.pdf"); },
    "poster (JPEG)": async () => { makeOrder({ kind: "poster" }); await uploadPosterFile({ id: "o1" }, "file:///a.jpg", { px: { w: 1, h: 1 }, dpi: 150, rotated90: false }); },
    "tirages (photos)": async () => { makeOrder({ kind: "print" }); await uploadPrintPhotos({ id: "o1" }, ["p1", "p2"]); },
    "abonnement (photos)": async () => { await submitSelection({ sub: { id: "s1", kind: "self", address: "x" }, month: "2026-11", photoIds: ["p1", "p2"] }); },
  };

  test.each(Object.keys(flows))("%s : POST binaire, jeton du compte, clé publique, x-upsert (un 2ᵉ essai remplace le 1er)", async (name) => {
    await flows[name]();
    expect(db.uploads.length).toBeGreaterThan(0);
    for (const { options } of db.uploads) {
      expect(options.httpMethod).toBe("POST");
      expect(options.uploadType).toBe("BINARY_CONTENT"); // le fichier part tel quel, sans passer par la mémoire
      expect(options.headers.Authorization).toBe("Bearer tok");
      expect(options.headers.apikey).toBe("pk_test");
      expect(options.headers["x-upsert"]).toBe("true");
      expect(options.headers["Content-Type"]).toMatch(/^(application\/pdf|image\/(jpeg|png|heic))$/);
    }
  });

  test.each(Object.keys(flows))("%s : tout est rangé sous le dossier DU COMPTE (jamais à la racine)", async (name) => {
    await flows[name]();
    for (const { url } of db.uploads) expect(url).toMatch(/\/object\/print-(files|photos)\/u1\//);
  });
});

// ═══════════════════════════ 8) « Abandonner cette commande » ═══════════════════════════
describe("confirmAbandonOrder", () => {
  const buttons = () => Alert.alert.mock.calls[0][2];
  const press = (label) => buttons().find((b) => b.text === label).onPress?.();

  test("demande confirmation avec deux boutons : Garder (annule) et Abandonner (destructif)", () => {
    confirmAbandonOrder({ id: "o1", kind: "book" }, jest.fn());
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert.mock.calls[0][0]).toBe("Abandonner cette commande ?");
    expect(buttons().map((b) => [b.text, b.style])).toEqual([["Garder", "cancel"], ["Abandonner", "destructive"]]);
    expect(db.calls).toEqual([]); // rien n'est supprimé avant le « oui »
  });

  test("le texte dit ce qui sera supprimé selon le type ; le livre, lui, reste intact", () => {
    confirmAbandonOrder({ kind: "book" });
    confirmAbandonOrder({ kind: "poster" });
    confirmAbandonOrder({ kind: "print" });
    confirmAbandonOrder(undefined);
    const msg = (i) => Alert.alert.mock.calls[i][1];
    expect(msg(0)).toMatch(/fichier du livre/);
    expect(msg(0)).toMatch(/Ton livre, lui, reste intact/);
    expect(msg(1)).toMatch(/fichier du poster/);
    expect(msg(1)).not.toMatch(/livre/);
    expect(msg(2)).toMatch(/photos envoyées/);
    expect(msg(3)).toMatch(/fichier du livre/);
    expect(msg(0)).toMatch(/Rien n'a été envoyé à l'imprimeur/);
  });

  test("« Garder » ne supprime rien", async () => {
    makeOrder();
    confirmAbandonOrder({ id: "o1", kind: "book", status: "draft" }, jest.fn());
    await press("Garder");
    expect(db.rows("orders")).toHaveLength(1);
  });

  test("« Abandonner » : la commande disparaît du serveur ET de la liste affichée, puis onDone", async () => {
    const o = makeOrder({ status: "file_ready" });
    db.tables.orders.push({ id: "o2", status: "draft" });
    ordersStore.setState({ orders: [{ id: "o1" }, { id: "o2" }] });
    const onDone = jest.fn();
    confirmAbandonOrder(o, onDone);
    await press("Abandonner");
    expect(db.rows("orders").map((r) => r.id)).toEqual(["o2"]);
    expect(ordersStore.getState().orders.map((x) => x.id)).toEqual(["o2"]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test("impossible de supprimer : message d'excuse, liste relue depuis le serveur, onDone PAS appelé", async () => {
    const o = makeOrder({ status: "file_ready" });
    db.errors["orders.delete"] = { message: "denied" };
    ordersStore.setState({ orders: [{ id: "o1" }] });
    const onDone = jest.fn();
    confirmAbandonOrder(o, onDone);
    await press("Abandonner");
    expect(Alert.alert).toHaveBeenCalledTimes(2);
    expect(Alert.alert.mock.calls[1][0]).toBe("Impossible pour l'instant");
    expect(onDone).not.toHaveBeenCalled();
    expect(ordersStore.getState().orders).toHaveLength(1);
    expect(ordersStore.getState().load).toHaveBeenCalledWith({ refresh: false, force: true });
  });

  test("une commande déjà transmise ne peut PAS être abandonnée d'ici, même après un « oui »", async () => {
    const o = makeOrder({ status: "transmitted", supplier_ref: "IMP-1" });
    const onDone = jest.fn();
    confirmAbandonOrder(o, onDone);
    await press("Abandonner");
    expect(db.rows("orders")).toHaveLength(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(Alert.alert.mock.calls[1][0]).toBe("Impossible pour l'instant");
  });
});
