// screens/BookOrdersScreen.js
// « Mes commandes » : les commandes de livres photo (table `orders`), leur avancement et le numéro de suivi.
// À l'ouverture (et en tirant vers le bas), l'avancement est relu chez l'imprimeur (fonction `imprimeur-order`, action « refresh »).
// Une commande interrompue (« Non envoyée », « À transmettre ») se reprend d'un toucher : BookOrderProgress { orderId }.

import { useEffect, useRef, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { SHADOW } from "../components/home/ui";
import { C, S } from "../constants/theme";
import { useAuthStore } from "../store/useAuthStore";
import { useOrdersStore } from "../store/useOrdersStore";
import { isIncomplete, ORDER_STATUS, orderKindOf, ORDER_KIND_LABEL, ORDER_RESUME_ROUTE, orderProductLine } from "../services/bookOrder";
import { confirmAbandonOrder } from "../services/orderActions";
import { formatEuro } from "../constants/subscription";

const dateFr = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const PRODUCT_LABEL = { a4: "21 × 29,7 cm", paysage: "21 × 15 cm" };
const POSTER_LABEL = { a4: "A4 · 21 × 29,7 cm", a3: "A3 · 29,7 × 42 cm", a2: "A2 · 42 × 59,4 cm", a1: "A1 · 59 × 84 cm" };

export function BookOrdersScreen({ navigation }) {
  const signedIn = !!useAuthStore((s) => s.session);
  // Les commandes viennent du store partagé avec le bloc « En route » du Labo (relues à chaque ouverture).
  const storeOrders = useOrdersStore((s) => s.orders);
  const loaded = useOrdersStore((s) => s.loaded);
  const failed = useOrdersStore((s) => s.failed);
  const load = useOrdersStore((s) => s.load);
  const orders = !signedIn ? [] : loaded ? storeOrders : null; // null = chargement
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  useEffect(() => {
    if (!signedIn) return;
    load({ refresh: true });
    return navigation.addListener("focus", () => load({ refresh: true }));
  }, [signedIn, load, navigation]);

  const onRefresh = async () => { setRefreshing(true); await load({ refresh: true, force: true }); if (alive.current) setRefreshing(false); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingTop: 8, paddingBottom: 12 }}>
        <BackButton accentColor={C.album} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11.5, color: C.textMuted }}>Livres, posters et tirages</Text>
          <Text style={{ fontSize: 19, fontWeight: "600", color: C.text }}>Mes commandes</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.pad, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.album} />}>
        {!signedIn && (
          <Text style={{ fontSize: 13, color: C.textMid, lineHeight: 19, textAlign: "center", marginTop: 30 }}>
            Connecte-toi pour retrouver tes commandes.
          </Text>
        )}
        {signedIn && orders === null && <ActivityIndicator color={C.album} style={{ marginTop: 30 }} />}
        {signedIn && failed && (
          <View style={{ backgroundColor: C.albumSoft, borderRadius: 14, padding: 12, marginBottom: 12 }}>
            <Text style={{ fontSize: 12.5, color: C.text, lineHeight: 18 }}>Impossible de lire tes commandes (connexion ?). Tire vers le bas pour réessayer.</Text>
          </View>
        )}
        {signedIn && orders && orders.length === 0 && !failed && (
          <Text style={{ fontSize: 13, color: C.textMid, lineHeight: 19, textAlign: "center", marginTop: 30 }}>
            Aucune commande pour l'instant.{"\n"}Tes livres, posters et tirages commandés apparaîtront ici.
          </Text>
        )}

        {(orders ?? []).map((o) => {
          const st = ORDER_STATUS[o.status] ?? { label: o.status, tone: "ok" };
          const warn = st.tone === "warn";
          return (
            <TouchableOpacity key={o.id} activeOpacity={0.85} onPress={() => navigation.navigate("OrderTracking", { orderId: o.id })}
              style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, marginBottom: 12, ...SHADOW }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: C.text }}>{o.title || ORDER_KIND_LABEL[orderKindOf(o)]}</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                    {o.ref} · {dateFr(o.created_at)}
                  </Text>
                </View>
                <View style={{ borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: warn ? "#fbeadb" : st.tone === "done" ? C.sage : C.albumSoft }}>
                  <Text style={{ fontSize: 11.5, fontWeight: "700", color: warn ? "#c4621c" : st.tone === "done" ? C.accent : C.album }}>{st.label}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 12.5, color: C.textMid, lineHeight: 18, marginTop: 8 }}>
                {orderProductLine(o)}{o.price_cents != null ? ` · ${formatEuro(o.price_cents)} TTC` : ""}
                {"\n"}Livraison : {o.address?.name}, {o.address?.city}
              </Text>
              {!!o.tracking_number && (
                <Text style={{ fontSize: 12.5, color: C.text, marginTop: 6 }}>Suivi Colissimo : <Text style={{ fontWeight: "700" }}>{o.tracking_number}</Text></Text>
              )}
              {__DEV__ && o.test && <Text style={{ fontSize: 11, color: "#c4621c", marginTop: 6 }}>🧪 commande de test</Text>}
              {isIncomplete(o) && (
                <>
                  {!!o.error && __DEV__ && <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>[dev] {o.error}</Text>}
                  <TouchableOpacity onPress={() => navigation.navigate(ORDER_RESUME_ROUTE[orderKindOf(o)], { orderId: o.id, albumId: o.album_id })}
                    style={{ height: 44, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center", marginTop: 12 }}>
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Reprendre la commande</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmAbandonOrder(o)} hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}
                    style={{ height: 40, alignItems: "center", justifyContent: "center", marginTop: 4 }}>
                    <Text style={{ color: "#c4621c", fontWeight: "600", fontSize: 13 }}>Abandonner cette commande</Text>
                  </TouchableOpacity>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
