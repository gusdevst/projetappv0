// components/home/FolderSheet.js
// Feuille « Choisir un dossier » : Toute la photothèque, Screenshots (mode Tri),
// puis les dossiers du téléphone.

import { View, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from "react-native";
import Text from "../AppText";
import Icon from "../Icons";
import { C } from "../../constants/theme";

function SheetRow({ icon, title, sub, count, checked, onPress, color }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 11 }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={21} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: "500", color: C.text }} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={{ fontSize: 12, color: C.textMuted }}>{sub}</Text>}
      </View>
      {count != null && !checked && <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{count}</Text>}
      {checked && (
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
          <Icon name="check" size={13} color="#fff" strokeWidth={2.8} />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function FolderSheet({
  visible, onClose, color = C.accent,
  libraryCount, showScreenshots, screenshotCount, screenshotsActive, onPickScreenshots,
  folders, loading, selectedFolderId, onPickAll, onPickFolder,
}) {
  const allActive = !selectedFolderId && !screenshotsActive;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(35,39,31,0.4)", justifyContent: "flex-end" }} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingBottom: 36 }}>
            <View style={{ alignItems: "center", paddingTop: 10, marginBottom: 8 }}>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: C.border }} />
            </View>
            <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
              <Text style={{ fontWeight: "600", fontSize: 18, color: C.text }}>Choisir un dossier</Text>
              <Text style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>
                Seules les photos de ce dossier seront dans ta session.
              </Text>
            </View>

            <SheetRow icon="grid" title="Toute la photothèque" sub={`${libraryCount} photos chargées`} checked={allActive} onPress={onPickAll} color={color} />
            {showScreenshots && (
              <SheetRow icon="screenshot" title="Screenshots" count={screenshotCount} checked={screenshotsActive} onPress={onPickScreenshots} color={color} />
            )}

            {loading ? (
              <View style={{ padding: 30, alignItems: "center" }}>
                <ActivityIndicator color={color} />
                <Text style={{ marginTop: 10, color: C.textMuted, fontSize: 13 }}>Chargement des dossiers…</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {folders.map((f) => (
                  <SheetRow key={f.id} icon="folder" title={f.title} count={f.assetCount}
                    checked={selectedFolderId === f.id} onPress={() => onPickFolder(f)} color={color} />
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
