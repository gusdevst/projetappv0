// components/home/AlbumHero.js
// Mode Album : haut de l'accueil, MÊME construction que le mode Tri (TriHero), en terracotta
// (maquette `Claude outputs/maquette-album-accueil.html`, piste A, validée le 10 nov.) :
//   illustration (un album ouvert, une vraie photo de la sélection y tombe) → « Ton prochain album : 48 photos »
//   → « 2,3 Go · du 3 juin au 28 août 2026 » → barre « 48 sur 12 480 photos » → bouton « Créer un album ».
// Pas de bouton loupe pour l'instant (la recherche reste dans « Affiner la sélection »).
// La suite de l'écran (« Affiner la sélection ») est dans HomeScreen.

import { View, TouchableOpacity } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Ellipse, Path, Rect } from "react-native-svg";
import Text from "../AppText";
import { C } from "../../constants/theme";
import FallingPhoto from "./FallingPhoto";

// Couleurs de l'illustration (un album en terracotta ; fixes, comme les teintes de DarkroomCover).
const BOOK_EDGE = "#a5522f";
const PAGE_LEFT = ["#f6e9e0", "#e6cdbd"];
const PAGE_RIGHT = "#f8eee6";
const SPINE = "#d8b9a4";
const TAB = "#e5cbbb";

function OpenAlbum({ photoUrl }) {
  return (
    <View style={{ width: 150, height: 104 }}>
      <Svg width={150} height={104} viewBox="0 0 170 120">
        <Defs>
          <LinearGradient id="al-page" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={PAGE_LEFT[0]} /><Stop offset="1" stopColor={PAGE_LEFT[1]} />
          </LinearGradient>
        </Defs>
        <Ellipse cx="85" cy="112" rx="62" ry="6" fill="#000" opacity={0.06} />
        <Path d="M18 66 L85 78 L152 66 L152 104 L85 116 L18 104Z" fill={BOOK_EDGE} />
        <Path d="M22 62 L85 74 L85 108 L22 98Z" fill="url(#al-page)" />
        <Path d="M148 62 L85 74 L85 108 L148 98Z" fill={PAGE_RIGHT} />
        <Path d="M85 74 V108" stroke={SPINE} strokeWidth={1.5} />
        <Rect x="34" y="78" width="22" height="16" rx="2" fill={TAB} transform="rotate(8 45 86)" />
        <Rect x="112" y="78" width="22" height="16" rx="2" fill={TAB} transform="rotate(-8 123 86)" />
        {/* pas de photo (photothèque pas chargée) : une carte vide */}
        {!photoUrl && <Rect x="53" y="9" width="60" height="60" rx="11" fill={C.albumSoft} transform="rotate(-7 85 40)" />}
      </Svg>
      {!!photoUrl && <FallingPhoto uri={photoUrl} left={46} top={7} size={55} rotate="-7deg" radius={10} />}
    </View>
  );
}

const frNum = (n) => n.toLocaleString("fr-FR");

export default function AlbumHero({ count, totalLibrary, infoLine, photoUrl, busy, onLaunch }) {
  const empty = count === 0;
  const pct = totalLibrary > 0 ? Math.min(100, Math.max(count > 0 ? 2 : 0, (count / totalLibrary) * 100)) : 0;
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ alignItems: "center" }}>
        <OpenAlbum photoUrl={photoUrl} />

        {empty ? (
          <Text style={{ fontSize: 15.5, fontWeight: "500", color: C.text, marginTop: 8, textAlign: "center" }}>
            {busy ? "Chargement de tes photos…" : "Aucune photo avec ces filtres"}
          </Text>
        ) : (
          <>
            <Text style={{ fontSize: 15.5, fontWeight: "500", color: C.text, marginTop: 4, textAlign: "center" }} numberOfLines={1} adjustsFontSizeToFit>
              Ton prochain album :{" "}
              <Text style={{ fontSize: 23, fontWeight: "600", color: C.album }}>{frNum(count)} photo{count > 1 ? "s" : ""}</Text>
            </Text>
            {!!infoLine && <Text style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4, textAlign: "center" }}>{infoLine}</Text>}
          </>
        )}
      </View>

      {/* Barre : part de la photothèque dans la sélection */}
      {!empty && (
        <>
          <View style={{ height: 8, borderRadius: 5, backgroundColor: C.bgMuted, overflow: "hidden", marginTop: 12, marginHorizontal: 30 }}>
            <View style={{ height: 8, width: `${pct}%`, backgroundColor: C.album, borderRadius: 5 }} />
          </View>
          <Text style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 6 }}>
            <Text style={{ fontWeight: "600", color: C.text }}>{frNum(count)}</Text>
            {" "}sur {frNum(totalLibrary)} photos de ta photothèque
          </Text>
        </>
      )}

      {/* Bouton principal */}
      <TouchableOpacity
        onPress={onLaunch}
        disabled={busy || empty}
        style={{
          marginTop: 16, backgroundColor: C.album, borderRadius: 16, paddingVertical: 11, alignItems: "center",
          opacity: busy || empty ? 0.6 : 1,
          shadowColor: C.album, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 12,
          // Android : pas d'ombre quand le bouton est grisé (ombre + transparence = rectangle gris)
          elevation: busy || empty ? 0 : 4,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>
          {busy ? "Chargement…" : empty ? "Ajuste tes filtres" : "Créer un album"}
        </Text>
        {!busy && !empty && (
          <Text style={{ fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.85)", marginTop: 1 }}>
            {frNum(count)} photo{count > 1 ? "s" : ""}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
