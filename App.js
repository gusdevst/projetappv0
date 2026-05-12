// App.js — Point d'entrée unique
// Rôle : navigation entre écrans UNIQUEMENT
// Toute la logique métier est dans /screens et /services

import { useState } from "react";
import { View, Modal, Text, TouchableOpacity } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { HomeScreen }     from "./screens/HomeScreen";
import { SwipeScreen }    from "./screens/SwipeScreen";
import { FaceScreen }     from "./screens/FaceScreen";
import { MapScreen }      from "./screens/MapScreen";
import { GalleryScreen }  from "./screens/GalleryScreen";
import { SummaryScreen }  from "./screens/SummaryScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { C, S }           from "./constants/theme";

export default function App() {
  const [screen, setScreen]         = useState("home");
  const [swipeQueue, setSwipeQueue] = useState([]);
  const [kept, setKept]             = useState([]);
  const [deleted, setDeleted]       = useState([]);
  const [printed, setPrinted]       = useState([]);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const goHome     = () => setScreen("home");
  const startSwipe = q  => { setSwipeQueue(q); setScreen("swipe"); };

  const handleDone = res => {
    setKept(k    => [...k,    ...res.kept.filter(p    => !k.map(x => x.id).includes(p.id))]);
    setDeleted(d => [...d,    ...res.deleted.filter(p => !d.map(x => x.id).includes(p.id))]);
    setPrinted(p => [...p,    ...res.printed.filter(x => !p.map(y => y.id).includes(x.id))]);
    setScreen("summary");
  };

  return (
    <SafeAreaProvider>
      {screen === "home"     && <HomeScreen onSwipe={startSwipe} onFaces={() => setScreen("faces")} onMap={() => setScreen("map")} onSection={s => setScreen(s)} onSettings={() => setScreen("settings")} kept={kept} deleted={deleted} printed={printed} />}
      {screen === "swipe"    && <SwipeScreen queue={swipeQueue} onDone={handleDone} onBack={goHome} />}
      {screen === "faces"    && <FaceScreen onBack={goHome} onStartSwipe={startSwipe} />}
      {screen === "map"      && <MapScreen onBack={goHome} onStartSwipe={startSwipe} />}
      {screen === "summary"  && <SummaryScreen kept={kept} deleted={deleted} printed={printed} onHome={goHome} />}
      {screen === "settings" && <SettingsScreen onBack={goHome} />}
      {screen === "kept"     && <GalleryScreen title="Photos conservées" photos={kept}    accent={C.green}  onBack={goHome} />}
      {screen === "album"    && <GalleryScreen title="Album souvenirs"   photos={printed} accent={C.purple} onBack={goHome} />}
      {screen === "deleted"  && (
        <View style={{ flex: 1 }}>
          <GalleryScreen title="Corbeille" photos={deleted} accent={C.red} onBack={goHome} showEmpty onEmpty={() => setConfirmEmpty(true)} />
          <Modal visible={confirmEmpty} transparent animationType="slide">
            <View style={{ flex: 1, backgroundColor: "rgba(60,20,0,0.5)", justifyContent: "flex-end" }}>
              <View style={{ backgroundColor: C.bgCard, borderRadius: S.radiusLg, padding: S.padLg, paddingBottom: 44 }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: C.text, marginBottom: 8 }}>Vider la corbeille ?</Text>
                <Text style={{ fontSize: 14, color: C.textMuted, marginBottom: 24 }}>Supprime définitivement {deleted.length} photos.</Text>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TouchableOpacity onPress={() => setConfirmEmpty(false)} style={{ flex: 1, backgroundColor: C.bgMuted, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: C.border }}>
                    <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setDeleted([]); setConfirmEmpty(false); goHome(); }} style={{ flex: 1, backgroundColor: C.red, borderRadius: 14, padding: 14, alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Confirmer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      )}
    </SafeAreaProvider>
  );
}