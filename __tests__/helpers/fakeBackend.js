// FAUX serveur pour tester les commandes (livre, poster, tirages, abonnement) sans réseau.
// Ce n'est pas un test : c'est un outil partagé par les fichiers `*.test.js` (jest.mock y renvoie ses modules).
//
// Ce que le faux Supabase sait faire (juste ce dont l'app a besoin) :
//   • des TABLES en mémoire : insert / select / update / delete / upsert, filtres `.eq()`, `.order()`, `.single()`, `.maybeSingle()` ;
//   • le STOCKAGE : list / remove, et les envois de fichiers (FileSystem.uploadAsync) qui y déposent un chemin ;
//   • les FONCTIONS serveur (`functions.invoke`) : à la main, via `db.invokeImpl` ;
//   • la SESSION (`auth.getSession`) ;
//   • des PANNES à la demande : `db.errors["orders.insert"] = { message, code }`.
// Comme le vrai, un `insert` dans `orders` reçoit un id, un statut « draft » et des dates.
//
// Les modules exportés (`supabaseModule`, `fileSystemModule`…) se branchent avec jest.mock, par exemple :
//   jest.mock("../services/supabase", () => require("./helpers/fakeBackend").supabaseModule);

const { createStore } = require("zustand/vanilla");

const copy = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const T0 = Date.UTC(2026, 10, 1, 12, 0, 0); // 1er nov. 2026, midi UTC

const db = {
  calls: [],
  tables: {},
  files: {},
  session: null,
  errors: {},
  uploads: [],
  uploadImpl: null,
  fileInfo: null,
  assets: {},
  invokeImpl: null,
  seq: 0,
  reset() {
    this.calls = [];
    this.tables = { orders: [], print_orders: [], addresses: [] };
    this.files = {};
    this.session = { user: { id: "u1" }, access_token: "tok" };
    this.errors = {};
    this.uploads = [];
    this.uploadImpl = null;
    this.fileInfo = null;
    this.assets = {};
    this.invokeImpl = null;
    this.blockDelete = false;
    this.seq = 0;
    ordersStore.setState({ orders: [], printOrderKeys: null });
    ordersStore.getState().load.mockClear();
    subscriptionStore.getState().setStage.mockClear();
  },
  // Raccourcis pour lire ce qui s'est passé.
  callsOf: (op, table) => db.calls.filter((c) => c.op === op && (!table || c.table === table)),
  rows: (table) => db.tables[table] ?? [],
};

// ── Tables ───────────────────────────────────────────────────────────────────
function run(table, q) {
  db.calls.push({ op: q.op, table, payload: copy(q.payload), filters: q.filters, opts: q.opts });
  const err = db.errors[`${table}.${q.op}`];
  if (err) return Promise.resolve({ data: null, error: err });
  if (!db.tables[table]) db.tables[table] = [];
  const rows = db.tables[table];
  const match = (r) => q.filters.every(([c, v]) => r[c] === v);
  const noRow = { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } };

  if (q.op === "insert") {
    const stamp = new Date(T0 + ++db.seq * 60000).toISOString();
    const row = { id: `${table[0]}${db.seq}`, ...(table === "orders" ? { status: "draft" } : {}), created_at: stamp, updated_at: stamp, ...copy(q.payload) };
    rows.push(row);
    return Promise.resolve({ data: copy(q.single ? row : [row]), error: null });
  }
  if (q.op === "update") {
    const hit = rows.filter(match);
    hit.forEach((r) => Object.assign(r, copy(q.payload)));
    if (q.single) return Promise.resolve(hit[0] ? { data: copy(hit[0]), error: null } : noRow);
    return Promise.resolve({ data: copy(hit), error: null });
  }
  if (q.op === "delete") {
    // Règle de sécurité (RLS) qui refuse la suppression : comme le vrai Supabase, AUCUNE erreur, simplement 0 ligne supprimée.
    if (db.blockDelete) return Promise.resolve({ data: [], error: null });
    const gone = rows.filter(match);
    db.tables[table] = rows.filter((r) => !match(r));
    return Promise.resolve({ data: gone.map((r) => ({ id: r.id })), error: null });
  }
  if (q.op === "upsert") {
    const keys = (q.opts?.onConflict ?? "id").split(",");
    const i = rows.findIndex((r) => keys.every((k) => r[k] === q.payload[k]));
    if (i >= 0) rows[i] = { ...rows[i], ...copy(q.payload) };
    else rows.push(copy(q.payload));
    return Promise.resolve({ data: null, error: null });
  }
  // select
  let out = rows.filter(match);
  if (q.order) {
    const [col, o] = q.order;
    out = [...out].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (o?.ascending === false ? -1 : 1));
  }
  if (q.single) return Promise.resolve(out[0] ? { data: copy(out[0]), error: null } : noRow);
  if (q.maybe) return Promise.resolve({ data: copy(out[0] ?? null), error: null });
  return Promise.resolve({ data: copy(out), error: null });
}

