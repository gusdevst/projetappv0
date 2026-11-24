// Tests de services/subscriptionSync.js : sauvegarde des abonnements « Coups de cœur » sur Supabase.
//   1) fonctions PURES (toRow, fromRow, mergeRemoteSubs, restoreSelections) : testées directement ;
//   2) comportement RÉSEAU (envoi différé de 3 s, récupération à la connexion, erreurs, doublons) : testé avec de FAUX
//      stores Zustand et un FAUX Supabase (rien ne sort de la machine). Le vrai code est celui qui tourne, seul l'extérieur est simulé.
jest.mock("../services/supabase", () => ({
  supabase: {
    from: (table) => ({
      select: (cols) => ({
        eq: (col, val) => {
          mockDb.calls.push({ op: "select", table, cols, col, val });
          return Promise.resolve(table === "subscriptions" ? mockDb.subsRes : mockDb.ordersRes);
        },
      }),
      upsert: (rows, opts) => {
        mockDb.calls.push({ op: "upsert", table, rows, opts });
        return Promise.resolve(mockDb.upsertRes);
      },
    }),
  },
}));
jest.mock("../store/useSubscriptionStore", () => {
  const { createStore } = require("zustand/vanilla");
  return { useSubscriptionStore: createStore(() => ({ subs: [], selections: {} })) };
});
jest.mock("../store/useAuthStore", () => {
  const { createStore } = require("zustand/vanilla");
  return { useAuthStore: createStore(() => ({ session: null })) };
});

const mockDb = { calls: [], subsRes: null, ordersRes: null, upsertRes: null };

const T0 = new Date("2026-11-17T10:00:00Z").getTime();

const fullSub = {
  id: "s1", kind: "self", product: "prints", count: 20, name: "Moi", recipient: "Léa",
  address: "1 rue Rivoli 75001 Paris", addressData: { name: "Léa", street: "1 rue Rivoli", zip: "75001", city: "Paris", phone: "0612345678" },
  message: "Coucou", validateEach: false, selectionDay: 5, sendDay: 20, status: "paused", createdAt: T0,
};

