// App.js — Point d'entrée unique
// Rôle : uniquement lancer la navigation. C'est tout.

import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider }    from "react-native-safe-area-context";
import { AppNavigator }        from "./navigation/AppNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}