function query(table) {
  const q = { op: null, payload: null, opts: null, filters: [], order: null, single: false, maybe: false };
  const chain = {
    insert: (p) => { q.op = "insert"; q.payload = p; return chain; },
    update: (p) => { q.op = "update"; q.payload = p; return chain; },
    delete: () => { q.op = "delete"; return chain; },
    upsert: (p, o) => { q.op = "upsert"; q.payload = p; q.opts = o; return chain; },
    select: () => { if (!q.op) q.op = "select"; return chain; }, // après insert / update / delete : « renvoie-moi la ligne »
    eq: (c, v) => { q.filters.push([c, v]); return chain; },
    order: (c, o) => { q.order = [c, o]; return chain; },
    single: () => { q.single = true; return run(table, q); },
    maybeSingle: () => { q.maybe = true; return run(table, q); },
    then: (res, rej) => run(table, q).then(res, rej),
  };
  return chain;
}

// ── Stockage ─────────────────────────────────────────────────────────────────
const storage = {
  from: (bucket) => ({
    list: async (path) => {
      db.calls.push({ op: "storage.list", bucket, path });
      if (db.errors["storage.list"]) throw new Error(db.errors["storage.list"].message);
      const names = (db.files[bucket] ?? []).filter((p) => p.startsWith(`${path}/`)).map((p) => ({ name: p.slice(path.length + 1) }));
      return { data: names, error: null };
    },
    remove: async (paths) => {
      db.calls.push({ op: "storage.remove", bucket, paths });
      if (db.errors["storage.remove"]) throw new Error(db.errors["storage.remove"].message);
      db.files[bucket] = (db.files[bucket] ?? []).filter((p) => !paths.includes(p));
      return { data: paths.map((name) => ({ name })), error: null };
    },
  }),
};

const supabase = {
  from: query,
  storage,
  auth: { getSession: async () => ({ data: { session: db.session } }) },
  functions: {
    invoke: async (name, opts) => {
      db.calls.push({ op: "invoke", name, body: opts?.body });
      if (db.invokeImpl) return db.invokeImpl(name, opts?.body);
      return { data: { ok: true, order: { id: opts?.body?.orderId, status: "received" } }, error: null };
    },
  },
};

const supabaseModule = { supabase, SUPABASE_URL: "https://test.supabase.co", SUPABASE_PUBLISHABLE_KEY: "pk_test" };

// ── Envoi de fichiers et photothèque ─────────────────────────────────────────
const fileSystemModule = {
  FileSystemUploadType: { BINARY_CONTENT: "BINARY_CONTENT" },
  uploadAsync: async (url, uri, options) => {
    db.uploads.push({ url, uri, options });
    if (db.uploadImpl) return db.uploadImpl(url, uri, options, db.uploads.length);
    const m = url.match(/\/object\/([^/]+)\/(.+)$/);
    if (m) (db.files[m[1]] ||= []).push(m[2]);
    return { status: 200, body: "" };
  },
  getInfoAsync: async (uri) => (db.fileInfo ? db.fileInfo(uri) : { exists: true, size: 12345 }),
};

const mediaLibraryModule = {
  getAssetInfoAsync: async (id) => {
    if (id in db.assets) return db.assets[id];
    return { localUri: `file:///photos/${id}.jpg`, width: 4000, height: 3000 };
  },
};

// ── Faux stores Zustand ──────────────────────────────────────────────────────
const ordersStore = createStore(() => ({ orders: [], printOrderKeys: null, load: jest.fn() }));
const subscriptionStore = createStore(() => ({ setStage: jest.fn() }));
const ordersStoreModule = { useOrdersStore: ordersStore };
const subscriptionStoreModule = { useSubscriptionStore: subscriptionStore };

db.reset();

module.exports = {
  db, supabaseModule, fileSystemModule, mediaLibraryModule, ordersStoreModule, subscriptionStoreModule, ordersStore, subscriptionStore,
};
