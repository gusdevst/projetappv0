// components/labo/EnRouteBlock.js
// Lignes du bloc « En route » (bas du Labo, maquette `maquette-labo-en-route.html` validée le 15 nov. 2026).
// Le titre de section (« En route · Toutes › ») est posé par GalleryHomeScreen (DarkLabel y est défini).
// Style = briques de la Chambre noire : fond `tray`, liseré lumineux à gauche selon l'état
// (orange = à reprendre · halo = en cours · vert = livrée), 4 petits segments d'avancement.
// Pas d'ombre sur fond non opaque (dette n°7, Android) : seulement des aplats.

import { View, TouchableOpacity } from "react-native";
import Text from "../AppText";
import { BookCover } from "../book/BookPage";
import { pageRatio } from "../../services/photoBook";
import { DARKROOM as D, C } from "../../constants/theme";
import { DELIVERED_KEEP_DAYS } from "../../services/enRoute";

const GLOW = { todo: D.todoGlow, go: D.halo, ok: C.sage3 };

// Vignette : la vraie couverture si le livre est encore sur ce téléphone, sinon un livre dessiné ; pour l'abonnement, deux tirages.
function Thumb({ item, books, urlById }) {
  const book = item.albumId ? books?.[item.albumId] : null;
  return (
    <View style={{ width: 48, height: 48, borderRadius: 11, backgroundColor: D.glow[2], alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {item.type === "book" && book && (
        <BookCover cover={book.cover} size={26} ratio={pageRatio(book)} urlById={urlById} />
      )}
      {item.type === "book" && !book && (
        <View style={{ width: 26, height: 38, borderRadius: 3, backgroundColor: C.album }} />
      )}
      {item.type === "print" && (
        <>
          <View style={{ position: "absolute", left: 7, top: 10, width: 20, height: 26, backgroundColor: D.paper, borderRadius: 2, transform: [{ rotate: "-8deg" }] }} />
          <View style={{ position: "absolute", left: 20, top: 12, width: 20, height: 26, backgroundColor: D.paper, borderRadius: 2, transform: [{ rotate: "7deg" }] }} />
        </>
      )}
      {item.type === "poster" && (
        <View style={{ width: 28, height: 38, borderRadius: 2, backgroundColor: D.paper, borderWidth: 2, borderColor: D.paper, overflow: "hidden" }}>
          <View style={{ flex: 1, backgroundColor: C.album, opacity: 0.85 }} />
        </View>
      )}
      {item.type === "sub" && (
        <>
          <View style={{ position: "absolute", left: 6, top: 9, width: 20, height: 25, backgroundColor: D.paper, borderRadius: 2, transform: [{ rotate: "-8deg" }] }} />
          <View style={{ position: "absolute", left: 20, top: 11, width: 20, height: 25, backgroundColor: D.paper, borderRadius: 2, transform: [{ rotate: "7deg" }] }} />
        </>
      )}
    </View>
  );
}

export default function EnRouteBlock({ items, books, urlById, onOpen, onAll, onAbandon }) {
  if (!items.length) return null;
  const hasDelivered = items.some((x) => x.tone === "ok");
  return (
    <View>
      {items.map((it) => {
        const todo = it.tone === "todo";
        return (
          <TouchableOpacity key={it.key} activeOpacity={0.85} onPress={() => onOpen(it)}
            style={{ marginTop: 10, borderRadius: 16, backgroundColor: D.tray, borderWidth: 1, borderColor: todo ? "#b8493a" : D.trayEdge, paddingVertical: 10, paddingLeft: 16, paddingRight: 12, flexDirection: "row", alignItems: "center", gap: 11 }}>
            <View style={{ position: "absolute", left: 0, top: 11, bottom: 11, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: GLOW[it.tone] }} />
            <Thumb item={it} books={books} urlById={urlById} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: D.paper }}>{it.title}</Text>
              <Text numberOfLines={1} style={{ fontSize: 11, color: D.halo, opacity: 0.8, marginTop: 1 }}>{it.subtitle}</Text>
              {it.step >= 0 && it.tone !== "ok" && (
                <View style={{ flexDirection: "row", gap: 3, marginTop: 7 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i < it.step ? C.sage3 : i === it.step ? D.halo : "rgba(255,201,188,0.22)" }} />
                  ))}
                </View>
              )}
              <Text style={{ fontSize: 11, fontWeight: "600", marginTop: 5, color: todo ? "#ffd9ce" : it.tone === "ok" ? C.sage3 : D.halo }}>
                {todo ? "● " : ""}{it.statusLabel}
              </Text>
              {it.resume && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 }}>
                  <View style={{ backgroundColor: D.todoBg, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 11.5, fontWeight: "700", color: D.paper }}>Reprendre la commande</Text>
                  </View>
                  {!!onAbandon && !!it.order && (
                    <TouchableOpacity onPress={() => onAbandon(it.order)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: "600", color: D.halo, textDecorationLine: "underline" }}>Abandonner</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
            {!it.resume && <Text style={{ fontSize: 20, color: D.halo, opacity: 0.7 }}>›</Text>}
          </TouchableOpacity>
        );
      })}
      {hasDelivered && (
        <Text style={{ fontSize: 10, color: D.halo, opacity: 0.6, textAlign: "center", marginTop: 8 }}>
          Une commande livrée disparaît d'ici après {DELIVERED_KEEP_DAYS} jours.
        </Text>
      )}
      <TouchableOpacity activeOpacity={0.8} onPress={onAll}
        style={{ marginTop: 14, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(255,214,204,0.45)", paddingVertical: 11, alignItems: "center" }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: D.paper }}>Toutes mes commandes ›</Text>
      </TouchableOpacity>
    </View>
  );
}
