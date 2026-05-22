// App.js — Point d'entrée unique
// Rôle : initialiser la navigation et vérifier la permission photo au démarrage.

import { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider }    from "react-native-safe-area-context";
import { AppNavigator }        from "./navigation/AppNavigator";
import { usePhotoStore }       from "./store/usePhotoStore";

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
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
