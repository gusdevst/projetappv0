// navigation/AppNavigator.js
// Le NavigationContainer est dans App.js (une seule fois dans toute l'app).
// Ici on déclare uniquement la pile d'écrans (Stack Navigator).

import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { HomeScreen }     from "../screens/HomeScreen";
import { SwipeScreen }    from "../screens/SwipeScreen";
import { FaceScreen }     from "../screens/FaceScreen";
import { MapScreen }      from "../screens/MapScreen";
import { GalleryScreen }  from "../screens/GalleryScreen";
import { SummaryScreen }  from "../screens/SummaryScreen";
import { SettingsScreen } from "../screens/SettingsScreen";

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home"     component={HomeScreen} />
      <Stack.Screen name="Swipe"    component={SwipeScreen} />
      <Stack.Screen name="Faces"    component={FaceScreen} />
      <Stack.Screen name="Map"      component={MapScreen} />
      <Stack.Screen name="Gallery"  component={GalleryScreen} />
      <Stack.Screen name="Summary"  component={SummaryScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}