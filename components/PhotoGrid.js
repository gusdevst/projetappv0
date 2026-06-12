// components/PhotoGrid.js
// Grille de photos réutilisable (corbeille, album, conservées)
// Usage : <PhotoGrid photos={[...]} onPress={(photo) => ...} />
//
// Props :
//   columns         — nombre de colonnes (défaut 2)
//   containerPadding — padding horizontal du parent (défaut 14, cf. GalleryScreen)
//   gap             — espacement entre photos (défaut 6)

import { View, TouchableOpacity, Image, useWindowDimensions } from "react-native";

export function PhotoGrid({ photos, onPress, columns = 2, containerPadding = 14, gap = 6 }) {
  const { width: SW } = useWindowDimensions();

  // Largeur disponible = écran moins les 2 marges du container
  // Taille d'une photo = (largeur dispo - espaces entre colonnes) / nb colonnes
  const availableWidth = SW - containerPadding * 2;
  const size = (availableWidth - gap * (columns - 1)) / columns;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
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