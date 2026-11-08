// screens/SubscriptionHistoryScreen.js
// Historique des envois : toutes les sélections validées (tous abonnements, même résiliés),
// la plus récente en premier. Toucher une ligne ouvre son suivi.

import { useMemo, useEffect } from "react";
import { View, ScrollView, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { ListRow } from "../components/home/ui";
import { C } from "../constants/theme";
import { monthName, STAGES, stageIndex } from "../services/printSelection";
import { syncOrderStatuses } from "../services/printOrders";
import { useSubscriptionStore } from "../store/useSubscriptionStore";

export function SubscriptionHistoryScreen({ navigation, route }) {
  const onlySub = route?.params?.subId ?? null; // sinon : tous les abonnements
  const subs       = useSubscriptionStore((s) => s.subs);
  const selections = useSubscriptionStore((s) => s.selections);

  useEffect(() => { syncOrderStatuses(); }, []);

  const items = useMemo(() => {
    const out = [];
    subs.filter((sub) => !onlySub || sub.id === onlySub).forEach((sub) => {
      Object.entries(selections[sub.id] ?? {}).forEach(([month, sel]) => {
        if (sel.status === "validated") out.push({ sub, month, sel });
      });
    });
    return out.sort((a, b) => b.sel.validatedAt - a.sel.validatedAt);
  }, [subs, selections, onlySub]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={{ fontSize: 19, fontWeight: "600", color: C.text }}>Historique des envois</Text>
        </View>

        {items.length === 0 ? (
          <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 40, fontSize: 13 }}>Aucun envoi pour l'instant.</Text>
        ) : (
          <View style={{ gap: 10, marginTop: 14 }}>
            {items.map(({ sub, month, sel }) => (
              <ListRow key={`${sub.id}-${month}`} icon="mail"
                title={`${monthName(month)} ${month.slice(0, 4)} · ${sub.kind === "self" ? "Pour moi" : sub.name}`}
                sub={`${sel.photoCount ?? sel.photoIds.length} photo${(sel.photoCount ?? sel.photoIds.length) > 1 ? "s" : ""} · ${STAGES[stageIndex(sel)].label}`}
                onPress={() => navigation.navigate("SubscriptionTracking", { subId: sub.id, month })} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
