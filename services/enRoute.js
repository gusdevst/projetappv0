// services/enRoute.js
// Bloc « En route » du Labo (maquette `Claude outputs/maquette-labo-en-route.html`, validée le 15 nov. 2026) :
// tout ce qui est parti à l'impression, au même endroit. Fonction PURE : elle reçoit les commandes de livres (table `orders`)
// et les abonnements, et renvoie des lignes prêtes à afficher. Un poster / un tirage simple s'y ajouteront ici le jour où ils se commandent.
//
// Une ligne = { key, type, tone, step, title, subtitle, statusLabel, albumId?, sortAt, nav: { name, params }, resume? }
//   tone : "todo" (à reprendre, orange) · "go" (en cours) · "ok" (livrée)
//   step : 0..3 (avancement), -1 si la commande n'est pas partie
// Règles : annulée = jamais affichée ; livrée = visible 14 jours puis seulement dans « Mes commandes » (Réglages) ;
// un envoi d'abonnement jamais mis à jour (suivi manuel) disparaît après 45 jours ; une sélection « validée » jamais envoyée au serveur n'apparaît pas.

import { ORDER_STATUS, ORDER_STEPS, orderStepIndex, isIncomplete } from "./bookOrder";
import { STAGES, stageIndex, monthName, shortDate } from "./printSelection";

const DAY = 86400000;
export const DELIVERED_KEEP_DAYS = 14;
const SUB_DELIVERY_DAYS = 7;   // même estimation que l'écran de suivi des abonnements
const SUB_STUCK_DAYS = 45;

export function buildEnRoute({ orders = [], subs = [], selections = {}, serverKeys = null, now = Date.now() }) {
  const items = [];

  // ── Livres photo et posters ──
  orders.forEach((o) => {
    if (o.status === "cancelled") return;
    const kind = o.kind === "poster" ? "poster" : o.kind === "print" ? "print" : "book";
    const poster = kind !== "book"; // poster et tirages : même suivi (commande reçue, pas transmise)
    const created = Date.parse(o.created_at) || now;
    const updated = Date.parse(o.updated_at) || created;
    const title = o.title || (kind === "poster" ? "Poster" : kind === "print" ? "Tirages" : "Livre photo");
    const what = kind === "poster" ? `Poster ${String(o.product).toUpperCase()}${o.quantity > 1 ? ` × ${o.quantity}` : ""}`
      : kind === "print" ? `Tirages ${String(o.product).replace("x", " × ")} cm · ${o.quantity}`
      : `Livre photo · ${o.pages} pages`;
    // Poster « reçu » : enregistré chez Pellicule, pas (encore) transmis à l'imprimeur.
    if (poster && o.status === "received") {
      items.push({
        key: `${kind}-${o.id}`, type: kind, tone: "go", step: 0, title,
        subtitle: `${what} · commandé le ${shortDate(created)}`,
        statusLabel: "Commande reçue",
        sortAt: created, nav: { name: "OrderTracking", params: { orderId: o.id } },
      });
      return;
    }

    if (isIncomplete(o)) {
      items.push({
        key: `${kind}-${o.id}`, type: kind, tone: "todo", step: -1, title,
        subtitle: what,
        statusLabel: `Commande ${(ORDER_STATUS[o.status]?.label ?? "à reprendre").toLowerCase()}`,
        albumId: o.album_id, sortAt: created, resume: true, order: o,
        nav: { name: kind === "poster" ? "PosterOrderProgress" : kind === "print" ? "PrintOrderProgress" : "BookOrderProgress", params: { orderId: o.id, albumId: o.album_id } },
      });
      return;
    }
    const delivered = o.status === "delivered";
    if (delivered && now - updated > DELIVERED_KEEP_DAYS * DAY) return;
    const step = orderStepIndex(o);
    items.push({
      key: `${kind}-${o.id}`, type: kind, tone: delivered ? "ok" : "go", step, title,
      subtitle: `${what} · commandé le ${shortDate(created)}`,
      statusLabel: delivered ? `✓ Livrée le ${shortDate(updated)}` : `${ORDER_STEPS[step].label}${o.status === "mailed" ? " · Colissimo" : ""}`,
      albumId: o.album_id, sortAt: delivered ? updated : created,
      nav: { name: "OrderTracking", params: { orderId: o.id } },
    });
  });

  // ── Envois de l'abonnement Coups de cœur (sélections validées) ──
  subs.forEach((sub) => {
    Object.entries(selections[sub.id] ?? {}).forEach(([month, sel]) => {
      if (sel?.status !== "validated") return;
      // Seulement les envois réellement partis (`sentAt`) ou retrouvés sur le serveur (`restored`) : une sélection « validée » avant
      // l'envoi des photos (anciennes versions) n'existe que sur le téléphone, pas dans Supabase → elle n'est pas « en route ».
      if (!sel.sentAt && !sel.restored) return;
      // `serverKeys` (envois présents dans print_orders, "subId|mois", connecté seulement) : un envoi absent du serveur
      // (ligne supprimée à la main, autre compte, test) n'est pas « en route » même si le téléphone l'a gardé.
      // Pas lu / pas connecté (`null`) = on ne peut rien affirmer : on n'affiche PAS (une ligne fantôme est pire qu'une ligne absente).
      if (!serverKeys || !new Set(serverKeys).has(`${sub.id}|${month}`)) return;
      const at = sel.validatedAt ?? now;
      const idx = stageIndex(sel);
      const delivered = idx === STAGES.length - 1;
      const age = now - at;
      if (delivered ? age > (SUB_DELIVERY_DAYS + DELIVERED_KEEP_DAYS) * DAY : age > SUB_STUCK_DAYS * DAY) return;
      items.push({
        key: `sub-${sub.id}-${month}`, type: "sub", tone: delivered ? "ok" : "go", step: idx,
        title: `Coups de cœur · ${monthName(month)}`,
        subtitle: `Abonnement · ${sub.kind === "self" ? "pour moi" : `pour ${sub.name}`}`,
        statusLabel: delivered ? "✓ Livrée" : STAGES[idx].label,
        sortAt: at,
        nav: { name: "SubscriptionTracking", params: { subId: sub.id, month } },
      });
    });
  });

  // À reprendre d'abord, puis en cours (plus récent en haut), puis livrées.
  const rank = (x) => (x.tone === "todo" ? 0 : x.tone === "go" ? 1 : 2);
  return items.sort((a, b) => rank(a) - rank(b) || b.sortAt - a.sortAt);
}
