// screens/SubscriptionManageScreen.js
// Gérer UN abonnement : voir la sélection / le suivi du mois, historique de CET abonnement, dates d'envoi,
// pause / reprise, résiliation. Ouvert en touchant un abonnement dans « Mes abonnements », ou avec le bouton
// « Gérer » de la sélection du mois. `route.params` : { subId, editDays? } (editDays = ouvre tout de suite les dates).

import { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar, Alert, Modal, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import SubscriptionRow from "../components/SubscriptionRow";
import SubDaysFields from "../components/SubDaysFields";
import { ListRow, SectionTitle, SHADOW } from "../components/home/ui";
import { useKeptUrls } from "../components/ProductArt";
import { C } from "../constants/theme";
import { dayLabel, subDays } from "../constants/subscription";
import { monthKey, monthName, subStatus } from "../services/printSelection";
import { requestPermission } from "../services/notificationService";
import { sendTestSubscriptionNotification } from "../services/subscriptionNotifications";
import { syncOrderStatuses } from "../services/printOrders";
import { useSubscriptionStore } from "../store/useSubscriptionStore";

export function SubscriptionManageScreen({ navigation, route }) {
  const { subId, editDays } = route.params ?? {};
  const subs       = useSubscriptionStore((s) => s.subs);
  const selections = useSubscriptionStore((s) => s.selections);
  const updateSub  = useSubscriptionStore((s) => s.updateSub);
  const urls       = useKeptUrls(3);
  const [daysOpen, setDaysOpen] = useState(!!editDays);

  const sub = subs.find((x) => x.id === subId);
  useEffect(() => { syncOrderStatuses(); }, []); // statuts d'impression à jour
  // Abonnement introuvable ou résilié : on quitte cette page.
  useEffect(() => { if (!sub || sub.status === "cancelled") navigation.goBack(); }, [sub?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sub || sub.status === "cancelled") return null;

  const month = monthKey();
  const sel = selections[sub.id]?.[month];
  const st = subStatus(sub, sel);
  const paused = sub.status === "paused";
  const label = `${sub.product === "magnets" ? "Magnets" : "Tirages"} · ${sub.kind === "self" ? "pour moi" : sub.name}`;
  const { selectionDay, sendDay } = subDays(sub);
  const sentCount = Object.values(selections[sub.id] ?? {}).filter((x) => x.status === "validated").length;

  const openSelection = () => navigation.navigate(st.kind === "validated" ? "SubscriptionTracking" : "SubscriptionMonth",
    st.kind === "validated" ? { subId: sub.id, month } : { subId: sub.id });

  function pause() {
    Alert.alert("Mettre en pause ?", `Plus de sélection pour « ${label} » tant que tu ne reprends pas.`, [
      { text: "Annuler", style: "cancel" },
      { text: "Mettre en pause", onPress: () => updateSub(sub.id, { status: "paused" }) },
    ]);
  }
  function cancel() {
    Alert.alert("Résilier ?", `L'abonnement « ${label} » s'arrête. Les envois déjà validés restent dans l'historique.`, [
      { text: "Annuler", style: "cancel" },
      { text: "Résilier", style: "destructive", onPress: () => updateSub(sub.id, { status: "cancelled" }) }, // la page se ferme toute seule
    ]);
  }
  async function testNotif() {
    const ok = (await requestPermission()) && (await sendTestSubscriptionNotification(sub));
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
          <Text style={{ fontSize: 19, fontWeight: "600", color: C.text }}>Gérer l'abonnement</Text>
        </View>

        {/* Résumé de l'abonnement (toucher = sa sélection du mois) */}
        <View style={{ marginTop: 14 }}>
          <SubscriptionRow sub={sub} st={st} urls={urls} hideMenu onPress={paused ? undefined : openSelection} />
        </View>

        <View style={{ gap: 10, marginTop: 14 }}>
          {!paused && (
            <ListRow icon={st.kind === "validated" ? "mail" : "grid"}
              title={st.kind === "validated" ? "Voir le suivi" : `Voir ma sélection de ${monthName(month)}`}
              onPress={openSelection} />
          )}
          <ListRow icon="calendar" title="Historique des envois"
            sub={sentCount ? `${sentCount} envoi${sentCount > 1 ? "s" : ""}` : "Aucun envoi pour l'instant"}
            onPress={() => navigation.navigate("SubscriptionHistory", { subId: sub.id })} />
          <ListRow icon="timer" iconColor={C.textMid} iconBg={C.bgMuted} title="Changer les dates d'envoi"
            sub={`Réception le ${dayLabel(selectionDay)} · envoi le ${sendDay}`}
            onPress={() => setDaysOpen(true)} />
          {paused ? (
            <ListRow icon="refresh" title="Reprendre l'abonnement" onPress={() => updateSub(sub.id, { status: "active" })} />
          ) : (
            <ListRow icon="timer" iconColor={C.textMid} iconBg={C.bgMuted} title="Mettre en pause" onPress={pause} />
          )}
          <ListRow icon="close" iconColor={C.red} iconBg={C.redSoft} title="Résilier" onPress={cancel} />
          {__DEV__ && !paused && (
            <ListRow icon="bell" iconColor={C.yellow} iconBg={C.bgMuted} title="Tester la notification (mode dev)"
              sub="Arrive dans 5 secondes, comme celle du jour choisi" onPress={testNotif} />
          )}
        </View>

        {/* Livraison : ce qu'on a enregistré (lecture seule) */}
        <SectionTitle title="LIVRAISON" />
        <View style={[{ backgroundColor: C.bgCard, borderRadius: 16, padding: 14 }, SHADOW]}>
          <Text style={{ fontSize: 13.5, fontWeight: "600", color: C.text }}>{sub.recipient || sub.name}</Text>
          <Text style={{ fontSize: 12.5, color: C.textMid, lineHeight: 18, marginTop: 2 }}>{sub.address}</Text>
          {!!sub.message && <Text style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic", marginTop: 6 }}>« {sub.message} »</Text>}
        </View>
      </ScrollView>

      {/* Dates d'envoi (enregistrées tout de suite) */}
      <Modal visible={daysOpen} transparent animationType="slide" onRequestClose={() => setDaysOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable onPress={() => setDaysOpen(false)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(35,39,31,0.42)" }} />
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28 }}>
            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: 12 }} />
            <Text style={{ fontSize: 16, fontWeight: "600", color: C.text }}>Dates d'envoi · {label}</Text>
            <SubDaysFields {...subDays(sub)} onChange={(d) => updateSub(sub.id, d)} />
            <TouchableOpacity onPress={() => setDaysOpen(false)} activeOpacity={0.85}
              style={[{ height: 48, borderRadius: 24, backgroundColor: C.album, alignItems: "center", justifyContent: "center", marginTop: 16 }, SHADOW]}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Terminé</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
