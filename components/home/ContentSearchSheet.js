// components/home/ContentSearchSheet.js
// Feuille « Chercher dans tes photos » (mode Album) — maquette recherche-flou, partie 1, écran B :
// on écrit « l'été 2026 à la plage », l'app montre ce qu'elle a compris (période + contenu),
// le nombre de photos trouvées, puis « Valider ce filtre ».
//
// RIEN n'est appliqué avant que l'utilisateur appuie sur un bouton. Chaque idée comprise a une case :
// décochée, elle est ignorée (c'est lui qui valide). Règle de combinaison : le LIEU (pays ou ville : « Maroc », « Marrakech », d'après le GPS de la photo)
// et la PÉRIODE (une année…) sont des filtres ; les sujets (plage, enfants, saison citée à part…) se cumulent en
// « l'un OU l'autre » à l'intérieur.
//
// La feuille ne touche pas aux filtres elle-même : elle prévient l'accueil via onApply(...).
import { useState, useMemo, useEffect } from "react";
import {
  View, TouchableOpacity, Modal, ScrollView, TextInput, Keyboard, Platform, ActivityIndicator, useWindowDimensions,
} from "react-native";
import Text from "../AppText";
import Icon from "../Icons";
import { C } from "../../constants/theme";
import { usePhotoStore } from "../../store/usePhotoStore";
import { useBlurStore } from "../../store/useBlurStore";
import { parseQuery } from "../../services/searchParser";
import { searchContent } from "../../services/contentSearch";
import { isWhatsAppPhoto } from "../../services/blurDetection";

const EXAMPLES = ["Maroc", "Marrakech 2025, plage", "Maroc 2025, plage, famille", "2026, voyage, enfants, coucher de soleil", "Noël 2025", "mon chien", "montagne cet hiver", "bébé, anniversaire", "feu d'artifice", "piscine l'été dernier"];

const frNum = (n) => n.toLocaleString("fr-FR");

/** Première lettre en majuscule (« été 2026 » → « Été 2026 »). */
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * @param visible, onClose
 * @param initialQuery   texte à pré-remplir (ex. la recherche déjà appliquée)
 * @param color          couleur du mode (album)
 * @param onApply        ({ query, parsed, dateIds, contentIds, placeIds, dateLabel, contentLabel, placeLabel }, create: boolean) => void
 *                       create = true : « Créer un album » (filtres appliqués + tri lancé tout de suite)
 * @param pickMode       true : un seul bouton « Voir ces photos » (appelle onApply(..., false)). Utilisé par le choix
 *                       d'une photo de poster, où il n'y a pas d'album à créer.
 */
