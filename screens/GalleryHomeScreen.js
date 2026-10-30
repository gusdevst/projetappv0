// screens/GalleryHomeScreen.js
// Onglet « Galerie » : une seule page (pas de barre de choix).
// Coups de cœur en tête, puis les albums (menu ··· : renommer / imprimer / supprimer),
// « + Nouvel album », « Sans album », « Imprimer tes albums · BIENTÔT »,
// et la Corbeille (seulement si elle contient des photos).
// Toucher une carte ouvre son contenu dans GalleryScreen (avec flèche retour).

import { useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar, Alert, Modal, TextInput, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Text from "../components/AppText";
import Icon from "../components/Icons";
import { ListRow, SHADOW } from "../components/home/ui";
import { C, FONT } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";

const formatSize = (mo) => (mo < 1024 ? `${mo.toFixed(0)} Mo` : `${(mo / 1024).toFixed(1)} Go`);

// "il y a 3 j", "il y a 2 sem.", "il y a 4 mois"
function timeAgo(ts) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  return `il y a ${Math.max(1, Math.floor(days / 30))} mois`;
}

// Mini-mosaïque de couverture : 1 grande photo + 2 petites.
function Cover({ urls, height }) {
  const cell = (u, style) => u
    ? <Image source={{ uri: u }} contentFit="cover" style={[{ backgroundColor: C.albumSoft }, style]} />
    : <View style={[{ backgroundColor: C.albumSoft }, style]} />;
  if (urls.length === 0) {
    return (
      <View style={{ height, borderRadius: 11, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}>
        <Icon name="album" size={28} color={C.album} />
      </View>
    );
  }
  return (
    <View style={{ height, borderRadius: 11, overflow: "hidden", flexDirection: "row", gap: 2 }}>
      {cell(urls[0], { flex: 2 })}
      <View style={{ flex: 1, gap: 2 }}>
        {cell(urls[1], { flex: 1 })}
        {cell(urls[2], { flex: 1 })}
      </View>
    </View>
  );
}

function Card({ width, cover, title, sub, onPress, onMenu }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}
      style={[{ width, backgroundColor: C.bgCard, borderRadius: 16, padding: 7 }, SHADOW]}>
      {cover}
      <Text style={{ fontSize: 13.5, fontWeight: "500", color: C.text, marginTop: 7, marginHorizontal: 3 }} numberOfLines={1}>{title}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 3, marginBottom: 2 }}>
        <Text style={{ flex: 1, fontSize: 11, color: C.textMuted }} numberOfLines={1}>{sub}</Text>
        {onMenu && (
          <TouchableOpacity onPress={onMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: C.textMuted, letterSpacing: 1 }}>···</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function GalleryHomeScreen({ navigation }) {
  const { width: SW } = useWindowDimensions();
  const CARD_W = (SW - 32 - 10) / 2;
  const COVER_H = CARD_W * 0.72;

  const kept          = usePhotoStore((s) => s.kept);
  const deleted       = usePhotoStore((s) => s.deleted);
  const printed       = usePhotoStore((s) => s.printed);
  const albums        = usePhotoStore((s) => s.albums);
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const createAlbum   = usePhotoStore((s) => s.createAlbum);
  const renameAlbum   = usePhotoStore((s) => s.renameAlbum);
  const deleteAlbum   = usePhotoStore((s) => s.deleteAlbum);

  // Retrouver une photo (url) par son id : photothèque + photos rangées.
  const photoById = useMemo(() => {
    const m = new Map();
    [...libraryPhotos, ...printed].forEach((p) => { if (p && !m.has(p.id)) m.set(p.id, p); });
    return m;
  }, [libraryPhotos, printed]);
  // Couverture = les 3 dernières photos ajoutées encore présentes.
  const coverUrls = (ids) => {
    const out = [];
    for (let k = ids.length - 1; k >= 0 && out.length < 3; k--) {
      const p = photoById.get(ids[k]);
      if (p) out.push(p.url);
    }
    return out;
  };
  const albumTime = (a) => a.updatedAt || Number(String(a.id).replace("album-", "")) || 0;
  const sortedAlbums = [...albums].sort((x, y) => albumTime(y) - albumTime(x));

  const inAnyAlbum = new Set(albums.flatMap((a) => a.photoIds));
  const sansAlbum = printed.filter((p) => !inAnyAlbum.has(p.id));
  const trashSize = deleted.reduce((a, p) => a + (p.size || 0), 0);

  // ── Menu ··· d'un album (repris de l'ancien accueil) ──
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameText, setRenameText]     = useState("");
  function openAlbumMenu(album) {
    const soon = () => Alert.alert("Bientôt disponible", "L'impression de tes albums arrive bientôt 🌸");
    Alert.alert(album.name, `${album.photoIds.length} photo${album.photoIds.length > 1 ? "s" : ""}`, [
      { text: "Renommer", onPress: () => { setRenameText(album.name); setRenameTarget(album); } },
      { text: "Imprimer (bientôt)", onPress: soon },
      {
        text: "Supprimer", style: "destructive",
        onPress: () => Alert.alert(
          "Supprimer l'album ?",
          `« ${album.name} » sera supprimé. Les photos restent sur ton téléphone.`,
          [{ text: "Annuler", style: "cancel" }, { text: "Supprimer", style: "destructive", onPress: () => deleteAlbum(album.id) }]
        ),
      },
      { text: "Annuler", style: "cancel" },
    ]);
  }

  // ── Nouvel album ──
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const open = (params) => navigation.navigate("Gallery", params);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        <Text style={{ fontSize: 24, fontWeight: "600", color: C.text, marginBottom: 14 }}>Galerie</Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {/* Coups de cœur : album automatique, toujours en tête */}
          <Card
            width={CARD_W}
            cover={
              <View style={{ height: COVER_H, borderRadius: 11, backgroundColor: C.redSoft, alignItems: "center", justifyContent: "center" }}>
                <Icon name="heart" size={34} color={C.red} filled />
              </View>
            }
            title="Coups de cœur"
            sub={`${kept.length} photo${kept.length > 1 ? "s" : ""} · rempli avec le ❤️`}
            onPress={() => open({ section: "kept" })}
          />

          {sortedAlbums.map((a) => (
            <Card
              key={a.id}
              width={CARD_W}
              cover={<Cover urls={coverUrls(a.photoIds)} height={COVER_H} />}
              title={a.name}
              sub={`${a.photoIds.length} photo${a.photoIds.length > 1 ? "s" : ""}${a.updatedAt ? ` · ${timeAgo(a.updatedAt)}` : ""}`}
              onPress={() => open({ section: "album", albumId: a.id })}
              onMenu={() => openAlbumMenu(a)}
            />
          ))}

          {/* + Nouvel album */}
          <TouchableOpacity
            onPress={() => { setNewName(""); setNewOpen(true); }}
            style={{ width: CARD_W, minHeight: COVER_H + 44, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.album, alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Text style={{ fontSize: 26, color: C.album }}>＋</Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: C.album }}>Nouvel album</Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 10, marginTop: 14 }}>
          {sansAlbum.length > 0 && (
            <ListRow icon="album" iconColor={C.textMid} iconBg={C.bgMuted} title="Sans album"
              sub={`${sansAlbum.length} photo${sansAlbum.length > 1 ? "s" : ""}`}
              onPress={() => open({ section: "album", albumId: "__sans_album__" })} />
          )}
          <ListRow
            icon="printer" iconColor={C.textMuted} iconBg={C.bgMuted}
            title="Imprimer tes albums"
            right={<Text style={{ fontSize: 10, fontWeight: "700", color: C.textMuted, backgroundColor: C.bgMuted, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: "hidden" }}>BIENTÔT</Text>}
            onPress={() => Alert.alert("Bientôt disponible", "L'impression de tes albums arrive bientôt 🌸")}
          />
          {deleted.length > 0 && (
            <ListRow icon="trash" iconColor={C.red} iconBg={C.redSoft} title="Corbeille"
              sub={`${deleted.length} photo${deleted.length > 1 ? "s" : ""} · ${formatSize(trashSize)}`}
              onPress={() => open({ section: "deleted" })} />
          )}
        </View>
      </ScrollView>

      {/* ── Renommer un album ── */}
      <Modal visible={!!renameTarget} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(35,39,31,0.45)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: C.bg, borderRadius: 20, padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: C.text, marginBottom: 12 }}>Renommer l'album</Text>
            <TextInput value={renameText} onChangeText={setRenameText} autoFocus placeholder="Nom de l'album"
              placeholderTextColor={C.textMuted}
              style={{ backgroundColor: C.bgCard, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 15, color: C.text, fontFamily: FONT }} />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity onPress={() => setRenameTarget(null)}
                style={{ flex: 1, padding: 13, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, alignItems: "center" }}>
                <Text style={{ color: C.textMuted, fontWeight: "600" }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { renameAlbum(renameTarget.id, renameText); setRenameTarget(null); }}
                style={{ flex: 1, padding: 13, borderRadius: 12, backgroundColor: C.album, alignItems: "center" }}>
                <Text style={{ color: "#fff", fontWeight: "600" }}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Nouvel album ── */}
      <Modal visible={newOpen} transparent animationType="fade" onRequestClose={() => setNewOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(35,39,31,0.45)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: C.bg, borderRadius: 20, padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: C.text }}>Nouvel album</Text>
            <Text style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2, marginBottom: 12 }}>Donne un nom à ton album.</Text>
            <TextInput value={newName} onChangeText={setNewName} autoFocus placeholder="Ex. Vacances 2026"
              placeholderTextColor={C.textMuted}
              style={{ backgroundColor: C.bgCard, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 15, color: C.text, fontFamily: FONT }} />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity onPress={() => setNewOpen(false)}
                style={{ flex: 1, padding: 13, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, alignItems: "center" }}>
                <Text style={{ color: C.textMuted, fontWeight: "600" }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!newName.trim()}
                onPress={() => { createAlbum(newName); setNewOpen(false); }}
                style={{ flex: 1, padding: 13, borderRadius: 12, backgroundColor: C.album, alignItems: "center", opacity: newName.trim() ? 1 : 0.4 }}>
                <Text style={{ color: "#fff", fontWeight: "600" }}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
