// services/orderActions.js
// « Abandonner cette commande » : demande confirmation, supprime la commande jamais transmise (et son PDF), puis retire la ligne du store.
// Utilisé par « Mes commandes », l'écran de suivi et le bloc « En route » du Labo. `onDone` n'est appelé que si la commande a bien disparu.

import { Alert } from "react-native";
import { discardOrder } from "./bookOrder";
import { useOrdersStore } from "../store/useOrdersStore";

export function confirmAbandonOrder(order, onDone) {
  Alert.alert(
    "Abandonner cette commande ?",
    `Rien n'a été envoyé à l'imprimeur : la commande et ${order?.kind === "print" ? "les photos envoyées" : `le fichier du ${order?.kind === "poster" ? "poster" : "livre"}`} seront supprimés.${(order?.kind ?? "book") === "book" ? " Ton livre, lui, reste intact." : ""}`,
    [
      { text: "Garder", style: "cancel" },
      {
        text: "Abandonner", style: "destructive",
        onPress: async () => {
          const ok = await discardOrder(order);
          if (!ok) {
            Alert.alert("Impossible pour l'instant", "La commande n'a pas pu être supprimée (connexion ?). Réessaie dans un moment.");
            useOrdersStore.getState().load({ refresh: false, force: true });
            return;
          }
          useOrdersStore.setState((s) => ({ orders: s.orders.filter((o) => o.id !== order.id) }));
          onDone?.();
        },
      },
    ]
  );
}
