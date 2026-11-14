// screens/ArSpikeScreen.js  — SPIKE (__DEV__ seulement), branche spike/ar-viro
// Question posée : ViroReact 2.56 tourne-t-il dans CETTE app (Expo 54, RN 0.81, nouvelle architecture) ? → OUI (essai du 13 nov.).
// v3 (13 nov., version GARDÉE par Augustin) : un mur lisse n'est détecté qu'en petits morceaux et le « hit test » du centre de l'écran ne trouve rien dessus,
// donc « Poser ici » pose le poster À UNE DISTANCE RÉGLABLE devant la caméra (− / +), à la verticale, tourné vers la personne.
// (La v4 « viser le pied du mur / sol » a été essayée puis abandonnée à la demande d'Augustin : il préfère régler la distance.)
// À trouver pour la vraie version : une façon simple pour l'utilisateur de donner / mesurer la distance au mur (≈ 1,50 m).
// Les indicateurs (suivi, plans, cible, points jaunes) restent affichés pour le spike. Tout est aussi écrit dans Metro (préfixe [AR]).
// Mesures de `POSTER_FORMATS` (mm) → Viro travaille en MÈTRES.

import { useRef, useState, useEffect, useCallback } from "react";
import { View, TouchableOpacity, StatusBar } from "react-native";
import {
  ViroARSceneNavigator, ViroARScene, ViroARPlaneSelector, ViroQuad, ViroNode, ViroMaterials, ViroAmbientLight,
} from "@reactvision/react-viro";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import { C } from "../constants/theme";
import { POSTER_FORMATS, POSTER_FORMAT_KEYS } from "../services/posterProducts";

// Texture d'essai : l'icône de l'app. (Plus tard : l'image du poster composé, « photographiée » avec react-native-view-shot.)
ViroMaterials.createMaterials({
  posterTest: { diffuseTexture: require("../assets/icon.png"), lightingModel: "Constant" },
});

const TRACKING = { 1: "INDISPONIBLE", 2: "LIMITÉ", 3: "NORMAL" };
const REASON = { 1: "", 2: "mouvement trop rapide", 3: "pas assez de détails visibles" };
const log = (...a) => console.log("[AR]", ...a);

function PosterScene(props) {
  const { formatKey, placed, onTracking, onAnchor, onHit, onCamera } = props.sceneNavigator.viroAppProps;
  const f = POSTER_FORMATS[formatKey];
  const selectorRef = useRef(null);
  const w = f.widthMm / 1000, h = f.heightMm / 1000;
  return (
    <ViroARScene
      anchorDetectionTypes={["PlanesVertical", "PlanesHorizontal"]}
      displayPointCloud={{ maxPoints: 300 }}
      onTrackingUpdated={(state, reason) => onTracking(state, reason)}
      onAnchorFound={(a) => { onAnchor(a, "found"); selectorRef.current?.handleAnchorFound(a); }}
      onAnchorUpdated={(a) => { onAnchor(a, "updated"); selectorRef.current?.handleAnchorUpdated(a); }}
      onAnchorRemoved={(a) => a && selectorRef.current?.handleAnchorRemoved(a)}
      onCameraARHitTest={(e) => onHit(e)}
      onCameraTransformUpdate={(t) => onCamera(t)}
    >
      <ViroAmbientLight color="#ffffff" />

      {/* (a) Toucher un plan détecté (les surfaces s'affichent en translucide) */}
      <ViroARPlaneSelector ref={selectorRef} alignment="Both" minWidth={0.1} minHeight={0.1}>
        {/* Dans le repère du plan, l'axe Y sort de la surface : on couche le rectangle (rotation -90° autour de X). */}
        <ViroQuad position={[0, 0.005, 0]} rotation={[-90, 0, 0]} width={w} height={h} materials={["posterTest"]} />
      </ViroARPlaneSelector>

      {/* (b) « Poser ici » : au point visé ou à la distance réglée, à la verticale, tourné vers l'endroit où on se tenait */}
      {placed && (
        <ViroNode position={placed.position} rotation={[0, placed.yaw, 0]}>
          <ViroQuad width={w} height={h} materials={["posterTest"]} />
        </ViroNode>
      )}
    </ViroARScene>
  );
}

