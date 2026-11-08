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
//   badgeFor         — (photo) => texte | null ; petite pastille en bas à gauche (ex. « Imprimée »)

import { View, TouchableOpacity, useWindowDimensions } from "react-native";
import Text from "./AppText";
import { Image } from "expo-image";
import Icon from "./Icons";

import { C } from "../constants/theme";
export function PhotoGrid({
  photos,
  onPress,
  onLongPress,
  selectedIds,
  badgeFor,
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
              borderColor: isSelected ? C.accent : "transparent",
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
            {/* Pastille d'information (ex. « Imprimée ») */}
            {!!badgeFor?.(p) && (
              <View style={{ position: "absolute", left: 6, bottom: 6, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(35,39,31,0.74)", borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3 }}>
                <Icon name="printer" size={11} color="#fff" strokeWidth={2.2} />
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{badgeFor(p)}</Text>
              </View>
            )}
            {/* Pastille ✓ bleue sur les photos sélectionnées */}
            {isSelected && (
              <View style={{
                position: "absolute", top: 6, right: 6,
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: C.accent,
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
