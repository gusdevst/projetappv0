// components/book/PrintPageRenderer.js
// Dessine UNE page du livre hors écran, à la taille d'impression (fond perdu compris),
// pour qu'elle soit « photographiée » (captureRef) puis mise dans le PDF.
// Il attend que les photos soient chargées avant de prévenir (onReady), avec une limite de temps.
//
// job : { key, kind: "cover" | "page", pageIndex? } · geo : voir pageGeometry() dans services/bookPdf.js
// onReady(key, ok) : ok = false si les photos n'ont pas fini de charger à temps.

import { useEffect, useRef } from "react";
import { View } from "react-native";
import { BookPage, BookCover } from "./BookPage";

const OFFSCREEN = -20000; // loin à gauche : dessinée, mais jamais visible
const SETTLE_MS = 250;    // petite pause après le dernier chargement (mise en place des photos)
const TIMEOUT_MS = 20000; // au-delà, on capture quand même (et on le signale)

export function PrintPageRenderer({ job, book, urlById, geo, viewRef, onReady }) {
  const loaded = useRef(0);
  const finished = useRef(false);

  const page = job?.kind === "page" ? book.pages[job.pageIndex] : null;
  const expected = !job ? 0
    : job.kind === "cover" ? (book.cover.style !== "titre" && book.cover.photoId && urlById[book.cover.photoId] ? 1 : 0)
    : (page?.slots ?? []).filter((id) => id && urlById[id]).length;

  const finish = (ok) => {
    if (finished.current || !job) return;
    finished.current = true;
    onReady(job.key, ok);
  };

  useEffect(() => {
    if (!job) return undefined;
    loaded.current = 0;
    finished.current = false;
    const noPhoto = expected === 0 ? setTimeout(() => finish(true), SETTLE_MS) : null;
    const giveUp = setTimeout(() => finish(false), TIMEOUT_MS);
    return () => { clearTimeout(noPhoto); clearTimeout(giveUp); };
  }, [job?.key]);

  const onImageLoad = () => {
    loaded.current += 1;
    if (loaded.current >= expected) setTimeout(() => finish(true), SETTLE_MS);
  };

  if (!job) return null;
  return (
    <View
      key={job.key}
      ref={viewRef}
      collapsable={false}
      pointerEvents="none"
      style={{ position: "absolute", left: OFFSCREEN, top: 0, width: geo.widthPt, height: geo.heightPt, backgroundColor: "#ffffff" }}
    >
      {job.kind === "cover" ? (
        // La couverture occupe toute la page, fond perdu compris : la photo va jusqu'au bord.
        <BookCover cover={book.cover} size={geo.widthPt} ratio={geo.heightPt / geo.widthPt} urlById={urlById} flat onImageLoad={onImageLoad} />
      ) : (
        // Page intérieure : marge blanche = fond perdu, puis la page rognée.
        <View style={{ padding: geo.bleedPt }}>
          <BookPage page={page} size={geo.trimWidthPt} ratio={geo.trimHeightPt / geo.trimWidthPt}
            urlById={urlById} coverFont={book.cover.font} flat onImageLoad={onImageLoad} />
        </View>
      )}
    </View>
  );
}
