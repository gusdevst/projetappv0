// components/PhotoGrid.js
// Grille de photos réutilisable (corbeille, album, conservées)
// Usage : <PhotoGrid photos={[...]} onPress={(photo) => ...} />

import { View, TouchableOpacity, Image, Dimensions } from "react-native";

const { width: SW } = Dimensions.get("window");

export function PhotoGrid({ photos, onPress, columns = 3 }) {
  const size = (SW - (columns + 1) * 6) / columns;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {photos.map((p) => (
        <TouchableOpacity
          key={p.id}
          onPress={() => onPress?.(p)}
          style={{ width: size, height: size, borderRadius: 12, overflow: "hidden" }}
        >
          <Image
            source={{ uri: p.url }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}