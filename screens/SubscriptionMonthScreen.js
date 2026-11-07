// screens/SubscriptionMonthScreen.js
// Sélection du mois de l'abonnement « Coups de cœur » (maquette validée, écrans 6, 7, 8 et 11).
// - tirage au hasard des photos parmi les coups de cœur (jamais une photo déjà validée pour cet abonnement)
// - ↻ sur une photo : une autre au hasard · choisir soi-même · retirer sans remplacer
// - « Tout retirer au sort » · « Valider » (la sélection est alors figée)
// - un onglet par abonnement (Pour moi / prénom du proche)
// - pas assez de coups de cœur disponibles : écran « Il te manque N coups de cœur »
// Pour l'instant la validation reste sur le téléphone : l'envoi pour impression viendra plus tard.

import { useEffect, useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar, Alert, Modal, Pressable, ActivityIndicator, BackHandler, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Text from "../components/AppText";
import Icon from "../components/Icons";
import BackButton from "../components/BackButton";
import { ListRow, SHADOW } from "../components/home/ui";
import { C } from "../constants/theme";
import { subDays, productOf } from "../constants/subscription";
import { monthKey, monthName, sentIdsFor, pickRandom, reconcile, replaceAt } from "../services/printSelection";
import { useSubscriptionStore } from "../store/useSubscriptionStore";
import { usePhotoStore } from "../store/usePhotoStore";
import { submitSelection, NOT_SIGNED_IN } from "../services/printOrders";

const GAP = 6;

// Une photo de la grille : cœur en haut à gauche, ↻ en bas à droite (sauf si validée).
function Cell({ uri, size, onRefresh, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={{ width: size, height: size, borderRadius: 10, overflow: "hidden", backgroundColor: C.bgMuted }}>
      <Image source={{ uri }} contentFit="cover" style={{ width: size, height: size }} />
      <View style={{ position: "absolute", left: 5, top: 5 }}>
        <Icon name="heart" size={14} color="#fff" filled />
      </View>
      {!!onRefresh && (
        <TouchableOpacity onPress={onRefresh} activeOpacity={0.8} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={[{ position: "absolute", right: 4, bottom: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" }, SHADOW]}>
          <Icon name="refresh" size={14} color={C.text} strokeWidth={2.4} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export function SubscriptionMonthScreen({ navigation, route }) {
  const { width: SW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const CELL = (SW - 32 - GAP * 2) / 3;

  const allSubs    = useSubscriptionStore((s) => s.subs);
  const selections = useSubscriptionStore((s) => s.selections);
  const setSelection      = useSubscriptionStore((s) => s.setSelection);
  const validateSelection = useSubscriptionStore((s) => s.validateSelection);
  const kept          = usePhotoStore((s) => s.kept);
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);

  const subs = useMemo(() => allSubs.filter((x) => x.status === "active"), [allSubs]);
  const [subId, setSubId] = useState(route.params?.subId ?? null);
  const sub = subs.find((x) => x.id === subId) ?? subs[0];

  const month = monthKey();
  const sel   = sub ? selections[sub.id]?.[month] : undefined;
  const validated = sel?.status === "validated";

  // Coups de cœur encore présents sur le téléphone : id → adresse à jour.
  const alive = useMemo(() => {
    const byId = new Map(libraryPhotos.map((p) => [p.id, p]));
    const out = new Map();
    kept.forEach((p) => {
      if (libraryPhotos.length === 0 || byId.has(p.id)) out.set(p.id, byId.get(p.id)?.url ?? p.url);
    });
    return out;
  }, [kept, libraryPhotos]);

  // Photos proposables à cet abonnement : coups de cœur vivants, jamais déjà validés pour lui.
  const poolIds = useMemo(() => {
    if (!sub) return [];
    const sent = sentIdsFor(selections[sub.id]);
    return [...alive.keys()].filter((id) => !sent.has(id));
  }, [alive, selections, sub]);
  const poolKey = poolIds.join("|");

  const notEnough = !!sub && !sel && poolIds.length < sub.count;

  // Tirage du mois (une fois), puis remise d'aplomb si des photos disparaissent.
  useEffect(() => {
    if (!sub || validated || notEnough) return;
    const cur = sel?.photoIds;
    const next = cur ? reconcile(cur, poolIds, sel.size ?? sub.count) : pickRandom(poolIds, sub.count);
    const same = cur && next.length === cur.length && next.every((id, i) => id === cur[i]);
    if (!same) setSelection(sub.id, month, next, sel?.size ?? sub.count);
  }, [sub?.id, poolKey, validated, notEnough]); // eslint-disable-line react-hooks/exhaustive-deps

  // Feuille « Changer une photo » : index de la photo visée, et mode (menu / choix à la main).
  const [target, setTarget] = useState(null);
  const [mode, setMode]     = useState("menu");
  const closeSheet = () => { setTarget(null); setMode("menu"); };
  const [upload, setUpload] = useState(null); // envoi des photos en cours : { done, total } (sinon null)
  const [viewIdx, setViewIdx] = useState(null); // photo ouverte en grand (position dans la sélection), sinon null
  // Android : le bouton retour referme d'abord la photo en grand.
  useEffect(() => {
    if (viewIdx === null) return undefined;
    const h = BackHandler.addEventListener("hardwareBackPress", () => { setViewIdx(null); return true; });
    return () => h.remove();
  }, [viewIdx]);

  if (!sub) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 16 }}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={{ marginTop: 30, textAlign: "center", color: C.textMid }}>Tu n'as pas encore d'abonnement.</Text>
      </SafeAreaView>
    );
  }

  const photoIds = sel?.photoIds ?? [];
  const who = sub.kind === "self" ? "Pour moi" : `Pour ${sub.name}`;
  const label = (x) => (x.kind === "self" ? "Pour moi" : x.name);
  const isDone = (x) => selections[x.id]?.[month]?.status === "validated";

  function save(ids, size) { setSelection(sub.id, month, ids, size ?? sel?.size ?? sub.count); }

  function redrawAll() {
    save(pickRandom(poolIds, sel?.size ?? sub.count));
  }
  function replaceOne() {
    const next = replaceAt(photoIds, target, poolIds);
    closeSheet();
    if (!next) { Alert.alert("Plus d'autre photo", "Tous tes autres coups de cœur ont déjà été envoyés ou sont déjà dans la sélection."); return; }
    save(next);
  }
  function pickMyself(id) {
    const next = [...photoIds];
    next[target] = id;
    closeSheet();
    save(next);
  }
  function removeOne() {
    setViewIdx(null);
    const next = photoIds.filter((_, i) => i !== target);
    closeSheet();
    save(next, Math.max(0, (sel?.size ?? sub.count) - 1));
  }
  // Valider = envoyer les photos à Pellicule pour impression. On demande l'accord clair de l'utilisateur,
  // on envoie, et la sélection n'est figée que si tout est bien parti (sinon elle reste modifiable).
  function validate() {
    const n = photoIds.length;
    Alert.alert(
      "Valider et envoyer ?",
      `${n} photo${n > 1 ? "s" : ""} seront envoyées à Pellicule pour être imprimées${sub.kind === "gift" ? ` et expédiées à ${sub.name}` : ""}. Tu ne pourras plus changer cette sélection.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Valider et envoyer", onPress: send },
      ]
    );
  }

  async function send() {
    setUpload({ done: 0, total: photoIds.length });
    try {
      await submitSelection({
        sub, month, photoIds,
        onProgress: (done, total) => setUpload({ done, total }),
      });
      validateSelection(sub.id, month, { sentAt: Date.now() });
      setUpload(null);
      navigation.navigate("SubscriptionTracking", { subId: sub.id, month }); // écran 9
    } catch (e) {
      setUpload(null);
      console.warn("submitSelection failed:", e);
      if (e?.message === NOT_SIGNED_IN) {
        Alert.alert("Connecte-toi d'abord", "Ta session a expiré. Reconnecte-toi, puis valide à nouveau.",
          [{ text: "Annuler", style: "cancel" }, { text: "Se connecter", onPress: () => navigation.navigate("Auth") }]);
      } else {
        Alert.alert("Envoi impossible", "Vérifie ta connexion internet et réessaie. Ta sélection n'a pas été validée.");
      }
    }
  }

  // Candidates pour « Choisir moi-même » : pas déjà dans la sélection.
  const candidates = poolIds.filter((id) => !photoIds.includes(id));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />

      {/* En-tête */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 19, fontWeight: "600", color: C.text }}>Sélection de {monthName(month)}</Text>
          <Text style={{ fontSize: 11.5, color: C.textMuted }}>{who} · {sub.count} {sub.product === "magnets" ? productOf(sub).units : `photo${sub.count > 1 ? "s" : ""}`}</Text>
        </View>
      </View>

      {/* Un onglet par abonnement */}
      {subs.length > 1 && (
        <View style={{ flexDirection: "row", backgroundColor: C.bgMuted, borderRadius: 14, padding: 3, marginHorizontal: 16, marginTop: 12 }}>
          {subs.map((x) => (
            <TouchableOpacity key={x.id} onPress={() => setSubId(x.id)} activeOpacity={0.8}
              style={[{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 11 }, x.id === sub.id && [{ backgroundColor: C.bgCard }, SHADOW]]}>
              <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: x.id === sub.id ? "600" : "500", color: x.id === sub.id ? C.text : C.textMuted }}>
                {label(x)}{isDone(x) ? " ✓" : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {notEnough ? (
        // ── Écran 11 : pas assez de coups de cœur ──
        <View style={{ flex: 1, paddingHorizontal: 22 }}>
          <View style={{ alignItems: "center", marginTop: 44 }}>
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.redSoft, alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <Icon name="heart" size={40} color={C.red} filled />
            </View>
            <Text style={{ fontSize: 22, fontWeight: "600", color: C.text, textAlign: "center", lineHeight: 27 }}>
              Il te manque {sub.count - poolIds.length} coup{sub.count - poolIds.length > 1 ? "s" : ""} de cœur
            </Text>
            <Text style={{ fontSize: 12.5, color: C.textMid, textAlign: "center", lineHeight: 18, marginTop: 6 }}>
              Pour préparer ta sélection de {monthName(month)}, il en faut au moins {sub.count} que {sub.kind === "self" ? "tu n'as pas encore reçus" : `${sub.name} n'a pas encore reçus`}.
            </Text>
          </View>
          <View style={{ marginTop: 26 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: C.text }}>{poolIds.length} sur {sub.count}</Text>
              <Text style={{ fontSize: 12, color: C.textMuted }}>disponibles</Text>
            </View>
            <View style={{ height: 9, backgroundColor: C.bgMuted, borderRadius: 5, overflow: "hidden", marginTop: 8 }}>
              <View style={{ width: `${Math.round((poolIds.length / sub.count) * 100)}%`, height: 9, backgroundColor: C.accent, borderRadius: 5 }} />
            </View>
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate("Main", { screen: "Home" })}
            style={[{ height: 50, borderRadius: 25, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", marginBottom: 20 }, SHADOW]}>
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Continuer à trier</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
            {sub.kind === "gift" && (
              <View style={[{ flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: C.bgCard, borderRadius: 14, padding: 10, marginBottom: 10 }, SHADOW]}>
                <Text style={{ fontSize: 20 }}>📮</Text>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "600", color: C.text }}>{sub.address.split("\n")[0]}</Text>
                  {!!sub.message && <Text numberOfLines={2} style={{ fontSize: 11.5, color: C.textMid, fontStyle: "italic" }}>« {sub.message} »</Text>}
                </View>
              </View>
            )}

            <View style={{ flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: C.sage, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 }}>
              <Text style={{ fontSize: 14 }}>{validated ? "✅" : "⏳"}</Text>
              <Text style={{ flex: 1, fontSize: 12, color: C.green }}>
                {validated ? "Sélection validée. L'impression est en préparation." : <>À valider avant le <Text style={{ fontWeight: "700", color: C.green }}>{subDays(sub).sendDay} {monthName(month)}</Text></>}
              </Text>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP, marginTop: 12 }}>
              {photoIds.map((id, i) => (
                <Cell key={id} uri={alive.get(id)} size={CELL} onPress={() => setViewIdx(i)} onRefresh={validated ? null : () => { setTarget(i); setMode("menu"); }} />
              ))}
            </View>

            {sub.product === "magnets" && (
              <Text style={{ fontSize: 11.5, color: C.textMuted, textAlign: "center", marginTop: 10, lineHeight: 16 }}>
                Tes magnets sont carrés (5 × 5 cm) : chaque photo est recadrée au centre, comme ci-dessus.
              </Text>
            )}

            {!validated && (
              <View style={{ alignItems: "center", marginTop: 14 }}>
                <TouchableOpacity onPress={redrawAll} activeOpacity={0.8}
                  style={[{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.bgCard, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14 }, SHADOW]}>
                  <Icon name="shuffle" size={15} color={C.accent} strokeWidth={2.2} />
                  <Text style={{ fontSize: 12.5, fontWeight: "600", color: C.accent }}>Tout retirer au sort</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Sélection validée : accès au suivi */}
          {validated && (
            <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 26, borderTopWidth: 1, borderTopColor: C.border }}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate("SubscriptionTracking", { subId: sub.id, month })}
                style={{ height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: C.textMid, fontSize: 15, fontWeight: "700" }}>Voir le suivi</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bouton fixe */}
          {!validated && (
            <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 26, borderTopWidth: 1, borderTopColor: C.border }}>
              <TouchableOpacity activeOpacity={0.85} disabled={photoIds.length === 0} onPress={validate}
                style={[{ height: 50, borderRadius: 25, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", opacity: photoIds.length === 0 ? 0.4 : 1 }, SHADOW]}>
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
                  {sub.kind === "self" ? "Valider et imprimer" : `Valider et envoyer à ${sub.name}`}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* ── Photo en grand : retour à la grille, ou changer la photo (feuille « Remplacer cette photo ») ── */}
      {viewIdx !== null && !!photoIds[viewIdx] && (() => {
        const magnets = sub.product === "magnets";
        const W = SW - 32;
        return (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: "rgba(20,22,18,0.95)", paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 18) + 6, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>
                {magnets ? "Magnet" : "Photo"} {viewIdx + 1} sur {photoIds.length}
              </Text>
              <TouchableOpacity onPress={() => setViewIdx(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}>
                <Icon name="close" size={18} color="#fff" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              {magnets ? (
                // Magnet carré : on montre exactement ce qui sera imprimé (recadré au centre)
                <View style={{ width: W, height: W, borderRadius: W * 0.06, overflow: "hidden", backgroundColor: C.bgMuted }}>
                  <Image source={{ uri: alive.get(photoIds[viewIdx]) }} contentFit="cover" style={{ width: W, height: W }} />
                </View>
              ) : (
                <Image source={{ uri: alive.get(photoIds[viewIdx]) }} contentFit="contain" style={{ width: W, height: "80%", borderRadius: 6 }} />
              )}
              {magnets && (
                <Text style={{ fontSize: 11.5, color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: 12 }}>
                  Aperçu du magnet 5 × 5 cm, recadré au centre
                </Text>
              )}
            </View>

            {!validated && (
              <TouchableOpacity activeOpacity={0.85} onPress={() => { setTarget(viewIdx); setMode("menu"); }}
                style={{ height: 50, borderRadius: 25, backgroundColor: C.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Icon name="refresh" size={17} color="#fff" strokeWidth={2.4} />
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Changer cette photo</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity activeOpacity={0.85} onPress={() => setViewIdx(null)}
              style={{ height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.4)", alignItems: "center", justifyContent: "center", marginTop: 10 }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>Retour à la grille</Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* ── Écran 7 : changer une photo (feuille du bas) ── */}
      <Modal visible={target !== null} transparent animationType="slide" onRequestClose={closeSheet}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable onPress={closeSheet} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(35,39,31,0.42)" }} />
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, maxHeight: "78%" }}>
            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: 12 }} />
            {mode === "menu" ? (
              <>
                <Text style={{ fontSize: 16, fontWeight: "600", color: C.text, marginBottom: 12 }}>Remplacer cette photo</Text>
                <View style={{ gap: 10 }}>
                  <ListRow icon="shuffle" title="Une autre au hasard" sub="Parmi tes coups de cœur pas encore envoyés" onPress={replaceOne} />
                  <ListRow icon="heart" iconColor={C.red} iconBg={C.redSoft} title="Choisir moi-même" sub="Ouvre tes coups de cœur"
                    onPress={() => (candidates.length ? setMode("pick") : Alert.alert("Plus d'autre photo", "Tous tes autres coups de cœur ont déjà été envoyés ou sont déjà dans la sélection."))} />
                  <ListRow icon="close" iconColor={C.textMid} iconBg={C.bgMuted} title="Retirer sans remplacer"
                    sub={`Il y aura ${Math.max(0, photoIds.length - 1)} photo${photoIds.length - 1 > 1 ? "s" : ""} ce mois-ci`} right={null} onPress={removeOne} />
                </View>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 16, fontWeight: "600", color: C.text, marginBottom: 12 }}>Choisir une photo</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
                    {candidates.map((id) => (
                      <TouchableOpacity key={id} activeOpacity={0.8} onPress={() => pickMyself(id)}>
                        <Image source={{ uri: alive.get(id) }} contentFit="cover" style={{ width: CELL, height: CELL, borderRadius: 10, backgroundColor: C.bgMuted }} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Envoi des photos en cours : on bloque l'écran jusqu'à la fin */}
      <Modal visible={!!upload} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={{ flex: 1, backgroundColor: "rgba(35,39,31,0.55)", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View style={{ backgroundColor: C.bg, borderRadius: 20, padding: 24, alignItems: "center", width: "100%" }}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.text, marginTop: 14 }}>Envoi de tes photos…</Text>
            <Text style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>
              {upload ? `${Math.min(upload.done + 1, upload.total)} / ${upload.total}` : ""}
            </Text>
            <View style={{ height: 8, alignSelf: "stretch", backgroundColor: C.bgMuted, borderRadius: 4, overflow: "hidden", marginTop: 14 }}>
              <View style={{ height: 8, width: `${upload && upload.total ? Math.round((upload.done / upload.total) * 100) : 0}%`, backgroundColor: C.accent, borderRadius: 4 }} />
            </View>
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 12, textAlign: "center" }}>Garde l'app ouverte jusqu'à la fin.</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
