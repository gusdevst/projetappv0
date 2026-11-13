// screens/GalleryHomeScreen.js
// Onglet « Galerie » (maquette validée « Pellicule + Chambre noire ») : une seule page, rien à ouvrir pour tout voir.
// 1. PELLICULE — « Mes albums » en LISTE (mosaïque, nom, nombre de photos, menu ···), ＋ dans le titre, puis « Sans album ».
// 2. CHAMBRE NOIRE — bloc rouge sombre pleine largeur : tout ce qu'on fait imprimer, déjà visible :
//    TIRAGES PHOTOS = Coups de cœur (guirlande, mot « Coups de cœur » au-dessus du fil, sans compteurs) + abonnements TIRAGES (brique dessous)
//    + « ＋ Créer » (page produit « Nouveaux tirages » : abonnement ou tirage simple) ; Livres photo (étagère de couvertures). Les abonnements se gèrent dans Réglages.
//    Une seule ampoule : celle du coin du bloc (maquette `maquette-chambre-noire-tirages-v2.html`, validée le 10 nov.).
// Toucher un élément ouvre seulement SON détail. La corbeille n'est plus ici : elle vit dans la carte « Cette semaine » de l'accueil.

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
import { PosterWall } from "../components/poster/PosterParts";
import { useBookFonts } from "../components/book/bookFonts";
import { bookStats, pageRatio } from "../services/photoBook";
import { LinearGradient } from "expo-linear-gradient";
import { C, FONT, DARKROOM as D } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { useSubscriptionStore } from "../store/useSubscriptionStore";
import SubscriptionRow from "../components/SubscriptionRow";
import { useKeptUrls } from "../components/ProductArt";
import { monthKey, monthName, subStatus } from "../services/printSelection";
import { usePrintedPhotos } from "../hooks/usePrintedPhotos";

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

