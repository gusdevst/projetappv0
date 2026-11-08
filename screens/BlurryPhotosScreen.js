// ─────────────────────────────────────────────
// screens/BlurryPhotosScreen.js
// Écran « Photos floues » (mode Tri) : grille des photos repérées floues, TOUTES cochées par défaut.
// Toucher la coche = garder la photo (elle sera décochée) ; toucher la photo = la voir en grand.
// Maquette : Claude outputs/maquette-recherche-flou.html, partie 2.
// ─────────────────────────────────────────────
import { useMemo, useState } from "react";
import { View, FlatList, TouchableOpacity, Modal, Dimensions, StatusBar } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import Icon from "../components/Icons";
import BlurConfirmSheet from "../components/BlurConfirmSheet";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { useBlurryPhotos } from "../hooks/useBlurryPhotos";

const { width: SW } = Dimensions.get("window");
const COLS = 3;
const GAP = 4;
const CELL = Math.floor((SW - S.pad * 2 - GAP * (COLS - 1)) / COLS);
const ROW_H = CELL + GAP;

function formatSize(mo) {
  if (mo < 1) return "0 Mo";
  if (mo < 1024) return `${mo.toFixed(0)} Mo`;
  return `${(mo / 1024).toFixed(1)} Go`;
}

const plural = (n, word) => `${n.toLocaleString("fr-FR")} ${word}${n > 1 ? "s" : ""}`;

// Pastille verte « WhatsApp » (sur la photo et dans la ligne « Dont … »).
function WhatsAppPill({ style }) {
  return (
    <View style={[{ backgroundColor: C.sage, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }, style]}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: C.accent }}>WhatsApp</Text>
    </View>
  );
}

// Coche ronde : pleine verte = cochée (sera traitée), vide = gardée.
function CheckCircle({ on, size = 24 }) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center",
        backgroundColor: on ? C.accent : "rgba(255,255,255,0.4)",
        borderWidth: 2, borderColor: "#fff",
      }}
    >
      {on && <Icon name="check" size={size * 0.55} color="#fff" strokeWidth={3} />}
    </View>
  );
}

