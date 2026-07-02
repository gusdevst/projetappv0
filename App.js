// App.js — Point d'entrée unique
// Rôle : initialiser la navigation, vérifier la permission photo au démarrage,
// et gérer le tap sur une notification de rappel (→ session ménage aléatoire).

import { useEffect, useRef } from "react";
import { View, Platform, AppState } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { AppNavigator } from "./navigation/AppNavigator";
import { usePhotoStore } from "./store/usePhotoStore";

// Import défensif : avant le rebuild incluant react-native-gesture-handler dans
// le binaire natif, on tombe sur un View standard sans gestures. Une fois le rebuild
// fait, GestureHandlerRootView prend le relais et active pinch/pan/double-tap.
let GestureHandlerRootView = View;
try {
  GestureHandlerRootView = require("react-native-gesture-handler").GestureHandlerRootView;
} catch (e) {
  // Module non disponible dans le dev build courant — fallback sur View
}

// Import défensif de expo-navigation-bar (Android uniquement)
let NavigationBar = null;
try {
  if (Platform.OS === "android") {
    NavigationBar = require("expo-navigation-bar");
  }
} catch (e) {}

// Fonction utilitaire : cacher la barre Android (appelée à chaque navigation)
async function hideAndroidNavBar() {
  if (!NavigationBar || Platform.OS !== "android") return;
  try {
    // overlay-swipe = la barre réapparaît brièvement si swipe depuis le bord, puis se recache seule
    await NavigationBar.setBehaviorAsync("overlay-swipe");
    await NavigationBar.setVisibilityAsync("hidden");
  } catch (e) {}
}

// ── Ref de navigation ──────────────────────────────────────────────────────────
// Permet de naviguer depuis l'extérieur du contexte React Navigation
// (ex : depuis le handler de notification).
export const navigationRef = createNavigationContainerRef();

// ── Session quotidienne depuis une notification ────────────────────────────
// Lance la session configurée par sortPriority : une sélection aléatoire,
// ou un batch de groupes de doublons à trier.
// Retourne true si la navigation a été déclenchée, false si la bibliothèque
// n'est pas encore chargée (on réessaiera après loadLibrary).
const DUPLICATES_BATCH_GROUPS = 5;

function launchDailySession() {
  const { libraryPhotos, kept, deleted, printed, skipped, randomCount, sortPriority } =
    usePhotoStore.getState();

  if (libraryPhotos.length === 0) return false;

  const priority = sortPriority || { type: "random" };

  // Le tri des doublons a sa propre écran (regroupement + comparaison) :
  // on y navigue directement avec une limite de groupes pour la session du jour.
  if (priority.type === "duplicates") {
    if (navigationRef.isReady()) {
      navigationRef.navigate("Duplicates", { maxGroups: DUPLICATES_BATCH_GROUPS });
    }
    return true;
  }

  const triedIds = new Set([
    ...kept.map((p) => p.id),
    ...deleted.map((p) => p.id),
    ...printed.map((p) => p.id),
    ...skipped.map((p) => p.id),
  ]);

  let pool = libraryPhotos.filter((p) => !triedIds.has(p.id));
  if (pool.length === 0) return true; // Tout trié, rien à faire

  // Pour native_album, le filtrage nécessite un appel async (getAlbumAssetIds)
  // qui ne peut pas se faire ici de façon synchrone — on tombe en mode aléatoire.

  // Mélange aléatoire (Fisher-Yates)
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const count = Math.min(randomCount || 30, shuffled.length);
  const queue = shuffled.slice(0, count);

  if (navigationRef.isReady()) {
    navigationRef.navigate("Swipe", { queue, mode: "menage" });
  }
  return true;
}

export default function App() {
  const checkPermission  = usePhotoStore((s) => s.checkPermission);
  const loadLibrary      = usePhotoStore((s) => s.loadLibrary);
  const pendingNotifTap  = useRef(false);

  useEffect(() => {
    hideAndroidNavBar();

    // iOS — app tuée puis ouverte via un tap sur la notification :
    // le listener ci-dessous ne se déclenche pas, on récupère la réponse ici.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (
        response?.notification?.request?.content?.data?.action ===
        "start_menage_random"
      ) {
        pendingNotifTap.current = true;
      }
    });

    // Toutes plateformes — app en foreground ou background (Android couvre aussi
    // le killed state via ce listener).
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (
          response?.notification?.request?.content?.data?.action ===
          "start_menage_random"
        ) {
          // Si la bibliothèque n'est pas encore chargée, on marque comme en attente.
          if (!launchDailySession()) {
            pendingNotifTap.current = true;
          }
        }
      }
    );

    // Vérification permission + chargement de la bibliothèque
    (async () => {
      const status = await checkPermission();
      if (status === "granted") {
        await loadLibrary();
        // Bibliothèque chargée : traiter le tap de notification différé si nécessaire
        if (pendingNotifTap.current) {
          pendingNotifTap.current = false;
          launchDailySession();
        }
      }
    })();

    return () => sub.remove();
  }, []);

  // Rafraîchit la photothèque quand l'app revient au premier plan, pour que
  // les photos prises pendant que l'app était en arrière-plan (ou fermée sans
  // relancer le process) apparaissent sans avoir à redémarrer l'app.
  // loadLibrary() déclenche lui-même le scan GPS en arrière-plan (étape 3),
  // donc les nouvelles photos sont aussi géolocalisées automatiquement.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      const { permission, libraryLoading } = usePhotoStore.getState();
      if (permission === "granted" && !libraryLoading) {
        usePhotoStore.getState().loadLibrary();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* onStateChange : recache la barre Android à chaque changement d'écran */}
        <NavigationContainer ref={navigationRef} onStateChange={hideAndroidNavBar}>
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
