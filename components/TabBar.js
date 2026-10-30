// components/TabBar.js
// Barre du bas : Accueil · Progression · [⇄ Tri / Album] · Galerie · Réglages.
// Le gros bouton central bascule le mode de l'accueil (vert = Tri, terracotta = Album)
// et ramène sur l'accueil si on était sur un autre onglet.

import { View, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Text from "./AppText";
import Icon from "./Icons";
import { C } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";

// nom de l'onglet → icône + libellé
const TABS = {
  Home:        { icon: "home",  label: "Accueil" },
  ProgressTab: { icon: "chart", label: "Progression" },
  GalleryTab:  { icon: "grid",  label: "Galerie" },
  SettingsTab: { icon: "gear",  label: "Réglages" },
};

export function TabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const homeMode = usePhotoStore((s) => s.homeMode);
  const toggleHomeMode = usePhotoStore((s) => s.toggleHomeMode);
  const modeColor = homeMode === "album" ? C.album : C.accent;

  const go = (route, focused) => {
    const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!focused && !ev.defaultPrevented) navigation.navigate(route.name);
  };

  const onCenter = () => {
    toggleHomeMode();
    if (state.routes[state.index].name !== "Home") navigation.navigate("Home");
  };

  const item = (route, i) => {
    const focused = state.index === i;
    const t = TABS[route.name];
    const color = focused ? modeColor : C.textMuted;
    return (
      <TouchableOpacity
        key={route.key}
        onPress={() => go(route, focused)}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        style={{ flex: 1, alignItems: "center", gap: 5, paddingTop: 15 }}
      >
        <Icon name={t.icon} size={27} color={color} strokeWidth={focused ? 2.1 : 1.9} />
        <Text style={{ fontSize: 11.5, fontWeight: focused ? "600" : "400", color }} numberOfLines={1}>{t.label}</Text>
      </TouchableOpacity>
    );
  };

  const routes = state.routes;
  return (
    <View style={{
      flexDirection: "row", alignItems: "flex-start",
      backgroundColor: C.bgCard, borderTopWidth: 1, borderTopColor: C.border,
      paddingBottom: Math.max(insets.bottom, 18), paddingHorizontal: 4,
    }}>
      {routes.slice(0, 2).map((r, i) => item(r, i))}

      {/* Bouton central : bascule Tri ⇄ Album */}
      <View style={{ flex: 1.1, alignItems: "center" }}>
        <TouchableOpacity
          onPress={onCenter}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={homeMode === "album" ? "Passer en mode Tri" : "Passer en mode Créer un album"}
          style={{
            width: 74, height: 74, borderRadius: 37, marginTop: -30,
            backgroundColor: modeColor, alignItems: "center", justifyContent: "center",
            borderWidth: 4, borderColor: C.bg,
            shadowColor: modeColor, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
          }}
        >
          <Icon name="swap" size={30} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
        <Text style={{ fontSize: 11.5, fontWeight: "600", color: modeColor, marginTop: 3 }} numberOfLines={1}>Tri ⇄ Album</Text>
      </View>

      {routes.slice(2).map((r, i) => item(r, i + 2))}
    </View>
  );
}
