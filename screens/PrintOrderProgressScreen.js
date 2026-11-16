// screens/PrintOrderProgressScreen.js
// Commander des tirages — envoi des photos et confirmation (même déroulé que PosterOrderProgressScreen / BookOrderProgressScreen).
// Ouvert par « Payer » : navigate("PrintOrderProgress", { photoIds, format, address })
// ou pour REPRENDRE une commande interrompue : { orderId } (les photos sont relues dans `orders.spec.source`).
// Étapes (services/printOrder.js) : commande enregistrée → photos envoyées (barre « 12 / 40 ») → commande « reçue ».
// ⚠️ Rien n'est transmis à imprimeur.fr (décision d'Augustin) : la commande reste chez Pellicule (table `orders`).

import { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import { SHADOW } from "../components/home/ui";
import { C, S } from "../constants/theme";
import { useOrdersStore } from "../store/useOrdersStore";
import { useAndroidBack } from "../hooks/useAndroidBack";
import { getOrder, discardOrder, isIncomplete, orderErrorText } from "../services/bookOrder";
import { createPrintOrder, uploadPrintPhotos, submitPrintOrder, printFormatOf } from "../services/printOrder";

const STEPS = ["Commande enregistrée", "J'envoie tes photos", "Je finalise ta commande"];

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

export function PrintOrderProgressScreen({ navigation, route }) {
  const given = route?.params ?? {};
  const resumeRef = useRef(given.orderId ?? null);
  const address = given.address;

  const orderRef = useRef(null);
  const startedRef = useRef(false);
  const cancelRef = useRef(false);
  const runId = useRef(0);
  const [phase, setPhase] = useState("working"); // "working" | "error" | "done" | "cancelled"
  const [stage, setStage] = useState(0);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(null);
  const [leftover, setLeftover] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: given.photoIds?.length ?? 0 });

  useEffect(() => { navigation.setOptions({ gestureEnabled: false }); }, [navigation]);

  const dropOrder = useCallback(async () => {
    const o = orderRef.current;
    orderRef.current = null;
    resumeRef.current = null;
    if (!o || !isIncomplete(o)) return;
    const ok = await discardOrder(o);
    useOrdersStore.getState().load({ refresh: false, force: true });
    if (!ok) setLeftover(true);
  }, []);

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
      let photoIds = given.photoIds ?? order?.spec?.source?.photoIds ?? [];
      if (!order) {
        if (!photoIds.length || !address) throw Object.assign(new Error("Photos ou adresse introuvables."), { kind: "server" });
        order = await createPrintOrder({ format: given.format, photoIds, address });
        if (stale()) { discardOrder(order); return; }
        orderRef.current = order;
      }
      if (["received", "transmitted", "printed", "mailed", "delivered"].includes(order.status)) { setDone(order); setPhase("done"); useOrdersStore.getState().load({ refresh: false, force: true }); return; }

      // 2. Les photos (sautées si déjà envoyées lors d'un essai précédent)
      if (!order.file_path || order.status === "draft") {
        photoIds = order.spec?.source?.photoIds ?? photoIds;
        setStage(2);
        setProgress({ done: 0, total: photoIds.length });
        order = await uploadPrintPhotos(order, photoIds, {
          onProgress: (d, t) => { if (!stale()) setProgress({ done: d, total: t }); },
          shouldStop: () => stale() || cancelRef.current,
        });
        if (stale()) return;
        orderRef.current = order;
      }

      // 3. Le serveur vérifie et enregistre (prix recalculé) — rien n'est envoyé à imprimeur.fr
      setStage(3);
      order = await submitPrintOrder(order.id);
      if (stale()) return;
      orderRef.current = order;
      useOrdersStore.getState().load({ refresh: false, force: true });
      setDone(order);
      setPhase("done");
    } catch (e) {
      if (stale() || e?.code === "cancelled") return;
      setErr(e);
      setPhase("error");
    }
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    run();
  }, [run]);

  const cancelNow = useCallback(() => {
    cancelRef.current = true;
    runId.current += 1;
    dropOrder();
    setPhase("cancelled");
  }, [dropOrder]);

  const askCancel = useCallback(() => {
    if (phase === "working" && stage >= 3) {
      Alert.alert("Envoi en cours", "Encore quelques instants : garde l'app ouverte.");
    } else if (phase === "working") {
      Alert.alert("Annuler la commande ?", "L'envoi des photos sera arrêté et la commande supprimée. Rien ne sera envoyé à l'imprimeur.", [
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
  const pct = Math.round((progress.done / Math.max(1, progress.total)) * 100);
  const toLabo = () => navigation.reset({ index: 0, routes: [{ name: "Main", params: { screen: "GalleryTab" } }] });
  const toOrders = () => navigation.reset({ index: 1, routes: [{ name: "Main", params: { screen: "GalleryTab" } }, { name: "BookOrders" }] });
  const fLabel = printFormatOf(given.format ?? orderRef.current?.product).label;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ padding: S.pad, paddingTop: 16, paddingBottom: 24 }}>
        {phase === "done" && done && (
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 11.5, color: C.textMuted }}>Commande n° {done.ref}</Text>
            <Text style={{ fontSize: 22, fontWeight: "700", color: C.text, marginTop: 2 }}>Commande reçue !</Text>
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.sage, alignItems: "center", justifyContent: "center", marginVertical: 18 }}>
              <Text style={{ fontSize: 34, fontWeight: "800", color: C.accent }}>✓</Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.text, textAlign: "center" }}>Tes tirages sont bien enregistrés</Text>
            <Text style={{ fontSize: 13, color: C.textMid, lineHeight: 19, textAlign: "center", marginTop: 6, marginBottom: 16, paddingHorizontal: 8 }}>
              Ils seront imprimés en France puis expédiés{done.address?.city ? ` à ${done.address.city}` : ""}. Tu retrouveras la commande dans « Mes commandes ».
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
              <Text style={{ fontSize: 11.5, color: C.textMuted }}>Commande en cours · tirages {fLabel}</Text>
              <Text style={{ fontSize: 22, fontWeight: "700", color: C.text, marginTop: 2 }}>
                {phase === "error" ? "Petit souci" : phase === "cancelled" ? "Commande annulée" : "Je prépare tes tirages"}
              </Text>
            </View>

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
                  ? "Rien n'a été envoyé à l'imprimeur, mais la commande est restée enregistrée : tu peux l'abandonner depuis « Mes commandes »."
                  : "Rien n'a été envoyé et la commande est supprimée."}
              </Text>
            )}

            {phase !== "cancelled" && (
              <View style={{ backgroundColor: C.bgCard, borderRadius: 18, paddingHorizontal: 14, ...SHADOW }}>
                <Step n={1} label={STEPS[0]} state={stepState(1)} />
                <Step n={2} label={phase === "error" && stage > 2 ? "Photos envoyées" : STEPS[1]} state={stepState(2)}>
                  {phase === "working" && stage === 2 && (
                    <>
                      <Text style={{ fontSize: 11.5, color: C.textMid }}>Photo {Math.min(progress.done + 1, progress.total)} sur {progress.total}</Text>
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