export function BlurryPhotosScreen({ navigation }) {
  const { items, count, analyzing, pct } = useBlurryPhotos();
  const [unchecked, setUnchecked] = useState(() => new Set()); // ids décochés (= gardés) ; tout le reste est coché
  const [opened, setOpened] = useState(null);                  // photo vue en grand
  const [confirmOpen, setConfirmOpen] = useState(false);       // feuille « Mettre N photos à la corbeille ? »
  const addDeletedMany = usePhotoStore((s) => s.addDeletedMany);
  const addBlurKept = usePhotoStore((s) => s.addBlurKept);

  const checkedCount = useMemo(
    () => items.reduce((n, x) => n + (unchecked.has(x.photo.id) ? 0 : 1), 0),
    [items, unchecked],
  );
  const totalSize = useMemo(() => items.reduce((a, x) => a + (x.photo.size || 0), 0), [items]);
  const waCount = useMemo(() => items.reduce((n, x) => n + (x.whatsapp ? 1 : 0), 0), [items]);
  const allChecked = checkedCount === count;

  // Photos cochées (à traiter) et décochées (à garder).
  const checkedItems = useMemo(() => items.filter((x) => !unchecked.has(x.photo.id)), [items, unchecked]);
  const keptItems = useMemo(() => items.filter((x) => unchecked.has(x.photo.id)), [items, unchecked]);
  const checkedSize = useMemo(() => checkedItems.reduce((a, x) => a + (x.photo.size || 0), 0), [checkedItems]);

  // Corbeille : les cochées vont à la corbeille de Pellicule (restaurable), les décochées sont
  // mémorisées « gardées » (plus jamais proposées comme floues). Puis retour à l'accueil.
  function confirmTrash() {
    addDeletedMany(checkedItems.map((x) => x.photo));
    addBlurKept(keptItems.map((x) => x.photo.id));
    setConfirmOpen(false);
    navigation.goBack();
  }

  // Tri en swipe : directement, sur les photos cochées uniquement.
  function startSwipe() {
    if (checkedItems.length === 0) return;
    navigation.navigate("Swipe", { queue: checkedItems.map((x) => x.photo), mode: "menage" });
  }

  function toggle(id) {
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setUnchecked(allChecked ? new Set(items.map((x) => x.photo.id)) : new Set());
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* En-tête : retour · titre + total · Tout décocher / Tout cocher */}
      <View style={{ paddingHorizontal: S.pad }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 }}>
          <BackButton mode="menage" onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 19, fontWeight: "600", color: C.text }}>Photos floues</Text>
            <Text style={{ fontSize: 11.5, color: C.textMuted }}>
              {`${plural(count, "photo")} · ${formatSize(totalSize)}`}
              {analyzing ? ` · analyse en cours (${pct} %)` : ""}
            </Text>
          </View>
          {count > 0 && (
            <TouchableOpacity onPress={toggleAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: 12.5, fontWeight: "600", color: C.accent }}>
                {allChecked ? "Tout décocher" : "Tout cocher"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {waCount > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
            <Text style={{ fontSize: 11.5, color: C.textMuted }}>{`Dont ${plural(waCount, "photo")}`}</Text>
            <WhatsAppPill />
          </View>
        )}
      </View>

      {/* Grille : toutes cochées au départ */}
      <FlatList
        data={items}
        numColumns={COLS}
        keyExtractor={(x) => x.photo.id}
        extraData={unchecked}
        style={{ marginTop: 10 }}
        contentContainerStyle={{ paddingHorizontal: S.pad, paddingBottom: 12 }}
        columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
        getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
        initialNumToRender={18}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={
          <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 40 }}>
            {analyzing ? `Analyse en cours (${pct} %)…` : "Aucune photo floue pour l'instant."}
          </Text>
        }
        renderItem={({ item }) => {
          const id = item.photo.id;
          const on = !unchecked.has(id);
          return (
            <TouchableOpacity activeOpacity={0.85} onPress={() => setOpened(item)} style={{ width: CELL, height: CELL }}>
              <Image
                source={{ uri: item.photo.url }}
                recyclingKey={id}
                contentFit="cover"
                style={{ width: CELL, height: CELL, borderRadius: 8, backgroundColor: C.bgMuted, opacity: on ? 1 : 0.45 }}
              />
              {item.whatsapp && <WhatsAppPill style={{ position: "absolute", left: 4, bottom: 4 }} />}
              <TouchableOpacity
                onPress={() => toggle(id)}
                hitSlop={{ top: 6, bottom: 10, left: 10, right: 6 }}
                style={{ position: "absolute", top: 5, right: 5 }}
              >
                <CheckCircle on={on} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />

      {/* Aide + boutons du bas : agissent sur les photos COCHÉES */}
      <View style={{ paddingHorizontal: S.pad, paddingTop: 6, paddingBottom: 10, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border }}>
        <Text style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginBottom: 8 }}>
          Toucher une photo = la voir en grand · toucher la coche = garder
        </Text>
        <TouchableOpacity
          disabled={checkedCount === 0}
          onPress={() => setConfirmOpen(true)}
          style={{ backgroundColor: C.red, borderRadius: 14, paddingVertical: 13, alignItems: "center", opacity: checkedCount === 0 ? 0.4 : 1 }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
            {`Mettre ${plural(checkedCount, "photo")} à la corbeille`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={checkedCount === 0}
          onPress={startSwipe}
          style={{ marginTop: 7, borderRadius: 14, paddingVertical: 11, alignItems: "center", backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, opacity: checkedCount === 0 ? 0.4 : 1 }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>Les trier une par une (swipe)</Text>
        </TouchableOpacity>
      </View>

      {/* Confirmation avant la corbeille (maquette, écran C) */}
      <BlurConfirmSheet
        visible={confirmOpen}
        count={checkedCount}
        sizeLabel={formatSize(checkedSize)}
        keptCount={keptItems.length}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmTrash}
      />

      {/* Photo en grand : toucher n'importe où pour fermer */}
      <Modal visible={!!opened} transparent animationType="fade" onRequestClose={() => setOpened(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setOpened(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center" }}>
          {opened && (
            <>
              <Image source={{ uri: opened.photo.url }} contentFit="contain" style={{ width: SW, height: "82%" }} />
              {opened.whatsapp && <WhatsAppPill style={{ position: "absolute", left: 16, bottom: 40 }} />}
              <TouchableOpacity
                onPress={() => toggle(opened.photo.id)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ position: "absolute", right: 16, bottom: 36 }}
              >
                <CheckCircle on={!unchecked.has(opened.photo.id)} size={34} />
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
