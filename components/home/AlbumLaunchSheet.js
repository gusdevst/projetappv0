// components/home/AlbumLaunchSheet.js
// Feuille « Dans quel album ? » : s'ouvre PAR LE BAS quand on touche « Créer un album » sur l'accueil (mode Album).
// Même forme que la feuille « Quel album ? » du livre photo (AlbumPickerSheet) :
//   · une ligne « Nouvel album » (on tape le nom, « Commencer ») ;
//   · la liste de MES ALBUMS (toucher = ajouter les photos à cet album).
// Remplace l'ancienne page « Créer un nouvel album / Continuer un album existant » (TriModeScreen, étapes 1 et 2).
// La feuille ne lance rien elle-même : elle prévient l'accueil (onCreate(nom) / onPick(album)).

import { useState, useMemo, useEffect } from "react";
import { View, TouchableOpacity, Pressable, Modal, ScrollView, TextInput, Keyboard, Platform, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Text from "../AppText";
import Icon from "../Icons";
import { C, FONT } from "../../constants/theme";

const frNum = (n) => n.toLocaleString("fr-FR");

export default function AlbumLaunchSheet({ visible, onClose, count, albums, libraryPhotos, onCreate, onPick }) {
  const { height } = useWindowDimensions();
  const [name, setName] = useState("");
  const [kb, setKb] = useState(0); // hauteur du clavier : la feuille monte au-dessus (comme ContentSearchSheet)

  useEffect(() => { if (visible) setName(""); }, [visible]);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => setKb(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKb(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Vignette de chaque album : sa dernière photo encore présente sur le téléphone (calculé seulement à l'ouverture).
  const rows = useMemo(() => {
    if (!visible) return [];
    const urlById = new Map(libraryPhotos.map((p) => [p.id, p.url]));
    return [...albums]
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .map((a) => {
        let thumb = null;
        for (let i = a.photoIds.length - 1; i >= 0 && !thumb; i--) thumb = urlById.get(a.photoIds[i]) ?? null;
        return { album: a, thumb, n: a.photoIds.filter((id) => urlById.has(id)).length };
      });
  }, [visible, albums, libraryPhotos]);

  const canCreate = name.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(35,39,31,0.4)" }} />
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingBottom: kb > 0 ? kb + 12 : 34, maxHeight: height * 0.8 }}>
          <View style={{ alignItems: "center", paddingTop: 10, marginBottom: 8 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: C.border }} />
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
            <Text style={{ fontWeight: "600", fontSize: 18, color: C.text }}>Dans quel album ?</Text>
            <Text style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>
              {`${frNum(count)} photo${count > 1 ? "s" : ""} à passer en revue.`}
            </Text>
          </View>

          {/* Nouvel album : le nom, puis « Commencer » */}
          <View style={{ marginHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.albumSoft, borderRadius: 16, padding: 8, paddingLeft: 12 }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 20, lineHeight: 22, color: "#fff", fontWeight: "600" }}>＋</Text>
            </View>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nouvel album : donne-lui un nom"
              placeholderTextColor={C.textMuted}
              returnKeyType="go"
              onSubmitEditing={() => canCreate && onCreate(name.trim())}
              style={{ flex: 1, fontSize: 14.5, color: C.text, fontFamily: FONT, paddingVertical: 6 }}
            />
            <TouchableOpacity
              disabled={!canCreate}
              onPress={() => onCreate(name.trim())}
              activeOpacity={0.85}
              style={{ backgroundColor: canCreate ? C.album : C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: canCreate ? "#fff" : C.textMuted }}>Commencer</Text>
            </TouchableOpacity>
          </View>

          {/* Mes albums */}
          <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: C.textMuted, marginHorizontal: 22, marginTop: 18, marginBottom: 4 }}>MES ALBUMS</Text>
          {rows.length === 0 ? (
            <Text style={{ fontSize: 13, color: C.textMuted, textAlign: "center", paddingVertical: 22, paddingHorizontal: 30, lineHeight: 19 }}>
              Tu n'as pas encore d'album.{"\n"}Crée le premier ci-dessus.
            </Text>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              {rows.map(({ album, thumb, n }) => (
                <TouchableOpacity key={album.id} onPress={() => onPick(album)} activeOpacity={0.8}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 9 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 11, overflow: "hidden", backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}>
                    {thumb
                      ? <Image source={{ uri: thumb }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                      : <Icon name="album" size={22} color={C.album} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "500", color: C.text }}>{album.name}</Text>
                    <Text style={{ fontSize: 12, color: C.textMuted }}>{`${frNum(n)} photo${n > 1 ? "s" : ""}`}</Text>
                  </View>
                  <Icon name="chevronRight" size={16} color={C.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