export default function ContentSearchSheet({ visible, onClose, initialQuery = "", color = C.album, onApply, pickMode = false }) {
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const deleted = usePhotoStore((s) => s.deleted);
  const geoPhotos = usePhotoStore((s) => s.geoPhotos);
  const geoScanStatus = usePhotoStore((s) => s.geoScanStatus);
  const geoScanProgress = usePhotoStore((s) => s.geoScanProgress);
  const { scores, rev, whatsapp, labelsStatus, labelsTotal, labelsDone } = useBlurStore();
  const [query, setQuery] = useState(initialQuery);
  const [modeOverride, setModeOverride] = useState(null); // null = comme la phrase ; "and" | "or" = choix de l'utilisateur
  const [off, setOff] = useState(() => new Set());        // idées décochées par l'utilisateur ("period" = la période)
  const toggle = (id) => setOff((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // À chaque ouverture : on repart de la recherche déjà appliquée (ou d'un champ vide).
  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
      setModeOverride(null);
      setOff(new Set());
    }
  }, [visible, initialQuery]);

  // Hauteur du clavier : la feuille monte AU-DESSUS du clavier (sinon il cache le champ de recherche).
  // La fenêtre est « translucide » (voir <Modal> plus bas) : Android ne la redimensionne pas toute seule,
  // on remonte donc la feuille nous-mêmes, de la même façon sur iOS et Android.
  const { height: winH } = useWindowDimensions();
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => setKb(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKb(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // base = tout ce que l'app a compris ; parsed = ce que l'utilisateur a gardé (cases cochées).
  const base = useMemo(() => parseQuery(query), [query]);
  const parsed = useMemo(() => ({
    ...base,
    concepts: base.concepts.filter((c) => !off.has(c.id)),
    places: base.places.filter((p) => !off.has(p.id)),
    seasons: base.seasons.filter((s) => !off.has(s.id)),
    period: off.has("period") ? null : base.period,
    mode: modeOverride ?? base.mode,
  }), [base, modeOverride, off]);
  const subjectCount = parsed.concepts.length + parsed.seasons.length;
  const hasQuery = query.trim() !== "";
  const understood = subjectCount > 0 || parsed.period != null || parsed.places.length > 0;

  const deletedIds = useMemo(() => new Set(deleted.map((p) => p.id)), [deleted]);

  // Coordonnées des photos (pour « Maroc » : le pays est déduit du GPS de la photo, hors ligne).
  const geoById = useMemo(() => new Map(geoPhotos.map((p) => [p.id, { lat: p.lat, lng: p.lng }])), [geoPhotos]);

  // Résultat complet (période + contenu).
  const full = useMemo(() => {
    if (!understood) return { results: [], notAnalyzed: 0 };
    return searchContent(parsed, libraryPhotos, scores, { deletedIds, geoById });
    // `rev` : de nouveaux résultats d'analyse arrivent pendant que la feuille est ouverte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, understood, libraryPhotos, deletedIds, geoById, rev]);

  const waCount = useMemo(
    () => full.results.filter((r) => isWhatsAppPhoto(r.photo, whatsapp.ids)).length,
    [full, whatsapp]
  );

  // Nombre de photos dans la période seule (affiché sur la ligne « période » de « J'ai compris »).
  const periodCount = useMemo(() => {
    if (!parsed.period) return 0;
    return searchContent({ ...parsed, concepts: [], seasons: [], places: [] }, libraryPhotos, scores, { deletedIds }).results.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, libraryPhotos, deletedIds]);

  // Nombre de photos prises dans le(s) pays (sans la période ni les sujets).
  const placeCount = useMemo(() => {
    if (!parsed.places.length) return 0;
    return searchContent({ ...parsed, concepts: [], seasons: [], period: null }, libraryPhotos, scores, { deletedIds, geoById }).results.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, libraryPhotos, deletedIds, geoById]);
  const geoScanning = geoScanStatus === "scanning";
  const geoPct = geoScanProgress?.total > 0 ? Math.round((geoScanProgress.scanned / geoScanProgress.total) * 100) : 0;

  const analysing = labelsStatus === "running" || labelsStatus === "idle";
  const analysisPct = labelsTotal > 0 ? Math.round((labelsDone / labelsTotal) * 100) : 0;
  const labelsOff = labelsStatus === "unavailable";

  // create = true : on applique les filtres ET on lance la création de l'album tout de suite.
  function apply(create = false) {
    if (!understood || full.results.length === 0) return;
    const deleted0 = deletedIds;
    // Période : toutes les photos de cette période (sans le contenu). Contenu : toutes les photos de ce contenu (sans la période).
    // Les deux filtres se combinent ensuite par intersection, comme les autres filtres de l'accueil.
    const dateIds = parsed.period
      ? searchContent({ ...parsed, concepts: [], seasons: [], places: [] }, libraryPhotos, scores, { deletedIds: deleted0 }).results.map((r) => r.photo.id)
      : null;
    // Pays : toutes les photos géolocalisées dans ce(s) pays (sans la période ni les sujets).
    const placeIds = parsed.places.length
      ? searchContent({ ...parsed, concepts: [], seasons: [], period: null }, libraryPhotos, scores, { deletedIds: deleted0, geoById }).results.map((r) => r.photo.id)
      : null;
    const contentIds = subjectCount
      ? searchContent({ ...parsed, period: null, places: [] }, libraryPhotos, scores, { deletedIds: deleted0 }).results.map((r) => r.photo.id)
      : null;
    onApply({
      query: query.trim(),
      parsed,
      dateIds,
      contentIds,
      placeIds,
      placeLabel: parsed.places.length ? parsed.places.map((p) => p.fr).join(" ou ") : null,
      dateLabel: parsed.period ? cap(parsed.period.label) : null,
      contentLabel: subjectCount
        ? [...parsed.concepts.map((c) => c.fr), ...parsed.seasons.map((x) => x.fr)].join(parsed.mode === "or" ? " ou " : " + ")
        : null,
    }, create);
  }

  const canApply = understood && full.results.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(35,39,31,0.4)", justifyContent: "flex-end", paddingBottom: kb }}
          activeOpacity={1}
          onPress={() => (kb > 0 ? Keyboard.dismiss() : onClose())}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingBottom: kb > 0 ? 14 : 28, maxHeight: winH - kb - 70 }}>
              <View style={{ alignItems: "center", paddingTop: 10, marginBottom: 8 }}>
                <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: C.border }} />
              </View>

              <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 6 }}>
                <Text style={{ fontWeight: "600", fontSize: 18, color: C.text }}>Chercher dans tes photos</Text>
                <Text style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>
                  Écris ta demande : un lieu (pays, ville), une année ou une période, et des sujets. Sépare-les par des virgules.
                </Text>

                {/* Champ */}
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, backgroundColor: C.bgCard,
                  borderRadius: 14, paddingHorizontal: 12, borderWidth: 2, borderColor: color,
                }}>
                  <Icon name="search" size={18} color={color} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="l'été 2026 à la plage"
                    placeholderTextColor={C.textMuted}
                    autoFocus
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    style={{ flex: 1, fontSize: 15.5, color: C.text, paddingVertical: 11 }}
                  />
                  {hasQuery && (
                    <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Icon name="close" size={15} color={C.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {labelsOff && (
                  <Text style={{ fontSize: 12, color: C.red, marginTop: 10 }}>
                    La recherche par sujet n'est pas disponible sur cette version de l'app (module absent). Les périodes marchent.
                  </Text>
                )}

                {/* J'ai compris */}
                {hasQuery && (
                  <View style={{ marginTop: 14, backgroundColor: C.bgCard, borderRadius: 16, padding: 14 }}>
                    <Text style={{ fontSize: 11.5, fontWeight: "700", color: color, letterSpacing: 0.6 }}>J'AI COMPRIS</Text>

                    {base.places.map((pl) => (
                      <Understood
                        key={pl.id}
                        icon="pin"
                        title={pl.fr}
                        sub={off.has(pl.id)
                          ? "Ignoré"
                          : `Filtre : ${frNum(placeCount)} photo${placeCount > 1 ? "s" : ""} géolocalisée${placeCount > 1 ? "s" : ""} là-bas`}
                        color={color}
                        on={!off.has(pl.id)}
                        onToggle={() => toggle(pl.id)}
                      />
                    ))}
                    {base.period && (
                      <Understood
                        icon="calendar"
                        title={cap(base.period.label)}
                        sub={off.has("period")
                          ? "Ignorée"
                          : `Filtre : ${frNum(periodCount)} photo${periodCount > 1 ? "s" : ""} sur cette période`}
                        color={color}
                        on={!off.has("period")}
                        onToggle={() => toggle("period")}
                      />
                    )}
                    {base.concepts.map((c) => (
                      <Understood
                        key={c.id}
                        icon="eye"
                        title={c.fr}
                        sub={off.has(c.id) ? "Ignoré" : c.approx ? "Approximatif : cherche des photos qui y ressemblent" : null}
                        color={color}
                        warn={c.approx && !off.has(c.id)}
                        on={!off.has(c.id)}
                        onToggle={() => toggle(c.id)}
                      />
                    ))}
                    {base.seasons.map((x) => (
                      <Understood
                        key={x.id}
                        icon="calendar"
                        title={x.fr}
                        sub={off.has(x.id) ? "Ignoré" : "Les photos de cette saison"}
                        color={color}
                        on={!off.has(x.id)}
                        onToggle={() => toggle(x.id)}
                      />
                    ))}
                    {(base.period || base.places.length > 0) && subjectCount > 0 && (
                      <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 10 }}>
                        {`Seulement des photos de ${[...parsed.places.map((p) => p.fr), parsed.period?.label].filter(Boolean).join(" · ")}, parmi les sujets cochés.`}
                      </Text>
                    )}
                    {subjectCount > 1 && (
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                        {[["or", "L'un ou l'autre"], ["and", "Les deux à la fois"]].map(([m, lab]) => {
                          const on = parsed.mode === m;
                          return (
                            <TouchableOpacity
                              key={m}
                              onPress={() => setModeOverride(m)}
                              style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 999, backgroundColor: on ? color : C.albumSoft }}
                            >
                              <Text style={{ fontSize: 12.5, fontWeight: "600", color: on ? "#fff" : color }}>{lab}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {parsed.unknown.length > 0 && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={{ fontSize: 12.5, color: understood ? C.textMid : C.red }}>
                          {`Je n'ai pas compris : « ${parsed.unknown.join(" ")} »${understood ? " (ignoré)" : ""}`}
                        </Text>
                        {parsed.suggestions.length > 0 && (
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6, alignItems: "center" }}>
                            <Text style={{ fontSize: 12.5, color: C.textMid }}>Tu voulais dire :</Text>
                            {parsed.suggestions.map((c) => (
                              <TouchableOpacity
                                key={c.id}
                                onPress={() => setQuery(c.fr.toLowerCase())}
                                style={{ backgroundColor: C.albumSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}
                              >
                                <Text style={{ fontSize: 12.5, fontWeight: "600", color }}>{c.fr}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {/* Résultat */}
                    {understood && (
                      <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
                        <Text style={{ fontSize: 11.5, fontWeight: "700", color: C.textMuted, letterSpacing: 0.6 }}>RÉSULTAT</Text>
                        <Text style={{ fontSize: 15, fontWeight: "600", color: C.text, marginTop: 3 }}>
                          {`${frNum(full.results.length)} photo${full.results.length > 1 ? "s" : ""}`}
                          {waCount > 0 && (
                            <Text style={{ fontWeight: "400", color: C.textMid }}>{`  dont ${frNum(waCount)} de WhatsApp`}</Text>
                          )}
                        </Text>
                        {parsed.concepts.length > 0 && full.notAnalyzed > 0 && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                            {analysing && <ActivityIndicator size="small" color={color} />}
                            <Text style={{ flex: 1, fontSize: 12, color: C.textMuted }}>
                              {analysing
                                ? `Analyse de tes photos en cours (${analysisPct} %) : ${frNum(full.notAnalyzed)} pas encore regardée${full.notAnalyzed > 1 ? "s" : ""}. La liste peut s'allonger.`
                                : `${frNum(full.notAnalyzed)} photo${full.notAnalyzed > 1 ? "s" : ""} pas analysée${full.notAnalyzed > 1 ? "s" : ""} (sur iCloud ?).`}
                            </Text>
                          </View>
                        )}
                        {parsed.places.length > 0 && (geoScanning || full.notLocated > 0) && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                            {geoScanning && <ActivityIndicator size="small" color={color} />}
                            <Text style={{ flex: 1, fontSize: 12, color: C.textMuted }}>
                              {geoScanning
                                ? `Localisation de tes photos en cours${geoPct ? ` (${geoPct} %)` : ""} : la liste peut s'allonger.`
                                : `${frNum(full.notLocated)} photo${full.notLocated > 1 ? "s" : ""} sans position GPS (WhatsApp, captures…) : ${full.notLocated > 1 ? "ignorées" : "ignorée"}.`}
                            </Text>
                          </View>
                        )}
                        {full.results.length === 0 && (
                          <Text style={{ fontSize: 12.5, color: C.textMid, marginTop: 6 }}>
                            Aucune photo ne correspond. Essaie un autre mot ou une autre période.
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* Essaie aussi */}
                {!hasQuery && (
                  <View style={{ marginTop: 18 }}>
                    <Text style={{ fontSize: 11.5, fontWeight: "700", color: C.textMuted, letterSpacing: 0.6 }}>ESSAIE AUSSI</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                      {EXAMPLES.map((ex) => (
                        <TouchableOpacity
                          key={ex}
                          onPress={() => setQuery(ex)}
                          style={{ backgroundColor: C.bgCard, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.border }}
                        >
                          <Text style={{ fontSize: 13, color: C.text }}>{`« ${ex} »`}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Bouton */}
              <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
                <TouchableOpacity
                  onPress={() => apply(false)}
                  disabled={!canApply}
                  style={{ backgroundColor: color, borderRadius: 16, paddingVertical: 13, alignItems: "center", opacity: canApply ? 1 : 0.45 }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>{pickMode ? "Voir ces photos" : "Valider ce filtre"}</Text>
                  {canApply && (
                    <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 1 }}>
                      {`${frNum(full.results.length)} photo${full.results.length > 1 ? "s" : ""}`}
                    </Text>
                  )}
                </TouchableOpacity>
                {!pickMode && (
                  <TouchableOpacity
                    onPress={() => apply(true)}
                    disabled={!canApply}
                    style={{ alignItems: "center", paddingVertical: 11, opacity: canApply ? 1 : 0.45 }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color }}>Valider et créer l'album tout de suite</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// Une ligne de « J'ai compris » : icône · titre · sous-titre.
// La pastille à droite est une CASE : touchée, elle ignore (ou reprend) cette idée.
function Understood({ icon, title, sub, color, warn, on = true, onToggle }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onToggle}
      disabled={!onToggle}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, opacity: on ? 1 : 0.5 }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: "600", color: C.text }}>{title}</Text>
        {!!sub && <Text style={{ fontSize: 12, color: warn ? C.album : C.textMuted, marginTop: 1 }}>{sub}</Text>}
      </View>
      <View style={{
        width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center",
        backgroundColor: on ? color : "transparent", borderWidth: on ? 0 : 2, borderColor: C.border,
      }}>
        {on && <Icon name="check" size={13} color="#fff" strokeWidth={2.8} />}
      </View>
    </TouchableOpacity>
  );
}
