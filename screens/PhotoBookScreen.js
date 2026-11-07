// screens/PhotoBookScreen.js
// Livre photo d'un album : format, couverture, doubles pages, mise en page.
// Ouvert avec navigation.navigate("PhotoBook", { albumId }).
//
// L'écran ne contient AUCUNE règle du livre : il appelle services/photoBook.js
// (qui calcule le nouveau livre) puis l'enregistre avec setBook (store).

import { useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, TouchableOpacity, TextInput, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gesture, GestureDetector, FlatList } from "react-native-gesture-handler";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { BookPage, BlankPage, BookCover, COVER_STYLE } from "../components/book/BookPage";
import { FlatCover } from "../components/book/FlatCover";
import { getCoverDimensions } from "../services/gelato";
import PhotoPickerSheet from "../components/book/PhotoPickerSheet";
import { useBookFonts } from "../components/book/bookFonts";
import { EditRow, Chip, NavArrow, LayoutPicker, ToolButton, sectionStyle } from "../components/book/BookControls";
import { TiltSlider } from "../components/book/TiltSlider";
import { SHADOW } from "../components/home/ui";
import { C, S, FONT } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import {
  BOOK_PAGES, createBook, syncWithAlbum, setFormat, setOrientation, setLayout, autofill, bookStats,
  placedMap, placePhoto, clearSlot, setCover, COVER_FONTS, COVER_SIZES, COVER_COLORS, COVER_POS,
  COVER_STYLES, COVER_BGS, setCoverStyle, setCoverBg, coverBgHex,
  getCoverCrop, setCoverCrop, resetCoverCrop,
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
  // Dimensions de la couverture à plat (dos compris), données par Gelato : chargées quand on regarde la couverture.
  const [flat, setFlat] = useState({ dims: null, format: null, error: false });
  // Recadrage de la photo de couverture : mode actif ? · redressement pendant le glissé du curseur · liste des couleurs dépliée ?
  const [coverEdit, setCoverEdit] = useState(false);
  const [liveTilt, setLiveTilt] = useState(null);
  const [bgOpen, setBgOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const stripRef = useRef(null); // bande « Toutes les pages »
  useEffect(() => { if (cur !== COVER) { setCoverEdit(false); setLiveTilt(null); } }, [cur]);
  // La bande des miniatures suit la page affichée (utile au-delà des premières pages).
  useEffect(() => {
    if (!book) return;
    const spreadStart = cur === COVER ? null : cur % 2 === 1 ? cur : cur - 1;
    const index = cur === COVER ? 0 : 1 + (spreadStart + 1) / 2;
    try { stripRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true }); } catch (e) { /* bande pas encore dessinée */ }
  }, [cur, book?.format]);
  useEffect(() => {
    if (!book || cur !== COVER) return undefined;
    let alive = true;
    setFlat((f) => ({ ...f, error: false }));
    getCoverDimensions(book.format)
      .then((dims) => { if (alive) setFlat({ dims, format: book.format, error: false }); })
      .catch(() => { if (alive) setFlat({ dims: null, format: null, error: true }); });
    return () => { alive = false; };
  }, [book?.format, cur]);
  // Maintenir − ou + : un pas tout de suite, puis ça défile (de 2 en 2) jusqu'au relâchement.
  const bookRef = useRef(book);
  bookRef.current = book;
  const holdTimers = useRef({ start: null, loop: null });
  const stepPages = (dir) => {
    const b = bookRef.current;
    if (!b) return;
    const f = clampPages(b.format + dir * BOOK_PAGES.step);
    if (f === b.format) { stopHold(); return; }
    setBook(albumId, setFormat(b, f));
    setCur((c) => (c >= f ? f - 1 : c));
  };
  const stopHold = () => { clearTimeout(holdTimers.current.start); clearInterval(holdTimers.current.loop); };
  const startHold = (dir) => {
    stopHold();
    stepPages(dir);
    holdTimers.current.start = setTimeout(() => { holdTimers.current.loop = setInterval(() => stepPages(dir), 90); }, 400);
  };
  useEffect(() => stopHold, []); // si l'écran se ferme en plein maintien
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
    if (picker === "cover") save(setCover(book, { photoId: id, crop: undefined })); // nouvelle photo : cadrage neuf
    else save(placePhoto(book, picker.page, picker.slot, id));
    setPicker(null);
  };

  // Double page affichée : la couverture seule, puis [intérieur couv. | 1], [2 | 3]…
  const leftIndex = cur === COVER ? null : cur === 0 ? -1 : cur % 2 === 1 ? cur : cur - 1;
  const pageW = Math.floor((width - S.pad * 2) / 2);
  const goPrev = () => setCur(leftIndex === -1 ? COVER : Math.max(0, leftIndex - 2));
  const goNext = () => setCur(cur === COVER ? 0 : leftIndex + 2);
  const canNext = cur === COVER || leftIndex + 2 < book.format;
  // Glisser vers la gauche = page suivante, vers la droite = page précédente.
  // Seulement si le geste est surtout horizontal, pour ne pas gêner le défilement de l'écran.
  const swipe = Gesture.Pan().runOnJS(true).enabled(!coverEdit).activeOffsetX([-25, 25]).failOffsetY([-20, 20])
    .onEnd((e) => {
      if (e.translationX < -50 && canNext) goNext();
      else if (e.translationX > 50 && cur !== COVER) goPrev();
    });
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
      <ScrollView scrollEnabled={!coverEdit} contentContainerStyle={{ padding: S.pad, paddingTop: 8, paddingBottom: 40 }}>
        {/* En-tête */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BackButton accentColor={C.album} onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, color: C.textMuted, fontWeight: "500" }}>Livre photo · enregistré automatiquement</Text>
            <Text numberOfLines={1} style={{ fontSize: 19, color: C.text, fontWeight: "600" }}>📕 {album.name}</Text>
          </View>
        </View>

        {/* Format 21 × 28 cm : orientation + nombre de pages, sur une seule ligne */}
        <View style={{ marginTop: 14, backgroundColor: C.bgCard, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", ...SHADOW }}>
          {/* Orientation : deux petites pastilles (vertical / horizontal) */}
          <View style={{ flexDirection: "row", backgroundColor: C.bgMuted, borderRadius: 99, padding: 3 }}>
            {[["portrait", "Vertical", 11, 15], ["landscape", "Horizontal", 15, 11]].map(([k, label, w, h]) => {
              const on = (book.orientation ?? "portrait") === k;
              return (
                <TouchableOpacity key={k} onPress={() => save(setOrientation(book, k))} accessibilityLabel={label}
                  style={{ width: 40, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 99, backgroundColor: on ? C.album : "transparent" }}>
                  <View style={{ width: w, height: h, borderWidth: 2, borderRadius: 2, borderColor: on ? "#fff" : C.textMid }} />
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={{ flex: 1, textAlign: "center", fontSize: 11.5, color: C.textMuted }}>{landscape ? "28 × 21" : "21 × 28"} cm</Text>

          {/* Nombre de pages : − 30 + (maintenir − ou + pour défiler vite, toucher le chiffre pour le saisir) */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <TouchableOpacity onPressIn={() => startHold(-1)} onPressOut={stopHold} disabled={book.format <= BOOK_PAGES.min}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center", opacity: book.format <= BOOK_PAGES.min ? 0.35 : 1 }}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: C.album, lineHeight: 22 }}>−</Text>
            </TouchableOpacity>
            <View style={{ alignItems: "center", minWidth: 50 }}>
              <TextInput
                value={pagesInput ?? String(book.format)}
                onFocus={() => setPagesInput(String(book.format))}
                onChangeText={(t) => setPagesInput(t.replace(/[^0-9]/g, "").slice(0, 3))}
                onEndEditing={() => { if (pagesInput != null) changePages(pagesInput); setPagesInput(null); }}
                keyboardType="number-pad"
                selectTextOnFocus
                style={{ fontFamily: FONT, fontSize: 20, fontWeight: "800", color: C.text, textAlign: "center", minWidth: 50, padding: 0, lineHeight: 22 }}
              />
              <Text style={{ fontSize: 10, color: C.textMuted }}>pages</Text>
            </View>
            <TouchableOpacity onPressIn={() => startHold(1)} onPressOut={stopHold} disabled={book.format >= BOOK_PAGES.max}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center", opacity: book.format >= BOOK_PAGES.max ? 0.35 : 1 }}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: C.album, lineHeight: 22 }}>+</Text>
            </TouchableOpacity>
          </View>
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

        {/* Double page (ou couverture seule) — glisser vers la gauche / la droite tourne les pages */}
        <GestureDetector gesture={swipe}>
        <View style={{ marginTop: 10, alignItems: "center" }}>
          {cur === COVER ? (
            <BookCover cover={book.cover} size={Math.round(pageW * (landscape ? 1.5 : 1.25))} ratio={ratio} urlById={urlById}
              onPress={coverEdit ? undefined : () => setPicker("cover")}
              editable={coverEdit} onCropChange={(c) => save(setCoverCrop(book, c))}
              cropPreview={coverEdit && liveTilt != null ? { tilt: liveTilt } : null} />
          ) : (
            <View style={{ flexDirection: "row", backgroundColor: "#ffffff", borderRadius: 6,
              shadowColor: "#3c3c28", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 14, elevation: 4 }}>
              {renderPage(leftIndex, pageW)}
              {renderPage(leftIndex + 1, pageW)}
            </View>
          )}
        </View>
        </GestureDetector>

        <Text style={{ fontSize: 11.5, color: C.textMuted, textAlign: "center", marginTop: 10 }}>
          {cur === COVER
            ? (coverEdit ? "Pince pour zoomer · glisse pour déplacer" : "Touche la photo pour la changer · glisse pour tourner la page")
            : "Touche une page pour l'ouvrir en grand · glisse pour tourner la page"}
        </Text>

        {/* Recadrer la photo de couverture (comme sur les pages) */}
        {cur === COVER && book.cover.photoId && (book.cover.style ?? "pleine") !== "titre" && (
          coverEdit ? (
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <ToolButton icon="↺" label="Pivoter" onPress={() => save(setCoverCrop(book, { rot: (getCoverCrop(book.cover).rot + 270) % 360 }))} />
                <ToolButton icon="↻" label="Pivoter" onPress={() => save(setCoverCrop(book, { rot: (getCoverCrop(book.cover).rot + 90) % 360 }))} />
                <ToolButton icon="⌖" label="Recentrer" onPress={() => save(resetCoverCrop(book))} />
                <ToolButton icon="⇄" label="Changer" onPress={() => { setCoverEdit(false); setPicker("cover"); }} />
                <ToolButton icon="✓" label="Terminé" accent onPress={() => { setCoverEdit(false); setLiveTilt(null); }} />
              </View>
              <Text style={sectionStyle}>REDRESSER</Text>
              <View style={{ backgroundColor: C.bgCard, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, ...SHADOW }}>
                <TiltSlider
                  value={liveTilt ?? getCoverCrop(book.cover).tilt}
                  onChange={setLiveTilt}
                  onEnd={(v) => { save(setCoverCrop(book, { tilt: v })); setLiveTilt(null); }}
                />
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setCoverEdit(true)}
              style={{ marginTop: 12, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 99, backgroundColor: C.albumSoft }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.album }}>✂ Recadrer la photo</Text>
            </TouchableOpacity>
          )
        )}

        {/* Réglages de la couverture */}
        {cur === COVER && (
          <>
            <Text style={sectionStyle}>STYLE DE COUVERTURE</Text>
            <View style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 12, ...SHADOW }}>
              {/* Le style actuel : on le touche pour voir tous les styles */}
              <TouchableOpacity onPress={() => setStyleOpen(!styleOpen)} activeOpacity={0.8}
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <BookCover cover={{ ...book.cover, title: book.cover.title || "Titre" }} size={34} ratio={ratio} urlById={urlById} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>
                    {COVER_STYLES.find((st) => st.key === (book.cover.style ?? "pleine"))?.label}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: C.textMuted }}>{COVER_STYLES.length} styles disponibles</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.album }}>{styleOpen ? "Fermer ▴" : "Changer ▾"}</Text>
              </TouchableOpacity>
              {styleOpen && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
                  {COVER_STYLES.map((st) => {
                    const on = (book.cover.style ?? "pleine") === st.key;
                    const tileW = Math.floor((width - S.pad * 2 - 24 - 20) / 3);
                    return (
                      <TouchableOpacity key={st.key} onPress={() => { save(setCoverStyle(book, st.key)); setStyleOpen(false); }} style={{ width: tileW, alignItems: "center" }}>
                        <View style={{ padding: 3, borderRadius: 8, borderWidth: 2.5, borderColor: on ? C.album : "transparent" }}>
                          <BookCover cover={{ ...book.cover, style: st.key, title: book.cover.title || "Titre" }} size={tileW - 14} ratio={ratio} urlById={urlById} />
                        </View>
                        <Text style={{ fontSize: 11.5, marginTop: 4, fontWeight: on ? "700" : "500", color: on ? C.album : C.textMid }}>{st.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <Text style={sectionStyle}>COULEUR DE FOND</Text>
            <View style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 12, ...SHADOW }}>
              {/* La couleur actuelle : on la touche pour voir toutes les couleurs */}
              <TouchableOpacity onPress={() => setBgOpen(!bgOpen)} activeOpacity={0.8}
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: coverBgHex(book.cover.bg), borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>
                    {COVER_BGS.find((c) => c.key === (book.cover.bg ?? "creme"))?.label}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: C.textMuted }}>Sert aussi au dos et à la 4ᵉ de couverture</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.album }}>{bgOpen ? "Fermer ▴" : "Changer ▾"}</Text>
              </TouchableOpacity>
              {bgOpen && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
                  {COVER_BGS.map((c) => {
                    const on = (book.cover.bg ?? "creme") === c.key;
                    return (
                      <TouchableOpacity key={c.key} onPress={() => { save(setCoverBg(book, c.key)); setBgOpen(false); }} accessibilityLabel={c.label}
                        style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2.5, borderColor: on ? C.album : "transparent", alignItems: "center", justifyContent: "center" }}>
                        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.hex, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" }} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <Text style={sectionStyle}>TITRE</Text>
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
              <EditRow label="Couleur" last={!["pleine", "cadre", undefined].includes(book.cover.style)}>
                <Chip on={book.cover.color === "auto"} onPress={() => save(setCover(book, { color: "auto" }))}>Auto</Chip>
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
              {/* « Position » n'a de sens que si le titre est posé sur la photo ; les autres styles ont leur zone de titre. */}
              {["pleine", "cadre", undefined].includes(book.cover.style) && (
                <EditRow label="Position" last>
                  {COVER_POS.map((k) => <Chip key={k} on={book.cover.pos === k} onPress={() => save(setCover(book, { pos: k }))}>{COVER_STYLE.pos[k].label}</Chip>)}
                </EditRow>
              )}
            </View>
            <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 8 }}>Le titre du livre ne renomme pas l'album.</Text>

            {/* Aperçu de la couverture à plat : 4ᵉ de couverture · dos · face avant */}
            <Text style={sectionStyle}>COUVERTURE À PLAT</Text>
            {flat.dims && flat.format === book.format ? (
              <>
                <View style={{ alignSelf: "center", borderRadius: 3, backgroundColor: "#fff", ...SHADOW }}>
                  <FlatCover cover={book.cover} dims={flat.dims} width={width - S.pad * 2} urlById={urlById} guides />
                </View>
                <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 8 }}>
                  4ᵉ de couverture · dos ({flat.dims.spine.w} mm, titre à la verticale) · face avant. Elle prend la couleur de fond choisie.
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: 12, color: flat.error ? C.album : C.textMuted }}>
                {flat.error ? "Aperçu indisponible : il faut une connexion internet la première fois." : "Chargement des dimensions de la couverture…"}
              </Text>
            )}
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
        {/* Liste défilante : elle ne dessine que les miniatures visibles, donc elle va jusqu'au bout d'un livre de 200 pages. */}
        <FlatList
          ref={stripRef}
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          data={[{ key: "cover", cover: true }, ...spreads.map((ps) => ({ key: `s${ps[0]}`, ps }))]}
          keyExtractor={(it) => it.key}
          initialNumToRender={10}
          windowSize={5}
          maxToRenderPerBatch={8}
          ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
          contentContainerStyle={{ paddingBottom: 4 }}
          onScrollToIndexFailed={(info) => stripRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true })}
          renderItem={({ item }) => item.cover ? (
            <Thumb label="Couv." on={cur === COVER} onPress={() => setCur(COVER)}>
              <BookCover cover={book.cover} size={landscape ? 34 : 26} ratio={ratio} urlById={urlById} />
            </Thumb>
          ) : (
            <Thumb label={item.ps.map((p) => p + 1).join("–")} on={item.ps.includes(cur)} onPress={() => setCur(item.ps[0])}>
              {item.ps.map((pi) => <BookPage key={pi} page={book.pages[pi]} size={landscape ? 34 : 26} ratio={ratio} urlById={urlById} coverFont={book.cover.font} />)}
            </Thumb>
          )}
        />

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
