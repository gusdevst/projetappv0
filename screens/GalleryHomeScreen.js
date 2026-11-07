// screens/GalleryHomeScreen.js
// Onglet « Galerie » : une seule page (pas de barre de choix).
// 1. Mes albums : grille de 3 (menu ··· : renommer / imprimer / supprimer), ＋ dans le titre.
// 2. Mes livres photo : étagère horizontale, ＋ dans le titre (feuille « Quel album ? »).
// 3. Mes tirages photos : Coups de cœur (l'impression viendra plus tard).
// Puis « Sans album » et la Corbeille (seulement si elles contiennent des photos).
// Toucher une carte ouvre son contenu dans GalleryScreen (avec flèche retour).

import { useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar, Alert, Modal, TextInput, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Text from "../components/AppText";
import Icon from "../components/Icons";
import { ListRow, SectionTitle, SHADOW } from "../components/home/ui";
import { BookCover } from "../components/book/BookPage";
import AlbumPickerSheet from "../components/book/AlbumPickerSheet";
import DarkroomCover, { printsFor } from "../components/DarkroomCover";
import { useBookFonts } from "../components/book/bookFonts";
import { bookStats, pageRatio } from "../services/photoBook";
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

function Card({ width, cover, title, titleIcon, sub, subLines = 1, onPress, onMenu }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}
      style={[{ width, backgroundColor: C.bgCard, borderRadius: 16, padding: 7 }, SHADOW]}>
      {cover}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 7, marginHorizontal: 3 }}>
        {titleIcon}
        <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "500", color: C.text }} numberOfLines={1}>{title}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 3, marginBottom: 2 }}>
        <Text style={{ flex: 1, fontSize: 11, color: C.textMuted }} numberOfLines={subLines}>{sub}</Text>
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
  const CARD_W = (SW - 32 - 20) / 3; // 3 cartes par ligne (2 espaces de 10)
  const COVER_H = CARD_W;              // vignette carrée

  const kept          = usePhotoStore((s) => s.kept);
  const deleted       = usePhotoStore((s) => s.deleted);
  const printed       = usePhotoStore((s) => s.printed);
  const albums        = usePhotoStore((s) => s.albums);
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const createAlbum   = usePhotoStore((s) => s.createAlbum);
  const renameAlbum   = usePhotoStore((s) => s.renameAlbum);
  const deleteAlbum   = usePhotoStore((s) => s.deleteAlbum);
  const books         = usePhotoStore((s) => s.books);
  const deleteBook    = usePhotoStore((s) => s.deleteBook);
  useBookFonts(); // titres des couvertures dans leur police

  // Retrouver une photo (url) par son id : photothèque + photos rangées.
  const photoById = useMemo(() => {
    const m = new Map();
    [...libraryPhotos, ...printed].forEach((p) => { if (p && !m.has(p.id)) m.set(p.id, p); });
    return m;
  }, [libraryPhotos, printed]);
  // Coups de cœur encore présents sur le téléphone (même règle que GalleryScreen),
  // avec leur adresse à jour. Tant que la photothèque charge : liste telle quelle.
  const keptAlive = useMemo(() => {
    if (libraryPhotos.length === 0) return kept;
    const byId = new Map(libraryPhotos.map((p) => [p.id, p]));
    return kept.filter((p) => byId.has(p.id)).map((p) => ({ ...p, url: byId.get(p.id).url }));
  }, [kept, libraryPhotos]);
  const keptCount = keptAlive.length;
  // Carte Coups de cœur plus large : 2 colonnes de la grille (titre lisible en entier).
  const HEART_W   = CARD_W * 2 + 10;
  const HEART_IMG = HEART_W - 14; // largeur du dessin (carte moins son padding)
  const keptUrls  = keptAlive.slice(-printsFor(HEART_IMG, COVER_H)).reverse().map((p) => p.url); // derniers ❤️ → guirlande
  // Couverture d'album = les 3 dernières photos ajoutées encore présentes.
  const coverUrls = (ids) => {
    const out = [];
    for (let k = ids.length - 1; k >= 0 && out.length < 3; k--) {
      const p = photoById.get(ids[k]);
      if (p) out.push(p.url);
    }
    return out;
  };
  // ── Livres photo (en cours) : le plus récemment modifié en premier ──
  const urlById = useMemo(() => Object.fromEntries([...photoById].map(([id, p]) => [id, p.url])), [photoById]);
  const bookList = Object.values(books)
    .map((b) => ({ book: b, album: albums.find((a) => a.id === b.albumId) }))
    .filter((x) => x.album)
    .sort((x, y) => (y.book.updatedAt || 0) - (x.book.updatedAt || 0));
  function openBookMenu({ book, album }) {
    Alert.alert(book.cover.title || album.name, `Livre de ${book.format} pages · album « ${album.name} »`, [
      { text: "Ouvrir", onPress: () => navigation.navigate("PhotoBook", { albumId: album.id }) },
      {
        text: "Supprimer le livre", style: "destructive",
        onPress: () => Alert.alert(
          "Supprimer le livre ?",
          "La mise en page sera perdue. L'album et ses photos restent intacts.",
          [{ text: "Annuler", style: "cancel" }, { text: "Supprimer", style: "destructive", onPress: () => deleteBook(album.id) }]
        ),
      },
      { text: "Annuler", style: "cancel" },
    ]);
  }

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

  // Petit ＋ discret à droite d'un titre de section
  const PlusButton = ({ onPress }) => (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Text style={{ fontSize: 22, lineHeight: 22, color: C.album }}>＋</Text>
    </TouchableOpacity>
  );
  const [bookPickerOpen, setBookPickerOpen] = useState(false);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        <Text style={{ fontSize: 24, fontWeight: "600", color: C.text, marginBottom: 14 }}>Galerie</Text>

        {/* 1. Mes albums : grille de 3 */}
        <SectionTitle title="Mes albums" right={<PlusButton onPress={() => { setNewName(""); setNewOpen(true); }} />} />
        {sortedAlbums.length === 0 ? (
          <Text style={{ fontSize: 12.5, color: C.textMuted, marginHorizontal: 2 }}>Crée ton premier album avec le ＋.</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
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
          </View>
        )}

        {/* 2. Mes livres photo : étagère horizontale (toujours affichée) */}
        <SectionTitle title="Mes livres photo" right={<PlusButton onPress={() => setBookPickerOpen(true)} />} />
        {bookList.length === 0 ? (
          <Text style={{ fontSize: 12.5, color: C.textMuted, marginHorizontal: 2 }}>Transforme un album en vrai livre avec le ＋.</Text>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
              {bookList.map(({ book, album }) => {
                const ids = album.photoIds.filter((id) => urlById[id]);
                const pct = Math.round(bookStats(book, ids).fillRatio * 100);
                return (
                  <TouchableOpacity key={book.albumId} activeOpacity={0.85}
                    onPress={() => navigation.navigate("PhotoBook", { albumId: album.id })}
                    onLongPress={() => openBookMenu({ book, album })}
                    style={{ width: CARD_W }}>
                    <View style={{ borderRadius: 8, backgroundColor: C.bgCard, ...SHADOW }}>
                      <BookCover cover={book.cover} size={CARD_W} ratio={pageRatio(book)} urlById={urlById} />
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 7 }}>
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, fontWeight: "600", color: C.text }}>{book.cover.title || album.name}</Text>
                      <TouchableOpacity onPress={() => openBookMenu({ book, album })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={{ fontSize: 15, color: C.textMuted, fontWeight: "700" }}>···</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 11.5, color: C.textMuted }}>{book.format} pages · {pct} % rempli</Text>
                    {!!book.updatedAt && <Text style={{ fontSize: 11, color: C.textMuted }}>{timeAgo(book.updatedAt)}</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* 3. Mes tirages photos : les Coups de cœur (impression à venir) */}
        <SectionTitle title="Mes tirages photos" />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Card
            width={HEART_W}
            cover={<DarkroomCover urls={keptUrls} width={HEART_IMG} height={COVER_H} />}
            titleIcon={<Icon name="heart" size={13} color={C.red} filled />}
            title="Coups de cœur"
            sub={`${keptCount} photo${keptCount > 1 ? "s" : ""} à imprimer`}
            onPress={() => open({ section: "kept" })}
          />
          {/* Abonnement mensuel : les coups de cœur par la poste (maquette validée) */}
          <Card
            width={CARD_W}
            cover={
              <View style={{ height: COVER_H, borderRadius: 11, backgroundColor: C.sage2, alignItems: "center", justifyContent: "center" }}>
                <Icon name="mail" size={30} color={C.accent} />
                <View style={{ position: "absolute", top: 5, right: 5, backgroundColor: C.album, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1.5 }}>
                  <Text style={{ fontSize: 8.5, fontWeight: "700", color: "#fff" }}>NOUVEAU</Text>
                </View>
              </View>
            }
            title="Abonnement"
            sub="10 tirages par mois"
            subLines={2}
            onPress={() => navigation.navigate("SubscriptionIntro")}
          />
        </View>

        <View style={{ gap: 10, marginTop: 14 }}>
          {sansAlbum.length > 0 && (
            <ListRow icon="album" iconColor={C.textMid} iconBg={C.bgMuted} title="Sans album"
              sub={`${sansAlbum.length} photo${sansAlbum.length > 1 ? "s" : ""}`}
              onPress={() => open({ section: "album", albumId: "__sans_album__" })} />
          )}
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

      {/* ── ＋ Mes livres photo : « Quel album ? » ── */}
      <AlbumPickerSheet
        visible={bookPickerOpen}
        onClose={() => setBookPickerOpen(false)}
        albums={albums}
        urlById={urlById}
        books={books}
        onPick={(a) => { setBookPickerOpen(false); navigation.navigate("PhotoBook", { albumId: a.id }); }}
      />

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
