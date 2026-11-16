// screens/BookFlipScreen.js
// « Feuilleter une dernière fois » : le livre en lecture seule, de la couverture au dos, page par page, avant de commander.
// Ouvert depuis BookCheck : navigation.navigate("BookFlip", { albumId }).
//  · livre VERTICAL (A4)  : une page par écran, on feuillette vers le haut / le bas.
//  · livre HORIZONTAL     : l'écran « bascule » tout seul : les pages sont tournées de 90° pour remplir toute la longueur du téléphone
//                           (on tourne le téléphone sur le côté, tête vers la gauche), et on feuillette de gauche à droite.
//    (Rotation dessinée à l'intérieur de l'écran : aucun module natif, pas de rebuild. Une vraie bascule de l'écran demanderait
//     expo-screen-orientation + un rebuild + de rouvrir l'orientation de toute l'app.)
// Rien ne se modifie ici ; « Modifier cette page » ouvre l'éditeur.

import { useMemo, useRef, useState } from "react";
import { View, FlatList, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { BookPage, BookCover, DoublePage } from "../components/book/BookPage";
import BackCover from "../components/book/BackCover";
import { useBookFonts } from "../components/book/bookFonts";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { pageRatio, isLandscape, isDoublePage, isDoubleLeft, doubleLeftIndex, getCrop } from "../services/photoBook";
import { bookSpec } from "../services/bookProducts";

const SHADOW_STYLE = { shadowColor: "#3c3c28", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 14, elevation: 4 };
const MARGIN = 18; // air autour d'une page

export function BookFlipScreen({ navigation, route }) {
  const albumId = route?.params?.albumId;
  const album   = usePhotoStore((s) => s.albums.find((a) => a.id === albumId));
  const printed = usePhotoStore((s) => s.printed);
  const book    = usePhotoStore((s) => s.books[albumId]);
  useBookFonts();
  const [area, setArea] = useState(null);   // zone de lecture mesurée { w, h }
  const [idx, setIdx] = useState(0);
  const listRef = useRef(null);

  const urlById = useMemo(() => Object.fromEntries(printed.map((p) => [p.id, p.url])), [printed]);

  // Éléments à feuilleter : couverture · chaque page une par une · dos.
  const items = useMemo(() => {
    if (!book) return [];
    const out = [{ key: "cover", kind: "cover", label: "Couverture" }];
    for (let pi = 0; pi < book.format; pi++) out.push({ key: `p${pi}`, kind: "page", pi, label: `Page ${pi + 1}` });
    out.push({ key: "back", kind: "back", label: "Dos du livre" });
    return out;
  }, [book]);

  if (!album || !book) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} />;

  const spec = bookSpec(book);
  const ratio = pageRatio(book);
  const landscape = isLandscape(book);

  // Cadre d'une « diapositive » : en horizontal, le cadre est la zone tournée de 90° (largeur ↔ hauteur échangées).
  const frameW = area ? (landscape ? area.h : area.w) : 0;
  const frameH = area ? (landscape ? area.w : area.h) : 0;
  const pageW = Math.max(60, Math.floor(Math.min(frameW - MARGIN * 2, (frameH - MARGIN * 2) / ratio)));

  const render = ({ item }) => {
    let body = null;
    if (item.kind === "cover") {
      body = <BookCover cover={book.cover} size={pageW} ratio={ratio} urlById={urlById}
        safe={{ x: spec.safeMm / spec.widthMm, y: spec.safeMm / spec.heightMm }} />;
    } else if (item.kind === "back") {
      body = <View style={{ overflow: "hidden", borderRadius: 4 }}><BackCover bg={book.cover.bg} size={pageW} ratio={ratio} /></View>;
    } else {
      const page = book.pages[item.pi];
      if (isDoublePage(page)) {
        // Photo sur 2 pages : ici on n'affiche que la moitié qui correspond à cette page.
        const l = doubleLeftIndex(book, item.pi);
        const owner = book.pages[l];
        const id = owner.slots[0];
        body = <DoublePage url={id ? urlById[id] : null} size={pageW} ratio={ratio} crop={id ? getCrop(owner, id) : undefined}
          half={isDoubleLeft(page) ? "left" : "right"} />;
      } else {
        body = <BookPage page={page} size={pageW} ratio={ratio} urlById={urlById} coverFont={book.cover.font} />;
      }
    }
    return (
      <View style={{ width: frameW, height: frameH, alignItems: "center", justifyContent: "center" }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 4, ...SHADOW_STYLE }}>{body}</View>
      </View>
    );
  };

  const cur = items[idx] ?? items[0];
  const go = (n) => {
    const next = Math.max(0, Math.min(items.length - 1, n));
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIdx(next);
  };
  const onEnd = (e) => {
    const o = landscape ? e.nativeEvent.contentOffset.x : e.nativeEvent.contentOffset.y;
    setIdx(Math.max(0, Math.min(items.length - 1, Math.round(o / (landscape ? frameW : frameH)))));
  };

  const list = area && (
    <FlatList
      ref={listRef}
      data={items}
      keyExtractor={(it) => it.key}
      renderItem={render}
      horizontal={landscape}
      pagingEnabled showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}
      getItemLayout={(_, i) => {
        const len = landscape ? frameW : frameH;
        return { length: len, offset: len * i, index: i };
      }}
      onMomentumScrollEnd={onEnd}
      windowSize={3} initialNumToRender={2}
      extraData={pageW}
      style={landscape
        // Zone tournée de 90° : on la pose au centre de la zone de lecture, puis on la pivote.
        ? { position: "absolute", width: frameW, height: frameH, left: (area.w - frameW) / 2, top: (area.h - frameH) / 2, transform: [{ rotate: "90deg" }] }
        : { flex: 1 }}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingTop: 8, paddingBottom: 6 }}>
        <BackButton accentColor={C.album} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 11.5, color: C.textMuted }}>📕 {book.cover.title || album.name}</Text>
          <Text style={{ fontSize: 19, fontWeight: "600", color: C.text }}>{cur?.label}</Text>
        </View>
        <Text style={{ fontSize: 12, color: C.textMuted }}>{idx + 1} / {items.length}</Text>
      </View>

      {/* Zone de lecture (mesurée) */}
      <View style={{ flex: 1 }} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; setArea((a) => (a && a.w === width && a.h === height ? a : { w: width, h: height })); }}>
        {list}
        {landscape && !!area && (
          <Text pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 4, textAlign: "center", fontSize: 11.5, color: C.textMuted }}>
            Tourne ton téléphone sur le côté · glisse pour tourner les pages
          </Text>
        )}
      </View>

      <View style={{ paddingHorizontal: S.pad, paddingBottom: 14, paddingTop: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 14, marginBottom: 10 }}>
          {[["‹", idx - 1, idx === 0], ["›", idx + 1, idx >= items.length - 1]].map(([label, to, off]) => (
            <TouchableOpacity key={label} disabled={off} onPress={() => go(to)}
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.bgCard, alignItems: "center", justifyContent: "center", opacity: off ? 0.35 : 1, elevation: 2 }}>
              <Text style={{ fontSize: 24, color: C.text, marginTop: -2 }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {cur?.kind === "page" && (
          <TouchableOpacity onPress={() => navigation.navigate("BookPageEditor", { albumId, pageIndex: cur.pi })}
            style={{ height: 46, borderRadius: S.radiusFull, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            <Text style={{ color: C.textMid, fontWeight: "700", fontSize: 14 }}>Modifier cette page</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => navigation.goBack()}
          style={{ height: 52, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center", elevation: 3 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>J'ai tout vu</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
