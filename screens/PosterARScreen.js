// screens/PosterARScreen.js
// « Voir ce poster chez toi » : le poster composé par l'utilisateur, posé sur son mur en réalité augmentée, à la VRAIE taille.
// Maquette : `Claude outputs/maquette-poster-voir-chez-moi-v2.html` (écrans 3, 4, 5). Techno : ViroReact 2.56 (essai concluant sur Android, 13 nov.).
//
// Parcours :
//   1. « Préparation » : le poster (photo + cadrage + titre, ou pêle-mêle) est « photographié » hors écran (PosterTexture) → c'est la texture.
//   2. La caméra s'ouvre. L'utilisateur se place FACE AU MUR, règle la distance qui l'en sépare (− / +, 1,50 m par défaut : pas de détection de mur,
//      un mur lisse n'est reconnu qu'en petits morceaux) puis « Poser le poster » : il apparaît à la verticale, tourné vers lui, centré sur le point visé.
//      Si une surface est détectée au centre de l'écran, c'est ce point qui est utilisé ; sinon, la distance réglée.
//   3. Réglages fins ← → ↑ ↓ (5 cm), pastilles des 4 formats avec la qualité (dpi) de CE poster et le prix, bouton rond = photo.
//   4. « Vu chez toi » : la photo (enregistrer / partager, revoir en AR) et « Choisir l'A3 » → retour à « Cadre ton poster » avec ce format.
// params : { photoId, collage, crop, title, format, dpis: { a4, a3, a2, a1 } } (dpis calculés par PosterFormatScreen).

import { useRef, useState, useEffect, useCallback } from "react";
import { View, TouchableOpacity, StatusBar, ActivityIndicator, Alert, Image as RNImage } from "react-native";
import * as Sharing from "expo-sharing";
import { ViroARSceneNavigator, ViroARScene, ViroQuad, ViroNode, ViroMaterials, ViroAmbientLight } from "@reactvision/react-viro";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import PosterTexture from "../components/poster/PosterTexture";
import { C } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { formatEuro } from "../constants/subscription";
import {
  POSTER_FORMATS, POSTER_FORMAT_KEYS, DEFAULT_POSTER_FORMAT, posterDims, posterSizeLabel, posterPriceCents, posterQualityLevel,
} from "../services/posterProducts";

const TONES = { good: "#7bd34f", ok: "#7bd34f", warn: "#ffc46b", bad: "#ff8a7a" };
const ICON = { good: "✓", ok: "✓", warn: "⚠", bad: "⚠" };
const DEFAULT_DIST = 1.5, DIST_STEP = 0.25, NUDGE = 0.05;
const m2 = (v) => v.toFixed(2).replace(".", ",");
const log = (...a) => { if (__DEV__) console.log("[AR]", ...a); };

function PosterScene(props) {
  const { matName, dims, pose, onTracking, onHit, onCamera } = props.sceneNavigator.viroAppProps;
  return (
    <ViroARScene
      anchorDetectionTypes={["PlanesVertical", "PlanesHorizontal"]}
      onTrackingUpdated={(state) => onTracking(state)}
      onCameraARHitTest={(e) => onHit(e)}
      onCameraTransformUpdate={(t) => onCamera(t)}
    >
      <ViroAmbientLight color="#ffffff" />
      {pose && (
        <ViroNode position={pose.position} rotation={[0, pose.yaw, 0]}>
          <ViroQuad width={dims.w} height={dims.h} materials={[matName]} />
        </ViroNode>
      )}
    </ViroARScene>
  );
}

