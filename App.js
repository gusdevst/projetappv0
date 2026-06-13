// App.js — Point d'entrée unique
// Rôle : initialiser la navigation et vérifier la permission photo au démarrage.

import { useEffect } from "react";
import { View, Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider }    from "react-native-safe-area-context";
import { AppNavigator }        from "./navigation/AppNavigator";
import { usePhotoStore }       from "./store/usePhotoStore";

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

export default function App() {
  const checkPermission = usePhotoStore((s) => s.checkPermission);
  const loadLibrary     = usePhotoStore((s) => s.loadLibrary);

  useEffect(() => {
    // Masquer la barre Android au démarrage
    hideAndroidNavBar();

    // Au lancement : on vérifie la permission. Si déjà accordée, on charge la photothèque.
    (async () => {
      const status = await checkPermission();
      if (status === "granted") {
        await loadLibrary();
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* onStateChange : recache la barre Android à chaque changement d'écran */}
        <NavigationContainer onStateChange={hideAndroidNavBar}>
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
