// hooks/useBookPdf.js
// Pilote la fabrication du PDF d'essai : dessine chaque page hors écran (PrintPageRenderer),
// la capture en JPEG (react-native-view-shot), puis l'ajoute au PDF (services/bookPdf.js).
//
// Usage :
//   const pdf = useBookPdf(book, urlById);
//   <PrintPageRenderer {...pdf.rendererProps} />   // à monter une fois dans l'écran
//   pdf.start() · pdf.cancel() · pdf.state = { phase, done, total, result, error, slowPages }
//   phase : "idle" | "working" | "done" | "error" | "cancelled"

import { useCallback, useMemo, useRef, useState } from "react";
import { PixelRatio } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system/legacy";
import { pageGeometry, coverGeometry, buildPlan, createPdf, addPdfPage, pdfToBase64 } from "../services/bookPdf";
import { getCoverDimensions } from "../services/gelato";
import { getShareableUri } from "../services/photoShare";

const IDLE = { phase: "idle", done: 0, total: 0, result: null, error: null, slowPages: 0, step: "" };
const FETCH_TIMEOUT_MS = 20000; // récupérer une photo (iCloud…) : au-delà, on garde l'adresse d'origine

// Pour une page, remplace les adresses « ph://… » par les fichiers originaux sur le téléphone
// (téléchargés depuis iCloud si besoin) : photos en pleine qualité, chargement fiable hors écran.
async function withOriginalFiles(ids, urlById) {
  const out = { ...urlById };
  await Promise.all(ids.map(async (id) => {
    try {
      const uri = await Promise.race([
        getShareableUri(id),
        new Promise((resolve) => setTimeout(() => resolve(null), FETCH_TIMEOUT_MS)),
      ]);
      if (uri) out[id] = uri;
    } catch (e) { /* on garde l'adresse d'origine */ }
  }));
  return out;
}
const yieldToUi = () => new Promise((resolve) => setTimeout(resolve, 0));

export function useBookPdf(book, urlById) {
  const viewRef = useRef(null);
  const waiting = useRef(null);   // { key, resolve } : le rendu en cours, en attente de « prêt »
  const cancelled = useRef(false);
  const [job, setJob] = useState(null);
  const [state, setState] = useState(IDLE);

  const geo = useMemo(() => (book ? pageGeometry(book, PixelRatio.get()) : null), [book?.orientation]);

  // Appelé par le rendu quand les photos de la page sont chargées.
  const onReady = useCallback((key, ok) => {
    if (waiting.current?.key === key) waiting.current.resolve(ok);
  }, []);

  // Affiche une page hors écran, attend qu'elle soit prête, la capture. Renvoie { uri, ok }.
  const renderToJpeg = (item) => new Promise((resolve, reject) => {
    waiting.current = {
      key: item.key,
      resolve: async (ok) => {
        waiting.current = null;
        try {
          const uri = await captureRef(viewRef, { format: "jpg", quality: 0.9, result: "tmpfile" });
          resolve({ uri, ok });
        } catch (e) { reject(e); }
      },
    };
    setJob(item);
  });

  const start = useCallback(async () => {
    if (!book || !geo || state.phase === "working") return;
    cancelled.current = false;
    const plan = buildPlan(book);
    setState({ ...IDLE, phase: "working", total: plan.length });
    let slowPages = 0;

    try {
      // Dimensions de la couverture à plat (dos compris), données par Gelato selon le nombre de pages.
      const dims = await getCoverDimensions(book.format);
      const coverGeo = coverGeometry(dims, PixelRatio.get());

      const doc = await createPdf();
      for (let i = 0; i < plan.length; i++) {
        if (cancelled.current) { setState({ ...IDLE, phase: "cancelled" }); return; }
        const item = plan[i];
        let base64 = null;
        if (item.kind !== "blank") {
          setState((s) => ({ ...s, step: `Page ${i + 1} : récupération des photos…` }));
          const ids = item.kind === "cover" ? [book.cover.photoId].filter(Boolean) : book.pages[item.pageIndex].slots.filter(Boolean);
          const urls = await withOriginalFiles(ids, urlById);
          if (cancelled.current) { setState({ ...IDLE, phase: "cancelled" }); return; }
          setState((s) => ({ ...s, step: `Page ${i + 1} : dessin…` }));
          const t0 = Date.now();
          const job = item.kind === "cover" ? { ...item, urlById: urls, dims, geo: coverGeo } : { ...item, urlById: urls };
          const { uri, ok } = await renderToJpeg(job);
          if (__DEV__) console.log(`[pdf] ${item.key} prête en ${Date.now() - t0} ms (photos chargées : ${ok})`);
          if (!ok) slowPages += 1;
          base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        }
        await addPdfPage(doc, item.kind === "cover" ? coverGeo.pdf : geo.pdf, base64);
        setState((s) => ({ ...s, done: i + 1, slowPages, step: "" }));
        await yieldToUi();
      }
      setJob(null);

      const base64 = await pdfToBase64(doc);
      const slug = (book.cover.title || "livre").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "livre";
      const path = `${FileSystem.cacheDirectory}pellicule-${slug}-${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
      const info = await FileSystem.getInfoAsync(path);
      setState({
        phase: "done", done: plan.length, total: plan.length, slowPages, error: null,
        result: { uri: path, pages: plan.length, sizeMo: Math.round(((info.size ?? 0) / (1024 * 1024)) * 10) / 10 },
      });
    } catch (e) {
      setJob(null);
      setState({ ...IDLE, phase: "error", error: String(e?.message ?? e) });
    }
  }, [book, geo, state.phase]);

  const cancel = useCallback(() => { cancelled.current = true; }, []);
  const reset = useCallback(() => setState(IDLE), []);

  return {
    state, start, cancel, reset,
    totalPages: book ? buildPlan(book).length : 0,
    rendererProps: { job, book, urlById, geo, viewRef, onReady },
  };
}
