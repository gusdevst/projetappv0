// navigation/AppNavigator.js
// Utilise createStackNavigator (JS-based) à la place du native-stack afin
// d'activer le swipe-to-go-back sur iOS ET Android.
// SwipeScreen a gestureEnabled: false pour ne pas interférer avec les swipes photo.

import { Dimensions } from "react-native";
import { createStackNavigator, CardStyleInterpolators } from "@react-navigation/stack";

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

const Stack = createStackNavigator();
const W     = Dimensions.get("window").width;

// Options communes : transition iOS + swipe-to-go-back sur tout l'écran gauche
const defaultOptions = {
  headerShown:           false,
  gestureEnabled:        true,
  gestureDirection:      "horizontal",
  gestureResponseDistance: Math.round(W * 0.15), // swipeable depuis 15 % gauche de l'écran
  cardStyleInterpolator:  CardStyleInterpolators.forHorizontalIOS,
};

export function AppNavigator() {
  const permission = usePhotoStore((s) => s.permission);

  if (permission === "undetermined") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS }}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      </Stack.Navigator>
    );
  }

  if (permission === "denied") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS }}>
        <Stack.Screen name="PermissionDenied" component={PermissionDeniedScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={defaultOptions}>
      <Stack.Screen name="Home"       component={HomeScreen} />
      <Stack.Screen name="TriMode"    component={TriModeScreen}
        options={{ cardStyleInterpolator: CardStyleInterpolators.forModalPresentationIOS, gestureDirection: "vertical" }}
      />
      {/* SwipeScreen : swipe désactivé — le geste appartient au tri des photos */}
      <Stack.Screen name="Swipe"      component={SwipeScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="Moments"    component={MomentScreen} />
      <Stack.Screen name="Duplicates" component={DuplicatesScreen} />
      <Stack.Screen name="Map"        component={MapScreen} />
      <Stack.Screen name="Gallery"    component={GalleryScreen} />
      <Stack.Screen name="Summary"    component={SummaryScreen} />
      <Stack.Screen name="Settings"   component={SettingsScreen} />
    </Stack.Navigator>
  );
}
