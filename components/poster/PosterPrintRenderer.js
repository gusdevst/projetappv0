// components/poster/PosterPrintRenderer.js
// Fabrique le FICHIER du poster à envoyer (JPEG à la résolution d'impression), comme PosterTexture le fait pour la réalité augmentée
// mais à la taille réelle : le poster est dessiné HORS ÉCRAN à la taille de la feuille, on attend que les photos soient chargées,
// puis react-native-view-shot le « photographie ». Même technique que les pages du livre (PrintPageRenderer).
//
// Poster horizontal : imprimeur.fr ne liste que des feuilles PORTRAIT → l'image est tournée de 90° dans la feuille (sens des aiguilles
// d'une montre) ; `rotated90` le dit dans le résultat (et dans orders.spec.file) pour que l'impression le sache.
//
// Mémoire : un A1 à 150 dpi fait 3 484 × 4 944 px (≈ 69 Mo en mémoire). Si la capture échoue, on recommence en plus petit
// (DPIS : 150 → 110 → 80) et la résolution réellement obtenue est annoncée dans le résultat.
//
// props : params { photoId, collage, crop, title } (les mêmes que PosterRecap) · format ("a4"…"a1")
//   onDone({ uri, px: { w, h }, dpi, landscape, rotated90 }) une seule fois ; en cas d'échec : onDone({ error }).

import { useEffect, useMemo, useRef, useState } from "react";
import { View, PixelRatio } from "react-native";
import { captureRef } from "react-native-view-shot";
import { PosterFrame, POSTER_RATIO } from "./PosterParts";
import CollagePoster from "./CollagePoster";
import { useBookFonts } from "../book/bookFonts";
import { usePhotoStore } from "../../store/usePhotoStore";
import { getShareableUri } from "../../services/photoShare";
import { posterIsLandscape } from "../../services/posterProducts";
import { posterFilePx } from "../../services/posterOrder";
import { DEFAULT_CROP } from "../../services/photoBook";
import { collageLayout, collagePhotoOrder } from "../../services/posterCollage";

const OFFSCREEN = -40000;   // loin à gauche : dessiné, mais jamais visible
const DPIS = [150, 110, 80];
const SETTLE_MS = 400;      // petite pause après le dernier chargement
const TIMEOUT_MS = 40000;   // au-delà, on photographie quand même
const FETCH_TIMEOUT_MS = 20000;

const withTimeout = (p, ms) => Promise.race([p, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

export default function PosterPrintRenderer({ params, format, onDone }) {
  const { photoId, collage, crop, title } = params ?? {};
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const kept = usePhotoStore((s) => s.kept);
  const fontsLoaded = useBookFonts();
  const viewRef = useRef(null);
  const loaded = useRef(0);
  const finished = useRef(false);
  const timers = useRef([]);
  const [urls, setUrls] = useState(null);   // id → fichier original sur le téléphone (ou adresse d'origine)
  const [attempt, setAttempt] = useState(0); // 0 → 150 dpi, puis plus petit si la capture échoue

  const photos = useMemo(() => {
    const byId = new Map([...kept, ...libraryPhotos].map((p) => [p.id, p]));
    const ids = collage ? collage.photoIds : [photoId];
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }, [collage, photoId, libraryPhotos, kept]);
  const landscape = !collage && posterIsLandscape(photos[0]);
  const cells = useMemo(() => (collage ? collageLayout(collage.style, photos.length, { seed: collage.seed, hasTitle: !!collage.title }) : []), [collage, photos.length]);
  const order = useMemo(() => (collage ? collagePhotoOrder(photos.length, collage.seed ?? 0) : []), [collage, photos.length]);

  const dpi = DPIS[attempt] ?? DPIS[DPIS.length - 1];
  const px = posterFilePx(format, dpi);                 // feuille portrait, en pixels
  const ratio = PixelRatio.get();
  const sheetW = px.w / ratio;                           // la feuille en unités d'écran
  const sheetH = sheetW * POSTER_RATIO;                  // même forme que le poster dessiné

  const finish = (result) => {
    if (finished.current) return;
    finished.current = true;
    timers.current.forEach(clearTimeout);
    onDone(result);
  };
  useEffect(() => () => { finished.current = true; timers.current.forEach(clearTimeout); }, []);

  // 1. Fichiers originaux (téléchargés depuis iCloud si besoin) : photos nettes, chargement fiable hors écran.
  useEffect(() => {
    if (!photos.length) { finish({ error: "Photo introuvable sur ce téléphone." }); return undefined; }
    let alive = true;
    (async () => {
      const out = {};
      await Promise.all(photos.map(async (p) => {
        try { out[p.id] = (await withTimeout(getShareableUri(p.id), FETCH_TIMEOUT_MS)) ?? p.url; } catch (e) { out[p.id] = p.url; }
      }));
      if (alive) setUrls(out);
    })();
    return () => { alive = false; };
  }, [photos.length]);

  // 2. Photographier quand tout est chargé (ou après une limite de temps). Un échec relance en plus petit.
  const capture = async () => {
    if (finished.current) return;
    try {
      const uri = await captureRef(viewRef, { format: "jpg", quality: 0.92, result: "tmpfile", width: px.w, height: px.h });
      finish({ uri, px, dpi, landscape, rotated90: landscape });
    } catch (e) {
      if (attempt < DPIS.length - 1) { loaded.current = 0; setAttempt((a) => a + 1); }
      else finish({ error: String(e?.message ?? e) });
    }
  };
  const ready = !!urls && fontsLoaded;
  useEffect(() => {
    if (!ready) return undefined;
    const giveUp = setTimeout(capture, TIMEOUT_MS);
    timers.current.push(giveUp);
    return () => clearTimeout(giveUp);
  }, [ready, attempt]);
  const onImageLoad = () => {
    loaded.current += 1;
    if (loaded.current >= photos.length) timers.current.push(setTimeout(capture, SETTLE_MS));
  };

  if (!ready) return null;
  const drawn = photos.map((p) => ({ ...p, url: urls[p.id] ?? p.url }));
  const flat = { shadowOpacity: 0, elevation: 0 };
  // Poster horizontal : on le dessine à l'horizontale (côté long = hauteur de la feuille) puis on le tourne de 90° dans la feuille.
  const inner = landscape ? { width: sheetH, height: sheetW, left: (sheetW - sheetH) / 2, top: (sheetH - sheetW) / 2, transform: [{ rotate: "90deg" }] } : { width: sheetW, height: sheetH, left: 0, top: 0 };
  return (
    <View key={attempt} ref={viewRef} collapsable={false} pointerEvents="none"
      style={{ position: "absolute", left: OFFSCREEN, top: 0, width: sheetW, height: sheetH, overflow: "hidden", backgroundColor: "#ffffff" }}>
      <View style={[{ position: "absolute" }, inner]}>
        {collage
          ? <CollagePoster width={inner.width} photos={drawn} cells={cells} order={order} crops={collage.crops} bg={collage.bg} title={collage.title} titleFont={collage.titleFont}
              onImageLoad={onImageLoad} style={flat} />
          : <PosterFrame uri={drawn[0]?.url} width={inner.width} border={0} landscape={landscape} crop={crop ?? DEFAULT_CROP} title={title} onLoaded={onImageLoad} style={flat} />}
      </View>
    </View>
  );
}
