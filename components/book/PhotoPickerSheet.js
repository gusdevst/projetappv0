// components/book/PhotoPickerSheet.js
// Feuille « Choisir une photo » du livre photo.
// - Pour un cadre : onglets « Pas encore placées » / « Tout l'album ».
//   Une photo déjà placée affiche « p.N » ; la choisir la DÉPLACE dans ce cadre.
// - Pour la couverture : tout l'album (une photo peut être en couverture ET dedans).

import { useState, useEffect } from "react";
import { View, TouchableOpacity, Pressable, Modal, FlatList, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Text from "../AppText";
import { C } from "../../constants/theme";

export default function PhotoPickerSheet({
  visible, onClose, subtitle, forCover, albumIds, urlById, placed, currentId, onPick, onRemove,
}) {
  const { width, height } = useWindowDimensions();
  const [tab, setTab] = useState("free");
  useEffect(() => { if (visible) setTab("free"); }, [visible]);

  const showAll = forCover || tab === "all";
  const list = showAll ? albumIds : albumIds.filter((id) => placed[id] === undefined);
  const cell = Math.floor((width - 32 - 3 * 4) / 4);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(35,39,31,0.4)" }} />
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, paddingBottom: 34, maxHeight: height * 0.8 }}>
          <View style={{ alignItems: "center", paddingTop: 10, marginBottom: 10 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: C.border }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text style={{ fontWeight: "600", fontSize: 18, color: C.text }}>Choisir une photo</Text>
            <Text style={{ fontSize: 12.5, color: C.textMuted }}>{subtitle}</Text>
          </View>

          {!forCover && (
            <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
              {[["free", "Pas encore placées"], ["all", "Tout l'album"]].map(([key, label]) => (
                <TouchableOpacity key={key} onPress={() => setTab(key)}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: tab === key ? C.text : C.bgMuted }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: tab === key ? "#fff" : C.textMuted }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {list.length === 0 ? (
            <Text style={{ fontSize: 13, color: C.textMuted, textAlign: "center", paddingVertical: 28, lineHeight: 19 }}>
              Toutes les photos sont déjà placées.{"\n"}Va dans « Tout l'album » pour en déplacer une.
            </Text>
          ) : (
            <FlatList
              data={list}
              keyExtractor={(id) => id}
              numColumns={4}
              style={{ marginTop: 10 }}
              columnWrapperStyle={{ gap: 4 }}
              contentContainerStyle={{ gap: 4 }}
              initialNumToRender={24}
              renderItem={({ item: id }) => {
                const page = placed[id];
                const dim = !forCover && page !== undefined;
                return (
                  <TouchableOpacity onPress={() => onPick(id)} activeOpacity={0.7}
                    style={{ width: cell, height: cell, borderRadius: 6, overflow: "hidden", backgroundColor: C.bgMuted,
                      borderWidth: id === currentId ? 2.5 : 0, borderColor: C.album }}>
                    <Image source={{ uri: urlById[id] }} style={{ width: "100%", height: "100%", opacity: dim ? 0.4 : 1 }} contentFit="cover" />
                    {page !== undefined && (
                      <View style={{ position: "absolute", right: 3, bottom: 3, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 9.5, fontWeight: "600", color: C.text }}>p.{page + 1}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {onRemove && (
            <TouchableOpacity onPress={onRemove}
              style={{ marginTop: 12, backgroundColor: C.albumSoft, borderRadius: 12, paddingVertical: 11, alignItems: "center" }}>
              <Text style={{ fontSize: 13.5, fontWeight: "600", color: C.album }}>Retirer la photo de ce cadre</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}
