// screens/SubscriptionTrackingScreen.js
// Suivi d'une sélection validée (maquette validée, écran 9) : Validée → En impression → Expédiée → Livrée.
// Ouvert juste après « Valider », ou depuis l'historique / la sélection du mois.
// L'étape vient de `selection.stage` (absent = « validée ») : elle sera mise à jour par le serveur plus tard.

import { useEffect } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import Icon from "../components/Icons";
import { ListRow, SHADOW } from "../components/home/ui";
import { C } from "../constants/theme";
import { subDays, productOf } from "../constants/subscription";
import { monthName, shortDate, STAGES, stageIndex } from "../services/printSelection";
import { syncOrderStatuses } from "../services/printOrders";
import { useSubscriptionStore } from "../store/useSubscriptionStore";

const DELIVERY_DAYS = 7; // « Autour du … » = validation + 7 jours (estimation)

export function SubscriptionTrackingScreen({ navigation, route }) {
  const { subId, month } = route.params;
  const subs       = useSubscriptionStore((s) => s.subs);
  const selections = useSubscriptionStore((s) => s.selections);

  useEffect(() => { syncOrderStatuses(); }, []); // « En impression », « Expédiée »… viennent de la table print_orders

  const sub = subs.find((x) => x.id === subId);
  const sel = selections[subId]?.[month];
  if (!sub || !sel || sel.status !== "validated") return null;

  const idx  = stageIndex(sel);
  const mois = monthName(month);
  const n    = sel.photoCount ?? sel.photoIds.length; // photoCount : envoi retrouvé depuis un autre téléphone
  const who  = sub.kind === "self" ? "Pour moi" : `Pour ${sub.name}`;

  // Détail sous chaque étape.
  const detail = (i) => {
    if (i === 0) return shortDate(sel.validatedAt);
    if (i === STAGES.length - 1) return `Autour du ${shortDate(sel.validatedAt + DELIVERY_DAYS * 86400000)}`;
    return STAGES[i].hint;
  };

  // Les autres abonnements actifs : encore à valider ce mois-ci ?
  const others = subs.filter((x) => x.status === "active" && x.id !== subId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: "center" }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: C.sage, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Icon name="check" size={36} color={C.accent} strokeWidth={2.6} />
          </View>
          <Text style={{ fontSize: 23, fontWeight: "700", color: C.text }}>C'est parti !</Text>
          <Text style={{ fontSize: 12.5, color: C.textMid, textAlign: "center", marginTop: 5 }}>
            {sub.kind === "self"
              ? `Tes ${n} ${productOf(sub).units} de ${mois} sont en route.`
              : `Les ${n} ${productOf(sub).units} de ${mois} pour ${sub.name} sont en route.`}
          </Text>
        </View>

        <View style={[{ backgroundColor: C.bgCard, borderRadius: 16, padding: 14, marginTop: 18 }, SHADOW]}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: C.text }}>{who} · {mois}</Text>
          <View style={{ marginTop: 14, paddingLeft: 4 }}>
            {STAGES.map((st, i) => {
              const done = i <= idx;
              const now  = i === idx + 1;
              const last = i === STAGES.length - 1;
              return (
                <View key={st.key} style={{ flexDirection: "row", gap: 12, paddingBottom: last ? 0 : 18 }}>
                  {!last && <View style={{ position: "absolute", left: 11, top: 24, bottom: 0, width: 2, backgroundColor: done ? C.sage3 : C.border }} />}
                  <View style={[{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: done ? C.accent : C.bgMuted },
                    now && { backgroundColor: C.bgCard, borderWidth: 2.5, borderColor: C.accent }]}>
                    {done && <Icon name="check" size={13} color="#fff" strokeWidth={3.2} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: done || now ? "600" : "500", color: done || now ? C.text : C.textMuted }}>{st.label}</Text>
                    {!!detail(i) && <Text style={{ fontSize: 11.5, color: C.textMuted }}>{detail(i)}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {others.length > 0 && (
          <View style={{ gap: 10, marginTop: 10 }}>
            {others.map((x) => {
              const s = selections[x.id]?.[month];
              const done = s?.status === "validated";
              return (
                <ListRow key={x.id}
                  thumb={<View style={{ width: 44, height: 44, borderRadius: 11, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 20 }}>📮</Text></View>}
                  title={`${x.kind === "self" ? "Pour moi" : x.name} · ${mois}`}
                  sub={done ? "Validée" : `Encore à valider · avant le ${subDays(x).sendDay}`}
                  onPress={() => navigation.navigate(done ? "SubscriptionTracking" : "SubscriptionMonth", done ? { subId: x.id, month } : { subId: x.id })} />
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 26, borderTopWidth: 1, borderTopColor: C.border }}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate("Main", { screen: "GalleryTab" })}
          style={{ height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.textMid, fontSize: 15, fontWeight: "700" }}>Retour à la galerie</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
