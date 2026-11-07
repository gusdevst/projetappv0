// screens/SubscriptionListScreen.js
// « Mes abonnements » (maquette validée, écran 10) : un abonnement par carte, total mensuel,
// historique, pause, résiliation. Ouvert depuis la carte « Abonnement » de la Galerie.
// Résilier = l'abonnement disparaît de la liste mais son historique d'envois est gardé.

import { useState, useMemo, useEffect } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar, Alert, Modal, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import Icon from "../components/Icons";
import BackButton from "../components/BackButton";
import { ListRow, SectionTitle, SHADOW } from "../components/home/ui";
import { C } from "../constants/theme";
import SubDaysFields from "../components/SubDaysFields";
import { SUB_FORMAT_LABEL, priceCentsFor, formatEuro, dayLabel, subDays, productOf } from "../constants/subscription";
import { monthKey, monthName, nextMonthKey } from "../services/printSelection";
import { requestPermission } from "../services/notificationService";
import { syncOrderStatuses } from "../services/printOrders";
import { sendTestSubscriptionNotification } from "../services/subscriptionNotifications";
import { useSubscriptionStore } from "../store/useSubscriptionStore";
import { useAuthStore } from "../store/useAuthStore";

const labelOf = (x) => (x.kind === "self" ? "Pour moi" : x.name);

function Pill({ text, on }) {
  return (
    <View style={{ backgroundColor: on ? C.sage : C.bgMuted, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontSize: 9.5, fontWeight: "700", color: on ? C.accent : C.textMuted }}>{text}</Text>
    </View>
  );
}