export function ArSpikeScreen({ navigation }) {
  const [fmt, setFmt] = useState("a3");
  const [placed, setPlaced] = useState(null);
  const [dist, setDist] = useState(1.5); // distance (m) devant la caméra quand aucune surface n'est visée
  const [info, setInfo] = useState({ tracking: "…", reason: "", planes: 0, lastPlane: "", target: "aucune" });
  const f = POSTER_FORMATS[fmt];

  // Les événements AR arrivent très souvent : on les range dans une réf et on n'actualise l'écran que 3 fois par seconde.
  const live = useRef({ tracking: "…", reason: "", planes: new Map(), target: "aucune", hit: null, cam: null });
  useEffect(() => {
    const t = setInterval(() => {
      const l = live.current;
      const last = [...l.planes.values()].pop();
      setInfo({ tracking: l.tracking, reason: l.reason, planes: l.planes.size, lastPlane: last ?? "", target: l.target });
    }, 330);
    return () => clearInterval(t);
  }, []);

  const onTracking = useCallback((state, reason) => {
    live.current.tracking = TRACKING[state] ?? String(state);
    live.current.reason = REASON[reason] ?? "";
    log("suivi", state, reason);
  }, []);
  const onAnchor = useCallback((a, kind) => {
    if (!a) return;
    const txt = `${a.alignment ?? a.type}${a.width ? ` ${Math.round(a.width * 100)}×${Math.round((a.height ?? 0) * 100)} cm` : ""}`;
    live.current.planes.set(a.anchorId, txt);
    if (kind === "found") log("plan trouvé", JSON.stringify({ id: a.anchorId, type: a.type, alignment: a.alignment, w: a.width, h: a.height, rot: a.rotation }));
  }, []);
  const onHit = useCallback((e) => {
    const r = e?.hitTestResults?.[0];
    live.current.cam = e?.cameraOrientation ?? live.current.cam;
    live.current.hit = r ?? null;
    if (r) {
      const cam = e.cameraOrientation.position;
      const p = r.transform.position;
      const d = Math.hypot(p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]);
      live.current.target = `${r.type} à ${d.toFixed(2)} m`;
    } else live.current.target = "aucune";
  }, []);

  // Position / direction de la caméra (événement dédié : marche même quand aucune surface n'est visée).
  const onCamera = useCallback((t) => {
    const c = t?.cameraTransform ?? t;
    const position = t?.position ?? c?.position;
    const forward = t?.forward ?? c?.forward;
    if (position && forward) live.current.cam = { position, forward };
  }, []);

  // « Poser ici » : s'il y a une surface au centre de l'écran, le poster y est posé ; sinon il est posé À LA DISTANCE réglée devant la caméra
  // (on se place devant le mur, on règle la distance jusqu'au mur). Toujours à la verticale, tourné vers la personne.
  const placeHere = () => {
    const { hit, cam } = live.current;
    if (!cam) { log("poser ici : caméra inconnue (aucun événement de position reçu)"); setInfo((i) => ({ ...i, target: "caméra inconnue" })); return; }
    const fw = cam.forward;
    const yaw = (Math.atan2(-fw[0], -fw[2]) * 180) / Math.PI;
    const position = hit
      ? hit.transform.position
      : [cam.position[0] + fw[0] * dist, cam.position[1] + fw[1] * dist, cam.position[2] + fw[2] * dist];
    log("poser ici", JSON.stringify({ source: hit ? hit.type : `devant la caméra à ${dist} m`, position, yaw }));
    setPlaced({ position, yaw });
  };

  const pill = (bg) => ({ backgroundColor: bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" });
  const trackColor = info.tracking === "NORMAL" ? "rgba(76,122,43,0.9)" : info.tracking === "LIMITÉ" ? "rgba(183,121,31,0.9)" : "rgba(179,64,47,0.9)";

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" />
      <ViroARSceneNavigator
        autofocus
        initialScene={{ scene: PosterScene }}
        viroAppProps={{ formatKey: fmt, placed, onTracking, onAnchor, onHit, onCamera }}
        style={{ flex: 1 }}
      />
      <SafeAreaView pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, justifyContent: "space-between" }}>
        {/* Indicateurs */}
        <View style={{ margin: 12, padding: 10, borderRadius: 14, backgroundColor: "rgba(30,31,28,0.78)", gap: 4 }} pointerEvents="none">
          <View style={pill(trackColor)}><Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{`Suivi : ${info.tracking}${info.reason ? ` · ${info.reason}` : ""}`}</Text></View>
          <Text style={{ color: "#fff", fontSize: 12 }}>{`Plans trouvés : ${info.planes}${info.lastPlane ? ` (dernier : ${info.lastPlane})` : ""}`}</Text>
          <Text style={{ color: "#fff", fontSize: 12 }}>{`Cible (centre de l'écran) : ${info.target}`}</Text>
          <Text style={{ color: "#ffd9a0", fontSize: 11 }}>Points jaunes = ce que l'AR voit. Bouge lentement, face à un mur avec du détail (cadre, prise, texture).</Text>
        </View>

        {/* Réticule au centre */}
        <View pointerEvents="none" style={{ position: "absolute", left: "50%", top: "50%", width: 26, height: 26, marginLeft: -13, marginTop: -13, borderRadius: 13, borderWidth: 2, borderColor: "#fff", opacity: 0.85 }} />

        {/* Commandes */}
        <View style={{ padding: 14 }}>
          <Text style={{ color: "#fff", textAlign: "center", fontSize: 12.5, marginBottom: 8 }}>{`${f.name} · ${f.sizeLabel}`}</Text>
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
            {POSTER_FORMAT_KEYS.map((k) => (
              <TouchableOpacity key={k} onPress={() => setFmt(k)}
                style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, backgroundColor: k === fmt ? C.album : "rgba(255,255,255,0.22)" }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>{POSTER_FORMATS[k].name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 10 }}>
            <Text style={{ color: "#fff", fontSize: 12.5 }}>Distance si rien n'est visé :</Text>
            <TouchableOpacity onPress={() => setDist((d) => Math.max(0.5, Math.round((d - 0.25) * 100) / 100))} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>−</Text></TouchableOpacity>
            <Text style={{ color: "#fff", fontWeight: "700", minWidth: 44, textAlign: "center" }}>{`${dist.toFixed(2).replace(".", ",")} m`}</Text>
            <TouchableOpacity onPress={() => setDist((d) => Math.min(5, Math.round((d + 0.25) * 100) / 100))} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>＋</Text></TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <TouchableOpacity onPress={placeHere} style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Poser ici (point visé)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPlaced(null)} style={{ height: 46, paddingHorizontal: 16, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "600" }}>Effacer</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ alignSelf: "center", marginTop: 8, paddingVertical: 8, paddingHorizontal: 18 }}>
            <Text style={{ color: "#fff", fontWeight: "600" }}>✕ Fermer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
