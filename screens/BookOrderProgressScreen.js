// screens/BookOrderProgressScreen.js
// Commander un livre — étapes 3 à 5 : fabrication, envoi, confirmation (maquette : écrans 4, 4 bis et 5).
// Ouvert par « Payer » : navigation.navigate("BookOrderProgress", { albumId, address })
// ou pour REPRENDRE une commande interrompue : { orderId } (depuis « Mes commandes »).
//
// Le déroulé (services/bookOrder.js) : commande enregistrée → PDF fabriqué sur le téléphone → PDF envoyé → transmission à l'imprimeur.
// Chaque étape déjà faite est sautée au « Réessayer » : la commande reste enregistrée, on ne repaie jamais.
// On ne quitte pas l'écran pendant le travail (retour bloqué, confirmation d'annulation).

import { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import Text from "../components/AppText";
import { BookCover } from "../components/book/BookPage";
import { PrintPageRenderer } from "../components/book/PrintPageRenderer";
import { useBookFonts } from "../components/book/bookFonts";
import { SHADOW } from "../components/home/ui";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { useOrdersStore } from "../store/useOrdersStore";
import { useBookPdf } from "../hooks/useBookPdf";
import { useAndroidBack } from "../hooks/useAndroidBack";
import { pageRatio } from "../services/photoBook";
import {
  createBookOrder, getOrder, uploadBookPdf, submitBookOrder, discardOrder, isIncomplete, orderErrorText, ORDER_STATUS,
} from "../services/bookOrder";

// Commande partie : on marque le livre (« ✓ Commandé le … » sur l'étagère du Labo ; `bookUpdatedAt` sert à repérer une retouche
// ultérieure, setBook ne change pas `updatedAt`) et on relit les commandes pour le bloc « En route ».
function markOrdered(albumId, order) {
  const st = usePhotoStore.getState();
  const b = albumId ? st.books[albumId] : null;
  if (b) st.setBook(albumId, { ...b, lastOrder: { orderId: order.id, at: Date.now(), bookUpdatedAt: b.updatedAt ?? 0 } });
  useOrdersStore.getState().load({ refresh: false, force: true });
}

const PDF_RESTARTS = 1; // relances complètes de la fabrication si une page reste figée malgré les essais par page
const STEPS = ["Commande enregistrée", "Je fabrique ton livre", "J'envoie à l'imprimeur"];

function Step({ n, label, state, children }) {
  const ok = state === "done", now = state === "now", ko = state === "error";
  return (
    <View style={{ flexDirection: "row", gap: 11, alignItems: "center", paddingVertical: 11, borderTopWidth: n > 1 ? 1 : 0, borderTopColor: C.border }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center",
        backgroundColor: ok ? C.sage : ko ? "#fbeadb" : now ? C.albumSoft : C.bgMuted }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: ok ? C.accent : ko ? "#c4621c" : now ? C.album : C.textMuted }}>
          {ok ? "✓" : ko ? "!" : now ? "…" : n}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: state === "wait" ? C.textMuted : C.text }}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

