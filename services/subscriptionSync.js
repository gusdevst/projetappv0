// services/subscriptionSync.js
// Sauvegarde des ABONNEMENTS « Coups de cœur » sur Supabase (table `subscriptions`, voir supabase/sql/subscriptions.sql).
//
// Avant : tout restait sur le téléphone (rien côté serveur). Maintenant :
//   • ENVOI : à chaque changement (abonnement, pause, reprise, résiliation, dates, adresse), envoi différé de 3 s ;
//     seuls les abonnements créés par le compte connecté sont envoyés.
//   • RÉCUPÉRATION (connexion / lancement) : les abonnements du compte absents du téléphone sont remis (nouveau
//     téléphone), + l'historique des envois (table `print_orders`) pour ne pas revalider un mois déjà envoyé.
//     En cas de doublon, le téléphone gagne (il est la source).
// Jamais bloquant : hors-ligne ou erreur → on réessaie au prochain changement / retour au premier plan.

import { supabase } from "./supabase";
import { useSubscriptionStore } from "../store/useSubscriptionStore";
import { useAuthStore } from "../store/useAuthStore";

const PUSH_DELAY_MS = 3000;

// ── Conversions et fusion (fonctions pures, sans réseau) ─────────────────────

// abonnement du téléphone → ligne de la table
export function toRow(sub, userId) {
  return {
    user_id: userId,
    sub_id: sub.id,
    kind: sub.kind,
    product: sub.product ?? "prints",
    count: sub.count,
    name: sub.name ?? null,
    recipient: sub.recipient ?? null,
    address: sub.address,
    message: sub.message ?? null,
    validate_each: sub.validateEach !== false,
    selection_day: sub.selectionDay ?? 1,
    send_day: sub.sendDay ?? 25,
    status: sub.status ?? "active",
    created_at: new Date(sub.createdAt ?? Date.now()).toISOString(),
  };
}

// ligne de la table → abonnement du téléphone
export function fromRow(r) {
  return {
    id: r.sub_id,
    kind: r.kind,
    userId: r.user_id,
    product: r.product,
    count: r.count,
    name: r.name ?? undefined,
    recipient: r.recipient ?? undefined,
    address: r.address,
    message: r.message ?? "",
    validateEach: r.validate_each,
    selectionDay: r.selection_day,
    sendDay: r.send_day,
    status: r.status,
    createdAt: new Date(r.created_at).getTime(),
  };
}

// Ajoute au téléphone les abonnements du serveur qu'il n'a pas (le téléphone gagne sur les doublons).
export function mergeRemoteSubs(localSubs = [], remoteRows = []) {
  const have = new Set(localSubs.map((s) => s.id));
  return [...localSubs, ...remoteRows.filter((r) => !have.has(r.sub_id)).map(fromRow)];
}

// Remet l'historique des envois : pour chaque commande du serveur absente du téléphone, une sélection « validée »
// (sans photos : leurs identifiants sont propres à l'ancien téléphone ; on garde le nombre et l'étape de suivi).
export function restoreSelections(localSelections = {}, orders = []) {
  const out = { ...localSelections };
  orders.forEach((o) => {
    if (out[o.sub_id]?.[o.month]) return; // déjà connue sur ce téléphone
    out[o.sub_id] = {
      ...out[o.sub_id],
      [o.month]: {
        photoIds: [], photoCount: o.photo_count, size: o.photo_count, status: "validated",
        stage: o.status, validatedAt: new Date(o.created_at).getTime(), createdAt: new Date(o.created_at).getTime(), restored: true,
      },
    };
  });
  return out;
}

// ── Réseau ───────────────────────────────────────────────────────────────────

let syncedFor = null; // compte pour lequel la récupération initiale est faite
let lastPushed = "";  // dernier contenu envoyé (évite les envois inutiles)
let pushTimer = null;
let pulling = false;

async function push(userId) {
  const subs = useSubscriptionStore.getState().subs.filter((s) => !s.userId || s.userId === userId);
  if (subs.length === 0) return;
  const rows = subs.map((s) => toRow(s, userId));
  const json = JSON.stringify(rows);
  if (json === lastPushed) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("subscriptions")
    .upsert(rows.map((r) => ({ ...r, updated_at: now })), { onConflict: "user_id,sub_id" });
  if (!error) lastPushed = json; // en cas d'erreur (hors-ligne, SQL pas lancé), on réessaiera
}

async function pullAndMerge(userId) {
  if (pulling) return;
  pulling = true;
  try {
    const [subsRes, ordersRes] = await Promise.all([
      supabase.from("subscriptions").select("*").eq("user_id", userId),
      supabase.from("print_orders").select("sub_id, month, status, photo_count, created_at").eq("user_id", userId),
    ]);
    if (subsRes.error) return; // hors-ligne ou table absente : on réessaiera plus tard
    const st = useSubscriptionStore.getState();
    const subs = mergeRemoteSubs(st.subs, subsRes.data ?? []);
    const selections = ordersRes.error ? st.selections : restoreSelections(st.selections, ordersRes.data ?? []);
    useSubscriptionStore.setState({ subs, selections });
    syncedFor = userId;
    lastPushed = ""; // force un premier envoi du résultat
    await push(userId);
  } catch (e) {
    // silencieux : la synchro est un confort
  } finally {
    pulling = false;
  }
}

function schedulePush() {
  const userId = useAuthStore.getState().session?.user?.id;
  if (!userId || syncedFor !== userId) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => push(userId).catch(() => {}), PUSH_DELAY_MS);
}

// Envoi immédiat (ex. quand l'app passe en arrière-plan).
export async function flushSubscriptions() {
  const userId = useAuthStore.getState().session?.user?.id;
  if (!userId || syncedFor !== userId) return;
  clearTimeout(pushTimer);
  try { await push(userId); } catch (e) { /* silencieux */ }
}

let started = false;

// À appeler une fois au démarrage (App.js).
export function startSubscriptionSync() {
  if (started) return;
  started = true;

  const onSession = (session) => {
    const userId = session?.user?.id;
    if (!userId) { syncedFor = null; clearTimeout(pushTimer); return; }
    if (syncedFor !== userId) pullAndMerge(userId);
  };
  useAuthStore.subscribe((s) => onSession(s.session));
  onSession(useAuthStore.getState().session);

  // Chaque changement d'abonnement → envoi différé.
  useSubscriptionStore.subscribe((state, prev) => {
    if (state.subs !== prev.subs) schedulePush();
  });
}
