// screens/PosterAREntry.js
// Porte d'entrée de « Voir ce poster chez toi ». Elle charge `PosterARScreen` (et donc ViroReact) SEULEMENT à l'ouverture, et attrape l'erreur
// si l'app installée n'a pas le module natif (pas de rebuild) : un message clair au lieu d'un plantage.

import { TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import { C } from "../constants/theme";

export function PosterAREntry(props) {
  let Screen = null;
  let error = null;
  try {
    Screen = require("./PosterARScreen").PosterARScreen;
  } catch (e) {
    error = e;
  }
  if (Screen) return <Screen {...props} />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 20, justifyContent: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>La réalité augmentée n'est pas disponible</Text>
      <Text style={{ fontSize: 13.5, color: C.textMid, marginTop: 8, lineHeight: 20 }}>
        Cette version de l'app ne contient pas le module de réalité augmentée. Il faut une version plus récente.
      </Text>
      {__DEV__ && <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 12 }}>{String(error?.message ?? error)}</Text>}
      <TouchableOpacity onPress={() => props.navigation.goBack()} style={{ marginTop: 20, alignSelf: "flex-start", backgroundColor: C.album, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 }}>
        <Text style={{ color: "#fff", fontWeight: "700" }}>Retour</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
