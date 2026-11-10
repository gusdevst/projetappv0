// screens/SubscriptionListScreen.js
// « Mes abonnements » (maquette validée, écran 10) : un abonnement par carte + total mensuel.
// Toucher une carte ouvre la GESTION de cet abonnement (SubscriptionManageScreen : sélection du mois, historique,
// dates, pause, résiliation) — plus de boutons globaux qui demandent « pour quel abonnement ? ».
// Ouvert depuis « Gérer › » de la Galerie. Résilier retire l'abonnement de la liste ; son historique est gardé.

import { useMemo, useEffect } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { SectionTitle, SHADOW } from "../components/home/ui";
import { C } from "../constants/theme";
import { SUB_FORMAT_LABEL, priceCentsFor, formatEuro, dayLabel, subDays, productOf } from "../constants/subscription";
import { monthKey, monthName, nextMonthKey } from "../services/printSelection";
import { syncOrderStatuses } from "../services/printOrders";
import { useSubscriptionStore } from "../store/useSubscriptionStore";
import { useAuthStore } from "../store/useAuthStore";

const labelOf = (x) => (x.kind === "self" ? "Pour moi" : x.name);

function Pill({ text, on }) {
  return (
    <View style={{ backgroundColor: on ? C.albumSoft : C.bgMuted, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontSize: 9.5, fontWeight: "700", color: on ? C.album : C.textMuted }}>{text}</Text>
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
  const email      = useAuthStore((s) => s.session?.user?.email);

  const subs  = useMemo(() => allSubs.filter((x) => x.status !== "cancelled"), [allSubs]);
  const month = monthKey();
  const next  = monthName(nextMonthKey(month));
  const hasSelf = subs.some((x) => x.kind === "self");
  useEffect(() => { syncOrderStatuses(); }, []); // statuts d'impression à jour (table print_orders)

  const totalCents = subs.filter((x) => x.status === "active").reduce((a, x) => a + priceCentsFor(x.count, x.product), 0);

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
              <TouchableOpacity key={x.id} activeOpacity={0.85}
                onPress={() => navigation.navigate("SubscriptionManage", { subId: x.id })}
                style={[{ backgroundColor: C.bgCard, borderRadius: 16, padding: 14 }, SHADOW]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: x.kind === "self" ? "#ecd3c3" : C.bgMuted }}>
                    <Text style={{ fontSize: 17, fontWeight: "800", color: x.kind === "self" ? C.album : C.textMid }}>{initial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: "500", color: C.text }} numberOfLines={1}>{labelOf(x)}</Text>
                    <Text style={{ fontSize: 11, color: C.textMuted }}>{x.count} {productOf(x).units} · {x.product === "magnets" ? "5 × 5 cm" : SUB_FORMAT_LABEL}</Text>
                  </View>
                  <Pill text={paused ? "EN PAUSE" : "ACTIF"} on={!paused} />
                  <Text style={{ color: C.textMuted, fontSize: 18 }}>›</Text>
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
                    <Text style={{ fontSize: 12, fontWeight: "700", color: C.album }}>À valider · avant le {sendDay}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {!hasSelf && <DashedRow label="M'abonner pour moi" onPress={() => navigation.navigate("SubscriptionIntro")} />}
        <DashedRow label={subs.some((x) => x.kind === "gift") ? "Offrir à un autre proche" : "Offrir à un proche"}
          onPress={() => navigation.navigate("SubscriptionIntro")} />

        <SectionTitle title="TOTAL" />
        <View style={[{ backgroundColor: C.bgCard, borderRadius: 16, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }, SHADOW]}>
          <Text style={{ fontSize: 13, color: C.textMid }}>Chaque mois</Text>
          <Text style={{ fontSize: 17, fontWeight: "700", color: C.text }}>{formatEuro(totalCents)}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