export function PosterARScreen({ navigation, route }) {
  const params = route.params ?? {};
  const dpis = params.dpis ?? {};
  const navRef = useRef(null);

  // Préparation du poster (texture) : "prep" → "ar" ; ou "error".
  const [phase, setPhase] = useState("prep");
  const [tex, setTex] = useState(null); // { matName, landscape }
  const [fmt, setFmt] = useState(params.format ?? DEFAULT_POSTER_FORMAT);
  const [dist, setDist] = useState(DEFAULT_DIST);
  const [placed, setPlaced] = useState(null); // { position, yaw }
  const [adj, setAdj] = useState({ dx: 0, dy: 0 });
  const [shot, setShot] = useState(null);     // { uri } : la photo « vu chez toi »
  const [shooting, setShooting] = useState(false);
  const [info, setInfo] = useState({ tracking: "…", target: "" });

  const onTextureDone = useCallback((res) => {
    if (!res?.uri) { log("texture : échec", res?.error); setPhase("error"); return; }
    const matName = `posterAR_${Date.now()}`;
    ViroMaterials.createMaterials({ [matName]: { diffuseTexture: { uri: res.uri }, lightingModel: "Constant" } });
    setTex({ matName, landscape: !!res.landscape });
    setPhase("ar");
    usePhotoStore.getState().notePosterAr(); // badge « Œil de décorateur »
  }, []);

  // Les événements AR arrivent très souvent : rangés dans une réf, l'écran n'est actualisé que 3 fois par seconde.
  const live = useRef({ tracking: "…", hit: null, cam: null, target: "" });
  useEffect(() => {
    if (phase !== "ar") return undefined;
    const t = setInterval(() => setInfo({ tracking: live.current.tracking, target: live.current.target }), 330);
    return () => clearInterval(t);
  }, [phase]);
  const onTracking = useCallback((state) => { live.current.tracking = state === 3 ? "ok" : state === 2 ? "limited" : "none"; }, []);
  const onHit = useCallback((e) => {
    const r = e?.hitTestResults?.[0] ?? null;
    live.current.hit = r;
    if (e?.cameraOrientation) live.current.cam = { ...(live.current.cam ?? {}), ...{ position: e.cameraOrientation.position, forward: e.cameraOrientation.forward } };
    if (r && e?.cameraOrientation) {
      const c = e.cameraOrientation.position, p = r.transform.position;
      live.current.target = m2(Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]));
    } else live.current.target = "";
  }, []);
  const onCamera = useCallback((t) => {
    const c = t?.cameraTransform ?? t;
    const position = t?.position ?? c?.position, forward = t?.forward ?? c?.forward;
    if (position && forward) live.current.cam = { position, forward };
  }, []);

  // « Poser le poster » : sur la surface visée s'il y en a une, sinon à la distance réglée devant la caméra ; à la verticale, face à la personne.
  const place = () => {
    const { hit, cam } = live.current;
    if (!cam) { Alert.alert("Un instant", "La caméra se prépare. Bouge doucement le téléphone, puis réessaie."); return; }
    const fw = cam.forward;
    const yaw = (Math.atan2(-fw[0], -fw[2]) * 180) / Math.PI;
    const position = hit ? hit.transform.position : [cam.position[0] + fw[0] * dist, cam.position[1] + fw[1] * dist, cam.position[2] + fw[2] * dist];
    log("poser", JSON.stringify({ source: hit ? hit.type : `distance ${dist} m`, position, yaw }));
    setPlaced({ position, yaw });
    setAdj({ dx: 0, dy: 0 });
  };

  const dimsMm = posterDims(fmt, !!tex?.landscape);
  const dims = { w: dimsMm.widthMm / 1000, h: dimsMm.heightMm / 1000 };
  let pose = null;
  if (placed) {
    const rad = (placed.yaw * Math.PI) / 180;
    pose = { yaw: placed.yaw, position: [placed.position[0] + Math.cos(rad) * adj.dx, placed.position[1] + adj.dy, placed.position[2] - Math.sin(rad) * adj.dx] };
  }

  const takePhoto = async () => {
    if (shooting) return;
    setShooting(true);
    try {
      const res = await navRef.current?._takeScreenshot?.(`pellicule-ar-${Date.now()}`, false);
      if (res?.success && res.url) setShot({ uri: res.url.startsWith("file://") || res.url.startsWith("content://") ? res.url : `file://${res.url}` });
      else Alert.alert("Photo impossible", "La capture n'a pas fonctionné. Réessaie.");
    } catch (e) {
      Alert.alert("Photo impossible", "La capture n'a pas fonctionné. Réessaie.");
    }
    setShooting(false);
  };
  const sharePhoto = async () => {
    try { if (shot && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(shot.uri); } catch (e) { /* annulé */ }
  };
  // Retour à « Cadre ton poster » avec le format choisi.
  const choose = () => {
    try { navigation.popTo("PosterFormat", { pickedFormat: fmt, pickedAt: Date.now() }, { merge: true }); } catch (e) { navigation.goBack(); }
  };

  const f = POSTER_FORMATS[fmt];
  const lvl = posterQualityLevel(dpis[fmt] ?? null);
  const hint = lvl.key === "tight" ? "Un peu juste : vu de près, l'image sera moins nette." : lvl.key === "low" ? "Trop petite pour ce format : choisis un format plus petit." : "";
  const glass = "rgba(30,31,28,0.78)";
  const roundBtn = (label, onPress) => (
    <TouchableOpacity onPress={onPress} style={{ width: 44, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>{label}</Text>
    </TouchableOpacity>
  );

  // ── 1. Préparation / erreur ───────────────────────────────────────────────
  if (phase !== "ar") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <StatusBar barStyle="dark-content" />
        {phase === "prep" && <PosterTexture params={params} onDone={onTextureDone} />}
        {phase === "prep" ? (
          <>
            <ActivityIndicator color={C.album} size="large" />
            <Text style={{ fontSize: 15, fontWeight: "700", color: C.text, marginTop: 16 }}>Je prépare ton poster…</Text>
            <Text style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4, textAlign: "center" }}>Ton cadrage et ton titre sont pris en compte.</Text>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>Je n'ai pas pu préparer le poster</Text>
            <Text style={{ fontSize: 12.5, color: C.textMuted, marginTop: 6, textAlign: "center" }}>Vérifie que tes photos sont bien disponibles sur le téléphone, puis réessaie.</Text>
          </>
        )}
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 22, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 22, backgroundColor: C.bgMuted }}>
          <Text style={{ color: C.text, fontWeight: "600" }}>{phase === "prep" ? "Annuler" : "Retour"}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── 2. Caméra ─────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" />
      <ViroARSceneNavigator
        ref={navRef}
        autofocus
        initialScene={{ scene: PosterScene }}
        viroAppProps={{ matName: tex.matName, dims, pose, onTracking, onHit, onCamera }}
        style={{ flex: 1 }}
      />

      <SafeAreaView pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, justifyContent: "space-between" }}>
        {/* Consigne */}
        <View style={{ margin: 12, flexDirection: "row", alignItems: "flex-start", gap: 8 }} pointerEvents="box-none">
          <View style={{ flex: 1, padding: 10, borderRadius: 14, backgroundColor: glass }} pointerEvents="none">
            <Text style={{ color: "#fff", fontSize: 13, textAlign: "center" }}>
              {!placed ? "Place-toi face au mur, règle ta distance au mur, puis pose le poster." : "Le poster reste accroché au mur : approche-toi pour le voir de près. Ajuste avec les flèches."}
            </Text>
            {info.tracking === "limited" && <Text style={{ color: "#ffd9a0", fontSize: 11.5, textAlign: "center", marginTop: 3 }}>Bouge doucement le téléphone pour aider la caméra.</Text>}
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: glass, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Point visé */}
        {!placed && <View pointerEvents="none" style={{ position: "absolute", left: "50%", top: "50%", width: 26, height: 26, marginLeft: -13, marginTop: -13, borderRadius: 13, borderWidth: 2, borderColor: "#fff", opacity: 0.85 }} />}

        {/* Commandes */}
        <View style={{ padding: 12, paddingBottom: 16, backgroundColor: "rgba(30,31,28,0.55)" }}>
          {!placed ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 }}>
                <Text style={{ color: "#fff", fontSize: 13 }}>Distance jusqu'au mur</Text>
                {roundBtn("−", () => setDist((d) => Math.max(0.5, Math.round((d - DIST_STEP) * 100) / 100)))}
                <Text style={{ color: "#fff", fontWeight: "700", minWidth: 50, textAlign: "center" }}>{`${m2(dist)} m`}</Text>
                {roundBtn("＋", () => setDist((d) => Math.min(5, Math.round((d + DIST_STEP) * 100) / 100)))}
              </View>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11.5, textAlign: "center", marginTop: 6 }}>
                {info.target ? `Surface détectée à ${info.target} m : le poster s'y posera.` : "Aucune surface détectée : le poster se posera à la distance réglée."}
              </Text>
              <TouchableOpacity onPress={place} style={{ marginTop: 10, height: 48, borderRadius: 24, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Poser le poster</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
                {roundBtn("←", () => setAdj((a) => ({ ...a, dx: Math.round((a.dx - NUDGE) * 100) / 100 })))}
                {roundBtn("→", () => setAdj((a) => ({ ...a, dx: Math.round((a.dx + NUDGE) * 100) / 100 })))}
                {roundBtn("↑", () => setAdj((a) => ({ ...a, dy: Math.round((a.dy + NUDGE) * 100) / 100 })))}
                {roundBtn("↓", () => setAdj((a) => ({ ...a, dy: Math.round((a.dy - NUDGE) * 100) / 100 })))}
                <TouchableOpacity onPress={() => setPlaced(null)} style={{ height: 40, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Reposer</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
                {POSTER_FORMAT_KEYS.map((k) => {
                  const l = posterQualityLevel(dpis[k] ?? null);
                  const sel = k === fmt;
                  return (
                    <TouchableOpacity key={k} onPress={() => setFmt(k)} style={{ flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 12, backgroundColor: sel ? C.album : "rgba(255,255,255,0.2)" }}>
                      <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>{POSTER_FORMATS[k].name}</Text>
                      <Text style={{ color: sel ? "#fff" : TONES[l.tone], fontSize: 9, fontWeight: "700", marginTop: 1 }}>{dpis[k] != null ? `${ICON[l.tone]} ${dpis[k]} dpi` : "—"}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <Text style={{ color: "#fff", fontSize: 12 }}>
                  <Text style={{ color: TONES[lvl.tone], fontWeight: "700" }}>{`${ICON[lvl.tone]} ${lvl.label}`}</Text>
                  {`  ·  ${posterSizeLabel(fmt, !!tex.landscape)}`}
                </Text>
                <Text style={{ color: "#fff", fontWeight: "700" }}>{formatEuro(posterPriceCents(fmt))}</Text>
              </View>
              {!!hint && <Text style={{ color: "#ffd9a0", fontSize: 11, marginTop: 4, textAlign: "center" }}>{hint}</Text>}

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
                <TouchableOpacity onPress={takePhoto} disabled={shooting} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center", opacity: shooting ? 0.5 : 1 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff" }} />
                </TouchableOpacity>
                <TouchableOpacity onPress={choose} style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 14.5, fontWeight: "700" }}>{`Choisir l'${f.name}`}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>

      {/* ── 3. « Vu chez toi » : la photo prise ── */}
      {shot && (
        <SafeAreaView style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: C.bg }}>
          <StatusBar barStyle="dark-content" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 8 }}>
            <TouchableOpacity onPress={() => setShot(null)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 17 }}>‹</Text>
            </TouchableOpacity>
            <View>
              <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>Vu chez toi</Text>
              <Text style={{ fontSize: 12, color: C.textMuted }}>{`Poster ${f.name} · ${posterSizeLabel(fmt, !!tex.landscape)}`}</Text>
            </View>
          </View>
          <View style={{ flex: 1, marginHorizontal: 16, marginTop: 14, borderRadius: 18, overflow: "hidden", backgroundColor: "#000" }}>
            <RNImage source={{ uri: shot.uri }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
          </View>
          <View style={{ padding: 16, paddingBottom: 22 }}>
            <TouchableOpacity onPress={choose} style={{ height: 50, borderRadius: 25, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{`Choisir l'${f.name} · ${formatEuro(posterPriceCents(fmt))}`}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={sharePhoto} style={{ height: 44, borderRadius: 22, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center", marginTop: 9 }}>
              <Text style={{ color: C.album, fontSize: 14, fontWeight: "700" }}>Enregistrer / partager la photo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShot(null)} style={{ height: 44, borderRadius: 22, backgroundColor: C.albumSoft, alignItems: "center", justifyContent: "center", marginTop: 9 }}>
              <Text style={{ color: C.album, fontSize: 14, fontWeight: "700" }}>📷 Revoir en réalité augmentée</Text>
            </TouchableOpacity>
            <Text style={{ textAlign: "center", fontSize: 11.5, color: C.textMuted, marginTop: 8 }}>La photo reste sur ton téléphone. Rien n'est envoyé.</Text>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}
