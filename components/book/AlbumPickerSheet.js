// components/book/AlbumPickerSheet.js
// Feuille « Quel album ? » : ouverte depuis l'accueil (mode Album) pour créer
// ou rouvrir le livre photo d'un album existant.

import { View, TouchableOpacity, Pressable, Modal, ScrollView, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Text from "../AppText";
import Icon from "../Icons";
import { C } from "../../constants/theme";

export default function AlbumPickerSheet({ visible, onClose, albums, urlById, books, onPick }) {
  const { height } = useWindowDimensions();
  const withPhotos = albums.filter((a) => a.photoIds.some((id) => urlById[id]));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(35,39,31,0.4)" }} />
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingBottom: 34, maxHeight: height * 0.75 }}>
          <View style={{ alignItems: "center", paddingTop: 10, marginBottom: 8 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: C.border }} />
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            <Text style={{ fontWeight: "600", fontSize: 18, color: C.text }}>Quel album ?</Text>
            <Text style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>Le livre photo se fait à partir d'un de tes albums.</Text>
          </View>

          {withPhotos.length === 0 ? (
            <Text style={{ fontSize: 13, color: C.textMuted, textAlign: "center", paddingVertical: 26, paddingHorizontal: 30, lineHeight: 19 }}>
              Tu n'as pas encore d'album.{"\n"}Crée-en un avec « Créer un album », puis reviens ici.
            </Text>
          ) : (
            <ScrollView>
              {withPhotos.map((a) => {
                const ids = a.photoIds.filter((id) => urlById[id]);
                return (
                  <TouchableOpacity key={a.id} onPress={() => onPick(a)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 9 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 11, overflow: "hidden", backgroundColor: C.albumSoft }}>
                      <Image source={{ uri: urlById[ids[0]] }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "500", color: C.text }}>{a.name}</Text>
                      <Text style={{ fontSize: 12, color: C.textMuted }}>
                        {ids.length} photo{ids.length > 1 ? "s" : ""}
                      </Text>
                    </View>
                    <Icon name="chevronRight" size={16} color={C.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
