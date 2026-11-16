// screens/GalleryHomeScreen.js
// Onglet « Labo » (ex-« Galerie ») = la CHAMBRE NOIRE, tout l'écran (variante C de `maquette-barre-chambre-noire.html`, choisie le 13 nov. 2026).
// Les albums ne sont plus ici : ils vivent dans l'accueil, mode Album (`components/home/MyAlbums.js`).
// Tout ce qu'on fait imprimer, déjà visible, rien à ouvrir :
//    TIRAGES PHOTOS = Coups de cœur (guirlande, mot « Coups de cœur » au-dessus du fil, sans compteurs) + abonnements TIRAGES (brique dessous)
//    + « ＋ Créer » (page produit « Nouveaux tirages » : abonnement ou tirage simple) ; Livres photo (étagère de couvertures) ; Posters.
//    Les abonnements se gèrent dans Réglages. Une seule ampoule : celle du coin (maquette `maquette-chambre-noire-tirages-v2.html`, validée le 10 nov.).
// Toucher un élément ouvre seulement SON détail. La corbeille n'est plus ici : elle vit dans la carte « Cette semaine » de l'accueil.

import { useCallback, useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar, Alert, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import Icon from "../components/Icons";
import { SHADOW } from "../components/home/ui";
import { BookCover } from "../components/book/BookPage";
import AlbumPickerSheet from "../components/book/AlbumPickerSheet";
import DarkroomCover, { printsFor } from "../components/DarkroomCover";
import { PosterWall } from "../components/poster/PosterParts";
import { useBookFonts } from "../components/book/bookFonts";
import { bookStats, pageRatio } from "../services/photoBook";
import { LinearGradient } from "expo-linear-gradient";
import { C, DARKROOM as D } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { useSubscriptionStore } from "../store/useSubscriptionStore";
import SubscriptionRow from "../components/SubscriptionRow";
import { useKeptUrls } from "../components/ProductArt";
import { monthKey, monthName, subStatus, shortDate } from "../services/printSelection";
import EnRouteBlock from "../components/labo/EnRouteBlock";
import { useEnRoute } from "../hooks/useEnRoute";
import { useOrdersStore } from "../store/useOrdersStore";
import { confirmAbandonOrder } from "../services/orderActions";
import { syncOrderStatuses } from "../services/printOrders";
import { usePrintedPhotos } from "../hooks/usePrintedPhotos";

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
  const subs          = useSubscriptionStore((s) => s.subs);
  const selections    = useSubscriptionStore((s) => s.selections);
  const updateSub     = useSubscriptionStore((s) => s.updateSub);
  const liveSubs      = useMemo(() => subs.filter((x) => x.status !== "cancelled"), [subs]); // résiliés = hors de la liste
  const hasSub        = liveSubs.length > 0;
  // Les abonnements TIRAGES vivent sous la guirlande. La gestion de tous les abonnements est dans
  // Réglages (« Gérer mes abonnements »), plus de section « Abonnements » dans la Chambre noire (10 nov.).
  const tirageSubs    = liveSubs.map((x, i) => ({ x, i }));
  const subUrls       = useKeptUrls(9);      // vignettes des abonnements : les vrais coups de cœur
  const books         = usePhotoStore((s) => s.books);
  const deleteBook    = usePhotoStore((s) => s.deleteBook);
  useBookFonts(); // titres des couvertures dans leur police
  const enRoute = useEnRoute(); // bloc « En route » (tout en bas) : livres et envois d'abonnement partis à l'impression


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

  // ── Abonnements en cours : ouvrir une ligne, menu ··· ──
  const subMonth = monthKey();
  function openSub(x) {
    const st = subStatus(x, selections[x.id]?.[subMonth]);
    if (st.kind === "paused") navigation.navigate("SubscriptionManage", { subId: x.id });
    else if (st.kind === "validated") navigation.navigate("SubscriptionTracking", { subId: x.id, month: subMonth });
    else navigation.navigate("SubscriptionMonth", { subId: x.id });
  }
  function openSubMenu(x) {
    const label = `Tirages · ${x.kind === "self" ? "pour moi" : x.name}`;
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

  const open = (params) => navigation.navigate("Gallery", params);

  const [bookPickerOpen, setBookPickerOpen] = useState(false);

  // Relit les commandes (et leur avancement chez l'imprimeur) à chaque passage dans le Labo.
  useFocusEffect(useCallback(() => { useOrdersStore.getState().load({ refresh: true }); syncOrderStatuses(); }, []));

  // La barre d'état passe en clair tant qu'on est sur cet onglet (fond sombre), puis revient en foncé en le quittant.
  useFocusEffect(useCallback(() => {
    StatusBar.setBarStyle("light-content");
    return () => StatusBar.setBarStyle("dark-content");
  }, []));

  return (
    <LinearGradient colors={[D.glow[1], D.glow[2]]} start={{ x: 0.8, y: 0 }} end={{ x: 0.3, y: 1 }} style={{ flex: 1 }}>
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View>
          {/* Ampoule rouge */}
          <View pointerEvents="none" style={{ position: "absolute", right: 20, top: -14, alignItems: "center" }}>
            <View style={{ width: 1.5, height: 14, backgroundColor: D.wire }} />
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: D.halo, opacity: 0.35, alignItems: "center", justifyContent: "center" }} />
            <View style={{ position: "absolute", top: 21, width: 11, height: 11, borderRadius: 6, backgroundColor: D.bulb }} />
          </View>
          <Text style={{ fontSize: 24, fontWeight: "700", color: D.paper }}>Chambre noire</Text>

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
              // Livre déjà commandé : « Modifié » si on l'a retouché depuis (le PDF envoyé reste celui de la commande).
              const modified = !!book.lastOrder && (book.updatedAt ?? 0) > (book.lastOrder.bookUpdatedAt ?? 0);
              return (
                <TouchableOpacity key={book.albumId} activeOpacity={0.85}
                  onPress={() => navigation.navigate("PhotoBook", { albumId: album.id })}
                  onLongPress={() => openBookMenu({ book, album })}
                  style={{ width: CARD_W }}>
                  <View style={{ borderRadius: 8, backgroundColor: C.bgCard, ...SHADOW }}>
                    <BookCover cover={book.cover} size={CARD_W} ratio={pageRatio(book)} urlById={urlById} />
                    {!!book.lastOrder && (
                      <View pointerEvents="none" style={{ position: "absolute", left: 6, top: 6, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: modified ? D.todoBg : "rgba(76,122,43,0.92)" }}>
                        <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>{modified ? "Modifié" : `✓ Commandé ${shortDate(book.lastOrder.at)}`}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 7 }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: "600", color: D.paper }}>{book.cover.title || album.name}</Text>
                    <TouchableOpacity onPress={() => openBookMenu({ book, album })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ fontSize: 15, color: D.halo, fontWeight: "700" }}>···</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 11, color: modified ? D.todoGlow : D.halo, fontWeight: modified ? "600" : "400" }}>
                    {modified ? "Modifié depuis la commande" : `${book.format} pages · ${pct} % rempli`}
                  </Text>
                  {modified && (
                    <TouchableOpacity onPress={() => navigation.navigate("BookCheck", { albumId: album.id })}
                      style={{ alignSelf: "flex-start", marginTop: 6, backgroundColor: D.todoBg, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: D.paper }}>Commander à nouveau</Text>
                    </TouchableOpacity>
                  )}
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

          {/* En route : tout ce qui est parti à l'impression, tout en bas (maquette `maquette-labo-en-route.html`). Absent s'il n'y a rien. */}
          {enRoute.length > 0 && (
            <>
              <DarkLabel title="En route" right="Toutes ›" onRight={() => navigation.navigate("BookOrders")} />
              <EnRouteBlock items={enRoute} books={books} urlById={urlById}
                onOpen={(it) => navigation.navigate(it.nav.name, it.nav.params)}
                onAll={() => navigation.navigate("BookOrders")}
                onAbandon={(order) => confirmAbandonOrder(order)} />
            </>
          )}

        </View>
      </ScrollView>

      {/* ── ＋ Mes livres photo : « Quel album ? » ── */}
      <AlbumPickerSheet
        visible={bookPickerOpen}
        onClose={() => setBookPickerOpen(false)}
        albums={albums}
        urlById={urlById}
        books={books}
        onPick={(a) => { setBookPickerOpen(false); navigation.navigate("PhotoBook", { albumId: a.id }); }}
      />

    </SafeAreaView>
    </LinearGradient>
  );
}
