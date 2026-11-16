// screens/BookPageEditorScreen.js
// Une page du livre photo, en grand. Ouvert depuis l'aperçu :
// navigation.navigate("BookPageEditor", { albumId, pageIndex }).
// Onglet Page  : mise en page (1 à 4 photos) + titre de page.
// Onglet Photo : la photo touchée → recadrer (pincer / glisser), pivoter, redresser, changer, retirer.

import { useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity, TextInput, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { BookPage, COVER_STYLE } from "../components/book/BookPage";
import PhotoPickerSheet from "../components/book/PhotoPickerSheet";
import { useBookFonts } from "../components/book/bookFonts";
import { EditRow, Chip, NavArrow, LayoutPicker, sectionStyle } from "../components/book/BookControls";
import { TiltSlider } from "../components/book/TiltSlider";
import { SHADOW } from "../components/home/ui";
import { C, S, FONT } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import {
  setLayout, setPeleCount, setPelePositions, PELE_LAYOUT, setPageTitle, placePhoto, clearSlot, placedMap, getCrop, setCrop, resetCrop,
  COVER_FONTS, PAGE_TITLE_POS, PAGE_TITLE_SIZES, pageRatio, isLandscape, layoutRows, doubleLeftIndex,
} from "../services/photoBook";

const POS_LABEL = { haut: "Haut", milieu: "Milieu", bas: "Bas" };

export function BookPageEditorScreen({ navigation, route }) {
  const albumId = route?.params?.albumId;
  const album   = usePhotoStore((s) => s.albums.find((a) => a.id === albumId));
  const printed = usePhotoStore((s) => s.printed);
  const book    = usePhotoStore((s) => s.books[albumId]);
  const setBook = usePhotoStore((s) => s.setBook);
  const { width } = useWindowDimensions();
  useBookFonts();

  const urlById  = useMemo(() => Object.fromEntries(printed.map((p) => [p.id, p.url])), [printed]);
  const albumIds = useMemo(() => (album ? album.photoIds.filter((id) => urlById[id]) : []), [album, urlById]);

  const [pi, setPi]           = useState(route?.params?.pageIndex ?? 0); // page affichée
  const [tab, setTab]         = useState("page");                          // "page" | "photo"
  const [selSlot, setSelSlot] = useState(null);                            // cadre sélectionné
  const [picker, setPicker]   = useState(null);                            // cadre pour lequel on choisit une photo
  const [liveTilt, setLiveTilt] = useState(null);                          // redressement pendant le glissé du curseur

  if (!album || !book || !book.pages[pi]) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} />;

  // Une page qui fait partie d'une double page ne se règle pas ici : la photo couvre 2 pages (voir l'aperçu du livre).
  if (book.pages[pi].double) {
    const l = doubleLeftIndex(book, pi);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ padding: S.pad, paddingTop: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <BackButton accentColor={C.album} onPress={() => navigation.goBack()} />
            <Text style={{ flex: 1, fontSize: 19, color: C.text, fontWeight: "600" }}>Pages {l + 1}–{l + 2}</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <NavArrow label="‹" disabled={pi === 0} onPress={() => setPi(pi - 1)} />
              <NavArrow label="›" disabled={pi >= book.format - 1} onPress={() => setPi(pi + 1)} />
            </View>
          </View>
          <Text style={{ fontSize: 14, color: C.textMid, lineHeight: 20, marginTop: 24 }}>
            Ces deux pages forment une double page : une seule photo les couvre. Retourne à l'aperçu du livre pour la changer, la recadrer ou la séparer.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const save  = (next) => setBook(albumId, next);
  const landscape = isLandscape(book);
  const page  = book.pages[pi];
  const title = page.title ?? { text: "", pos: "bas", size: "M" };
  const titleFont = title.font ?? book.cover.font; // par défaut : la police de la couverture
  const selId = selSlot != null ? page.slots[selSlot] : null;

  const crop  = selId ? getCrop(page, selId) : null;
  const isPele = page.layout === PELE_LAYOUT;
  const tabE = tab === "placer" && !isPele ? "page" : tab;   // l'onglet « Placer » n'existe qu'en pêle-mêle
  const moving = tabE === "placer";                           // les tirages se déplacent au doigt
  const editing = tabE === "photo" && !!selId; // une photo est en cours de recadrage
  const saveCrop = (patch) => save(setCrop(book, pi, selId, patch));

  const goTo = (next) => { setPi(next); setSelSlot(null); setTab("page"); };
  // Glisser vers la gauche = page suivante, vers la droite = précédente.
  // Coupé pendant le recadrage d'une photo : le glissé sert alors à la déplacer.
  const swipe = Gesture.Pan().runOnJS(true).enabled(!editing && !moving).activeOffsetX([-25, 25]).failOffsetY([-20, 20])
    .onEnd((e) => {
      if (e.translationX < -50 && pi < book.format - 1) goTo(pi + 1);
      else if (e.translationX > 50 && pi > 0) goTo(pi - 1);
    });
  const onSlotPress = (si) => {
    if (!page.slots[si]) { setPicker(si); return; }   // cadre vide → choisir une photo
    setSelSlot(si); setTab("photo");                    // cadre rempli → on le sélectionne
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView scrollEnabled={!editing && !moving} contentContainerStyle={{ padding: S.pad, paddingTop: 8, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* En-tête */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BackButton accentColor={C.album} onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 11.5, color: C.textMuted, fontWeight: "500" }}>📕 {album.name}</Text>
            <Text style={{ fontSize: 19, color: C.text, fontWeight: "600" }}>Page {pi + 1}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <NavArrow label="‹" disabled={pi === 0} onPress={() => goTo(pi - 1)} />
            <NavArrow label="›" disabled={pi >= book.format - 1} onPress={() => goTo(pi + 1)} />
          </View>
        </View>

        {/* La page en grand — glisser vers la gauche / la droite change de page (désactivé pendant le recadrage) */}
        <GestureDetector gesture={swipe}>
        <View style={{ marginTop: 14, borderRadius: 6, backgroundColor: "#fff", alignSelf: "center",
          shadowColor: "#3c3c28", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 14, elevation: 4 }}>
          <BookPage page={page} size={landscape ? width - S.pad * 2 : Math.min(width - S.pad * 2, 300)} ratio={pageRatio(book)}
            urlById={urlById} coverFont={book.cover.font}
            onSlotPress={moving ? undefined : onSlotPress} selectedSlot={tabE === "photo" ? selSlot : null}
            moveMode={moving} onPelePlace={(positions) => save(setPelePositions(book, pi, positions))}
            editableSlot={editing ? selSlot : null}
            onCropChange={(si, c) => save(setCrop(book, pi, page.slots[si], c))}
            cropPreview={editing && liveTilt != null ? { slot: selSlot, tilt: liveTilt } : null} />
        </View>
        </GestureDetector>
        <Text style={{ fontSize: 11.5, color: C.textMuted, textAlign: "center", marginTop: 10 }}>
          {editing ? "Pince pour zoomer · glisse pour déplacer" : moving ? "Glisse un tirage pour le déplacer" : "Touche une photo pour la modifier · glisse pour tourner la page"}
        </Text>

        {/* Onglets */}
        <View style={{ flexDirection: "row", backgroundColor: C.bgMuted, borderRadius: 14, padding: 4, marginTop: 14 }}>
          {[["page", "Page"], ["photo", "Photo"], ...(isPele ? [["placer", "Placer"]] : [])].map(([k, label]) => (
            <TouchableOpacity key={k} onPress={() => { setTab(k); if (k === "placer") setSelSlot(null); }}
              style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, backgroundColor: tabE === k ? C.bgCard : "transparent" }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: tabE === k ? C.text : C.textMuted }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tabE === "placer" ? (
          <>
            <Text style={sectionStyle}>PLACER LES TIRAGES</Text>
            <View style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 14, ...SHADOW }}>
              <Text style={{ fontSize: 13.5, color: C.text, lineHeight: 20 }}>
                Glisse un tirage où tu veux sur la page. Il ne peut jamais en recouvrir un autre : il les contourne.
              </Text>
              <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 17, marginTop: 8 }}>
                Les tirages restent dans la marge de la page : rien n'est coupé à l'impression.
              </Text>
            </View>
            <TouchableOpacity disabled={!page.pos} onPress={() => save(setPelePositions(book, pi, null))}
              style={{ marginTop: 12, height: 46, borderRadius: S.radiusFull, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center", opacity: page.pos ? 1 : 0.4 }}>
              <Text style={{ color: C.textMid, fontWeight: "700", fontSize: 14 }}>Remettre en ordre</Text>
            </TouchableOpacity>
          </>
        ) : tabE === "page" ? (
          <>
            <Text style={sectionStyle}>MISE EN PAGE</Text>
            <LayoutPicker value={page.layout} landscape={landscape} onChange={(n) => { save(setLayout(book, pi, n)); setSelSlot(null); }}
              peleCount={page.slots.length} onPeleCount={(n) => { save(setPeleCount(book, pi, n)); setSelSlot(null); }} />

            <Text style={sectionStyle}>TITRE DE LA PAGE</Text>
            <View style={{ backgroundColor: C.bgCard, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 2, ...SHADOW }}>
              <EditRow label="Texte">
                <TextInput
                  value={title.text}
                  onChangeText={(text) => save(setPageTitle(book, pi, { text }))}
                  maxLength={50}
                  placeholder="Ajouter un titre (facultatif)"
                  placeholderTextColor={C.textMuted}
                  style={{ flex: 1, backgroundColor: C.bgMuted, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontFamily: FONT, fontSize: 14, color: C.text }}
                />
              </EditRow>
              <EditRow label="Position">
                {PAGE_TITLE_POS.map((k) => (
                  <Chip key={k} on={title.pos === k} disabled={k === "milieu" && layoutRows(page.layout, landscape) < 2}
                    onPress={() => save(setPageTitle(book, pi, { pos: k }))}>{POS_LABEL[k]}</Chip>
                ))}
              </EditRow>
              <EditRow label="Police">
                {COVER_FONTS.map((k) => {
                  const f = COVER_STYLE.font[k];
                  return <Chip key={k} on={titleFont === k} onPress={() => save(setPageTitle(book, pi, { font: k }))}
                    textStyle={{ fontFamily: f.family, fontWeight: f.weight }}>{f.label}</Chip>;
                })}
              </EditRow>
              <EditRow label="Taille" last>
                {PAGE_TITLE_SIZES.map((k) => (
                  <Chip key={k} on={title.size === k} onPress={() => save(setPageTitle(book, pi, { size: k }))}>{k}</Chip>
                ))}
              </EditRow>
            </View>
            {layoutRows(page.layout, landscape) < 2 && (
              <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 8 }}>« Milieu » place le titre entre deux lignes de photos.</Text>
            )}
          </>
        ) : !selId ? (
          <View style={{ marginTop: 16, backgroundColor: C.bgCard, borderRadius: 14, padding: 16, alignItems: "center", ...SHADOW }}>
            <Text style={{ fontSize: 13, color: C.textMuted, textAlign: "center" }}>Touche une photo de la page pour la modifier.</Text>
          </View>
        ) : (
          <>
            <Text style={sectionStyle}>PHOTO SÉLECTIONNÉE</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Tool icon="↺" label="Pivoter" onPress={() => saveCrop({ rot: (crop.rot + 270) % 360 })} />
              <Tool icon="↻" label="Pivoter" onPress={() => saveCrop({ rot: (crop.rot + 90) % 360 })} />
              <Tool icon="⌖" label="Recentrer" onPress={() => save(resetCrop(book, pi, selId))} />
              <Tool icon="⇄" label="Changer" onPress={() => setPicker(selSlot)} />
              <Tool icon="✕" label="Retirer" danger onPress={() => { save(clearSlot(book, pi, selSlot)); setSelSlot(null); }} />
            </View>
            <Text style={sectionStyle}>REDRESSER</Text>
            <View style={{ backgroundColor: C.bgCard, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, ...SHADOW }}>
              <TiltSlider
                value={liveTilt ?? crop.tilt}
                onChange={setLiveTilt}
                onEnd={(v) => { saveCrop({ tilt: v }); setLiveTilt(null); }}
              />
            </View>
          </>
        )}
      </ScrollView>

      {/* Bouton fixe en bas : les changements sont déjà enregistrés, « Valider » ferme juste la page */}
      <View style={{ paddingHorizontal: S.pad, paddingTop: 10, paddingBottom: 12, backgroundColor: C.bg }}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85}
          style={{ backgroundColor: C.album, borderRadius: 16, paddingVertical: 15, alignItems: "center" }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Valider</Text>
        </TouchableOpacity>
      </View>

      <PhotoPickerSheet
        visible={picker != null}
        onClose={() => setPicker(null)}
        subtitle={`page ${pi + 1}`}
        albumIds={albumIds}
        urlById={urlById}
        placed={placedMap(book)}
        currentId={picker != null ? page.slots[picker] : null}
        onPick={(id) => { save(placePhoto(book, pi, picker, id)); setSelSlot(picker); setPicker(null); }}
        onRemove={null}
      />
    </SafeAreaView>
  );
}

function Tool({ icon, label, danger, onPress }) {
  return (
    <TouchableOpacity onPress={onPress}
      style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: C.bgCard, ...SHADOW }}>
      <Text style={{ fontSize: 19, color: danger ? C.album : C.text }}>{icon}</Text>
      <Text style={{ fontSize: 11.5, marginTop: 2, color: danger ? C.album : C.text, fontWeight: "500" }}>{label}</Text>
    </TouchableOpacity>
  );
}
