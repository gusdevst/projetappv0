// screens/PosterOrderProgressScreen.js
// Commander un poster — fabrication, envoi, confirmation (même déroulé que BookOrderProgressScreen).
// Ouvert par « Payer » : navigation.navigate("PosterOrderProgress", { params, format, quantity, address })
// ou pour REPRENDRE une commande interrompue : { orderId } (depuis « Mes commandes » / « En route » ; le poster est alors
// redessiné d'après `orders.spec.source`).
//
// Étapes (services/posterOrder.js) : commande enregistrée → fichier JPEG fabriqué sur le téléphone → fichier envoyé → commande « reçue ».
// ⚠️ La commande n'est PAS transmise à imprimeur.fr (décision d'Augustin, 16 nov. 2026) : elle reste chez Pellicule (table `orders`).
// Chaque étape déjà faite est sautée au « Réessayer ». On ne quitte pas l'écran pendant le travail.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import Text from "../components/AppText";
import PosterPrintRenderer from "../components/poster/PosterPrintRenderer";
import { PosterFrame } from "../components/poster/PosterParts";
import CollagePoster from "../components/poster/CollagePoster";
import { useBookFonts } from "../components/book/bookFonts";
import { SHADOW } from "../components/home/ui";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { useOrdersStore } from "../store/useOrdersStore";
import { useAndroidBack } from "../hooks/useAndroidBack";
import { getOrder, discardOrder, isIncomplete, orderErrorText } from "../services/bookOrder";
import { createPosterOrder, uploadPosterFile, submitPosterOrder } from "../services/posterOrder";
import { posterIsLandscape, POSTER_FORMATS } from "../services/posterProducts";
import { collageLayout, collagePhotoOrder } from "../services/posterCollage";

const STEPS = ["Commande enregistrée", "Je fabrique ton poster", "J'envoie à Pellicule"];
const RENDER_TRIES = 2; // essais de fabrication du fichier avant d'afficher une erreur

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

