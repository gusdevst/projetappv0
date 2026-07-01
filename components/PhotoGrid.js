// components/PhotoGrid.js
// Grille de photos réutilisable (corbeille, album, conservées)
// Usage : <PhotoGrid photos={[...]} onPress={(photo) => ...} />
//
// Props :
//   columns          — nombre de colonnes (défaut 2)
//   containerPadding — padding horizontal du parent (défaut 14, cf. GalleryScreen)
//   gap              — espacement entre photos (défaut 6)
//   onLongPress      — appelé quand l'user appuie longuement sur une photo (active la sélection multiple)
//   selectedIds      — Set<string> des IDs sélectionnés ; si fourni, affiche le mode sélection

import { View, TouchableOpacity, Text, useWindowDimensions } from "react-native";
import { Image } from "expo-image";

export function PhotoGrid({
  photos,
  onPress,
  onLongPress,
  selectedIds,
  columns = 2,
  containerPadding = 14,
  gap = 6,
}) {
  const { width: SW } = useWindowDimensions();

  // Largeur disponible = écran moins les 2 marges du container
  // Taille d'une photo = (largeur dispo - espaces entre colonnes) / nb colonnes
  const availableWidth = SW - containerPadding * 2;
  const size = (availableWidth - gap * (columns - 1)) / columns;

  // Mode sélection actif si selectedIds est fourni (même s'il est vide)
  const inSelectionMode = selectedIds !== undefined && selectedIds !== null;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
      {photos.map((p) => {
        const isSelected = inSelectionMode && selectedIds.has(p.id);
        return (
          <TouchableOpacity
            key={p.id}
            onPress={() => onPress?.(p)}
            onLongPress={() => onLongPress?.(p)}
            delayLongPress={350}
            activeOpacity={0.85}
            style={{
              width: size, height: size, borderRadius: 12, overflow: "hidden",
              // Bordure bleue sur les photos sélectionnées
              borderWidth: isSelected ? 3 : 0,
              borderColor: isSelected ? "#3B82F6" : "transparent",
            }}
          >
            <Image
              source={{ uri: p.url }}
              style={{
                width: "100%", height: "100%",
                // Léger assombrissement des photos non sélectionnées en mode sélection
                opacity: inSelectionMode && !isSelected ? 0.55 : 1,
              }}
              resizeMode="cover"
            />
            {/* Pastille ✓ bleue sur les photos sélectionnées */}
            {isSelected && (
              <View style={{
                position: "absolute", top: 6, right: 6,
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: "#3B82F6",
                alignItems: "center", justifyContent: "center",
                borderWidth: 2, borderColor: "#fff",
              }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", lineHeight: 14 }}>✓</Text>
              </View>
            )}
            {/* Cercle vide (non sélectionné) en mode sélection */}
            {inSelectionMode && !isSelected && (
              <View style={{
                position: "absolute", top: 6, right: 6,
                width: 22, height: 22, borderRadius: 11,
                borderWidth: 2, borderColor: "rgba(255,255,255,0.8)",
                backgroundColor: "rgba(0,0,0,0.2)",
              }} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