// ───────────────────────── 1) Fonctions pures ─────────────────────────
describe("fonctions pures", () => {
  let sync;
  beforeEach(() => { jest.resetModules(); sync = require("../services/subscriptionSync"); });

  describe("toRow : téléphone → ligne de la table", () => {
    test("recopie tous les champs et ajoute le compte", () => {
      expect(sync.toRow(fullSub, "u1")).toEqual({
        user_id: "u1", sub_id: "s1", kind: "self", product: "prints", count: 20, name: "Moi", recipient: "Léa",
        address: "1 rue Rivoli 75001 Paris", address_data: fullSub.addressData, message: "Coucou", validate_each: false,
        selection_day: 5, send_day: 20, status: "paused", created_at: "2026-11-17T10:00:00.000Z",
      });
    });

    test("valeurs par défaut d'un abonnement minimal", () => {
      const r = sync.toRow({ id: "s2", kind: "gift", count: 20, address: "x" }, "u1");
      expect(r.product).toBe("prints");
      expect(r.name).toBeNull();
      expect(r.recipient).toBeNull();
      expect(r.address_data).toBeNull();
      expect(r.message).toBeNull();
      expect(r.validate_each).toBe(true);
      expect(r.selection_day).toBe(1);
      expect(r.send_day).toBe(25);
      expect(r.status).toBe("active");
    });

    test("« Je valide chaque envoi » : seul `false` le désactive (absent = activé)", () => {
      expect(sync.toRow({ ...fullSub, validateEach: false }, "u").validate_each).toBe(false);
      expect(sync.toRow({ ...fullSub, validateEach: true }, "u").validate_each).toBe(true);
      expect(sync.toRow({ ...fullSub, validateEach: undefined }, "u").validate_each).toBe(true);
      expect(sync.toRow({ ...fullSub, validateEach: null }, "u").validate_each).toBe(true);
    });

    test("pas de date de création : on prend maintenant", () => {
      jest.useFakeTimers().setSystemTime(T0);
      const { createdAt, ...noDate } = fullSub;
      expect(sync.toRow(noDate, "u").created_at).toBe("2026-11-17T10:00:00.000Z");
      jest.useRealTimers();
    });

    test("un jour de sélection à 0 n'est pas remplacé par le défaut (?? et non ||)", () => {
      // 0 n'est pas un jour valide dans l'app, mais la conversion ne doit pas le « corriger » en silence
      expect(sync.toRow({ ...fullSub, selectionDay: 0 }, "u").selection_day).toBe(0);
    });
  });

  describe("fromRow : ligne de la table → téléphone", () => {
    test("recopie et convertit la date en millisecondes", () => {
      const r = sync.toRow(fullSub, "u1");
      const s = sync.fromRow(r);
      expect(s).toEqual({ ...fullSub, userId: "u1" });
      expect(typeof s.createdAt).toBe("number");
    });

    test("les champs vides du serveur (null) deviennent « absents » sur le téléphone", () => {
      const s = sync.fromRow({
        sub_id: "s2", kind: "self", user_id: "u", product: "prints", count: 20, name: null, recipient: null, address: "x",
        address_data: null, message: null, validate_each: true, selection_day: 1, send_day: 25, status: "active",
        created_at: "2026-11-17T10:00:00.000Z",
      });
      expect(s.name).toBeUndefined();
      expect(s.recipient).toBeUndefined();
      expect(s.addressData).toBeUndefined();
      expect(s.message).toBe(""); // le petit mot est toujours une chaîne (champ de saisie)
    });

    test("aller-retour : ce qu'on envoie est ce qu'on récupère (nouveau téléphone = mêmes réglages)", () => {
      for (const sub of [
        fullSub,
        { id: "s3", kind: "gift", count: 20, address: "x", status: "active", selectionDay: 1, sendDay: 25, validateEach: true, product: "prints", createdAt: T0, message: "" },
      ]) {
        expect(sync.fromRow(sync.toRow(sub, "u9"))).toEqual({ ...sub, userId: "u9" });
      }
    });
  });

  describe("mergeRemoteSubs : le téléphone gagne sur les doublons", () => {
    const remote = (id, extra = {}) => ({ ...sync.toRow({ ...fullSub, id, ...extra }, "u1") });

    test("ajoute seulement les abonnements du serveur absents du téléphone", () => {
      const local = [{ ...fullSub, id: "a" }];
      const out = sync.mergeRemoteSubs(local, [remote("a"), remote("b")]);
      expect(out.map((s) => s.id)).toEqual(["a", "b"]);
    });

    test("en cas de doublon, la version du TÉLÉPHONE est gardée (pas celle du serveur)", () => {
      const local = [{ ...fullSub, id: "a", status: "active", name: "Local" }];
      const out = sync.mergeRemoteSubs(local, [remote("a", { status: "cancelled", name: "Serveur" })]);
      expect(out).toHaveLength(1);
      expect(out[0].status).toBe("active");
      expect(out[0].name).toBe("Local");
    });

    test("téléphone neuf : tous les abonnements du serveur sont remis", () => {
      expect(sync.mergeRemoteSubs([], [remote("a"), remote("b"), remote("c")])).toHaveLength(3);
    });

    test("rien de part ni d'autre : liste vide ; arguments absents tolérés", () => {
      expect(sync.mergeRemoteSubs([], [])).toEqual([]);
      expect(sync.mergeRemoteSubs()).toEqual([]);
    });

    test("ne modifie pas la liste d'origine", () => {
      const local = [{ ...fullSub, id: "a" }];
      sync.mergeRemoteSubs(local, [remote("b")]);
      expect(local).toHaveLength(1);
    });
  });

  describe("restoreSelections : l'historique des envois revient sans les photos", () => {
    const order = (sub_id, month, extra = {}) => ({ sub_id, month, status: "shipped", photo_count: 20, created_at: "2026-10-03T08:00:00.000Z", ...extra });

    test("une commande du serveur devient une sélection « validée » restaurée", () => {
      const out = sync.restoreSelections({}, [order("s1", "2026-10")]);
      expect(out.s1["2026-10"]).toEqual({
        photoIds: [], photoCount: 20, size: 20, status: "validated", stage: "shipped",
        validatedAt: new Date("2026-10-03T08:00:00.000Z").getTime(),
        createdAt: new Date("2026-10-03T08:00:00.000Z").getTime(), restored: true,
      });
    });

    test("un mois DÉJÀ connu sur ce téléphone n'est jamais écrasé (il a ses vraies photos)", () => {
      const mine = { photoIds: ["p1", "p2"], size: 2, status: "validated" };
      const out = sync.restoreSelections({ s1: { "2026-10": mine } }, [order("s1", "2026-10", { status: "delivered" })]);
      expect(out.s1["2026-10"]).toBe(mine);
    });

    test("les autres mois du même abonnement sont conservés", () => {
      const nov = { photoIds: ["p9"], size: 1, status: "draft" };
      const out = sync.restoreSelections({ s1: { "2026-11": nov } }, [order("s1", "2026-10")]);
      expect(out.s1["2026-11"]).toBe(nov);
      expect(out.s1["2026-10"].restored).toBe(true);
    });

    test("plusieurs abonnements et plusieurs mois", () => {
      const out = sync.restoreSelections({}, [order("s1", "2026-09"), order("s1", "2026-10"), order("s2", "2026-10")]);
      expect(Object.keys(out.s1).sort()).toEqual(["2026-09", "2026-10"]);
      expect(Object.keys(out.s2)).toEqual(["2026-10"]);
    });

    test("ne modifie pas l'objet d'origine ; arguments absents tolérés", () => {
      const local = { s1: { "2026-11": { status: "draft", photoIds: [] } } };
      const copy = JSON.parse(JSON.stringify(local));
      sync.restoreSelections(local, [order("s1", "2026-10"), order("s2", "2026-10")]);
      expect(local).toEqual(copy);
      expect(sync.restoreSelections()).toEqual({});
    });
  });
});

