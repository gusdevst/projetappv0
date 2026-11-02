// components/book/BookPage.js
// Une page du livre photo, dessinée à n'importe quelle taille
// (grande dans la double page, minuscule dans la bande des miniatures).
//
// La mise en page = des LIGNES de cadres. Ex. 3 photos : 1 grand en haut, 2 en bas.
// Les nombres dans ROWS sont les numéros de cadre (0, 1, 2…).

import { View, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import Text from "../AppText";
import { C } from "../../constants/theme";

const ROWS = {
  1: [[0]],
  2: [[0], [1]],
  3: [[0], [1, 2]],
  4: [[0, 1], [2, 3]],
};
const ROW_FLEX = { 3: [1.3, 1] }; // la ligne du haut un peu plus grande pour 3 photos

// page : { layout, slots } · urlById : { id: url } · onSlotPress(slotIndex) optionnel
export function BookPage({ page, size, urlById, selected, onPress, onSlotPress, number }) {
  const mini = size < 60;
  const pad = mini ? 1.5 : 9;
  const gap = mini ? 1 : 4;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={!onPress}
      style={{
        width: size, height: size, padding: pad, paddingBottom: mini ? pad : 15,
        backgroundColor: "#ffffff", borderRadius: mini ? 2 : 6,
        borderWidth: selected ? (mini ? 1.5 : 2.5) : 0, borderColor: C.album,
      }}
    >
      <View style={{ flex: 1, gap }}>
        {ROWS[page.layout].map((row, ri) => (
          <View key={ri} style={{ flex: ROW_FLEX[page.layout]?.[ri] ?? 1, flexDirection: "row", gap }}>
            {row.map((si) => {
              const url = page.slots[si] ? urlById[page.slots[si]] : null;
              return (
                <TouchableOpacity
                  key={si}
                  activeOpacity={0.8}
                  disabled={!onSlotPress}
                  onPress={() => onSlotPress?.(si)}
                  style={{
                    flex: 1, borderRadius: mini ? 1 : 3, overflow: "hidden",
                    backgroundColor: url ? C.bgMuted : mini ? C.border : C.bgCard,
                    borderWidth: url || mini ? 0 : 1.5, borderStyle: "dashed", borderColor: "#cfcdc4",
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  {url
                    ? <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    : !mini && <Text style={{ color: "#b5b3a9", fontSize: 18 }}>+</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
      {!mini && number != null && (
        <Text style={{ position: "absolute", bottom: 2, left: 0, right: 0, textAlign: "center", fontSize: 9, color: C.textMuted }}>
          {number}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// Page vide hachurée : « Intérieur de couverture », « Fin du livre ».
export function BlankPage({ size, label }) {
  return (
    <View style={{ width: size, height: size, backgroundColor: "#f6f5f1", borderRadius: 6, alignItems: "center", justifyContent: "center", padding: 10 }}>
      <Text style={{ fontSize: 10.5, color: C.textMuted, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

// Couverture (affichage simple ; les réglages du titre arrivent à l'étape 4).
export function BookCover({ cover, size, urlById, onPress }) {
  const url = cover.photoId ? urlById[cover.photoId] : null;
  const mini = size < 60;
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} disabled={!onPress}
      style={{ width: size, height: size, borderRadius: mini ? 2 : 8, overflow: "hidden", backgroundColor: C.albumSoft }}>
      {url && <Image source={{ uri: url }} style={{ position: "absolute", width: "100%", height: "100%" }} contentFit="cover" />}
      {onPress && !mini && (
        <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 10.5, fontWeight: "600", color: C.text }}>Changer la photo</Text>
        </View>
      )}
      {!mini && (
        <Text numberOfLines={2} style={{ position: "absolute", left: "8%", right: "8%", bottom: "9%", textAlign: "center",
          color: "#ffffff", fontSize: size * 0.13, fontWeight: "600",
          textShadowColor: "rgba(0,0,0,0.25)", textShadowRadius: 8 }}>
          {cover.title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
