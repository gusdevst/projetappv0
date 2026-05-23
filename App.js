// App.js — Point d'entrée unique
// Rôle : initialiser la navigation et vérifier la permission photo au démarrage.

import { useEffect } from "react";
import { View } from "react-native";
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

export default function App() {
  const checkPermission = usePhotoStore((s) => s.checkPermission);
  const loadLibrary     = usePhotoStore((s) => s.loadLibrary);

  useEffect(() => {
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
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
