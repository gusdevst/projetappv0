// components/book/PrintPageRenderer.js
// Dessine UNE page du livre hors écran, à la taille d'impression (fond perdu compris),
// pour qu'elle soit « photographiée » (captureRef) puis mise dans le PDF.
// Il attend que les photos soient chargées avant de prévenir (onReady), avec une limite de temps.
//
// job : { key, kind: "front" / "back" (couverture de face / de dos) | "page", pageIndex? } · geo : voir pageGeometry() dans services/bookPdf.js
// onReady(key, ok) : ok = false si les photos n'ont pas fini de charger à temps.

import { useEffect, useRef } from "react";
import { View } from "react-native";
import { BookPage, BookCover, DoublePage } from "./BookPage";
import BackCover from "./BackCover";
import { bookSpec } from "../../services/bookProducts";
import { coverBgHex, getCrop, doubleLeftIndex, pagePhotoIds, isDoubleLeft } from "../../services/photoBook";

const OFFSCREEN = -20000; // loin à gauche : dessinée, mais jamais visible
const SETTLE_MS = 250;    // petite pause après le dernier chargement (mise en place des photos)
const TIMEOUT_MS = 15000; // au-delà, on capture quand même (et on le signale)

// job.urlById (facultatif) : adresses des photos en pleine qualité pour CETTE page (fichiers locaux, voir useBookPdf).
export function PrintPageRenderer({ job, book, urlById: defaultUrls, geo: pageGeo, viewRef, onReady }) {
  const geo = pageGeo;
  const urlById = job?.urlById ?? defaultUrls;
  const loaded = useRef(0);
  const finished = useRef(false);
  const lastKey = useRef(null);

  // Nouvelle page : on repart de zéro TOUT DE SUITE (pendant le rendu), avant que les photos ne commencent à charger.
  // (Si on le faisait plus tard, une photo déjà en mémoire pourrait finir de charger avant et ne plus être comptée.)
  if (job && lastKey.current !== job.key) {
    lastKey.current = job.key;
    loaded.current = 0;
    finished.current = false;
  }

  const page = job?.kind === "page" ? book.pages[job.pageIndex] : null;
  const expected = !job ? 0
    : job.kind === "front" ? (book.cover.style !== "titre" && book.cover.photoId && urlById[book.cover.photoId] ? 1 : 0)
    : job.kind === "back" ? 0
    : pagePhotoIds(book, job.pageIndex).filter((id) => urlById[id]).length;

  const finish = (ok) => {
    if (finished.current || !job) return;
    finished.current = true;
    onReady(job.key, ok);
  };

  useEffect(() => {
    if (!job) return undefined;
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
      {job.kind === "back" ? (
        // Couverture de DOS (layflat) : couleur de fond de la couverture + logo Pellicule et « Fait avec Pellicule ❤️ » au centre.
        <BackCover bg={book.cover.bg} size={geo.widthPt} ratio={geo.heightPt / geo.widthPt} />
      ) : job.kind === "front" ? (
        // Couverture de FACE (layflat) : une page au format exact, comme le gabarit imprimeur.fr.
        <BookCover cover={book.cover} size={geo.widthPt} ratio={geo.heightPt / geo.widthPt} urlById={urlById} flat onImageLoad={onImageLoad}
          safe={{ x: bookSpec(book).safeMm / bookSpec(book).widthMm, y: bookSpec(book).safeMm / bookSpec(book).heightMm }} />
      ) : page?.double ? (
        // Moitié d'une double page : la photo est dessinée sur les 2 pages, on ne garde que cette moitié.
        (() => {
          const l = doubleLeftIndex(book, job.pageIndex);
          const owner = book.pages[l];
          const id = owner.slots[0];
          return (
            <View style={{ padding: geo.bleedPt }}>
              <DoublePage url={id ? urlById[id] : null} size={geo.trimWidthPt} ratio={geo.trimHeightPt / geo.trimWidthPt}
                crop={id ? getCrop(owner, id) : undefined} half={isDoubleLeft(page) ? "left" : "right"} flat onLoaded={onImageLoad} />
            </View>
          );
        })()
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
