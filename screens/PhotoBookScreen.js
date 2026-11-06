// screens/PhotoBookScreen.js
// Livre photo d'un album : format, couverture, doubles pages, mise en page.
// Ouvert avec navigation.navigate("PhotoBook", { albumId }).
//
// L'écran ne contient AUCUNE règle du livre : il appelle services/photoBook.js
// (qui calcule le nouveau livre) puis l'enregistre avec setBook (store).

import { useEffect, useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity, TextInput, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { BookPage, BlankPage, BookCover, COVER_STYLE } from "../components/book/BookPage";
import PhotoPickerSheet from "../components/book/PhotoPickerSheet";
import { useBookFonts } from "../components/book/bookFonts";
import { EditRow, Chip, NavArrow, LayoutPicker, sectionStyle } from "../components/book/BookControls";
import { SHADOW } from "../components/home/ui";
import { C, S, FONT } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import {
  BOOK_PAGES, createBook, syncWithAlbum, setFormat, setOrientation, setLayout, autofill, bookStats,
  placedMap, placePhoto, clearSlot, setCover, COVER_FONTS, COVER_SIZES, COVER_COLORS, COVER_POS,
  pageRatio, isLandscape, clampPages,
} from "../services/photoBook";

const COVER = -1; // « page » sélectionnée = la couverture

export function PhotoBookScreen({ navigation, route }) {
  const albumId = route?.params?.albumId;
  const album   = usePhotoStore((s) => s.albums.find((a) => a.id === albumId));
  const printed = usePhotoStore((s) => s.printed);
  const book    = usePhotoStore((s) => s.books[albumId]);
  const setBook = usePhotoStore((s) => s.setBook);
  const { width } = useWindowDimensions();
  useBookFonts(); // charge les polices du titre (l'écran se redessine quand elles sont prêtes)

  // id → adresse de l'image, pour afficher les photos du livre.
  const urlById = useMemo(() => Object.fromEntries(printed.map((p) => [p.id, p.url])), [printed]);
  // Photos de l'album encore présentes sur le téléphone.
  const albumIds = useMemo(() => (album ? album.photoIds.filter((id) => urlById[id]) : []), [album, urlById]);

  // 1re ouverture → on crée le livre pré-rempli. Ensuite → on le remet d'accord avec l'album.
  useEffect(() => {
    if (!album) return;
    if (!book) setBook(albumId, createBook({ ...album, photoIds: albumIds }));
    else {
      const synced = syncWithAlbum(book, albumIds);
      if (synced !== book) setBook(albumId, synced);
    }
  }, [albumId, albumIds.length]);

  const [cur, setCur] = useState(COVER);
  // Feuille de choix ouverte pour : null (fermée) · "cover" · { page, slot }.
  const [picker, setPicker] = useState(null);
  // Saisie directe du nombre de pages (touche le chiffre) : null = pas en cours de saisie.
  const [pagesInput, setPagesInput] = useState(null);
  if (!album || !book) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} />;

  const save = (next) => setBook(albumId, next);
  const ratio = pageRatio(book);
  const landscape = isLandscape(book);
  // Change le nombre de pages et garde la page affichée valide.
  const changePages = (n) => {
    const f = clampPages(n);
    save(setFormat(book, f));
    if (cur >= f) setCur(f - 1);
  };
  const stats = bookStats(book, albumIds);
  const left = albumIds.length - stats.placedCount;
  const placed = placedMap(book);
  const pickerCurrent = picker === "cover" ? book.cover.photoId
    : picker ? book.pages[picker.page]?.slots[picker.slot] : null;
  const onPick = (id) => {
    if (picker === "cover") save(setCover(book, { photoId: id }));
    else save(placePhoto(book, picker.page, picker.slot, id));
    setPicker(null);
  };

  // Double page affichée : la couverture seule, puis [intérieur couv. | 1], [2 | 3]…
  const leftIndex = cur === COVER ? null : cur === 0 ? -1 : cur % 2 === 1 ? cur : cur - 1;
  const pageW = Math.floor((width - S.pad * 2) / 2);
  const goPrev = () => setCur(leftIndex === -1 ? COVER : Math.max(0, leftIndex - 2));
  const goNext = () => setCur(cur === COVER ? 0 : leftIndex + 2);
  const canNext = cur === COVER || leftIndex + 2 < book.format;
  const spreadLabel = cur === COVER ? "Couverture"
    : leftIndex === -1 ? "Page 1"
    : leftIndex + 1 >= book.format ? `Page ${leftIndex + 1}` : `Pages ${leftIndex + 1}–${leftIndex + 2}`;

  const renderPage = (pi, size) =>
    pi < 0 ? <BlankPage key="in" size={size} ratio={ratio} label="Intérieur de couverture" />
    : pi >= book.format ? <BlankPage key="end" size={size} ratio={ratio} label="Fin du livre" />
    : <BookPage key={pi} page={book.pages[pi]} size={size} ratio={ratio} urlById={urlById}
        coverFont={book.cover.font}
        selected={pi === cur} onPress={() => { setCur(pi); navigation.navigate("BookPageEditor", { albumId, pageIndex: pi }); }} />;

  // Bande des miniatures : couverture, puis chaque double page.
  const spreads = [];
  for (let s = -1; s < book.format; s += 2) spreads.push([s, s + 1].filter((p) => p >= 0 && p < book.format));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.pad, paddingTop: 8, paddingBottom: 40 }}>
        {/* En-tête */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BackButton accentColor={C.album} onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, color: C.textMuted, fontWeight: "500" }}>Livre photo · enregistré automatiquement</Text>
            <Text numberOfLines={1} style={{ fontSize: 19, color: C.text, fontWeight: "600" }}>📕 {album.name}</Text>
          </View>
        </View>

        {/* Format 21 × 28 cm : orientation + nombre de pages */}
        <View style={{ marginTop: 16, backgroundColor: C.bgCard, borderRadius: 16, padding: 12, ...SHADOW }}>
          <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.8, color: C.textMuted, marginBottom: 8 }}>
            FORMAT · {landscape ? "28 × 21" : "21 × 28"} CM
          </Text>
          <View style={{ flexDirection: "row", backgroundColor: C.bgMuted, borderRadius: 99, padding: 4 }}>
            {[["portrait", "Vertical", 11, 15], ["landscape", "Horizontal", 15, 11]].map(([k, label, w, h]) => {
              const on = (book.orientation ?? "portrait") === k;
              return (
                <TouchableOpacity key={k} onPress={() => save(setOrientation(book, k))}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 99, backgroundColor: on ? C.album : "transparent" }}>
                  <View style={{ width: w, height: h, borderWidth: 2, borderRadius: 2, borderColor: on ? "#fff" : C.textMid }} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: on ? "#fff" : C.textMid }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.8, color: C.textMuted, marginTop: 14, marginBottom: 8 }}>NOMBRE DE PAGES</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <TouchableOpacity onPress={() => changePages(book.format - BOOK_PAGES.step)} disabled={book.format <= BOOK_PAGES.min}
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center", opacity: book.format <= BOOK_PAGES.min ? 0.35 : 1 }}>
              <Text style={{ fontSize: 22, fontWeight: "700", color: C.album }}>−</Text>
            </TouchableOpacity>
            <View style={{ alignItems: "center" }}>
              <TextInput
                value={pagesInput ?? String(book.format)}
                onFocus={() => setPagesInput(String(book.format))}
                onChangeText={(t) => setPagesInput(t.replace(/[^0-9]/g, "").slice(0, 3))}
                onEndEditing={() => { if (pagesInput != null) changePages(pagesInput); setPagesInput(null); }}
                keyboardType="number-pad"
                selectTextOnFocus
                style={{ fontFamily: FONT, fontSize: 26, fontWeight: "800", color: C.text, textAlign: "center", minWidth: 80, padding: 0 }}
              />
              <Text style={{ fontSize: 11.5, color: C.textMid }}>pages · de {BOOK_PAGES.min} à {BOOK_PAGES.max}</Text>
            </View>
            <TouchableOpacity onPress={() => changePages(book.format + BOOK_PAGES.step)} disabled={book.format >= BOOK_PAGES.max}
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center", opacity: book.format >= BOOK_PAGES.max ? 0.35 : 1 }}>
              <Text style={{ fontSize: 22, fontWeight: "700", color: C.album }}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 8 }}>Le nombre de pages va de 2 en 2 (30, 32, 34…). Touche le chiffre pour le saisir.</Text>
        </View>

        {/* Remplissage */}
        <View style={{ marginTop: 12, backgroundColor: C.bgCard, borderRadius: 14, padding: 12, ...SHADOW }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12.5, color: C.textMid }}>
              <Text style={{ fontWeight: "600", color: C.text }}>{stats.placedCount}</Text> / {stats.total} photos de l'album placées
            </Text>
            <Text style={{ fontSize: 12.5, color: C.textMid }}>
              {stats.emptyPages ? `${stats.emptyPages} page${stats.emptyPages > 1 ? "s" : ""} vide${stats.emptyPages > 1 ? "s" : ""}` : "Livre plein ✓"}
            </Text>
          </View>
          <View style={{ height: 6, backgroundColor: C.bgMuted, borderRadius: 4, marginTop: 8, overflow: "hidden" }}>
            <View style={{ width: `${Math.round(stats.fillRatio * 100)}%`, height: "100%", backgroundColor: C.album, borderRadius: 4 }} />
          </View>
          {left > 0 ? (
            <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 7 }}>
              {left} photo{left > 1 ? "s" : ""} pas encore dans le livre ·{" "}
              <Text onPress={() => save(autofill(book, albumIds))} style={{ color: C.album, fontWeight: "600" }}>Compléter automatiquement</Text>
            </Text>
          ) : (
            <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 7 }}>Toutes les photos de l'album sont dans le livre.</Text>
          )}
        </View>

        {/* Navigation entre doubles pages */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
          <NavArrow label="‹" disabled={cur === COVER} onPress={goPrev} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: C.text }}>{spreadLabel}</Text>
          <NavArrow label="›" disabled={!canNext} onPress={goNext} />
        </View>

        {/* Double page (ou couverture seule) */}
        <View style={{ marginTop: 10, alignItems: "center" }}>
          {cur === COVER ? (
            <BookCover cover={book.cover} size={Math.round(pageW * (landscape ? 1.5 : 1.25))} ratio={ratio} urlById={urlById} onPress={() => setPicker("cover")} />
          ) : (
            <View style={{ flexDirection: "row", backgroundColor: "#ffffff", borderRadius: 6,
              shadowColor: "#3c3c28", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 14, elevation: 4 }}>
              {renderPage(leftIndex, pageW)}
              {renderPage(leftIndex + 1, pageW)}
            </View>
          )}
        </View>

        <Text style={{ fontSize: 11.5, color: C.textMuted, textAlign: "center", marginTop: 10 }}>
          {cur === COVER ? "Touche la photo pour la changer" : "Touche une page pour l'ouvrir en grand"}
        </Text>

        {/* Réglages de la couverture */}
        {cur === COVER && (
          <>
            <Text style={sectionStyle}>COUVERTURE</Text>
            <View style={{ backgroundColor: C.bgCard, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 2, ...SHADOW }}>
              <EditRow label="Titre">
                <TextInput
                  value={book.cover.title}
                  onChangeText={(title) => save(setCover(book, { title }))}
                  maxLength={40}
                  placeholder="Titre du livre"
                  placeholderTextColor={C.textMuted}
                  style={{ flex: 1, backgroundColor: C.bgMuted, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontFamily: FONT, fontSize: 14, color: C.text }}
                />
              </EditRow>
              <EditRow label="Police">
                {COVER_FONTS.map((k) => {
                  const f = COVER_STYLE.font[k];
                  return <Chip key={k} on={book.cover.font === k} onPress={() => save(setCover(book, { font: k }))}
                    textStyle={{ fontFamily: f.family, fontWeight: f.weight }}>{f.label}</Chip>;
                })}
              </EditRow>
              <EditRow label="Taille">
                {COVER_SIZES.map((k) => <Chip key={k} on={book.cover.size === k} onPress={() => save(setCover(book, { size: k }))}>{k}</Chip>)}
              </EditRow>
              <EditRow label="Couleur">
                {COVER_COLORS.map((k) => {
                  const on = book.cover.color === k;
                  return (
                    <TouchableOpacity key={k} onPress={() => save(setCover(book, { color: k }))}
                      style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: on ? C.album : "transparent", alignItems: "center", justifyContent: "center" }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: COVER_STYLE.color[k], borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" }} />
                    </TouchableOpacity>
                  );
                })}
              </EditRow>
              <EditRow label="Position" last>
                {COVER_POS.map((k) => <Chip key={k} on={book.cover.pos === k} onPress={() => save(setCover(book, { pos: k }))}>{COVER_STYLE.pos[k].label}</Chip>)}
              </EditRow>
            </View>
            <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 8 }}>Le titre du livre ne renomme pas l'album.</Text>
          </>
        )}

        {/* Mise en page de la page sélectionnée */}
        {cur !== COVER && (
          <>
            <Text style={sectionStyle}>MISE EN PAGE · PAGE {cur + 1}</Text>
            <LayoutPicker value={book.pages[cur].layout} landscape={landscape} onChange={(n) => save(setLayout(book, cur, n))} />
            <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 8 }}>Les photos en trop retournent dans l'album, rien n'est perdu.</Text>
          </>
        )}

        {/* Toutes les pages */}
        <Text style={sectionStyle}>TOUTES LES PAGES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          <Thumb label="Couv." on={cur === COVER} onPress={() => setCur(COVER)}>
            <BookCover cover={book.cover} size={landscape ? 34 : 26} ratio={ratio} urlById={urlById} />
          </Thumb>
          {spreads.map((ps) => (
            <Thumb key={ps[0]} label={ps.map((p) => p + 1).join("–")} on={ps.includes(cur)} onPress={() => setCur(ps[0])}>
              {ps.map((pi) => <BookPage key={pi} page={book.pages[pi]} size={landscape ? 34 : 26} ratio={ratio} urlById={urlById} coverFont={book.cover.font} />)}
            </Thumb>
          ))}
        </ScrollView>

        {/* Impression : ouvre les contrôles avant impression */}
        <TouchableOpacity
          onPress={() => navigation.navigate("BookCheck", { albumId })}
          style={{ marginTop: 20, backgroundColor: C.album, borderRadius: 16, paddingVertical: 14, alignItems: "center", elevation: 3 }}
        >
          <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#fff" }}>Imprimer ce livre</Text>
        </TouchableOpacity>
      </ScrollView>

      <PhotoPickerSheet
        visible={!!picker}
        onClose={() => setPicker(null)}
        forCover={picker === "cover"}
        subtitle={picker === "cover" ? "couverture" : picker ? `page ${picker.page + 1}` : ""}
        albumIds={albumIds}
        urlById={urlById}
        placed={placed}
        currentId={pickerCurrent}
        onPick={onPick}
        onRemove={picker && picker !== "cover" && pickerCurrent
          ? () => { save(clearSlot(book, picker.page, picker.slot)); setPicker(null); }
          : null}
      />
    </SafeAreaView>
  );
}

function Thumb({ label, on, onPress, children }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ alignItems: "center" }}>
      <View style={{ flexDirection: "row", gap: 1, padding: 2, backgroundColor: "#ffffff", borderRadius: 3,
        borderWidth: on ? 2 : 0, borderColor: C.album }}>
        {children}
      </View>
      <Text style={{ fontSize: 9, color: C.textMuted, marginTop: 3 }}>{label}</Text>
    </TouchableOpacity>
  );
}
