// hooks/useAndroidBack.js
// Hook personnalisé : gère le bouton retour physique Android
// Usage : useAndroidBack(() => navigation.goBack())

import { useEffect } from "react";
import { BackHandler, Platform } from "react-native";

export function useAndroidBack(handler) {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handler();
      return true; // true = on intercepte l'event, l'app ne se ferme pas
    });
    return () => sub.remove(); // nettoyage quand le composant se démonte
  }, [handler]);
}