// components/shared/SharedPendingRows.js
// Accueil, mode Album : les envois vers un album partagé qui attendent (maquette Claude outputs/maquette-album-partage.html, écran 7).
//   · « 34 photos prêtes pour Augustin »  = tri fini mais « Plus tard » : toucher ouvre l'écran d'envoi ;
//   · « Envoi à Augustin… 21 / 34 »       = envoi en cours ou interrompu (il reprend tout seul) : toucher ouvre le suivi.
// Rien ne s'affiche s'il n'y a rien en attente.
import { View, TouchableOpacity } from "react-native";
import Text from "../AppText";
import Icon from "../Icons";
import { C } from "../../constants/theme";
import { useSharedStore } from "../../store/useSharedStore";

export default function SharedPendingRows({ onOpen }) {
  const selections = useSharedStore((s) => s.selections);
  const outbox = useSharedStore((s) => s.outbox);
  const upload = useSharedStore((s) => s.upload);

  const albumIds = [...new Set([...Object.keys(selections), ...Object.keys(outbox)])];
  const rows = albumIds.map((id) => {
    const sel = selections[id];
    const box = outbox[id];
    const meta = sel ?? box;
    if (!meta) return null;
    const waiting = box?.ids?.length ?? 0;
    const picked = sel?.ids?.length ?? 0;
    if (waiting + picked === 0) return null;
    const total = box?.total ?? waiting;
    const sending = waiting > 0;
    const title = sending ? `Envoi à ${meta.ownerName}…` : `${picked} photo${picked > 1 ? "s" : ""} prête${picked > 1 ? "s" : ""} pour ${meta.ownerName}`;
    const sub = sending
      ? `${Math.max(0, total - waiting)} / ${total}${upload?.albumId === id && upload.error ? " · en pause" : ""} · « ${meta.name} »`
      : `Album « ${meta.name} » · pas encore envoyées`;
    return { id, album: { id, name: meta.name, ownerName: meta.ownerName }, title, sub, sending };
  }).filter(Boolean);

  if (rows.length === 0) return null;
  return (
    <View style={{ gap: 8, marginBottom: 10 }}>
      {rows.map((r) => (
        <TouchableOpacity key={r.id} onPress={() => onOpen(r.album)} activeOpacity={0.85}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.albumSoft, borderRadius: 16, padding: 12, borderWidth: 1.5, borderColor: C.album }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }}>
            <Icon name="mail" size={17} color="#fff" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{r.title}</Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: C.textMuted }}>{r.sub}</Text>
          </View>
          <Icon name="chevronRight" size={16} color={C.album} />
        </TouchableOpacity>
      ))}
    </View>
  );
}
