// components/AlbumFiltersBar.js
// Barre des filtres combinés du mode "Créer un album".
// Affiche un chip par filtre actif (date / lieu / coup de cœur) avec une croix
// pour le retirer. Les filtres se cumulent en INTERSECTION (ET).

import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { C } from "../constants/theme";

const TYPE_EMOJI = { date: "📅", lieu: "🗺", coeur: "❤️", visage: "👤" };

export function AlbumFiltersBar({ filters, onRemove, onClear, matchCount }) {
  if (!filters || filters.length === 0) return null;

  return (
    <View style={{
      backgroundColor: `${C.album}10`,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: `${C.album}40`,
      padding: 12,
      marginBottom: 12,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: "800", color: C.album, flex: 1 }}>
          🔗 {filters.length} filtre{filters.length > 1 ? "s" : ""} combiné{filters.length > 1 ? "s" : ""}
          {typeof matchCount === "number" ? ` · ${matchCount} photo${matchCount > 1 ? "s" : ""}` : ""}
        </Text>
        <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: C.textMuted }}>Tout effacer</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {filters.map((f) => (
            <View
              key={f.id}
              style={{
                flexDirection: "row", alignItems: "center", gap: 6,
                backgroundColor: C.bgCard,
                borderRadius: 99, borderWidth: 1.5, borderColor: `${C.album}55`,
                paddingLeft: 12, paddingRight: 8, paddingVertical: 7,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: C.album }}>
                {TYPE_EMOJI[f.type] || "•"} {f.label}
              </Text>
              <TouchableOpacity onPress={() => onRemove(f.id)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                <Text style={{ fontSize: 12, color: C.textMuted, fontWeight: "800" }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export default AlbumFiltersBar;