export function PosterOrderProgressScreen({ navigation, route }) {
  const resumeRef = useRef(route?.params?.orderId ?? null);   // commande à reprendre (vidée si on l'abandonne)
  const given = route?.params ?? {};
  const address = given.address;
  useBookFonts();
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const kept = usePhotoStore((s) => s.kept);

  const orderRef = useRef(null);
  const startedRef = useRef(false);
  const cancelRef = useRef(false);
  const runId = useRef(0);
  const [phase, setPhase] = useState("working"); // "working" | "error" | "done" | "cancelled"
  const [stage, setStage] = useState(0);         // 1 enregistrement · 2 fabrication · 3 envoi
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(null);
  const [leftover, setLeftover] = useState(false);
  const [job, setJob] = useState(null);          // fabrication en cours : { key, params, format }
  const jobDone = useRef(null);                  // appelé par PosterPrintRenderer quand le fichier est prêt

  useEffect(() => { navigation.setOptions({ gestureEnabled: false }); }, [navigation]);

  // Aperçu pendant le travail : d'après les paramètres reçus (ou la commande reprise).
  const [shown, setShown] = useState(given.params ? { params: given.params, format: given.format } : null);
  const byId = useMemo(() => new Map([...kept, ...libraryPhotos].map((p) => [p.id, p])), [kept, libraryPhotos]);

  const dropOrder = useCallback(async () => {
    const o = orderRef.current;
    orderRef.current = null;
    resumeRef.current = null;
    if (!o || !isIncomplete(o)) return;
    const ok = await discardOrder(o);
    useOrdersStore.getState().load({ refresh: false, force: true });
    if (!ok) setLeftover(true);
  }, []);

  // Fabrique le fichier : monte PosterPrintRenderer et attend son résultat.
  const renderFile = (params, format) => new Promise((resolve) => {
    jobDone.current = resolve;
    setJob({ key: `${Date.now()}`, params, format });
  });

  const run = useCallback(async () => {
    cancelRef.current = false;
    const my = ++runId.current;
    const stale = () => my !== runId.current;
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
        if (!given.params || !address) throw Object.assign(new Error("Poster ou adresse introuvable."), { kind: "server" });
        const st = usePhotoStore.getState();
        const all = new Map([...st.kept, ...st.libraryPhotos].map((x) => [x.id, x]));
        const photo = all.get(given.params.collage ? given.params.collage.photoIds[0] : given.params.photoId);
        order = await createPosterOrder({ params: given.params, format: given.format, quantity: given.quantity ?? 1, address, photo });
        if (stale()) { discardOrder(order); return; }
        orderRef.current = order;
      }
      if (["received", "transmitted", "printed", "mailed", "delivered"].includes(order.status)) { setDone(order); setPhase("done"); useOrdersStore.getState().load({ refresh: false, force: true }); return; }

      // 2. Le fichier (sauté s'il a déjà été envoyé lors d'un essai précédent)
      if (!order.file_path || order.status === "draft") {
        const src = order.spec?.source ?? given.params;
        const format = order.product;
        if (!src) throw Object.assign(new Error("Poster introuvable sur ce téléphone."), { kind: "server" });
        setShown({ params: src, format });
        setStage(2);
        let result = null;
        for (let attempt = 0; attempt < RENDER_TRIES && !result; attempt++) {
          const r = await renderFile(src, format);
          if (stale() || cancelRef.current) { setJob(null); return; }
          if (r?.uri) result = r; else if (attempt === RENDER_TRIES - 1) throw Object.assign(new Error(r?.error ?? "Fabrication impossible."), { kind: "server" });
          setJob(null);
          await new Promise((res) => setTimeout(res, 600));
        }
        if (stale()) return;
        setStage(3);
        order = await uploadPosterFile(order, result.uri, { px: result.px, dpi: result.dpi, rotated90: result.rotated90 });
        if (stale()) return;
        orderRef.current = order;
        FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
      }

      // 3. Le serveur vérifie et enregistre (prix recalculé) — rien n'est envoyé à imprimeur.fr
      setStage(3);
      order = await submitPosterOrder(order.id);
      if (stale()) return;
      orderRef.current = order;
      useOrdersStore.getState().load({ refresh: false, force: true });
      setDone(order);
      setPhase("done");
    } catch (e) {
      if (stale()) return;
      setJob(null);
      setErr(e);
      setPhase("error");
    }
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    run();
  }, [run]);

  // Annulation immédiate : l'essai en cours est abandonné, la commande jamais envoyée est supprimée.
  const cancelNow = useCallback(() => {
    cancelRef.current = true;
    runId.current += 1;
    jobDone.current?.({ error: "annulé" });
    setJob(null);
    dropOrder();
    setPhase("cancelled");
  }, [dropOrder]);

  const askCancel = useCallback(() => {
    if (phase === "working" && stage >= 3) {
      Alert.alert("Envoi en cours", "Encore quelques instants : garde l'app ouverte.");
    } else if (phase === "working") {
      Alert.alert("Annuler la commande ?", "La fabrication du poster sera arrêtée et la commande supprimée. Rien ne sera envoyé.", [
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

  const stepState = (n) => {
    if (phase === "done") return "done";
    if (phase === "error") return n < stage ? "done" : n === stage ? "error" : "wait";
    return n < stage ? "done" : n === stage ? "now" : "wait";
  };
  const toLabo = () => navigation.reset({ index: 0, routes: [{ name: "Main", params: { screen: "GalleryTab" } }] });
  const toOrders = () => navigation.reset({ index: 1, routes: [{ name: "Main", params: { screen: "GalleryTab" } }, { name: "BookOrders" }] });

  // Petit aperçu du poster pendant la fabrication.
  const preview = (() => {
    if (!shown?.params) return null;
    const { collage, photoId, crop, title } = shown.params;
    if (collage) {
      const ph = collage.photoIds.map((id) => byId.get(id)).filter(Boolean);
      return <CollagePoster width={84} photos={ph} cells={collageLayout(collage.style, ph.length, { seed: collage.seed, hasTitle: !!collage.title })}
        order={collagePhotoOrder(ph.length, collage.seed ?? 0)} crops={collage.crops} bg={collage.bg} title={collage.title} titleFont={collage.titleFont} />;
    }
    const photo = byId.get(photoId);
    const land = posterIsLandscape(photo);
    return <PosterFrame uri={photo?.url} crop={crop} title={title} width={land ? 112 : 84} landscape={land} />;
  })();
  const fName = POSTER_FORMATS[shown?.format]?.name;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      {/* Fabrication du fichier hors écran (jamais visible) */}
      {!!job && <PosterPrintRenderer key={job.key} params={job.params} format={job.format} onDone={(r) => { const f = jobDone.current; jobDone.current = null; f?.(r); }} />}

      <ScrollView contentContainerStyle={{ padding: S.pad, paddingTop: 16, paddingBottom: 24 }}>
        {phase === "done" && done && (
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 11.5, color: C.textMuted }}>Commande n° {done.ref}</Text>
            <Text style={{ fontSize: 22, fontWeight: "700", color: C.text, marginTop: 2 }}>Commande reçue !</Text>
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.sage, alignItems: "center", justifyContent: "center", marginVertical: 18 }}>
              <Text style={{ fontSize: 34, fontWeight: "800", color: C.accent }}>✓</Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.text, textAlign: "center" }}>Ton poster est bien enregistré</Text>
            <Text style={{ fontSize: 13, color: C.textMid, lineHeight: 19, textAlign: "center", marginTop: 6, marginBottom: 16, paddingHorizontal: 8 }}>
              Il sera fabriqué en France puis expédié{done.address?.city ? ` à ${done.address.city}` : ""}. Tu retrouveras la commande dans « Mes commandes ».
            </Text>
            {__DEV__ && (
              <Text style={{ fontSize: 11.5, color: "#c4621c", textAlign: "center", marginBottom: 12 }}>
                🧪 Mode test : la commande est dans Supabase (table orders), pas transmise à l'imprimeur.
              </Text>
            )}
          </View>
        )}

        {phase !== "done" && (
          <>
            <View style={{ alignItems: "center", marginBottom: 14 }}>
              <Text style={{ fontSize: 11.5, color: C.textMuted }}>Commande en cours{fName ? ` · poster ${fName}` : ""}</Text>
              <Text style={{ fontSize: 22, fontWeight: "700", color: C.text, marginTop: 2 }}>
                {phase === "error" ? "Petit souci" : phase === "cancelled" ? "Commande annulée" : "Je prépare ton poster"}
              </Text>
            </View>

            {phase === "working" && !!preview && <View style={{ alignItems: "center", marginBottom: 16 }}>{preview}</View>}

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
                  : "Rien n'a été envoyé et la commande est supprimée."}
              </Text>
            )}

            {phase !== "cancelled" && (
              <View style={{ backgroundColor: C.bgCard, borderRadius: 18, paddingHorizontal: 14, ...SHADOW }}>
                <Step n={1} label={STEPS[0]} state={stepState(1)} />
                <Step n={2} label={phase === "error" && stage > 2 ? "Poster fabriqué" : STEPS[1]} state={stepState(2)} />
                <Step n={3} label={STEPS[2]} state={stepState(3)} />
              </View>
            )}

            {phase === "working" && (
              <Text style={{ fontSize: 12.5, color: C.textMid, textAlign: "center", lineHeight: 18, marginTop: 14 }}>
                Garde l'app ouverte et l'écran allumé.{"\n"}Ça prend un petit moment.
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
            {!!address && (
              <TouchableOpacity onPress={() => { orderRef.current = null; resumeRef.current = null; setLeftover(false); run(); }}
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
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Voir mes commandes</Text>
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
