// navigation/AppNavigator.js
// Le NavigationContainer est dans App.js (une seule fois dans toute l'app).
// Ici on choisit dynamiquement la pile à afficher selon l'état de la permission photo.

import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { OnboardingScreen }       from "../screens/OnboardingScreen";
import { PermissionDeniedScreen } from "../screens/PermissionDeniedScreen";
import { HomeScreen }             from "../screens/HomeScreen";
import { TriModeScreen }          from "../screens/TriModeScreen";
import { SwipeScreen }            from "../screens/SwipeScreen";
import { MomentScreen }           from "../screens/MomentScreen";
import { DuplicatesScreen }       from "../screens/DuplicatesScreen";
import { MapScreen }              from "../screens/MapScreen";
import { GalleryScreen }          from "../screens/GalleryScreen";
import { SummaryScreen }          from "../screens/SummaryScreen";
import { SettingsScreen }         from "../screens/SettingsScreen";
import { usePhotoStore }          from "../store/usePhotoStore";

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  const permission = usePhotoStore((s) => s.permission);

  // Tant que le check initial n'est pas fait, on affiche l'onboarding par défaut.
  // Le store passe à "granted"/"denied"/"undetermined" après le check au démarrage.
  if (permission === "undetermined") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      </Stack.Navigator>
    );
  }

  if (permission === "denied") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="PermissionDenied" component={PermissionDeniedScreen} />
      </Stack.Navigator>
    );
  }

  // Permission accordée → pile principale de l'app
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home"        component={HomeScreen} />
      <Stack.Screen name="TriMode"     component={TriModeScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="Swipe"       component={SwipeScreen} />
      <Stack.Screen name="Moments"     component={MomentScreen} />
      <Stack.Screen name="Duplicates"  component={DuplicatesScreen} />
      <Stack.Screen name="Map"         component={MapScreen} />
      <Stack.Screen name="Gallery"     component={GalleryScreen} />
      <Stack.Screen name="Summary"     component={SummaryScreen} />
      <Stack.Screen name="Settings"    component={SettingsScreen} />
    </Stack.Navigator>
  );
}
