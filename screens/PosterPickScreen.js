// screens/PosterPickScreen.js
// Choisir LA photo du poster, sur UN SEUL écran (pas de page « d'où vient la photo ? » en plus) :
//   (une seule photo cochée = poster simple, plusieurs = pêle-mêle : détecté tout seul, plus d'interrupteur) ;
//   trois onglets en haut — Coups de cœur · Albums (pastilles d'albums) · Photothèque (avec recherche par contenu) —
//   puis la grille (3 colonnes, une seule coche) et « Choisir cette photo » → écran du format.
// La recherche « l'été 2026 à la plage » réutilise ContentSearchSheet (mode `pickMode` : un seul bouton).
// Pas de photo en corbeille. La taille de chaque photo est affichée (la qualité dépend d'elle).

import { useState, useMemo, useCallback, memo } from "react";
import { View, FlatList, ScrollView, TouchableOpacity, StatusBar, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Text from "../components/AppText";
import Icon from "../components/Icons";
import BackButton from "../components/BackButton";
import ContentSearchSheet from "../components/home/ContentSearchSheet";
import { SHADOW } from "../components/home/ui";
import { C } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { COLLAGE_MIN, COLLAGE_MAX } from "../services/posterCollage";

const COLS = 3;
const GAP = 4;
const frNum = (n) => n.toLocaleString("fr-FR");

// Une case de la grille (mémorisée : la photothèque peut compter des milliers de photos).
const Cell = ({ photo, size, selected, order, onPress }) => (
  <TouchableOpacity activeOpacity={0.85} onPress={() => onPress(photo.id)}
    style={{ width: size, height: size * (4 / 3), borderRadius: 5, overflow: "hidden", backgroundColor: C.albumSoft, borderWidth: selected ? 3 : 0, borderColor: C.album }}>
    <Image source={{ uri: photo.url }} style={{ width: "100%", height: "100%" }} contentFit="cover" recyclingKey={photo.id} />
    {selected && (
      <View style={{ position: "absolute", right: 5, top: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }}>
        {order ? <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>{order}</Text> : <Icon name="check" size={12} color="#fff" strokeWidth={3} />}
      </View>
    )}
    {!!photo.width && (
      <View style={{ position: "absolute", left: 4, bottom: 4, backgroundColor: "rgba(35,39,31,0.72)", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1.5 }}>
        <Text style={{ fontSize: 8.5, fontWeight: "700", color: "#fff" }}>{Math.max(photo.width, photo.height)} px</Text>
      </View>
    )}
  </TouchableOpacity>
);
const MemoCell = memo(Cell);

export function PosterPickScreen({ navigation }) {
  const { width: SW } = useWindowDimensions();
  const kept = usePhotoStore((s) => s.kept);
  const albums = usePhotoStore((s) => s.albums);
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const deleted = usePhotoStore((s) => s.deleted);

  const byId = useMemo(() => new Map(libraryPhotos.map((p) => [p.id, p])), [libraryPhotos]);
  const deletedIds = useMemo(() => new Set(deleted.map((p) => p.id)), [deleted]);
  const alive = useCallback((id) => byId.get(id) && !deletedIds.has(id), [byId, deletedIds]);

  const keptPhotos = useMemo(() => kept.filter((p) => alive(p.id)).map((p) => byId.get(p.id)).reverse(), [kept, alive, byId]);
  // Albums qui ont au moins une photo encore présente (nombre de photos affiché sur la pastille).
  const albumList = useMemo(
    () => albums.map((a) => ({ album: a, photos: a.photoIds.filter(alive).map((id) => byId.get(id)) })).filter((x) => x.photos.length > 0),
    [albums, alive, byId],
  );

  const [tab, setTab] = useState(() => (keptPhotos.length > 0 ? "kept" : "library")); // onglet de départ
  const [albumId, setAlbumId] = useState(null);       // null = le premier album
  const [sel, setSel] = useState([]);                 // ids cochés, dans l'ordre : 1 photo = poster simple, 2 et plus = pêle-mêle (détecté automatiquement)
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState(null);         // { query, label, ids:Set|null }

  const currentAlbum = albumList.find((x) => x.album.id === albumId) ?? albumList[0] ?? null;
  const libraryList = useMemo(() => {
    let list = libraryPhotos.filter((p) => !deletedIds.has(p.id));
    if (search?.ids) list = list.filter((p) => search.ids.has(p.id));
    return list;
  }, [libraryPhotos, deletedIds, search]);

  const photos = tab === "kept" ? keptPhotos : tab === "album" ? (currentAlbum?.photos ?? []) : libraryList;
  const cell = Math.floor((SW - GAP * (COLS + 1)) / COLS);
  const ready = sel.length >= 1;
  const isCollage = sel.length >= COLLAGE_MIN; // plusieurs photos cochées = pêle-mêle, sans interrupteur

  function changeTab(t) { setTab(t); } // la sélection suit d'un onglet / d'un album à l'autre
  // Toucher une photo la coche (numérotée dans l'ordre), la retoucher la décoche. Jusqu'à COLLAGE_MAX photos.
  const toggleSelect = useCallback((id) => setSel((cur) => {
    if (cur.includes(id)) return cur.filter((x) => x !== id);
    return cur.length >= COLLAGE_MAX ? cur : [...cur, id];
  }), []);

  function onApplySearch(r) {
    // Période et contenu se combinent par intersection (comme les filtres de l'accueil).
    let ids = null;
    for (const list of [r.dateIds, r.contentIds, r.placeIds]) {
      if (!list) continue;
      const set = new Set(list);
      ids = ids ? new Set([...ids].filter((id) => set.has(id))) : set;
    }
    const label = [r.placeLabel, r.dateLabel, r.contentLabel].filter(Boolean).join(" · ");
    setSearch({ query: r.query, label, ids });
    setSearchOpen(false);
  }

  const TABS = [
    { key: "kept", label: "Coups de cœur" },
    { key: "album", label: "Albums" },
    { key: "library", label: "Photothèque" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>Quelle photo en poster ?</Text>
          <Text style={{ fontSize: 12, color: C.textMuted }}>{`Une photo pour un poster, plusieurs pour un pêle-mêle (jusqu'à ${COLLAGE_MAX}).`}</Text>
        </View>
      </View>

      {/* Onglets : d'où vient la photo */}
      <View style={{ flexDirection: "row", marginHorizontal: 16, backgroundColor: C.bgMuted, borderRadius: 13, padding: 3 }}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} activeOpacity={0.8} onPress={() => changeTab(t.key)}
            style={[{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10 }, tab === t.key && [{ backgroundColor: C.bgCard }, SHADOW]]}>
            <Text style={{ fontSize: 12.5, fontWeight: tab === t.key ? "700" : "500", color: tab === t.key ? C.text : C.textMuted }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Albums : pastilles à faire défiler */}
      {tab === "album" && (
        albumList.length === 0
          ? <Text style={{ fontSize: 12.5, color: C.textMuted, marginHorizontal: 18, marginTop: 12 }}>Aucun album avec des photos pour l'instant.</Text>
          : (
            <View style={{ height: 46, marginTop: 10 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: "center" }}>
                {albumList.map(({ album, photos: ph }) => {
                  const on = currentAlbum?.album.id === album.id;
                  return (
                    <TouchableOpacity key={album.id} activeOpacity={0.8} onPress={() => { setAlbumId(album.id); }}
                      style={{ borderRadius: 99, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: on ? C.album : C.bgCard, borderWidth: 1, borderColor: on ? C.album : C.border }}>
                      <Text style={{ fontSize: 12.5, fontWeight: "600", color: on ? "#fff" : C.textMid }}>{album.name} · {frNum(ph.length)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )
      )}

      {/* Photothèque : recherche par contenu */}
      {tab === "library" && (
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => setSearchOpen(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.bgCard, borderRadius: 13, borderWidth: 1.5, borderColor: search ? C.album : C.border, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Icon name="search" size={16} color={C.textMuted} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: search ? C.text : C.textMuted }}>
              {search ? search.query : "Chercher : « l'été 2026 à la plage »…"}
            </Text>
            {!!search && (
              <TouchableOpacity onPress={() => { setSearch(null); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 15, color: C.textMuted }}>✕</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          {!!search?.label && <Text style={{ fontSize: 11.5, color: C.album, fontWeight: "600", marginTop: 6, marginLeft: 2 }}>{search.label}</Text>}
        </View>
      )}

      <Text style={{ fontSize: 11.5, color: C.textMuted, marginHorizontal: 18, marginTop: 10, marginBottom: 6 }}>
        {`${frNum(photos.length)} photo${photos.length > 1 ? "s" : ""}`}{sel.length > 0 ? ` · ${sel.length} sélectionnée${sel.length > 1 ? "s" : ""}` : ""}
      </Text>
      <FlatList
        data={photos}
        keyExtractor={(p) => p.id}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GAP, paddingHorizontal: GAP, marginBottom: GAP }}
        contentContainerStyle={{ paddingBottom: 120 }}
        initialNumToRender={24}
        windowSize={7}
        removeClippedSubviews
        extraData={sel}
        renderItem={({ item }) => (
          <MemoCell photo={item} size={cell} selected={sel.includes(item.id)} order={isCollage ? sel.indexOf(item.id) + 1 : 0} onPress={toggleSelect} />
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: "center", color: C.textMuted, fontSize: 13, marginTop: 40 }}>
            {tab === "library" && search ? "Aucune photo ne correspond." : tab === "kept" ? "Pas encore de coup de cœur." : "Aucune photo ici."}
          </Text>
        }
      />

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 26, borderTopWidth: 1, borderTopColor: C.border }}>
        <Text style={{ fontSize: 11.5, color: C.textMuted, textAlign: "center", marginBottom: 8 }}>
          {sel.length === 0 ? "Touche une photo, ou plusieurs pour un pêle-mêle"
            : sel.length === 1 ? "Touche d'autres photos pour faire un pêle-mêle"
            : sel.length >= COLLAGE_MAX ? `${COLLAGE_MAX} photos : le maximum · touche une photo cochée pour la décocher`
            : "Pêle-mêle · touche une photo cochée pour la décocher"}
        </Text>
        <TouchableOpacity activeOpacity={0.85} disabled={!ready}
          onPress={() => (isCollage ? navigation.navigate("PosterCollage", { photoIds: sel }) : navigation.navigate("PosterFormat", { photoId: sel[0] }))}
          style={[{ height: 50, borderRadius: 25, backgroundColor: ready ? C.album : C.border, alignItems: "center", justifyContent: "center" }, ready && SHADOW]}>
          <Text style={{ color: ready ? "#fff" : C.textMuted, fontSize: 15, fontWeight: "700" }}>
            {!ready ? "Choisir" : isCollage ? `Composer · ${sel.length} photos` : "Choisir cette photo"}
          </Text>
        </TouchableOpacity>
      </View>

      <ContentSearchSheet visible={searchOpen} onClose={() => setSearchOpen(false)} initialQuery={search?.query ?? ""}
        color={C.album} pickMode onApply={onApplySearch} />
    </SafeAreaView>
  );
}