// ───────────────────────── 2) Comportement réseau (faux Supabase) ─────────────────────────
describe("synchronisation avec le serveur", () => {
  let sync, auth, subs;
  const session = (id) => ({ user: { id } });
  const upserts = () => mockDb.calls.filter((c) => c.op === "upsert");
  const selects = () => mockDb.calls.filter((c) => c.op === "select");
  const tick = (ms = 0) => jest.advanceTimersByTimeAsync(ms); // laisse les promesses se résoudre (et avance l'horloge)
  const serverRow = (id, userId = "u1", extra = {}) => sync.toRow({ ...fullSub, id, ...extra }, userId);

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.setSystemTime(T0);
    mockDb.calls = [];
    mockDb.subsRes = { data: [], error: null };
    mockDb.ordersRes = { data: [], error: null };
    mockDb.upsertRes = { error: null };
    sync = require("../services/subscriptionSync");
    auth = require("../store/useAuthStore").useAuthStore;
    subs = require("../store/useSubscriptionStore").useSubscriptionStore;
  });
  afterEach(() => jest.useRealTimers());

  const login = (id = "u1") => auth.setState({ session: session(id) });

  test("pas connecté : aucun appel au serveur, même quand les abonnements changent", async () => {
    sync.startSubscriptionSync();
    subs.setState({ subs: [{ ...fullSub, id: "a" }] });
    await tick(10_000);
    expect(mockDb.calls).toEqual([]);
  });

  test("à la connexion : on lit les abonnements ET l'historique des envois DU COMPTE", async () => {
    sync.startSubscriptionSync();
    login("u1");
    await tick();
    expect(selects().map((c) => [c.table, c.col, c.val])).toEqual([
      ["subscriptions", "user_id", "u1"],
      ["print_orders", "user_id", "u1"],
    ]);
  });

  test("déjà connecté au lancement de l'app : récupération immédiate", async () => {
    login("u1");
    sync.startSubscriptionSync();
    await tick();
    expect(selects()).toHaveLength(2);
  });

  test("nouveau téléphone : les abonnements et l'historique du serveur sont remis", async () => {
    mockDb.subsRes = { data: [serverRow("a"), serverRow("b")], error: null };
    mockDb.ordersRes = { data: [{ sub_id: "a", month: "2026-10", status: "shipped", photo_count: 20, created_at: "2026-10-03T08:00:00.000Z" }], error: null };
    sync.startSubscriptionSync();
    login("u1");
    await tick();
    expect(subs.getState().subs.map((s) => s.id)).toEqual(["a", "b"]);
    expect(subs.getState().selections.a["2026-10"]).toMatchObject({ status: "validated", stage: "shipped", restored: true });
  });

  test("le téléphone gagne : un abonnement déjà présent n'est pas écrasé par celui du serveur", async () => {
    subs.setState({ subs: [{ ...fullSub, id: "a", name: "Local", userId: "u1" }] });
    mockDb.subsRes = { data: [serverRow("a", "u1", { name: "Serveur" })], error: null };
    sync.startSubscriptionSync();
    login("u1");
    await tick();
    expect(subs.getState().subs).toHaveLength(1);
    expect(subs.getState().subs[0].name).toBe("Local");
  });

  test("après la récupération, le résultat fusionné est renvoyé au serveur (upsert sur user_id + sub_id)", async () => {
    subs.setState({ subs: [{ ...fullSub, id: "a" }] });
    mockDb.subsRes = { data: [serverRow("b")], error: null };
    sync.startSubscriptionSync();
    login("u1");
    await tick();
    expect(upserts()).toHaveLength(1);
    expect(upserts()[0].table).toBe("subscriptions");
    expect(upserts()[0].opts).toEqual({ onConflict: "user_id,sub_id" });
    expect(upserts()[0].rows.map((r) => r.sub_id).sort()).toEqual(["a", "b"]);
    expect(upserts()[0].rows.every((r) => r.user_id === "u1" && typeof r.updated_at === "string")).toBe(true);
  });

  test("erreur à la lecture des abonnements (hors-ligne, table absente) : rien n'est touché, rien n'est envoyé", async () => {
    const before = [{ ...fullSub, id: "a" }];
    subs.setState({ subs: before });
    mockDb.subsRes = { data: null, error: { message: "offline" } };
    sync.startSubscriptionSync();
    login("u1");
    await tick();
    expect(subs.getState().subs).toBe(before);
    expect(upserts()).toEqual([]);
  });

  test("erreur seulement sur l'historique : les abonnements sont remis, les sélections restent comme elles étaient", async () => {
    const selections = { a: { "2026-11": { status: "draft", photoIds: [] } } };
    subs.setState({ selections });
    mockDb.subsRes = { data: [serverRow("b")], error: null };
    mockDb.ordersRes = { data: null, error: { message: "boom" } };
    sync.startSubscriptionSync();
    login("u1");
    await tick();
    expect(subs.getState().subs.map((s) => s.id)).toEqual(["b"]);
    expect(subs.getState().selections).toBe(selections);
  });

  test("après une erreur de lecture, on réessaie à la prochaine ouverture de session (pas bloqué)", async () => {
    mockDb.subsRes = { data: null, error: { message: "offline" } };
    sync.startSubscriptionSync();
    login("u1");
    await tick();
    mockDb.subsRes = { data: [serverRow("a")], error: null };
    auth.setState({ session: session("u1") }); // nouvel événement d'authentification (jeton renouvelé…)
    await tick();
    expect(subs.getState().subs.map((s) => s.id)).toEqual(["a"]);
  });

  test("deux événements d'auth pendant la lecture : UNE seule lecture (pas de course)", async () => {
    let release;
    mockDb.subsRes = new Promise((r) => { release = r; });
    sync.startSubscriptionSync();
    login("u1");
    auth.setState({ session: session("u1") });
    auth.setState({ session: session("u1") });
    await tick();
    expect(selects().filter((c) => c.table === "subscriptions")).toHaveLength(1);
    release({ data: [], error: null });
    await tick();
  });

  test("appeler startSubscriptionSync deux fois ne double pas les abonnements aux stores", async () => {
    sync.startSubscriptionSync();
    sync.startSubscriptionSync();
    login("u1");
    await tick();
    expect(selects().filter((c) => c.table === "subscriptions")).toHaveLength(1);
  });

  describe("envoi différé (3 s)", () => {
    const syncedAs = async (id = "u1") => {
      sync.startSubscriptionSync();
      login(id);
      await tick(); // récupération initiale terminée
      mockDb.calls = [];
    };

    test("un changement est envoyé après 3 s, pas avant", async () => {
      await syncedAs();
      subs.setState({ subs: [{ ...fullSub, id: "a" }] });
      await tick(2999);
      expect(upserts()).toHaveLength(0);
      await tick(1);
      expect(upserts()).toHaveLength(1);
    });

    test("plusieurs changements rapprochés = UN seul envoi (le dernier état)", async () => {
      await syncedAs();
      subs.setState({ subs: [{ ...fullSub, id: "a" }] });
      await tick(1500);
      subs.setState({ subs: [{ ...fullSub, id: "a" }, { ...fullSub, id: "b" }] });
      await tick(1500);
      subs.setState({ subs: [{ ...fullSub, id: "a" }, { ...fullSub, id: "b" }, { ...fullSub, id: "c" }] });
      await tick(3000);
      expect(upserts()).toHaveLength(1);
      expect(upserts()[0].rows.map((r) => r.sub_id)).toEqual(["a", "b", "c"]);
    });

    test("changer autre chose que les abonnements (les sélections) n'envoie rien", async () => {
      await syncedAs();
      subs.setState({ selections: { a: {} } });
      await tick(10_000);
      expect(upserts()).toEqual([]);
    });

    test("même contenu qu'au dernier envoi : pas de nouvel envoi inutile", async () => {
      await syncedAs();
      const list = [{ ...fullSub, id: "a" }];
      subs.setState({ subs: list });
      await tick(3000);
      expect(upserts()).toHaveLength(1);
      subs.setState({ subs: [{ ...fullSub, id: "a" }] }); // nouvel objet, mêmes valeurs
      await tick(3000);
      expect(upserts()).toHaveLength(1);
    });

    test("seuls les abonnements de CE compte (ou sans propriétaire) sont envoyés", async () => {
      await syncedAs("u1");
      subs.setState({ subs: [
        { ...fullSub, id: "mien", userId: "u1" },
        { ...fullSub, id: "ancien" }, // créé avant l'ajout du champ userId
        { ...fullSub, id: "autre", userId: "u2" }, // un autre compte sur le même téléphone
      ] });
      await tick(3000);
      expect(upserts()[0].rows.map((r) => r.sub_id)).toEqual(["mien", "ancien"]);
      expect(upserts()[0].rows.every((r) => r.user_id === "u1")).toBe(true);
    });

    test("liste vide : aucun envoi (on n'efface jamais le serveur)", async () => {
      await syncedAs();
      subs.setState({ subs: [{ ...fullSub, id: "a" }] });
      await tick(3000);
      mockDb.calls = [];
      subs.setState({ subs: [] });
      await tick(10_000);
      expect(upserts()).toEqual([]);
    });

    test("échec d'envoi : le même contenu est renvoyé au prochain essai", async () => {
      await syncedAs();
      mockDb.upsertRes = { error: { message: "offline" } };
      subs.setState({ subs: [{ ...fullSub, id: "a" }] });
      await tick(3000);
      expect(upserts()).toHaveLength(1);
      mockDb.upsertRes = { error: null };
      await sync.flushSubscriptions();
      expect(upserts()).toHaveLength(2);
      await sync.flushSubscriptions();
      expect(upserts()).toHaveLength(2); // cette fois c'est passé : plus rien à envoyer
    });

    test("flushSubscriptions (app en arrière-plan) envoie tout de suite et annule l'envoi différé", async () => {
      await syncedAs();
      subs.setState({ subs: [{ ...fullSub, id: "a" }] });
      await sync.flushSubscriptions();
      expect(upserts()).toHaveLength(1);
      await tick(10_000);
      expect(upserts()).toHaveLength(1); // pas de second envoi 3 s plus tard
    });

    test("flushSubscriptions sans être connecté : ne fait rien", async () => {
      sync.startSubscriptionSync();
      await sync.flushSubscriptions();
      expect(mockDb.calls).toEqual([]);
    });

    test("app mise en arrière-plan PENDANT la récupération : flushSubscriptions n'envoie rien (sinon on écraserait le serveur)", async () => {
      let release;
      mockDb.subsRes = new Promise((r) => { release = r; });
      sync.startSubscriptionSync();
      login("u1");
      subs.setState({ subs: [{ ...fullSub, id: "a" }] });
      await sync.flushSubscriptions();
      expect(upserts()).toEqual([]);
      release({ data: [], error: null });
      await tick();
    });

    test("pas d'envoi tant que la récupération du compte n'est pas faite (sinon on écraserait le serveur)", async () => {
      let release;
      mockDb.subsRes = new Promise((r) => { release = r; });
      sync.startSubscriptionSync();
      login("u1");
      subs.setState({ subs: [{ ...fullSub, id: "a" }] }); // changement PENDANT la lecture
      await tick(10_000);
      expect(upserts()).toEqual([]);
      release({ data: [serverRow("z")], error: null });
      await tick();
      // après la lecture : un seul envoi, avec le résultat FUSIONNÉ (a du téléphone + z du serveur)
      expect(upserts()).toHaveLength(1);
      expect(upserts()[0].rows.map((r) => r.sub_id).sort()).toEqual(["a", "z"]);
    });
  });

  describe("déconnexion et changement de compte", () => {
    test("déconnexion : l'envoi en attente est annulé", async () => {
      sync.startSubscriptionSync();
      login("u1");
      await tick();
      mockDb.calls = [];
      subs.setState({ subs: [{ ...fullSub, id: "a" }] }); // envoi programmé dans 3 s
      auth.setState({ session: null });
      await tick(10_000);
      expect(upserts()).toEqual([]);
    });

    test("après déconnexion, les changements ne sont plus envoyés", async () => {
      sync.startSubscriptionSync();
      login("u1");
      await tick();
      auth.setState({ session: null });
      mockDb.calls = [];
      subs.setState({ subs: [{ ...fullSub, id: "b" }] });
      await tick(10_000);
      expect(mockDb.calls).toEqual([]);
    });

    test("un AUTRE compte se connecte : nouvelle récupération avec SON identifiant", async () => {
      sync.startSubscriptionSync();
      login("u1");
      await tick();
      auth.setState({ session: null });
      mockDb.calls = [];
      login("u2");
      await tick();
      expect(selects().every((c) => c.val === "u2")).toBe(true);
      expect(selects()).toHaveLength(2);
    });

    test("même compte, session renouvelée : pas de nouvelle récupération", async () => {
      sync.startSubscriptionSync();
      login("u1");
      await tick();
      mockDb.calls = [];
      auth.setState({ session: session("u1") });
      await tick();
      expect(selects()).toEqual([]);
    });
  });
});
