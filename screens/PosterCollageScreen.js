// screens/PosterCollageScreen.js
// « Compose ton poster » : plusieurs photos sur UN poster (maquette `maquette-poster-pele-mele.html`, écran 2).
//   · aperçu du poster ; toucher une photo = la recadrer (glisser / pincer / − ＋) ou la retirer ;
//   · STYLE (Grille · Mosaïque · Pêle-mêle) · FOND (6 couleurs) · TITRE facultatif · « Mélanger la disposition » ;
//   · « Continuer » → écran du format (`PosterFormat` avec route.params.collage), qui calcule la qualité sur la plus petite photo.
// Le fichier d'impression n'est pas encore fabriqué (commande en standby) : voir services/posterCollage.js.

import { useState, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, TextInput, Modal, StatusBar, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Svg, { Rect, G } from "react-native-svg";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import CollagePoster from "../components/poster/CollagePoster";
import { CroppedImage } from "../components/book/CroppedImage";
import { useBookFonts } from "../components/book/bookFonts";
import { SHADOW } from "../components/home/ui";
import { C, FONT } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { DEFAULT_CROP, MAX_ZOOM, COVER_FONTS } from "../services/photoBook";
import { COVER_STYLE } from "../components/book/BookPage";
import {
  COLLAGE_STYLES, COLLAGE_BGS, COLLAGE_RATIO, COLLAGE_MIN, DEFAULT_COLLAGE_STYLE, DEFAULT_COLLAGE_BG,
  collageLayout, collagePhotoOrder, cellPhotoRect,
} from "../services/posterCollage";

const ZOOM_STEP = 0.25;

// Petite icône de chaque style (dans la pastille).
function StyleIcon({ kind, color }) {
  return (
    <Svg width={34} height={34} viewBox="0 0 34 34">
      <G fill={color}>
        {kind === "grille" && (<>
          <Rect x="2" y="2" width="14" height="14" /><Rect x="18" y="2" width="14" height="14" />
          <Rect x="2" y="18" width="14" height="14" /><Rect x="18" y="18" width="14" height="14" />
        </>)}
        {kind === "mosaique" && (<>
          <Rect x="2" y="2" width="30" height="14" /><Rect x="2" y="18" width="9" height="14" />
          <Rect x="13" y="18" width="9" height="14" /><Rect x="24" y="18" width="8" height="14" />
        </>)}
        {kind === "pelemele" && (<>
          <Rect x="3" y="4" width="13" height="15" transform="rotate(-8 9 11)" />
          <Rect x="17" y="3" width="13" height="15" transform="rotate(7 24 10)" />
          <Rect x="9" y="17" width="15" height="15" transform="rotate(-3 16 24)" />
        </>)}
      </G>
    </Svg>
  );
}

export function PosterCollageScreen({ navigation, route }) {
  useBookFonts(); // police du titre (Caveat)
  const { width: SW, height: SH } = useWindowDimensions();
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const kept = usePhotoStore((s) => s.kept);

  const [ids, setIds] = useState(route.params?.photoIds ?? []);
  const [style, setStyle] = useState(DEFAULT_COLLAGE_STYLE);
  const [bg, setBg] = useState(DEFAULT_COLLAGE_BG);
  const [seed, setSeed] = useState(0);
  const [title, setTitle] = useState("");
  const [titleFont, setTitleFont] = useState("manuscrite"); // mêmes polices que le titre de couverture du livre
  const [crops, setCrops] = useState({});          // { [photoId]: { scale, x, y } }
  const [editIndex, setEditIndex] = useState(null); // case en cours de recadrage
  const [draft, setDraft] = useState(DEFAULT_CROP);

  const photos = useMemo(() => {
    const byId = new Map([...kept, ...libraryPhotos].map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }, [ids, libraryPhotos, kept]);

  const n = photos.length;
  const hasTitle = title.trim().length > 0;
  const cells = useMemo(() => (n >= COLLAGE_MIN ? collageLayout(style, n, { seed, hasTitle }) : []), [style, n, seed, hasTitle]);
  const order = useMemo(() => collagePhotoOrder(n, seed), [n, seed]);

  // Taille de l'aperçu : le plus grand poster qui tient.
  const maxH = Math.min(380, SH * 0.42);
  const previewW = Math.min(SW - 80, maxH / COLLAGE_RATIO);

  // ── Recadrage d'une photo ──
  const editPhoto = editIndex != null ? photos[order[editIndex]] : null;
  const editRect = editIndex != null ? cellPhotoRect(cells[editIndex]) : null;
  const openEdit = (i) => { setDraft({ ...DEFAULT_CROP, ...crops[photos[order[i]].id] }); setEditIndex(i); };
  const saveEdit = () => {
    if (editPhoto) setCrops((c) => ({ ...c, [editPhoto.id]: { scale: draft.scale, x: draft.x, y: draft.y } }));
    setEditIndex(null);
  };
  const removeEdit = () => {
    if (editPhoto && n > COLLAGE_MIN) setIds((l) => l.filter((id) => id !== editPhoto.id));
    setEditIndex(null);
  };
  const zoomDraft = (d) => setDraft((c) => {
    const scale = Math.min(MAX_ZOOM, Math.max(1, Math.round((c.scale + d) * 100) / 100));
    return d < 0 ? { ...c, scale, x: 0, y: 0 } : { ...c, scale };
  });
  const modalW = SW - 56;
  const modalMaxH = SH * 0.42;
  const cropW = editRect ? Math.min(modalW - 32, (modalMaxH * editRect.w) / editRect.h) : 0;
  const cropH = editRect ? cropW * (editRect.h / editRect.w) : 0;

  const small = (label, onPress, disabled) => (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}
      style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.bgCard, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1, ...SHADOW }}>
      <Text style={{ fontSize: 20, lineHeight: 22, color: C.album, fontWeight: "700" }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 130 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BackButton onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>Compose ton poster</Text>
            <Text style={{ fontSize: 12, color: C.textMuted }}>{`${n} photo${n > 1 ? "s" : ""}`}</Text>
          </View>
        </View>

        {/* Aperçu */}
        <View style={{ alignItems: "center", marginTop: 14, paddingVertical: 16, borderRadius: 20, backgroundColor: C.bgMuted }}>
          {n >= COLLAGE_MIN && (
            <CollagePoster width={previewW} photos={photos} cells={cells} order={order} crops={crops} bg={bg} title={title} titleFont={titleFont} onCellPress={openEdit} />
          )}
          <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 12 }}>Touche une photo pour la recadrer ou la retirer</Text>
        </View>

        {/* Style */}
        <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: C.textMuted, marginTop: 18, marginBottom: 8 }}>STYLE</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {COLLAGE_STYLES.map((st) => {
            const on = st.key === style;
            return (
              <TouchableOpacity key={st.key} activeOpacity={0.85} onPress={() => setStyle(st.key)}
                style={[{ flex: 1, alignItems: "center", backgroundColor: on ? "#fbf3ee" : C.bgCard, borderRadius: 14, paddingVertical: 9, borderWidth: 1.5, borderColor: on ? C.album : "transparent" }, SHADOW]}>
                <StyleIcon kind={st.key} color={on ? C.album : "#cbb9a8"} />
                <Text style={{ fontSize: 11.5, fontWeight: "600", color: on ? C.text : C.textMid, marginTop: 3 }}>{st.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Fond */}
        <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: C.textMuted, marginTop: 18, marginBottom: 8 }}>FOND</Text>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingLeft: 2 }}>
          {COLLAGE_BGS.map((b) => (
            <TouchableOpacity key={b.key} onPress={() => setBg(b.key)} activeOpacity={0.8} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: b.color, borderWidth: 1.5, borderColor: C.border, ...(bg === b.key ? { borderColor: C.album, borderWidth: 3 } : {}) }} />
          ))}
        </View>

        {/* Titre */}
        <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: C.textMuted, marginTop: 18, marginBottom: 8 }}>TITRE (FACULTATIF)</Text>
        <TextInput value={title} onChangeText={setTitle} maxLength={28} placeholder="Été 2026" placeholderTextColor={C.textMuted}
          style={{ backgroundColor: C.bgCard, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14.5, color: C.text, fontFamily: FONT }} />

        {hasTitle && (
          <View style={[{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.bgCard, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 }, SHADOW]}>
            <Text style={{ width: 52, fontSize: 13, color: C.text, fontWeight: "500" }}>Police</Text>
            <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 5 }}>
              {COVER_FONTS.map((k) => {
                const f = COVER_STYLE.font[k];
                const on = titleFont === k;
                return (
                  <TouchableOpacity key={k} onPress={() => setTitleFont(k)} activeOpacity={0.8}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: on ? C.album : C.bgMuted }}>
                    <Text style={{ fontSize: 13, color: on ? "#fff" : C.textMid, fontFamily: f.family, fontWeight: f.weight }}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Mélanger */}
        <TouchableOpacity onPress={() => setSeed((v) => v + 1)} activeOpacity={0.8} style={{ alignSelf: "flex-start", marginTop: 16, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 16, color: C.album }}>↻</Text>
          <Text style={{ fontSize: 13, fontWeight: "600", color: C.album }}>Mélanger la disposition</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 26, borderTopWidth: 1, borderTopColor: C.border }}>
        <TouchableOpacity activeOpacity={0.85} disabled={n < COLLAGE_MIN}
          onPress={() => navigation.navigate("PosterFormat", { collage: { photoIds: ids, style, bg, seed, title: title.trim(), titleFont, crops } })}
          style={[{ height: 50, borderRadius: 25, backgroundColor: n >= COLLAGE_MIN ? C.album : C.border, alignItems: "center", justifyContent: "center" }, n >= COLLAGE_MIN && SHADOW]}>
          <Text style={{ color: n >= COLLAGE_MIN ? "#fff" : C.textMuted, fontSize: 15, fontWeight: "700" }}>Continuer</Text>
        </TouchableOpacity>
      </View>

      {/* Recadrer une photo (les gestes dans un Modal Android demandent leur propre racine) */}
      <Modal visible={editIndex != null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setEditIndex(null)}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(35,39,31,0.55)", alignItems: "center", justifyContent: "center", padding: 28 }}>
            <View style={{ width: modalW, backgroundColor: C.bg, borderRadius: 22, padding: 16, alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: C.text, alignSelf: "flex-start" }}>Recadre cette photo</Text>
              {editPhoto && (
                <View style={{ width: cropW, height: cropH, marginTop: 12, overflow: "hidden", backgroundColor: C.bgMuted }}>
                  <CroppedImage url={editPhoto.url} crop={draft} editable onChange={(p) => setDraft((c) => ({ ...c, ...p }))} />
                </View>
              )}
              <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 10 }}>Glisse pour déplacer · pince pour zoomer</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 }}>
                {small("−", () => zoomDraft(-ZOOM_STEP), draft.scale <= 1)}
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.text, minWidth: 40, textAlign: "center" }}>{`${Math.round(draft.scale * 100)} %`}</Text>
                {small("＋", () => zoomDraft(ZOOM_STEP), draft.scale >= MAX_ZOOM)}
                <TouchableOpacity onPress={() => setDraft(DEFAULT_CROP)} activeOpacity={0.8} style={{ marginLeft: 6 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: "600", color: C.album }}>⌖ Recentrer</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16, alignSelf: "stretch" }}>
                <TouchableOpacity onPress={removeEdit} disabled={n <= COLLAGE_MIN} activeOpacity={0.8}
                  style={{ flex: 1, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center", opacity: n <= COLLAGE_MIN ? 0.4 : 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: "600", color: C.red }}>Retirer</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveEdit} activeOpacity={0.85}
                  style={{ flex: 1.4, height: 44, borderRadius: 22, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </SafeAreaView>
  );
}
