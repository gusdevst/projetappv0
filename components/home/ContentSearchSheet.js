// components/home/ContentSearchSheet.js
// Feuille « Chercher dans tes photos » (mode Album) — maquette recherche-flou, partie 1, écran B :
// on écrit « l'été 2026 à la plage », l'app montre ce qu'elle a compris (période + contenu),
// le nombre de photos trouvées, puis « Appliquer ces filtres ».
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

const EXAMPLES = ["Noël 2025", "mon chien", "montagne cet hiver", "anniversaire", "bébé", "feu d'artifice", "piscine l'été dernier"];

const frNum = (n) => n.toLocaleString("fr-FR");

/** Première lettre en majuscule (« été 2026 » → « Été 2026 »). */
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * @param visible, onClose
 * @param initialQuery   texte à pré-remplir (ex. la recherche déjà appliquée)
 * @param color          couleur du mode (album)
 * @param onApply        ({ query, parsed, dateIds, contentIds, dateLabel, contentLabel }, create: boolean) => void
 *                       create = true : « Créer un album » (filtres appliqués + tri lancé tout de suite)
 * @param pickMode       true : un seul bouton « Voir ces photos » (appelle onApply(..., false)). Utilisé par le choix
 *                       d'une photo de poster, où il n'y a pas d'album à créer.
 */
export default function ContentSearchSheet({ visible, onClose, initialQuery = "", color = C.album, onApply, pickMode = false }) {
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const deleted = usePhotoStore((s) => s.deleted);
  const { scores, rev, whatsapp, labelsStatus, labelsTotal, labelsDone } = useBlurStore();
  const [query, setQuery] = useState(initialQuery);
  const [modeOverride, setModeOverride] = useState(null); // null = comme la phrase ; "and" | "or" = choix de l'utilisateur

  // À chaque ouverture : on repart de la recherche déjà appliquée (ou d'un champ vide).
  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
      setModeOverride(null);
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

  const base = useMemo(() => parseQuery(query), [query]);
  const parsed = useMemo(() => ({ ...base, mode: modeOverride ?? base.mode }), [base, modeOverride]);
  const hasQuery = query.trim() !== "";
  const understood = parsed.concepts.length > 0 || parsed.period != null;

  const deletedIds = useMemo(() => new Set(deleted.map((p) => p.id)), [deleted]);

  // Résultat complet (période + contenu).
  const full = useMemo(() => {
    if (!understood) return { results: [], notAnalyzed: 0 };
    return searchContent(parsed, libraryPhotos, scores, { deletedIds });
    // `rev` : de nouveaux résultats d'analyse arrivent pendant que la feuille est ouverte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, understood, libraryPhotos, deletedIds, rev]);

  const waCount = useMemo(
    () => full.results.filter((r) => isWhatsAppPhoto(r.photo, whatsapp.ids)).length,
    [full, whatsapp]
  );

  // Nombre de photos dans la période seule (affiché sur la ligne « période » de « J'ai compris »).
  const periodCount = useMemo(() => {
    if (!parsed.period) return 0;
    return searchContent({ ...parsed, concepts: [] }, libraryPhotos, scores, { deletedIds }).results.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, libraryPhotos, deletedIds]);

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
      ? searchContent({ ...parsed, concepts: [] }, libraryPhotos, scores, { deletedIds: deleted0 }).results.map((r) => r.photo.id)
      : null;
    const contentIds = parsed.concepts.length
      ? searchContent({ ...parsed, period: null }, libraryPhotos, scores, { deletedIds: deleted0 }).results.map((r) => r.photo.id)
      : null;
    onApply({
      query: query.trim(),
      parsed,
      dateIds,
      contentIds,
      dateLabel: parsed.period ? cap(parsed.period.label) : null,
      contentLabel: parsed.concepts.length
        ? parsed.concepts.map((c) => c.fr).join(parsed.mode === "or" ? " ou " : " + ")
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
                  Écris ta demande : une période, un sujet, ou les deux.
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

                    {parsed.period && (
                      <Understood
                        icon="calendar"
                        title={cap(parsed.period.label)}
                        sub={`${frNum(periodCount)} photo${periodCount > 1 ? "s" : ""} sur cette période`}
                        color={color}
                      />
                    )}
                    {parsed.concepts.map((c) => (
                      <Understood
                        key={c.id}
                        icon="eye"
                        title={c.fr}
                        sub={c.approx ? "Approximatif : cherche des photos qui y ressemblent" : null}
                        color={color}
                        warn={c.approx}
                      />
                    ))}
                    {parsed.concepts.length > 1 && (
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
                  onPress={() => apply(!pickMode)}
                  disabled={!canApply}
                  style={{ backgroundColor: color, borderRadius: 16, paddingVertical: 13, alignItems: "center", opacity: canApply ? 1 : 0.45 }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>{pickMode ? "Voir ces photos" : "Créer un album avec ces photos"}</Text>
                  {canApply && (
                    <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 1 }}>
                      {`${frNum(full.results.length)} photo${full.results.length > 1 ? "s" : ""}`}
                    </Text>
                  )}
                </TouchableOpacity>
                {!pickMode && (
                  <TouchableOpacity
                    onPress={() => apply(false)}
                    disabled={!canApply}
                    style={{ alignItems: "center", paddingVertical: 11, opacity: canApply ? 1 : 0.45 }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color }}>Appliquer les filtres seulement</Text>
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
function Understood({ icon, title, sub, color, warn }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: "600", color: C.text }}>{title}</Text>
        {!!sub && <Text style={{ fontSize: 12, color: warn ? C.album : C.textMuted, marginTop: 1 }}>{sub}</Text>}
      </View>
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
        <Icon name="check" size={12} color="#fff" strokeWidth={2.8} />
      </View>
    </View>
  );
}
