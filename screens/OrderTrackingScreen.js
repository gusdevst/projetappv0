// screens/OrderTrackingScreen.js
// Suivi d'une commande de livre (maquette `maquette-labo-en-route.html`, écran 2, validée le 15 nov. 2026).
// Ouvert en touchant une ligne du bloc « En route » (Labo) : navigate("OrderTracking", { orderId }).
// L'avancement est relu chez l'imprimeur à l'ouverture et en tirant vers le bas (pas de notification : il faudra le webhook).
// Pas de date par étape : on ne garde que la date de commande et la dernière mise à jour ; le n° de colis s'affiche une fois expédiée.
// Les envois de l'abonnement Coups de cœur gardent leur propre écran de suivi (`SubscriptionTracking`).

import { useCallback, useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl, Linking, StatusBar } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import Icon from "../components/Icons";
import { BookCover } from "../components/book/BookPage";
import { useBookFonts } from "../components/book/bookFonts";
import { SHADOW } from "../components/home/ui";
import { C, S } from "../constants/theme";
import { formatEuro } from "../constants/subscription";
import { usePhotoStore } from "../store/usePhotoStore";
import { useOrdersStore } from "../store/useOrdersStore";
import { ORDER_STEPS, ORDER_STATUS, orderStepIndex, isIncomplete, orderKindOf, ORDER_KIND_LABEL, ORDER_RESUME_ROUTE, orderProductLine } from "../services/bookOrder";
import { pageRatio } from "../services/photoBook";
import { shortDate } from "../services/printSelection";
import { confirmAbandonOrder } from "../services/orderActions";

const PRODUCT_LABEL = { a4: "21 × 29,7 cm", paysage: "21 × 15 cm" };
const POSTER_LABEL = { a4: "A4 · 21 × 29,7 cm", a3: "A3 · 29,7 × 42 cm", a2: "A2 · 42 × 59,4 cm", a1: "A1 · 59 × 84 cm" };
const trackUrl = (n) => `https://www.laposte.fr/outils/suivre-vos-envois?code=${encodeURIComponent(n)}`;