// Titre de section de la Chambre noire (maquette « titres », version D validée le 10 nov.) :
// petit voyant rouge + titre en gras + filet lumineux qui s'estompe + action à droite (« ＋ Créer » sur chaque produit).
// `badge` : pastille « NOUVEAU » à côté du titre. `onInfo` : petit ⓘ avant l'action (ex. rouvrir la présentation du poster).
function DarkLabel({ title, right, onRight, soon, badge, onInfo }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 22, marginBottom: 11, marginHorizontal: 2 }}>
      {/* Voyant : pas d'élévation (piège Android, dette n°7), juste une lueur iOS */}
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: D.todoGlow, shadowColor: D.todoGlow, shadowOpacity: 0.9, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }} />
      <Text style={{ fontSize: 15, fontWeight: "700", color: D.paper }}>{title}</Text>
      {!!badge && (
        <View style={{ backgroundColor: C.album, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: 8.5, fontWeight: "700", color: "#fff" }}>{badge}</Text>
        </View>
      )}
      <LinearGradient colors={["rgba(255,201,188,0.55)", "rgba(255,201,188,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, height: 1 }} />
      {!!onInfo && (
        <TouchableOpacity onPress={onInfo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontSize: 15, color: D.halo }}>ⓘ</Text>
        </TouchableOpacity>
      )}
      {!!right && (
        <TouchableOpacity onPress={onRight} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 12.5, fontWeight: "600", color: D.paper }}>{right}</Text>
            {!!soon && (
              <View style={{ backgroundColor: C.album, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 8.5, fontWeight: "700", color: "#fff" }}>BIENTÔT</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function GalleryHomeScreen({ navigation }) {
  const { width: SW } = useWindowDimensions();
  const CARD_W = (SW - 32 - 20) / 3; // 3 cartes par ligne (2 espaces de 10)

  const kept          = usePhotoStore((s) => s.kept);
  const printed       = usePhotoStore((s) => s.printed);
  const albums        = usePhotoStore((s) => s.albums);
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const createAlbum   = usePhotoStore((s) => s.createAlbum);
  const renameAlbum   = usePhotoStore((s) => s.renameAlbum);
  const deleteAlbum   = usePhotoStore((s) => s.deleteAlbum);
  const subs          = useSubscriptionStore((s) => s.subs);
  const selections    = useSubscriptionStore((s) => s.selections);
  const updateSub     = useSubscriptionStore((s) => s.updateSub);
  const liveSubs      = useMemo(() => subs.filter((x) => x.status !== "cancelled"), [subs]); // résiliés = hors de la liste
  const hasSub        = liveSubs.length > 0;
  // Les abonnements TIRAGES vivent sous la guirlande. Les magnets et la gestion de tous les abonnements sont dans
  // Réglages (« Gérer mes abonnements »), plus de section « Abonnements » dans la Chambre noire (10 nov.).
  const tirageSubs    = liveSubs.map((x, i) => ({ x, i })).filter(({ x }) => x.product !== "magnets");
  const subUrls       = useKeptUrls(9);      // vignettes des abonnements : les vrais coups de cœur
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
  const printedMap = usePrintedPhotos();
  // Guirlande de la Chambre noire : les derniers ❤️ pas encore imprimés (sinon, les derniers tout court).
  const HEART_W = SW - 32;   // pleine largeur du bloc
  const HEART_H = 150; // hauteur d'origine (plus de compteurs sous la scène, plus de pancarte)
  // Bloc « Posters » : 3 photos parmi les coups de cœur (pas les mêmes que la guirlande quand il y en a assez).
  const posterUrls = useMemo(() => {
    const rev = [...keptAlive].reverse();
    return (rev.length > 5 ? rev.slice(3, 6) : rev.slice(0, 3)).map((p) => p.url);
  }, [keptAlive]);
  // « ＋ Créer » et le bloc ouvrent toujours la page produit du poster (plus de ⓘ), d'où on choisit sa photo.
  const openPoster = () => navigation.navigate("PosterIntro");
  const toPrint = keptAlive.filter((p) => !printedMap[p.id]);
  const garland = toPrint.length ? toPrint : keptAlive;
  const keptUrls = garland.slice(-printsFor(HEART_W, HEART_H)).reverse().map((p) => p.url);
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
  // La tuile « Créer un livre » prend exactement la forme d'une couverture (celle du 1er livre, sinon 21×28 vertical).
  const bookRatio = bookList.length ? pageRatio(bookList[0].book) : 4 / 3;
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

  // ── Abonnements en cours : ouvrir une ligne, menu ··· ──
  const subMonth = monthKey();
  function openSub(x) {
    const st = subStatus(x, selections[x.id]?.[subMonth]);
    if (st.kind === "paused") navigation.navigate("SubscriptionManage", { subId: x.id });
    else if (st.kind === "validated") navigation.navigate("SubscriptionTracking", { subId: x.id, month: subMonth });
    else navigation.navigate("SubscriptionMonth", { subId: x.id });
  }
  function openSubMenu(x) {
    const label = `${x.product === "magnets" ? "Magnets" : "Tirages"} · ${x.kind === "self" ? "pour moi" : x.name}`;
    const st = subStatus(x, selections[x.id]?.[subMonth]);
    const paused = x.status === "paused";
    Alert.alert(label, undefined, [
      ...(paused ? [] : [st.kind === "validated"
        ? { text: "Voir le suivi", onPress: () => openSub(x) }
        : { text: `Voir ma sélection de ${monthName(subMonth)}`, onPress: () => openSub(x) }]),
      { text: "Changer les dates d'envoi", onPress: () => navigation.navigate("SubscriptionManage", { subId: x.id, editDays: true }) },
      paused
        ? { text: "Reprendre l'abonnement", onPress: () => updateSub(x.id, { status: "active" }) }
        : { text: "Mettre en pause", onPress: () => updateSub(x.id, { status: "paused" }) },
      {
        text: "Résilier", style: "destructive",
        onPress: () => Alert.alert("Résilier ?", `L'abonnement « ${label} » s'arrête. Les envois déjà validés restent dans l'historique.`, [
          { text: "Annuler", style: "cancel" },
          { text: "Résilier", style: "destructive", onPress: () => updateSub(x.id, { status: "cancelled" }) },
        ]),
      },
      { text: "Annuler", style: "cancel" },
    ]);
  }

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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 24, fontWeight: "600", color: C.text, marginBottom: 14 }}>Galerie</Text>

        {/* 1. PELLICULE : mes albums, en liste */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8, marginBottom: 6, marginHorizontal: 2 }}>
          <View>
            <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1.4, color: C.album }}>PELLICULE</Text>
            <Text style={{ fontSize: 17, fontWeight: "700", color: C.text }}>Mes albums</Text>
          </View>
          <PlusButton onPress={() => { setNewName(""); setNewOpen(true); }} />
        </View>
        <View style={{ gap: 8, marginTop: 4 }}>
          {sortedAlbums.length === 0 && (
            <Text style={{ fontSize: 12.5, color: C.textMuted, marginHorizontal: 2 }}>Crée ton premier album avec le ＋.</Text>
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

        {/* 2. CHAMBRE NOIRE : tout ce qu'on fait imprimer, toujours visible (rien à ouvrir) */}
        <LinearGradient colors={[D.glow[1], D.glow[2]]} start={{ x: 0.8, y: 0 }} end={{ x: 0.3, y: 1 }}
          style={{ marginTop: 26, marginHorizontal: -16, marginBottom: -30, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 40 }}>
          {/* Ampoule rouge */}
          <View pointerEvents="none" style={{ position: "absolute", right: 36, top: 0, alignItems: "center" }}>
            <View style={{ width: 1.5, height: 14, backgroundColor: D.wire }} />
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: D.halo, opacity: 0.35, alignItems: "center", justifyContent: "center" }} />
            <View style={{ position: "absolute", top: 21, width: 11, height: 11, borderRadius: 6, backgroundColor: D.bulb }} />
          </View>
          <Text style={{ fontSize: 21, fontWeight: "700", color: D.paper }}>Chambre noire</Text>

          {/* Tirages photos : guirlande des coups de cœur (mot au-dessus du fil) + abonnements tirages dessous */}
          <DarkLabel title="Tirages photos" right="＋ Créer" onRight={() => navigation.navigate("PrintNew")} />
          <TouchableOpacity activeOpacity={0.85} onPress={() => open({ section: "kept" })}>
            <DarkroomCover urls={keptUrls} width={HEART_W} height={HEART_H} radius={16} />
            <View pointerEvents="none" style={{ position: "absolute", left: 16, top: 11, flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Icon name="heart" size={13} color={D.halo} filled />
              <Text style={{ fontSize: 14, fontWeight: "700", color: D.paper }}>Coups de cœur</Text>
            </View>
          </TouchableOpacity>
          <View style={{ gap: 9, marginTop: 10 }}>
            {tirageSubs.map(({ x, i }) => (
              <SubscriptionRow key={x.id} dark sub={x} st={subStatus(x, selections[x.id]?.[subMonth])}
                urls={subUrls.slice((i * 3) % 9, ((i * 3) % 9) + 3)}
                onPress={() => openSub(x)} onMenu={() => openSubMenu(x)} />
            ))}
          </View>

          {/* Livres photo : étagère de couvertures */}
          <DarkLabel title="Livres photo" right="＋ Créer" onRight={() => setBookPickerOpen(true)} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
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
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: "600", color: D.paper }}>{book.cover.title || album.name}</Text>
                    <TouchableOpacity onPress={() => openBookMenu({ book, album })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ fontSize: 15, color: D.halo, fontWeight: "700" }}>···</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 11, color: D.halo }}>{book.format} pages · {pct} % rempli</Text>
                </TouchableOpacity>
              );
            })}
            {/* Dernière vue : créer un livre */}
            <TouchableOpacity activeOpacity={0.85} onPress={() => setBookPickerOpen(true)} style={{ width: CARD_W }}>
              <View style={{ height: CARD_W * bookRatio, borderRadius: 8, borderWidth: 1.5, borderStyle: "dashed", borderColor: D.halo, alignItems: "center", justifyContent: "center", opacity: 0.8 }}>
                <Text style={{ fontSize: 26, color: D.paper }}>＋</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: D.paper, marginTop: 7 }}>Créer un livre</Text>
              <Text style={{ fontSize: 11, color: D.halo }}>à partir d'un album</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Posters : 3 cadres accrochés au fil (maquette `maquette-poster.html`). 1re fois = présentation, ensuite choix de la photo. */}
          <DarkLabel title="Posters" badge="NOUVEAU" right="＋ Créer" onRight={openPoster} />
          <TouchableOpacity activeOpacity={0.85} onPress={openPoster}>
            <PosterWall urls={posterUrls} width={HEART_W} />
          </TouchableOpacity>

        </LinearGradient>
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