export function BookOrderProgressScreen({ navigation, route }) {
  const resumeRef = useRef(route?.params?.orderId ?? null); // commande à reprendre (vidée si on l'abandonne)
  const albumId = route?.params?.albumId ?? null;
  const address = route?.params?.address;
  const album   = usePhotoStore((s) => s.albums.find((a) => a.id === albumId));
  const printed = usePhotoStore((s) => s.printed);
  const book    = usePhotoStore((s) => s.books[albumId]);
  useBookFonts();
  const urlById = useRef({});
  urlById.current = Object.fromEntries(printed.map((p) => [p.id, p.url]));
  const pdf = useBookPdf(book, urlById.current);

  const orderRef = useRef(null);       // la ligne `orders` en cours
  const startedRef = useRef(false);
  const cancelRef = useRef(false);
  const runId = useRef(0);             // numéro de l'essai en cours : un essai abandonné (annulation) n'écrit plus rien à l'écran
  const createdHere = useRef(false);   // commande créée pendant CET écran (supprimable si on annule avant l'envoi)
  const [phase, setPhase] = useState("working"); // "working" | "error" | "done" | "cancelled"
  const [stage, setStage] = useState(0);         // étape en cours : 1 enregistrement · 2 fabrication · 3 envoi
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(null);
  const [restarting, setRestarting] = useState(0); // > 0 : la fabrication a bloqué et recommence (numéro du nouvel essai)

  useEffect(() => { navigation.setOptions({ gestureEnabled: false }); }, [navigation]);

  const [leftover, setLeftover] = useState(false); // la commande n'a pas pu être supprimée à l'annulation

  // Annuler = supprimer la commande si elle n'est jamais partie chez l'imprimeur (créée ici OU reprise de « Mes commandes »).
  const dropOrder = useCallback(async () => {
    const o = orderRef.current;
    orderRef.current = null;
    resumeRef.current = null;
    createdHere.current = false;
    if (!o || !isIncomplete(o)) return;
    const ok = await discardOrder(o);
    useOrdersStore.getState().load({ refresh: false, force: true });
    if (!ok) setLeftover(true);
  }, []);

  const run = useCallback(async () => {
    cancelRef.current = false;
    const my = ++runId.current;
    const stale = () => my !== runId.current; // annulé ou relancé entre-temps
    setErr(null); setPhase("working");
    try {
      // 1. La commande
      setStage(1);
      let order = orderRef.current;
      if (!order && resumeRef.current) {
        order = await getOrder(resumeRef.current);
        if (stale()) return;
        if (!order) throw Object.assign(new Error("Commande introuvable."), { kind: "server" });
        orderRef.current = order;
      }
      if (!order) {
        if (!book || !address) throw Object.assign(new Error("Livre ou adresse introuvable."), { kind: "server" });
        order = await createBookOrder({ albumId, book, albumName: album?.name, address });
        if (stale()) { discardOrder(order); return; } // annulé pendant la création : on supprime la ligne qui vient d'apparaître
        orderRef.current = order;
        createdHere.current = true;
      }
      if (["transmitted", "printed", "mailed", "delivered"].includes(order.status)) { markOrdered(albumId, order); setDone(order); setPhase("done"); return; }

      // 2. Le PDF (sauté si déjà envoyé lors d'un essai précédent).
      //    La fabrication se fige parfois sur une page : le hook redessine déjà la page (3 essais) ; en dernier recours,
      //    on relance TOUTE la fabrication (PDF_RESTARTS fois) avant d'afficher une erreur.
      if (!order.file_path || order.status === "draft") {
        if (!book) throw Object.assign(new Error("Livre introuvable sur ce téléphone."), { kind: "server" });
        setStage(2);
        let result;
        for (let attempt = 0; ; attempt++) {
          try {
            result = await pdf.start();
            break;
          } catch (e) {
            if (stale() || cancelRef.current) return;
            if (attempt >= PDF_RESTARTS) throw e;
            setRestarting(attempt + 1);          // « Je recommence la fabrication… »
            await new Promise((r) => setTimeout(r, 1200));
            if (stale() || cancelRef.current) return;
          }
        }
        setRestarting(0);
        if (stale()) return;
        if (cancelRef.current || !result) {
          await dropOrder();
          setPhase("cancelled");
          return;
        }
        setStage(3);
        order = await uploadBookPdf(order, result.uri);
        if (stale()) return;
        orderRef.current = order;
        FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
      }

      // 3. Transmission à l'imprimeur (prix recalculé côté serveur)
      setStage(3);
      order = await submitBookOrder(order.id);
      if (stale()) return;
      orderRef.current = order;
      markOrdered(albumId, order);
      setDone(order);
      setPhase("done");
    } catch (e) {
      if (stale()) return;
      setRestarting(0);
      setErr(e);
      setPhase("error");
    }
  }, [book, address, albumId, album?.name, pdf]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    run();
  }, [run]);

  // Annulation IMMÉDIATE : même si la fabrication est figée, l'écran passe tout de suite à « annulée » (l'essai en cours est abandonné).
  const cancelNow = useCallback(() => {
    cancelRef.current = true;
    runId.current += 1;
    pdf.cancel();
    setRestarting(0);
    dropOrder();
    setPhase("cancelled");
  }, [pdf, dropOrder]);

  const askCancel = useCallback(() => {
    if (phase === "working" && stage >= 3) {
      // L'envoi du fichier est lancé : on ne peut plus l'arrêter proprement (la commande reste enregistrée de toute façon).
      Alert.alert("Envoi en cours", "Encore quelques instants : garde l'app ouverte.");
    } else if (phase === "working") {
      Alert.alert("Annuler la commande ?", "La fabrication du livre sera arrêtée et la commande supprimée. Rien ne sera envoyé.", [
        { text: "Continuer", style: "cancel" },
        { text: "Annuler la commande", style: "destructive", onPress: cancelNow },
      ]);
    } else if (phase === "done") {
      navigation.reset({ index: 0, routes: [{ name: "Main", params: { screen: "GalleryTab" } }] });
    } else {
      navigation.goBack();
    }
  }, [phase, stage, cancelNow, navigation]);
  useAndroidBack(askCancel);

  const pct = Math.round((pdf.state.done / Math.max(1, pdf.state.total)) * 100);
  const stepState = (n) => {
    if (phase === "done") return "done";
    if (phase === "error") return n < stage ? "done" : n === stage ? "error" : "wait";
    return n < stage ? "done" : n === stage ? "now" : "wait";
  };

  const toLabo = () => navigation.reset({ index: 0, routes: [{ name: "Main", params: { screen: "GalleryTab" } }] });
  const toOrders = () => navigation.reset({ index: 1, routes: [{ name: "Main", params: { screen: "GalleryTab" } }, { name: "BookOrders" }] });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      {/* Rendu hors écran des pages pour le PDF (jamais visible) */}
      <PrintPageRenderer {...pdf.rendererProps} />

      <ScrollView contentContainerStyle={{ padding: S.pad, paddingTop: 16, paddingBottom: 24 }}>
        {/* ── 5 · Confirmation ───────────────────────────────────────── */}
        {phase === "done" && done && (
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 11.5, color: C.textMuted }}>Commande n° {done.ref}</Text>
            <Text style={{ fontSize: 22, fontWeight: "700", color: C.text, marginTop: 2 }}>C'est parti !</Text>
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.sage, alignItems: "center", justifyContent: "center", marginVertical: 18 }}>
              <Text style={{ fontSize: 34, fontWeight: "800", color: C.accent }}>✓</Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.text, textAlign: "center" }}>Ton livre est en route vers l'imprimeur</Text>
            <Text style={{ fontSize: 13, color: C.textMid, lineHeight: 19, textAlign: "center", marginTop: 6, marginBottom: 16, paddingHorizontal: 8 }}>
              Il sera fabriqué en France puis expédié{done.address?.city ? ` à ${done.address.city}` : ""}. Tu verras l'avancement dans « Mes commandes ».
            </Text>
            {__DEV__ && done.test && (
              <Text style={{ fontSize: 11.5, color: "#c4621c", textAlign: "center", marginBottom: 12 }}>🧪 Commande de test : rien ne sera imprimé ni facturé.</Text>
            )}
            <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, alignSelf: "stretch", ...SHADOW }}>
              {[["Commande reçue", true], [ORDER_STATUS[done.status]?.label ?? "En préparation", true], ["Expédiée · numéro de suivi", false], ["Livrée", false]].map(([label, on], i) => (
                <View key={label} style={{ flexDirection: "row", gap: 11, alignItems: "center", paddingVertical: 6 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: on ? (i === 1 ? C.album : C.accent) : C.bgMuted }} />
                  <Text style={{ fontSize: 13, color: on ? C.text : C.textMuted, fontWeight: i === 1 ? "700" : "400" }}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 4 · Fabrication et envoi (+ 4 bis · échec) ─────────────── */}
        {phase !== "done" && (
          <>
            <View style={{ alignItems: "center", marginBottom: 14 }}>
              <Text style={{ fontSize: 11.5, color: C.textMuted }}>Commande en cours</Text>
              <Text style={{ fontSize: 22, fontWeight: "700", color: C.text, marginTop: 2 }}>
                {phase === "error" ? "Petit souci" : phase === "cancelled" ? "Commande annulée" : "Je prépare ton livre"}
              </Text>
            </View>

            {phase === "working" && book && (
              <View style={{ alignItems: "center", marginBottom: 16 }}>
                <BookCover cover={book.cover} size={book.orientation === "landscape" ? 150 : 96} ratio={pageRatio(book)} urlById={urlById.current} />
              </View>
            )}

            {phase === "error" && (
              <View style={{ alignItems: "center", marginBottom: 14 }}>
                <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: "#fbeadb", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <Text style={{ fontSize: 34, fontWeight: "800", color: "#c4621c" }}>!</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>L'envoi s'est interrompu</Text>
                <Text style={{ fontSize: 13, color: C.textMid, lineHeight: 19, textAlign: "center", marginTop: 6, paddingHorizontal: 8 }}>{orderErrorText(err)}</Text>
                {__DEV__ && !!err && <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 8, textAlign: "center" }}>[dev] {err.code ? `${err.code} · ` : ""}{String(err.message ?? err)}</Text>}
              </View>
            )}

            {phase === "cancelled" && (
              <Text style={{ fontSize: 13, color: C.textMid, lineHeight: 19, textAlign: "center", marginBottom: 14 }}>
                {leftover
                  ? "Rien n'a été envoyé, mais la commande est restée enregistrée : tu peux l'abandonner depuis « Mes commandes »."
                  : address ? "Rien n'a été envoyé et la commande est supprimée. Tu peux la relancer quand tu veux." : "Rien n'a été envoyé et la commande est supprimée."}
              </Text>
            )}

            {phase !== "cancelled" && (
              <View style={{ backgroundColor: C.bgCard, borderRadius: 18, paddingHorizontal: 14, ...SHADOW }}>
                <Step n={1} label={STEPS[0]} state={stepState(1)} />
                <Step n={2} label={phase === "error" && stage > 2 ? "Livre fabriqué" : STEPS[1]} state={stepState(2)}>
                  {phase === "working" && stage === 2 && (
                    <>
                      <Text style={{ fontSize: 11.5, color: C.textMid }}>Page {Math.min(pdf.state.done + 1, pdf.state.total)} sur {pdf.state.total}</Text>
                      {(restarting > 0 || /nouvel essai/.test(pdf.state.step || "")) && (
                        <Text style={{ fontSize: 11.5, color: C.album, marginTop: 2 }}>
                          {restarting > 0 ? "Ça a bloqué : je recommence la fabrication…" : "Une page a bloqué : je la redessine…"}
                        </Text>
                      )}
                      <View style={{ height: 10, backgroundColor: C.bgMuted, borderRadius: 6, overflow: "hidden", marginTop: 6 }}>
                        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: C.album, borderRadius: 6 }} />
                      </View>
                    </>
                  )}
                </Step>
                <Step n={3} label={STEPS[2]} state={stepState(3)} />
              </View>
            )}

            {phase === "working" && (
              <Text style={{ fontSize: 12.5, color: C.textMid, textAlign: "center", lineHeight: 18, marginTop: 14 }}>
                Garde l'app ouverte et l'écran allumé.{"\n"}Ça prend quelques minutes.
              </Text>
            )}
            {phase === "error" && (
              <Text style={{ fontSize: 11.5, color: C.textMuted, textAlign: "center", lineHeight: 16, marginTop: 12 }}>
                Tu peux aussi fermer l'app : la commande reste dans « Mes commandes ».
              </Text>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Boutons ───────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: S.pad, paddingTop: 8, paddingBottom: 12, backgroundColor: C.bg, gap: 8 }}>
        {phase === "working" && (
          <TouchableOpacity onPress={askCancel}
            style={{ height: 50, borderRadius: S.radiusFull, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.textMid, fontWeight: "700", fontSize: 14.5 }}>Annuler</Text>
          </TouchableOpacity>
        )}
        {phase === "error" && (
          <>
            <TouchableOpacity onPress={run}
              style={{ height: 52, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center", elevation: 3 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Réessayer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={toOrders}
              style={{ height: 48, borderRadius: S.radiusFull, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.textMid, fontWeight: "700", fontSize: 14.5 }}>Voir mes commandes</Text>
            </TouchableOpacity>
          </>
        )}
        {phase === "cancelled" && (
          <>
            {/* Relancer = repartir d'une commande neuve : possible seulement si on a l'adresse (parcours « Payer »), pas depuis une reprise. */}
            {!!address && (
              <TouchableOpacity onPress={() => { orderRef.current = null; resumeRef.current = null; createdHere.current = false; setLeftover(false); run(); }}
                style={{ height: 52, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center", elevation: 3 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Relancer la commande</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => navigation.goBack()}
              style={{ height: 48, borderRadius: S.radiusFull, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.textMid, fontWeight: "700", fontSize: 14.5 }}>Retour</Text>
            </TouchableOpacity>
          </>
        )}
        {phase === "done" && (
          <>
            <TouchableOpacity onPress={toOrders}
              style={{ height: 52, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center", elevation: 3 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Suivre ma commande</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={toLabo}
              style={{ height: 48, borderRadius: S.radiusFull, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.textMid, fontWeight: "700", fontSize: 14.5 }}>Retour au Labo</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