export function OrderTrackingScreen({ navigation, route }) {
  const { orderId } = route.params;
  const order      = useOrdersStore((s) => s.orders.find((o) => o.id === orderId));
  const load       = useOrdersStore((s) => s.load);
  const books      = usePhotoStore((s) => s.books);
  const printed    = usePhotoStore((s) => s.printed);
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const [refreshing, setRefreshing] = useState(false);
  useBookFonts();

  useFocusEffect(useCallback(() => { load({ refresh: true, force: true }); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load({ refresh: true, force: true }); setRefreshing(false); };

  const urlById = useMemo(() => {
    const m = {};
    [...libraryPhotos, ...printed].forEach((p) => { if (p && !m[p.id]) m[p.id] = p.url; });
    return m;
  }, [libraryPhotos, printed]);

  if (!order) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: S.pad }}>
        <BackButton accentColor={C.album} onPress={() => navigation.goBack()} />
        <Text style={{ fontSize: 13, color: C.textMid, textAlign: "center", marginTop: 40 }}>Cette commande est introuvable.</Text>
      </SafeAreaView>
    );
  }

  const kindOf = orderKindOf(order);
  const poster = kindOf !== "book"; // poster et tirages : pas de couverture ni de « Commander à nouveau »
  const held = order.status === "received"; // poster enregistré chez Pellicule, pas (encore) transmis à l'imprimeur
  const book = !poster && order.album_id ? books[order.album_id] : null;
  const idx = orderStepIndex(order);
  const incomplete = isIncomplete(order);
  const st = ORDER_STATUS[order.status] ?? { label: order.status };
  const created = Date.parse(order.created_at);

  // Détail sous chaque étape (on ne connaît pas la date de chaque étape).
  const detail = (i) => {
    if (i === 0) return shortDate(created);
    if (i === 2 && idx >= 2) return order.tracking_number ? `Colissimo ${order.tracking_number}` : "Colissimo";
    if (i === 3) return idx >= 3 ? `Mise à jour le ${shortDate(Date.parse(order.updated_at) || created)}` : "en général 2 à 4 jours après l'envoi";
    return null;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingTop: 8, paddingBottom: 4 }}>
        <BackButton accentColor={C.album} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11.5, color: C.textMuted }}>{ORDER_KIND_LABEL[kindOf]}</Text>
          <Text style={{ fontSize: 19, fontWeight: "600", color: C.text }}>Suivi de commande</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.pad, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.album} />}>

        {/* En-tête : couverture, titre, n° et date, étape en cours */}
        <View style={[{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12 }, SHADOW]}>
          {book
            ? <BookCover cover={book.cover} size={54} ratio={pageRatio(book)} urlById={urlById} />
            : <View style={{ width: 54, height: 72, borderRadius: 4, backgroundColor: C.album }} />}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: "600", color: C.text }}>{order.title || ORDER_KIND_LABEL[kindOf]}</Text>
            <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{order.ref} · commandé le {shortDate(created)}</Text>
            <View style={{ alignSelf: "flex-start", marginTop: 6, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: incomplete ? "#fbeadb" : C.albumSoft }}>
              <Text style={{ fontSize: 11.5, fontWeight: "700", color: incomplete ? "#c4621c" : C.album }}>
                {incomplete ? `Commande ${st.label.toLowerCase()}` : held ? "Commande reçue" : ORDER_STEPS[idx].label}
              </Text>
            </View>
          </View>
        </View>

        {/* Étapes */}
        {held && (
          <View style={[{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, marginTop: 14 }, SHADOW]}>
            <Text style={{ fontSize: 13.5, fontWeight: "600", color: C.text }}>Ta commande est bien enregistrée</Text>
            <Text style={{ fontSize: 12.5, color: C.textMid, lineHeight: 18, marginTop: 4 }}>
              Elle n'est pas encore transmise à l'imprimeur : le suivi de fabrication et d'expédition apparaîtra ici dès qu'elle partira.
            </Text>
          </View>
        )}
        {!incomplete && !held && (
          <View style={[{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, marginTop: 14 }, SHADOW]}>
            {ORDER_STEPS.map((step, i) => {
              const done = i < idx || idx === ORDER_STEPS.length - 1;
              const now = i === idx && !done;
              const last = i === ORDER_STEPS.length - 1;
              return (
                <View key={step.key} style={{ flexDirection: "row", gap: 12, paddingBottom: last ? 0 : 16 }}>
                  {!last && <View style={{ position: "absolute", left: 10, top: 22, bottom: 0, width: 2, backgroundColor: i < idx ? C.album : C.border }} />}
                  <View style={[{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: done ? C.album : C.bgMuted },
                    now && { backgroundColor: C.bgCard, borderWidth: 2.5, borderColor: C.album }]}>
                    {done && <Icon name="check" size={12} color="#fff" strokeWidth={3.2} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: done || now ? "600" : "500", color: done || now ? C.text : C.textMuted }}>{step.label}</Text>
                    {!!detail(i) && <Text style={{ fontSize: 11.5, color: C.textMuted }}>{detail(i)}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Récap */}
        <View style={[{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, marginTop: 14 }, SHADOW]}>
          {[
            ["Produit", orderProductLine(order)],
            ...(order.price_cents != null ? [["Prix", `${formatEuro(order.price_cents)} TTC, livraison comprise`]] : []),
            ["Livraison", `${order.address?.name ?? ""}${order.address?.city ? `, ${order.address.city}` : ""}`],
          ].map(([k, v], i) => (
            <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: 14, paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: C.border }}>
              <Text style={{ fontSize: 12.5, color: C.textMuted }}>{k}</Text>
              <Text style={{ flex: 1, fontSize: 12.5, fontWeight: "600", color: C.text, textAlign: "right" }}>{v}</Text>
            </View>
          ))}
          {__DEV__ && order.test && <Text style={{ fontSize: 11, color: "#c4621c", marginTop: 6 }}>🧪 commande de test</Text>}
        </View>

        {/* Actions */}
        {incomplete && (
          <>
            <Btn label="Reprendre la commande" onPress={() => navigation.navigate(ORDER_RESUME_ROUTE[kindOf], { orderId: order.id, albumId: order.album_id })} />
            <TouchableOpacity onPress={() => confirmAbandonOrder(order, () => navigation.goBack())} hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}
              style={{ height: 44, alignItems: "center", justifyContent: "center", marginTop: 6 }}>
              <Text style={{ color: "#c4621c", fontWeight: "600", fontSize: 13.5 }}>Abandonner cette commande</Text>
            </TouchableOpacity>
          </>
        )}
        {!incomplete && !!order.tracking_number && <Btn label="Suivre mon colis" onPress={() => Linking.openURL(trackUrl(order.tracking_number))} />}
        {!incomplete && !!book && (
          <Btn alt label="Commander à nouveau" onPress={() => navigation.navigate("BookCheck", { albumId: order.album_id })} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Btn({ label, onPress, alt }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}
      style={{ height: 48, borderRadius: S.radiusFull, alignItems: "center", justifyContent: "center", marginTop: 14,
        backgroundColor: alt ? "transparent" : C.album, borderWidth: alt ? 1.5 : 0, borderColor: C.album }}>
      <Text style={{ color: alt ? C.album : "#fff", fontWeight: "700", fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  );
}
