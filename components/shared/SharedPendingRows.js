// components/shared/SharedPendingRows.js
// Accueil, mode Album : retrouver facilement mon travail pour un album PARTAGÉ avec moi (je suis celui qui envoie).
// Une ligne par album, selon l'état :
//   · tri pas fini      : « Reprendre pour Augustin » · 12 / 80 passées en revue · 5 choisies  → toucher = reprendre le swipe là où je me suis arrêté ;
//                         bouton « Envoyer 5 » à droite si des photos sont déjà choisies (envoi sans finir le tri) ;
//   · tri fini / « Plus tard » : « 34 photos prêtes pour Augustin » → toucher = écran d'envoi ;
//   · envoi en cours / en pause : « Envoi à Augustin… 21 / 34 » → toucher = suivi (il reprend tout seul).
// Rien ne s'affiche s'il n'y a rien en attente.
import { View, TouchableOpacity } from "react-native";
import Text from "../AppText";
import Icon from "../Icons";
import { C } from "../../constants/theme";
import { useSharedStore } from "../../store/useSharedStore";

// onOpen(album) = écran d'envoi ; onResume(album) = reprendre le swipe
export default function SharedPendingRows({ onOpen, onResume }) {
  const selections = useSharedStore((s) => s.selections);
  const outbox = useSharedStore((s) => s.outbox);
  const sorts = useSharedStore((s) => s.sorts);
  const upload = useSharedStore((s) => s.upload);

  const albumIds = [...new Set([...Object.keys(selections), ...Object.keys(outbox), ...Object.keys(sorts)])];
  const rows = albumIds.map((id) => {
    const sel = selections[id];
    const box = outbox[id];
    const sort = sorts[id];
    const meta = sort ?? sel ?? box;
    if (!meta) return null;
    const waiting = box?.ids?.length ?? 0;
    const picked = sel?.ids?.length ?? 0;
    const left = sort ? Math.max(0, sort.photoIds.length - sort.idx) : 0;
    if (waiting + picked + left === 0) return null;
    const total = box?.total ?? waiting;
    const album = { id, name: meta.name, ownerName: meta.ownerName };
    const owner = meta.ownerName;
    const plural = (n) => (n > 1 ? "s" : "");

    if (left > 0) { // tri pas fini
      return {
        id, album, kind: "resume",
        title: `Reprendre pour ${owner}`,
        sub: `${sort.idx} / ${sort.photoIds.length} passées en revue · ${picked} choisie${plural(picked)} · « ${meta.name} »`,
        sendCount: picked,
      };
    }
    if (waiting > 0) { // envoi en cours / en pause
      return {
        id, album, kind: "open",
        title: `Envoi à ${owner}…`,
        sub: `${Math.max(0, total - waiting)} / ${total}${upload?.albumId === id && upload.error ? " · en pause" : ""} · « ${meta.name} »`,
      };
    }
    return {
      id, album, kind: "open",
      title: `${picked} photo${plural(picked)} prête${plural(picked)} pour ${owner}`,
      sub: `Album « ${meta.name} » · pas encore envoyée${plural(picked)}`,
    };
  }).filter(Boolean);

  if (rows.length === 0) return null;
  return (
    <View style={{ gap: 8, marginBottom: 10 }}>
      {rows.map((r) => (
        <TouchableOpacity key={r.id} onPress={() => (r.kind === "resume" ? onResume(r.album) : onOpen(r.album))} activeOpacity={0.85}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.albumSoft, borderRadius: 16, padding: 12, borderWidth: 1.5, borderColor: C.album }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }}>
            <Icon name="mail" size={17} color="#fff" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{r.title}</Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: C.textMuted }}>{r.sub}</Text>
          </View>
          {r.sendCount > 0 ? (
            <TouchableOpacity onPress={() => onOpen(r.album)} hitSlop={6}
              style={{ backgroundColor: C.album, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 12.5 }}>{`Envoyer ${r.sendCount}`}</Text>
            </TouchableOpacity>
          ) : (
            <Icon name="chevronRight" size={16} color={C.album} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}
