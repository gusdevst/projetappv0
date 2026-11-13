// components/home/MyAlbums.js
// « Mes albums » : la liste des albums, dans l'accueil en mode Album (sous « Album en cours »).
// 13 nov. 2026 : les albums quittent l'onglet Galerie (devenu « Labo », la Chambre noire) et viennent ici
// (maquette `Claude outputs/maquette-barre-chambre-noire.html`, variante C choisie par Augustin).
// Reprend tel quel ce que faisait l'ancienne Galerie : liste (mosaïque, nom, nombre de photos, menu ···), « ＋ Nouvel album »,
// renommer / supprimer, ligne « Sans album ». Toucher un album ouvre l'écran `Gallery` (photos de l'album, bouton Livre photo).

import { useMemo, useState } from "react";
import { View, TouchableOpacity, Alert, Modal, TextInput } from "react-native";
import { Image } from "expo-image";
import Text from "../AppText";
import Icon from "../Icons";
import { ListRow } from "./ui";
import { C, FONT } from "../../constants/theme";
import { usePhotoStore } from "../../store/usePhotoStore";

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

export default function MyAlbums({ navigation }) {
  const albums        = usePhotoStore((s) => s.albums);
  const printed       = usePhotoStore((s) => s.printed);
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

  // Couverture d'album = les 3 dernières photos ajoutées encore présentes.
  const coverUrls = (ids) => {
    const out = [];
    for (let k = ids.length - 1; k >= 0 && out.length < 3; k--) {
      const p = photoById.get(ids[k]);
      if (p) out.push(p.url);
    }
    return out;
  };

  const albumTime = (a) => a.updatedAt || Number(String(a.id).replace("album-", "")) || 0;
  const sortedAlbums = useMemo(() => [...albums].sort((x, y) => albumTime(y) - albumTime(x)), [albums]);
  const sansAlbum = useMemo(() => {
    const inAny = new Set(albums.flatMap((a) => a.photoIds));
    return printed.filter((p) => !inAny.has(p.id));
  }, [albums, printed]);

  const open = (params) => navigation.navigate("Gallery", params);

  // ── Menu ··· d'un album ──
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

  return (
    <View>
      {/* Titre de section + « ＋ Nouvel album » */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 22, marginBottom: 10, marginHorizontal: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>Mes albums</Text>
        <TouchableOpacity onPress={() => { setNewName(""); setNewOpen(true); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ fontSize: 12.5, fontWeight: "600", color: C.album }}>＋ Nouvel album</Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: 9 }}>
        {sortedAlbums.length === 0 && (
          <Text style={{ fontSize: 12.5, color: C.textMuted, marginHorizontal: 2 }}>Pas encore d'album. Touche « ＋ Nouvel album », ou crée-en un avec « Créer un album ».</Text>
        )}
        {sortedAlbums.map((a) => (
          <ListRow
            key={a.id}
            thumb={<View style={{ width: 44, height: 44 }}><Cover urls={coverUrls(a.photoIds)} height={44} /></View>}
            title={a.name}
            sub={`${a.photoIds.length} photo${a.photoIds.length > 1 ? "s" : ""}${a.updatedAt ? ` · ${timeAgo(a.updatedAt)}` : ""}`}
            right={
              <TouchableOpacity onPress={() => openAlbumMenu(a)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}>
                <Text style={{ fontSize: 17, fontWeight: "600", color: C.textMuted, letterSpacing: 1 }}>···</Text>
              </TouchableOpacity>
            }
            onPress={() => open({ section: "album", albumId: a.id })}
          />
        ))}
        {sansAlbum.length > 0 && (
          <ListRow icon="album" iconColor={C.textMid} iconBg={C.bgMuted} title="Sans album"
            sub={`${sansAlbum.length} photo${sansAlbum.length > 1 ? "s" : ""}`}
            onPress={() => open({ section: "album", albumId: "__sans_album__" })} />
        )}
      </View>

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
    </View>
  );
}
