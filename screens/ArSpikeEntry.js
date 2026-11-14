// screens/ArSpikeEntry.js  — SPIKE (__DEV__ seulement)
// Porte d'entrée de l'écran de test AR. Elle charge `ArSpikeScreen` (et donc ViroReact) SEULEMENT quand on ouvre l'écran,
// et attrape l'erreur si l'app installée n'a pas encore le module natif (pas de rebuild) : message clair au lieu d'un plantage.

import { View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import { C } from "../constants/theme";

export function ArSpikeEntry(props) {
  let Screen = null;
  let error = null;
  try {
    Screen = require("./ArSpikeScreen").ArSpikeScreen;
  } catch (e) {
    error = e;
  }
  if (Screen) return <Screen {...props} />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 20, justifyContent: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>Le module AR n'est pas dans cette version</Text>
      <Text style={{ fontSize: 13.5, color: C.textMid, marginTop: 8, lineHeight: 20 }}>
        Il faut reconstruire l'app (build de développement) après l'installation de ViroReact.
      </Text>
      <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 12 }}>{String(error?.message ?? error)}</Text>
      <TouchableOpacity onPress={() => props.navigation.goBack()} style={{ marginTop: 20, alignSelf: "flex-start", backgroundColor: C.album, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 }}>
        <Text style={{ color: "#fff", fontWeight: "700" }}>Retour</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
