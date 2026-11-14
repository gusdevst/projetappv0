// components/poster/PosterTexture.js
// Fabrique l'IMAGE du poster tel que l'utilisateur l'a composé (photo + cadrage + titre, ou pêle-mêle), pour la poser en réalité augmentée.
// Même technique que les pages du livre (PrintPageRenderer) : le poster est dessiné HORS ÉCRAN, on attend que les photos soient chargées,
// puis react-native-view-shot le « photographie » en JPEG. Sans bord blanc ni ombre : c'est le fichier plein cadre, comme à l'impression.
//
// params : { photoId, collage, crop, title } (les mêmes que PosterRecap)
// onDone({ uri, landscape }) une seule fois ; en cas d'échec : onDone({ error }).

import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { PosterFrame, POSTER_RATIO } from "./PosterParts";
import CollagePoster from "./CollagePoster";
import { useBookFonts } from "../book/bookFonts";
import { usePhotoStore } from "../../store/usePhotoStore";
import { getShareableUri } from "../../services/photoShare";
import { posterIsLandscape } from "../../services/posterProducts";
import { DEFAULT_CROP } from "../../services/photoBook";
import { collageLayout, collagePhotoOrder } from "../../services/posterCollage";

const OFFSCREEN = -20000;  // loin à gauche : dessiné, mais jamais visible
const DRAW_W = 600;        // largeur de dessin (les tailles du titre, des cases… en découlent)
const OUT_W = 1200;        // largeur de l'image obtenue (texture AR : assez nette, pas trop lourde)
const SETTLE_MS = 300;     // petite pause après le dernier chargement
const TIMEOUT_MS = 20000;  // au-delà, on photographie quand même
const FETCH_TIMEOUT_MS = 15000;

const withTimeout = (p, ms) => Promise.race([p, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

export default function PosterTexture({ params, onDone }) {
  const { photoId, collage, crop, title } = params ?? {};
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const kept = usePhotoStore((s) => s.kept);
  const fontsLoaded = useBookFonts();
  const viewRef = useRef(null);
  const loaded = useRef(0);
  const finished = useRef(false);
  const [urls, setUrls] = useState(null); // id → fichier original sur le téléphone (ou adresse d'origine)

  // Photos du poster, dans l'ordre.
  const photos = useMemo(() => {
    const byId = new Map([...kept, ...libraryPhotos].map((p) => [p.id, p]));
    const ids = collage ? collage.photoIds : [photoId];
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }, [collage, photoId, libraryPhotos, kept]);
  const landscape = !collage && posterIsLandscape(photos[0]);
  const ratio = landscape ? 1 / POSTER_RATIO : POSTER_RATIO; // hauteur / largeur
  const cells = useMemo(() => (collage ? collageLayout(collage.style, photos.length, { seed: collage.seed, hasTitle: !!collage.title }) : []), [collage, photos.length]);
  const order = useMemo(() => (collage ? collagePhotoOrder(photos.length, collage.seed ?? 0) : []), [collage, photos.length]);

  const finish = (result) => {
    if (finished.current) return;
    finished.current = true;
    onDone(result);
  };

  // 1. Récupérer les fichiers originaux (téléchargés depuis iCloud si besoin) : photos nettes, chargement fiable hors écran.
  useEffect(() => {
    if (!photos.length) { finish({ error: "photo introuvable" }); return undefined; }
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

  // 2. Photographier le poster quand tout est chargé (ou après une limite de temps).
  const capture = async () => {
    try {
      const uri = await captureRef(viewRef, { format: "jpg", quality: 0.9, result: "tmpfile", width: OUT_W, height: Math.round(OUT_W * ratio) });
      finish({ uri, landscape });
    } catch (e) {
      finish({ error: String(e?.message ?? e) });
    }
  };
  const ready = !!urls && fontsLoaded;
  useEffect(() => {
    if (!ready) return undefined;
    const giveUp = setTimeout(capture, TIMEOUT_MS);
    return () => clearTimeout(giveUp);
  }, [ready]);
  const onImageLoad = () => {
    loaded.current += 1;
    if (loaded.current >= photos.length) setTimeout(capture, SETTLE_MS);
  };

  if (!ready) return null;
  const drawn = photos.map((p) => ({ ...p, url: urls[p.id] ?? p.url }));
  const flat = { shadowOpacity: 0, elevation: 0 };
  return (
    <View ref={viewRef} collapsable={false} pointerEvents="none"
      style={{ position: "absolute", left: OFFSCREEN, top: 0, width: DRAW_W, height: Math.round(DRAW_W * ratio), backgroundColor: "#ffffff" }}>
      {collage
        ? <CollagePoster width={DRAW_W} photos={drawn} cells={cells} order={order} crops={collage.crops} bg={collage.bg} title={collage.title} titleFont={collage.titleFont}
            onImageLoad={onImageLoad} style={flat} />
        : <PosterFrame uri={drawn[0]?.url} width={DRAW_W} border={0} landscape={landscape} crop={crop ?? DEFAULT_CROP} title={title} onLoaded={onImageLoad} style={flat} />}
    </View>
  );
}
