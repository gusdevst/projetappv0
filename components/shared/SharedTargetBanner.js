// components/shared/SharedTargetBanner.js
// Bandeau en haut de l'accueil, mode Album, quand un album partagé avec moi est présélectionné
// (maquette Claude outputs/maquette-album-partage.html, écran 5). ✕ = revenir à un tri « normal ».
import { View, TouchableOpacity } from "react-native";
import Text from "../AppText";
import Icon from "../Icons";
import { C } from "../../constants/theme";

export default function SharedTargetBanner({ album, onClear }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.albumSoft, borderRadius: 16, padding: 11, marginBottom: 10 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>{(album.ownerName || "?")[0].toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "600", color: C.text }}>{`Album partagé « ${album.name} »`}</Text>
        <Text numberOfLines={1} style={{ fontSize: 12, color: C.textMuted }}>{`Choisis tes photos pour ${album.ownerName}`}</Text>
      </View>
      <TouchableOpacity onPress={onClear} hitSlop={12}>
        <Icon name="close" size={16} color={C.album} strokeWidth={2.2} />
      </TouchableOpacity>
    </View>
  );
}