function DashedRow({ label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.album, borderRadius: 15, paddingVertical: 13, marginTop: 10 }}>
      <Text style={{ fontSize: 18, color: C.album, marginTop: -2 }}>+</Text>
      <Text style={{ fontSize: 13.5, fontWeight: "600", color: C.album }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SubscriptionListScreen({ navigation }) {
  const allSubs    = useSubscriptionStore((s) => s.subs);
  const selections = useSubscriptionStore((s) => s.selections);
  const updateSub  = useSubscriptionStore((s) => s.updateSub);
  const email      = useAuthStore((s) => s.session?.user?.email);

  const subs  = useMemo(() => allSubs.filter((x) => x.status !== "cancelled"), [allSubs]);
  const month = monthKey();
  const next  = monthName(nextMonthKey(month));
  const hasSelf = subs.some((x) => x.kind === "self");
  useEffect(() => { syncOrderStatuses(); }, []); // statuts d'impression à jour (table print_orders)
  const [daysSubId, setDaysSubId] = useState(null); // abonnement dont on change les dates
  const daysSub = subs.find((x) => x.id === daysSubId);

  const totalCents = subs.filter((x) => x.status === "active").reduce((a, x) => a + priceCentsFor(x.count, x.product), 0);

  // Une action sur « un abonnement » : directe s'il n'y en a qu'un, sinon on demande lequel.
  function onOne(title, candidates, action) {
    if (candidates.length === 0) return;
    if (candidates.length === 1) { action(candidates[0]); return; }
    Alert.alert(title, "Pour quel abonnement ?", [
      ...candidates.map((x) => ({ text: labelOf(x), onPress: () => action(x) })),
      { text: "Annuler", style: "cancel" },
    ]);
  }

  const activeOnes = subs.filter((x) => x.status === "active");
  const pausedOnes = subs.filter((x) => x.status === "paused");

  function pause(x) {
    Alert.alert("Mettre en pause ?", `Plus de sélection pour « ${labelOf(x)} » tant que tu ne reprends pas.`, [
      { text: "Annuler", style: "cancel" },
      { text: "Mettre en pause", onPress: () => updateSub(x.id, { status: "paused" }) },
    ]);
  }
  function cancel(x) {
    Alert.alert("Résilier ?", `L'abonnement « ${labelOf(x)} » s'arrête. Les envois déjà validés restent dans l'historique.`, [
      { text: "Annuler", style: "cancel" },
      { text: "Résilier", style: "destructive", onPress: () => updateSub(x.id, { status: "cancelled" }) },
    ]);
  }

  async function testNotif(x) {
    const ok = (await requestPermission()) && (await sendTestSubscriptionNotification(x));
    Alert.alert(
      ok ? "Notification programmée" : "Notifications refusées",
      ok ? "Elle arrive dans 5 secondes. Mets l'app en arrière-plan, puis touche-la pour ouvrir la sélection." : "Autorise les notifications dans les réglages du téléphone."
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={{ fontSize: 19, fontWeight: "600", color: C.text }}>Mes abonnements</Text>
        </View>

        <View style={{ gap: 10, marginTop: 14 }}>
          {subs.map((x) => {
            const sel = selections[x.id]?.[month];
            const done = sel?.status === "validated";
            const paused = x.status === "paused";
            const { selectionDay, sendDay } = subDays(x);
            const initial = x.kind === "self" ? (email?.[0] ?? "M").toUpperCase() : (x.name?.[0] ?? "?").toUpperCase();
            return (
              <TouchableOpacity key={x.id} activeOpacity={0.85} disabled={paused}
                onPress={() => navigation.navigate("SubscriptionMonth", { subId: x.id })}
                style={[{ backgroundColor: C.bgCard, borderRadius: 16, padding: 14 }, SHADOW]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: x.kind === "self" ? C.sage2 : C.albumSoft }}>
                    <Text style={{ fontSize: 17, fontWeight: "800", color: x.kind === "self" ? C.accent : C.album }}>{initial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: "500", color: C.text }} numberOfLines={1}>{labelOf(x)}</Text>
                    <Text style={{ fontSize: 11, color: C.textMuted }}>{x.count} {productOf(x).units} · {x.product === "magnets" ? "5 × 5 cm" : SUB_FORMAT_LABEL}</Text>
                  </View>
                  <Pill text={paused ? "EN PAUSE" : "ACTIF"} on={!paused} />
                </View>
                <View style={{ height: 1, backgroundColor: C.border, marginTop: 11, marginBottom: 9 }} />
                {paused ? (
                  <Text style={{ fontSize: 12, color: C.textMuted }}>Aucune sélection tant que l'abonnement est en pause.</Text>
                ) : done ? (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 12, color: C.textMid }}>Prochaine sélection</Text>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: C.text }}>{dayLabel(selectionDay)} {next}</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 12, color: C.textMid }}>Sélection de {monthName(month)}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: C.accent }}>À valider · avant le {sendDay} ›</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {!hasSelf && <DashedRow label="M'abonner pour moi" onPress={() => navigation.navigate("SubscriptionSetup", { kind: "self" })} />}
        <DashedRow label={subs.some((x) => x.kind === "gift") ? "Offrir à un autre proche" : "Offrir à un proche"}
          onPress={() => navigation.navigate("SubscriptionSetup", { kind: "gift" })} />

        <SectionTitle title="TOTAL" />
        <View style={[{ backgroundColor: C.bgCard, borderRadius: 16, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }, SHADOW]}>
          <Text style={{ fontSize: 13, color: C.textMid }}>Chaque mois</Text>
          <Text style={{ fontSize: 17, fontWeight: "700", color: C.text }}>{formatEuro(totalCents)}</Text>
        </View>

        <View style={{ gap: 10, marginTop: 14 }}>
          <ListRow icon="calendar" title="Historique des envois" onPress={() => navigation.navigate("SubscriptionHistory")} />
          {activeOnes.length > 0 && (
            <ListRow icon="timer" iconColor={C.textMid} iconBg={C.bgMuted} title="Mettre en pause"
              onPress={() => onOne("Mettre en pause", activeOnes, pause)} />
          )}
          {pausedOnes.length > 0 && (
            <ListRow icon="refresh" title="Reprendre l'abonnement"
              onPress={() => onOne("Reprendre", pausedOnes, (x) => updateSub(x.id, { status: "active" }))} />
          )}
          {subs.length > 0 && (
            <ListRow icon="calendar" iconColor={C.textMid} iconBg={C.bgMuted} title="Changer les dates d'envoi"
              sub="Jour de réception et jour d'envoi à l'impression"
              onPress={() => onOne("Changer les dates", subs, (x) => setDaysSubId(x.id))} />
          )}
          {subs.length > 0 && (
            <ListRow icon="close" iconColor={C.red} iconBg={C.redSoft} title="Résilier"
              onPress={() => onOne("Résilier", subs, cancel)} />
          )}
          {__DEV__ && activeOnes.length > 0 && (
            <ListRow icon="bell" iconColor={C.yellow} iconBg={C.bgMuted} title="Tester la notification (mode dev)"
              sub="Arrive dans 5 secondes, comme celle du jour choisi"
              onPress={() => onOne("Tester la notification", activeOnes, testNotif)} />
          )}
        </View>
      </ScrollView>

      {/* Dates d'envoi d'un abonnement (modifiées tout de suite) */}
      <Modal visible={!!daysSub} transparent animationType="slide" onRequestClose={() => setDaysSubId(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable onPress={() => setDaysSubId(null)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(35,39,31,0.42)" }} />
          {!!daysSub && (
            <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28 }}>
              <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: 12 }} />
              <Text style={{ fontSize: 16, fontWeight: "600", color: C.text }}>Dates d'envoi · {labelOf(daysSub)}</Text>
              <SubDaysFields {...subDays(daysSub)} onChange={(d) => updateSub(daysSub.id, d)} />
              <TouchableOpacity onPress={() => setDaysSubId(null)} activeOpacity={0.85}
                style={[{ height: 48, borderRadius: 24, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", marginTop: 16 }, SHADOW]}>
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Terminé</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
