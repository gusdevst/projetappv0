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
import { pageGeometry, buildPlan, createPdf, addPdfPage, pdfToBase64 } from "../services/bookPdf";

const IDLE = { phase: "idle", done: 0, total: 0, result: null, error: null, slowPages: 0 };
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
      const doc = await createPdf();
      for (let i = 0; i < plan.length; i++) {
        if (cancelled.current) { setState({ ...IDLE, phase: "cancelled" }); return; }
        const item = plan[i];
        let base64 = null;
        if (item.kind !== "blank") {
          const { uri, ok } = await renderToJpeg(item);
          if (!ok) slowPages += 1;
          base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        }
        await addPdfPage(doc, geo, base64);
        setState((s) => ({ ...s, done: i + 1, slowPages }));
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
