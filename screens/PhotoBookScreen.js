// screens/PhotoBookScreen.js
// Livre photo d'un album : format, couverture, doubles pages, mise en page.
// Ouvert avec navigation.navigate("PhotoBook", { albumId }).
//
// L'écran ne contient AUCUNE règle du livre : il appelle services/photoBook.js
// (qui calcule le nouveau livre) puis l'enregistre avec setBook (store).

import { useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, TouchableOpacity, TextInput, Alert, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gesture, GestureDetector, FlatList } from "react-native-gesture-handler";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import Icon from "../components/Icons";
import { BookPage, BlankPage, BookCover, DoublePage, COVER_STYLE } from "../components/book/BookPage";
import BookFormatChooser from "../components/book/BookFormatChooser";
import { BOOK_PRODUCTS, BOOK_PRODUCT_KEYS, bookSpec, bookPriceCents } from "../services/bookProducts";
import { formatEuro } from "../constants/subscription";
import PhotoPickerSheet from "../components/book/PhotoPickerSheet";
import { useBookFonts } from "../components/book/bookFonts";
import { EditRow, Chip, NavArrow, LayoutPicker, ToolButton, sectionStyle } from "../components/book/BookControls";
import { TiltSlider } from "../components/book/TiltSlider";
import { SHADOW } from "../components/home/ui";
import { C, S, FONT } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import {
  pagesRange, createBook, syncWithAlbum, setFormat, setProduct, setLayout, autofill, bookStats,
  placedMap, placePhoto, clearSlot, setCover, COVER_FONTS, COVER_SIZES, COVER_COLORS, COVER_POS,
  COVER_STYLES, COVER_BGS, setCoverStyle, setCoverBg, coverBgHex, styleNeedsBg, autoTitleXY, completeBook, COMPLETE_ORDERS,
  getCrop, setCrop, resetCrop, isDoubleLeft, isDoublePage, canDouble, spreadLeftOf, setDouble, clearDouble,
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
  // id → date de la photo (pour « Compléter automatiquement par date »).
  const dateById = useMemo(() => Object.fromEntries(printed.map((p) => [p.id, p.creationTime ?? 0])), [printed]);
  // Photos de l'album encore présentes sur le téléphone.
  const albumIds = useMemo(() => (album ? album.photoIds.filter((id) => urlById[id]) : []), [album, urlById]);

  // Pas encore de livre → l'écran « Choisis ton format » est affiché (le livre est créé au choix, voir plus bas).
  // Livre existant → on le remet d'accord avec l'album.
  useEffect(() => {
    if (!album || !book) return;
    const synced = syncWithAlbum(book, albumIds);
    if (synced !== book) setBook(albumId, synced);
  }, [albumId, albumIds.length, !!book]);

  const [cur, setCur] = useState(COVER);
  // Feuille de choix ouverte pour : null (fermée) · "cover" · { page, slot }.
  const [picker, setPicker] = useState(null);
  // Saisie directe du nombre de pages (touche le chiffre) : null = pas en cours de saisie.
  const [pagesInput, setPagesInput] = useState(null);
  // Couverture : ce que l'utilisateur a touché ("title" · "photo" · null) → c'est lui qui décide des outils affichés.
  const [sel, setSel] = useState(null);
  // Position du titre pendant qu'on le glisse (enregistrée au lâcher) · glissé en cours (bloque le défilement de l'écran).
  const [liveXY, setLiveXY] = useState(null);
  // Double page : photo touchée (outils affichés) · recadrage en cours.
  const [dblSel, setDblSel] = useState(false);
  const [dblEdit, setDblEdit] = useState(false);
  const [dragging, setDragging] = useState(false);
  // (remplacé : le format s'affiche sur une carte, on le touche pour changer ; le remplissage a sa propre carte)
  const [chooser, setChooser] = useState(false);          // page « Format du livre » ouverte ?
  const [completeOpen, setCompleteOpen] = useState(false); // options de « Compléter automatiquement » dépliées ?
  const [completeOrder, setCompleteOrder] = useState("date");
  // Recadrage de la photo de couverture : mode actif ? · redressement pendant le glissé du curseur · liste des couleurs dépliée ?
  const [coverEdit, setCoverEdit] = useState(false);
  const [liveTilt, setLiveTilt] = useState(null);
  const [bgOpen, setBgOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const stripRef = useRef(null); // bande « Toutes les pages »
  useEffect(() => { if (cur !== COVER) { setCoverEdit(false); setLiveTilt(null); setSel(null); setLiveXY(null); } }, [cur]);
  useEffect(() => { setDblSel(false); setDblEdit(false); }, [cur]);
  // La bande des miniatures suit la page affichée (utile au-delà des premières pages).
  useEffect(() => {
    if (!book) return;
    const spreadStart = cur === COVER ? null : cur % 2 === 1 ? cur : cur - 1;
    const index = cur === COVER ? 0 : 1 + (spreadStart + 1) / 2;
    try { stripRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true }); } catch (e) { /* bande pas encore dessinée */ }
  }, [cur, book?.format]);
  // Maintenir − ou + : un pas tout de suite, puis ça défile (de 2 en 2) jusqu'au relâchement.
  const bookRef = useRef(book);
  bookRef.current = book;
  const holdTimers = useRef({ start: null, loop: null });
  const stepPages = (dir) => {
    const b = bookRef.current;
    if (!b) return;
    const f = clampPages(b.format + dir * pagesRange(b).step, b);
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
  if (!album) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} />;
  // Création : on choisit le format (présentation du layflat et des deux livres avec leurs prix), puis le livre est créé.
  if (!book) {
    return (
      <BookFormatChooser
        albumName={album.name}
        urls={albumIds.slice(0, 3).map((id) => urlById[id])}
        onBack={() => navigation.goBack()}
        onChoose={(product) => setBook(albumId, createBook({ ...album, photoIds: albumIds }, product))}
      />
    );
  };

  // Page « Format du livre » : mêmes cartes qu'à la création, pour changer de format (les photos et le titre sont gardés).
  if (chooser) {
    return (
      <BookFormatChooser
        albumName={album.name}
        urls={albumIds.slice(0, 3).map((id) => urlById[id])}
        current={book.product}
        pages={book.format}
        onBack={() => setChooser(false)}
        onChoose={(product) => { setBook(albumId, setProduct(book, product)); setChooser(false); }}
      />
    );
  }

  const save = (next) => setBook(albumId, next);
  const ratio = pageRatio(book);
  const landscape = isLandscape(book);
  const spec = bookSpec(book);
  const range = pagesRange(book);
  const price = bookPriceCents(book);
  // Change le nombre de pages et garde la page affichée valide.
  const changePages = (n) => {
    const f = clampPages(n, book);
    save(setFormat(book, f));
    if (cur >= f) setCur(f - 1);
  };
  const stats = bookStats(book, albumIds);
  const coverStyleKey = book.cover.style ?? "pleine";
  const hasCoverPhoto = !!book.cover.photoId && coverStyleKey !== "titre"; // le style « Titre seul » n'a pas de photo
  const titleManual = !!book.cover.titleXY;
  const titleOnPhoto = ["pleine", "cadre"].includes(coverStyleKey);        // les autres styles ont une zone de titre propre
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
  // (désactivé pendant le recadrage et quand le titre / la photo de la couverture est sélectionné : le doigt sert à les régler.)
  const swipe = Gesture.Pan().runOnJS(true).enabled(!coverEdit && !dblEdit && !dblSel && !(cur === COVER && sel)).activeOffsetX([-25, 25]).failOffsetY([-20, 20])
    .onEnd((e) => {
      if (e.translationX < -50 && canNext) goNext();
      else if (e.translationX > 50 && cur !== COVER) goPrev();
    });
  const spreadLabel = cur === COVER ? "Couverture"
    : leftIndex === -1 ? "Page 1"
    : leftIndex + 1 >= book.format ? `Page ${leftIndex + 1}` : `Pages ${leftIndex + 1}–${leftIndex + 2}`;

  // Double page affichée ? (la photo couvre les 2 pages face à face, voir DoublePage)
  const dl = leftIndex != null && leftIndex >= 1 && isDoubleLeft(book.pages[leftIndex]) ? leftIndex : null;
  const dblPage = dl != null ? book.pages[dl] : null;
  const dblPhoto = dblPage ? dblPage.slots[0] : null;
  const dblCrop = dblPhoto ? getCrop(dblPage, dblPhoto) : null;
  // « Double page » dans la mise en page : confirmation si des photos vont retourner dans l'album, puis choix de la photo.
  const onDouble = () => {
    if (isDoublePage(book.pages[cur])) { if (dl == null) setCur(spreadLeftOf(cur)); return; }
    if (!canDouble(book, cur)) {
      Alert.alert("Double page impossible ici", "La page 1 est seule face à l'intérieur de la couverture, et la dernière page est seule face à la fin du livre. Une double page se pose sur 2 pages face à face.");
      return;
    }
    const l = spreadLeftOf(cur);
    const n = [l, l + 1].reduce((t, i) => t + book.pages[i].slots.filter(Boolean).length, 0);
    const go = () => { save(setDouble(book, l)); setCur(l); setPicker({ page: l, slot: 0 }); };
    if (n === 0) go();
    else Alert.alert(
      "Passer ces 2 pages en double page ?",
      `${n} photo${n > 1 ? "s" : ""} actuelle${n > 1 ? "s" : ""} retourne${n > 1 ? "nt" : ""} dans l'album, rien n'est perdu. Tu choisis ensuite la photo qui s'étale sur les deux pages.`,
      [{ text: "Annuler", style: "cancel" }, { text: "Choisir la photo", onPress: go }]
    );
  };
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
      <ScrollView scrollEnabled={!coverEdit && !dragging && !dblEdit} contentContainerStyle={{ padding: S.pad, paddingTop: 8, paddingBottom: 40 }}>
        {/* En-tête : nom de l'album + icône « enregistré automatiquement » */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BackButton accentColor={C.album} onPress={() => navigation.goBack()} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 19, color: C.text, fontWeight: "600" }}>📕 {album.name}</Text>
          <TouchableOpacity accessibilityLabel="Enregistré automatiquement" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => Alert.alert("Enregistré automatiquement", "Tes modifications sont gardées au fur et à mesure, rien à faire.")}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}>
            <Icon name="check" size={18} color={C.album} />
          </TouchableOpacity>
        </View>

        {/* Format : on touche la carte pour changer de format (page « Format du livre ») ; les deux pastilles à droite
            passent d'un livre vertical à un livre horizontal. Le tarif est en gris dessous. */}
        <View style={{ marginTop: 14, backgroundColor: C.bgCard, borderRadius: 16, paddingVertical: 11, paddingLeft: 14, paddingRight: 12, flexDirection: "row", alignItems: "center", ...SHADOW }}>
          <TouchableOpacity onPress={() => setChooser(true)} activeOpacity={0.7} style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
            accessibilityLabel="Changer le format du livre">
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: "700", color: C.text }}>{book.format} pages · {spec.sizeLabel}</Text>
              <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                {spec.finishLabel}{price != null ? ` · ${formatEuro(price)} TTC, livraison comprise` : ""}
              </Text>
            </View>
            <Icon name="chevronRight" size={16} color={C.textMuted} />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", backgroundColor: C.bgMuted, borderRadius: 99, padding: 3, marginLeft: 10 }}>
            {BOOK_PRODUCT_KEYS.map((k) => {
              const on = book.product === k;
              const portrait = BOOK_PRODUCTS[k].orientation === "portrait";
              return (
                <TouchableOpacity key={k} onPress={() => save(setProduct(book, k))} accessibilityLabel={`${BOOK_PRODUCTS[k].label} ${BOOK_PRODUCTS[k].sizeLabel}`}
                  style={{ width: 40, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 99, backgroundColor: on ? C.album : "transparent" }}>
                  <View style={{ width: portrait ? 11 : 15, height: portrait ? 15 : 11, borderWidth: 2, borderRadius: 2, borderColor: on ? "#fff" : C.textMid }} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Remplissage : où en est l'album, nombre de pages, et « Compléter automatiquement » */}
        <View style={{ marginTop: 12, backgroundColor: C.bgCard, borderRadius: 14, padding: 12, ...SHADOW }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12.5, color: C.textMid }}>
              <Text style={{ fontWeight: "600", color: C.text }}>{stats.placedCount}</Text> / {stats.total} photos de l'album placées
            </Text>
            <Text style={{ fontSize: 12.5, color: left > 0 ? C.album : C.textMid, fontWeight: left > 0 ? "600" : "400" }}>
              {left > 0 ? `${left} à placer` : "Toutes placées ✓"}
            </Text>
          </View>
          <View style={{ height: 6, backgroundColor: C.bgMuted, borderRadius: 4, marginTop: 8, overflow: "hidden" }}>
            <View style={{ width: `${stats.total ? Math.round((stats.placedCount / stats.total) * 100) : 100}%`, height: "100%", backgroundColor: C.album, borderRadius: 4 }} />
          </View>
          {stats.emptyPages > 0 && (
            <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 7 }}>{stats.emptyPages} page{stats.emptyPages > 1 ? "s" : ""} encore vide{stats.emptyPages > 1 ? "s" : ""}</Text>
          )}

          {/* Nombre de pages : − 24 + (maintenir − ou + pour défiler vite, toucher le chiffre pour le saisir) */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <Text style={{ fontSize: 12.5, color: C.textMid }}>Nombre de pages</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <TouchableOpacity onPressIn={() => startHold(-1)} onPressOut={stopHold} disabled={book.format <= range.min}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center", opacity: book.format <= range.min ? 0.35 : 1 }}>
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
              </View>
              <TouchableOpacity onPressIn={() => startHold(1)} onPressOut={stopHold} disabled={book.format >= range.max}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center", opacity: book.format >= range.max ? 0.35 : 1 }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: C.album, lineHeight: 22 }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {left > 0 ? (
            <>
              <TouchableOpacity onPress={() => setCompleteOpen(!completeOpen)} activeOpacity={0.8}
                style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 11, borderTopWidth: 1, borderTopColor: C.border }}>
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: C.album }}>Compléter automatiquement</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.album }}>{completeOpen ? "▴" : "▾"}</Text>
              </TouchableOpacity>
              {completeOpen && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 6 }}>Ordre des {left} photo{left > 1 ? "s" : ""} restante{left > 1 ? "s" : ""} :</Text>
                  {COMPLETE_ORDERS.map((o) => {
                    const on = completeOrder === o.key;
                    return (
                      <TouchableOpacity key={o.key} onPress={() => setCompleteOrder(o.key)} activeOpacity={0.8}
                        style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
                        <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? C.album : C.border, alignItems: "center", justifyContent: "center" }}>
                          {on && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.album }} />}
                        </View>
                        <Text style={{ fontSize: 13.5, color: C.text }}>
                          <Text style={{ fontWeight: "600" }}>{o.label}</Text> · {o.hint}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {(() => {
                    // Ce que ça donnerait : pages ajoutées, prix, photos qui ne rentrent pas.
                    const next = completeBook(book, albumIds, { order: completeOrder, dates: dateById });
                    const added = next.format - book.format;
                    const rest = albumIds.length - bookStats(next, albumIds).placedCount;
                    return (
                      <>
                        <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 4, lineHeight: 16 }}>
                          {added > 0 ? `Ajoute ${added} page${added > 1 ? "s" : ""} : ${next.format} pages · ${formatEuro(bookPriceCents(next))} TTC.` : "Remplit les cadres vides, sans ajouter de pages."}
                          {rest > 0 ? ` ${rest} photo${rest > 1 ? "s" : ""} ne rentre${rest > 1 ? "nt" : ""} pas (maximum ${range.max} pages).` : ""}
                        </Text>
                        <TouchableOpacity onPress={() => { save(next); setCompleteOpen(false); }}
                          style={{ marginTop: 10, height: 44, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Compléter</Text>
                        </TouchableOpacity>
                      </>
                    );
                  })()}
                </View>
              )}
            </>
          ) : null}
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
            <BookCover cover={liveXY ? { ...book.cover, titleXY: liveXY } : book.cover}
              size={Math.round(pageW * (landscape ? 1.5 : 1.25))} ratio={ratio} urlById={urlById}
              onPress={coverEdit ? undefined : () => setSel(hasCoverPhoto && sel !== "photo" ? "photo" : null)}
              photoSelected={sel === "photo" && !coverEdit}
              onTitlePress={coverEdit ? undefined : () => setSel(sel === "title" ? null : "title")}
              titleSelected={sel === "title"} titleDraggable={sel === "title"}
              onTitleMove={setLiveXY} onTitleMoveEnd={(xy) => { setLiveXY(null); save(setCover(book, { titleXY: xy })); }}
              onTitleDrag={setDragging}
              editable={coverEdit} onCropChange={(c) => save(setCoverCrop(book, c))}
              cropPreview={coverEdit && liveTilt != null ? { tilt: liveTilt } : null} />
          ) : (
            <View style={{ flexDirection: "row", backgroundColor: "#ffffff", borderRadius: 6,
              shadowColor: "#3c3c28", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 14, elevation: 4 }}>
              {dl != null ? (
                <DoublePage url={dblPhoto ? urlById[dblPhoto] : null} size={pageW} ratio={ratio} crop={dblCrop ? { ...dblCrop, ...(dblEdit && liveTilt != null ? { tilt: liveTilt } : {}) } : undefined} seam
                  selected={(dblSel || dblEdit) && !!dblPhoto}
                  onPress={dblEdit ? undefined : () => { if (dblPhoto) setDblSel(!dblSel); else setPicker({ page: dl, slot: 0 }); }}
                  editable={dblEdit && !!dblPhoto}
                  onCropChange={(c) => save(setCrop(book, dl, dblPhoto, c))} />
              ) : (
                <>
                  {renderPage(leftIndex, pageW)}
                  {renderPage(leftIndex + 1, pageW)}
                </>
              )}
            </View>
          )}
        </View>
        </GestureDetector>

        <Text style={{ fontSize: 11.5, color: C.textMuted, textAlign: "center", marginTop: 10 }}>
          {cur === COVER
            ? (coverEdit ? "Pince pour zoomer · glisse pour déplacer"
              : sel === "title" && titleManual ? "Glisse le titre où tu veux sur la couverture"
              : sel ? "" : "Touche le titre ou la photo pour les modifier")
            : dl != null ? (dblEdit ? "Pince pour zoomer · glisse pour déplacer"
              : dblSel ? "" : dblPhoto ? "Touche la photo pour la modifier · glisse pour tourner la page" : "Touche le cadre pour choisir la photo")
            : "Touche une page pour l'ouvrir en grand · glisse pour tourner la page"}
        </Text>

        {/* DOUBLE PAGE : photo touchée → changer, recadrer ou séparer */}
        {cur !== COVER && dl != null && dblPhoto && dblSel && !dblEdit && (
          <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
            <ToolButton icon="⇄" label="Changer la photo" onPress={() => setPicker({ page: dl, slot: 0 })} />
            <ToolButton icon="✂" label="Recadrer" onPress={() => setDblEdit(true)} />
            <ToolButton icon="▥" label="Séparer en 2 pages" onPress={() => { save(clearDouble(book, dl)); setDblSel(false); }} />
          </View>
        )}
        {cur !== COVER && dl != null && !dblPhoto && (
          <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
            <ToolButton icon="＋" label="Choisir la photo" accent onPress={() => setPicker({ page: dl, slot: 0 })} />
            <ToolButton icon="▥" label="Séparer en 2 pages" onPress={() => save(clearDouble(book, dl))} />
          </View>
        )}
        {cur !== COVER && dl != null && dblPhoto && dblEdit && (
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <ToolButton icon="↺" label="Pivoter" onPress={() => save(setCrop(book, dl, dblPhoto, { rot: (dblCrop.rot + 270) % 360 }))} />
              <ToolButton icon="↻" label="Pivoter" onPress={() => save(setCrop(book, dl, dblPhoto, { rot: (dblCrop.rot + 90) % 360 }))} />
              <ToolButton icon="⌖" label="Recentrer" onPress={() => save(resetCrop(book, dl, dblPhoto))} />
              <ToolButton icon="✓" label="Terminé" accent onPress={() => { setDblEdit(false); setDblSel(false); setLiveTilt(null); }} />
            </View>
            <Text style={sectionStyle}>REDRESSER</Text>
            <View style={{ backgroundColor: C.bgCard, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, ...SHADOW }}>
              <TiltSlider
                value={liveTilt ?? dblCrop.tilt}
                onChange={setLiveTilt}
                onEnd={(v) => { save(setCrop(book, dl, dblPhoto, { tilt: v })); setLiveTilt(null); }}
              />
            </View>
          </View>
        )}

        {/* COUVERTURE : les outils dépendent de ce que l'utilisateur a touché (la photo ou le titre). */}
        {cur === COVER && (
          <>
            {/* Pas de titre → on peut en ajouter un */}
            {!book.cover.title && sel !== "title" && !coverEdit && (
              <TouchableOpacity onPress={() => setSel("title")}
                style={{ marginTop: 12, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 99, backgroundColor: C.albumSoft }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.album }}>＋ Ajouter un titre</Text>
              </TouchableOpacity>
            )}

            {/* Photo touchée : changer ou recadrer */}
            {sel === "photo" && hasCoverPhoto && !coverEdit && (
              <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
                <ToolButton icon="⇄" label="Changer la photo" onPress={() => setPicker("cover")} />
                <ToolButton icon="✂" label="Recadrer" onPress={() => setCoverEdit(true)} />
              </View>
            )}

            {/* Recadrage de la photo de couverture (comme sur les pages) */}
            {coverEdit && hasCoverPhoto && (
              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <ToolButton icon="↺" label="Pivoter" onPress={() => save(setCoverCrop(book, { rot: (getCoverCrop(book.cover).rot + 270) % 360 }))} />
                  <ToolButton icon="↻" label="Pivoter" onPress={() => save(setCoverCrop(book, { rot: (getCoverCrop(book.cover).rot + 90) % 360 }))} />
                  <ToolButton icon="⌖" label="Recentrer" onPress={() => save(resetCoverCrop(book))} />
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
            )}

            {/* Titre touché : texte, police, taille, couleur, position (automatique ou manuelle) */}
            {sel === "title" && !coverEdit && (
              <View style={{ marginTop: 12, backgroundColor: C.bgCard, borderRadius: 16, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2, ...SHADOW }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: C.textMuted }}>TITRE</Text>
                  <TouchableOpacity onPress={() => setSel(null)} hitSlop={{ top: 8, bottom: 8, left: 12, right: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: C.album }}>Terminé ✓</Text>
                  </TouchableOpacity>
                </View>
                <EditRow label="Texte">
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
                <EditRow label="Position" last={!(!titleManual && titleOnPhoto)}>
                  <Chip on={!titleManual} onPress={() => save(setCover(book, { titleXY: undefined }))}>Auto</Chip>
                  <Chip on={titleManual} onPress={() => save(setCover(book, { titleXY: book.cover.titleXY ?? autoTitleXY(book.cover) }))}>Manuelle</Chip>
                </EditRow>
                {/* Auto : haut / milieu / bas, seulement si le titre est posé sur la photo (les autres styles ont leur zone de titre). */}
                {!titleManual && titleOnPhoto && (
                  <EditRow label="Place" last>
                    {COVER_POS.map((k) => <Chip key={k} on={book.cover.pos === k} onPress={() => save(setCover(book, { pos: k }))}>{COVER_STYLE.pos[k].label}</Chip>)}
                  </EditRow>
                )}
                {titleManual && (
                  <Text style={{ fontSize: 11.5, color: C.textMuted, paddingBottom: 10 }}>Glisse le titre directement sur la couverture.</Text>
                )}
              </View>
            )}

            {/* Style de couverture : toujours affiché */}
            <Text style={sectionStyle}>STYLE DE COUVERTURE</Text>
            <View style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 12, ...SHADOW }}>
              {/* Le style actuel : on le touche pour voir tous les styles */}
              <TouchableOpacity onPress={() => setStyleOpen(!styleOpen)} activeOpacity={0.8}
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <BookCover cover={{ ...book.cover, title: book.cover.title || "Titre", titleXY: undefined }} size={34} ratio={ratio} urlById={urlById} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>
                    {COVER_STYLES.find((st) => st.key === coverStyleKey)?.label}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: C.textMuted }}>{COVER_STYLES.length} styles disponibles</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.album }}>{styleOpen ? "Fermer ▴" : "Changer ▾"}</Text>
              </TouchableOpacity>
              {styleOpen && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
                  {COVER_STYLES.map((st) => {
                    const on = coverStyleKey === st.key;
                    const tileW = Math.floor((width - S.pad * 2 - 24 - 20) / 3);
                    return (
                      <TouchableOpacity key={st.key} onPress={() => {
                        save(setCoverStyle(book, st.key));
                        setStyleOpen(false);
                        setSel(null);
                        // Un style qui montre la couleur de fond → on la propose tout de suite.
                        if (st.key !== coverStyleKey && styleNeedsBg(st.key)) setBgOpen(true);
                      }} style={{ width: tileW, alignItems: "center" }}>
                        <View style={{ padding: 3, borderRadius: 8, borderWidth: 2.5, borderColor: on ? C.album : "transparent" }}>
                          <BookCover cover={{ ...book.cover, style: st.key, title: book.cover.title || "Titre", titleXY: undefined }} size={tileW - 14} ratio={ratio} urlById={urlById} />
                        </View>
                        <Text style={{ fontSize: 11.5, marginTop: 4, fontWeight: on ? "700" : "500", color: on ? C.album : C.textMid }}>{st.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Couleur de fond : seulement pour les styles où le fond se voit (voir COVER_STYLES_WITH_BG dans photoBook.js) */}
            {styleNeedsBg(coverStyleKey) && (
              <>
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
                      <Text style={{ fontSize: 11.5, color: C.textMuted }}>Sert aussi au dos du livre</Text>
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
              </>
            )}
          </>
        )}

        {/* Mise en page de la page sélectionnée */}
        {cur !== COVER && (
          <>
            <Text style={sectionStyle}>{isDoublePage(book.pages[cur]) ? `MISE EN PAGE · PAGES ${spreadLeftOf(cur) + 1}–${spreadLeftOf(cur) + 2}` : `MISE EN PAGE · PAGE ${cur + 1}`}</Text>
            <LayoutPicker value={isDoublePage(book.pages[cur]) ? null : book.pages[cur].layout} landscape={landscape}
              onChange={(n) => save(setLayout(book, cur, n))}
              onDouble={onDouble} doubleState={isDoublePage(book.pages[cur]) ? "on" : canDouble(book, cur) ? "off" : "disabled"} />
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
              {item.ps.length === 2 && isDoubleLeft(book.pages[item.ps[0]])
                ? <DoublePage size={landscape ? 34 : 26} ratio={ratio} url={book.pages[item.ps[0]].slots[0] ? urlById[book.pages[item.ps[0]].slots[0]] : null}
                    crop={book.pages[item.ps[0]].slots[0] ? getCrop(book.pages[item.ps[0]], book.pages[item.ps[0]].slots[0]) : undefined} />
                : item.ps.map((pi) => <BookPage key={pi} page={book.pages[pi]} size={landscape ? 34 : 26} ratio={ratio} urlById={urlById} coverFont={book.cover.font} />)}
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
        subtitle={picker === "cover" ? "couverture" : picker ? (book.pages[picker.page]?.double ? `double page ${picker.page + 1}–${picker.page + 2}` : `page ${picker.page + 1}`) : ""}
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
