// hooks/useBookPdf.js
// Pilote la fabrication du PDF : dessine chaque page hors écran (PrintPageRenderer),
// la capture en JPEG (react-native-view-shot), puis l'ajoute au PDF (services/bookPdf.js).
//
// Usage :
//   const pdf = useBookPdf(book, urlById);
//   <PrintPageRenderer {...pdf.rendererProps} />   // à monter une fois dans l'écran
//   pdf.start() → Promise<result | undefined> · pdf.cancel() · pdf.state = { phase, done, total, result, error, slowPages, step }
//   phase : "idle" | "working" | "done" | "error" | "cancelled"
//
// ANTI-BLOCAGE (14 nov. 2026 : la fabrication restait parfois figée sur une page, et « Annuler » ne répondait plus) :
//  · chaque page a un CHRONO (PAGE_TIMEOUT_MS) qui couvre le dessin ET la capture ; s'il saute, la page est redessinée
//    (nouvelle clé = nouvelle vue native, après une courte pause) jusqu'à MAX_PAGE_TRIES fois, le PDF déjà fait est gardé ;
//  · « Annuler » (cancel) interrompt immédiatement l'attente en cours : plus aucun point où l'on reste coincé ;
//  · si une page échoue malgré tout, start() lève l'erreur : l'écran de commande relance alors tout (voir BookOrderProgressScreen).

import { useCallback, useMemo, useRef, useState } from "react";
import { PixelRatio } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system/legacy";
import { pageGeometry, buildPlan, createPdf, addPdfPage, pdfToBase64 } from "../services/bookPdf";
import { pagePhotoIds } from "../services/photoBook";
import { getShareableUri } from "../services/photoShare";

const IDLE = { phase: "idle", done: 0, total: 0, result: null, error: null, slowPages: 0, step: "" };
const FETCH_TIMEOUT_MS = 20000; // récupérer une photo (iCloud…) : au-delà, on garde l'adresse d'origine
const PAGE_TIMEOUT_MS = 40000;  // dessin + capture d'UNE page : au-delà, on la redessine
const MAX_PAGE_TRIES = 3;       // essais par page avant d'abandonner (le PDF déjà fabriqué est conservé entre deux essais)
const RETRY_PAUSE_MS = 900;     // laisse la vue native se détruire avant de redessiner

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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pdfError = (code, message) => Object.assign(new Error(message), { code });

export function useBookPdf(book, urlById) {
  const viewRef = useRef(null);
  const waiting = useRef(null);   // { key, resolve } : le rendu en cours, en attente de « prêt »
  const abortWait = useRef(null); // interrompt l'attente en cours (utilisé par cancel)
  const cancelled = useRef(false);
  const [job, setJob] = useState(null);
  const [state, setState] = useState(IDLE);

  const geo = useMemo(() => (book ? pageGeometry(book, PixelRatio.get()) : null), [book?.orientation, book?.product]);

  // Appelé par le rendu quand les photos de la page sont chargées.
  const onReady = useCallback((key, ok) => {
    if (waiting.current?.key === key) waiting.current.resolve(ok);
  }, []);

  // Affiche une page hors écran, attend qu'elle soit prête, la capture. Renvoie { uri, ok }.
  // Rejette si : le chrono saute (PDF_TIMEOUT), la capture échoue, ou cancel() est appelé (PDF_CANCELLED).
  const renderToJpeg = (item) => new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (waiting.current?.key === item.key) waiting.current = null;
      abortWait.current = null;
      fn(value);
    };
    const timer = setTimeout(() => settle(reject, pdfError("PDF_TIMEOUT", `Page ${item.key} : délai dépassé`)), PAGE_TIMEOUT_MS);
    abortWait.current = (err) => settle(reject, err);
    waiting.current = {
      key: item.key,
      resolve: async (ok) => {
        try {
          const uri = await captureRef(viewRef, { format: "jpg", quality: 0.9, result: "tmpfile" });
          if (settled) { FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}); return; } // arrivée trop tard
          settle(resolve, { uri, ok });
        } catch (e) { settle(reject, e); }
      },
    };
    setJob(item);
  });

  const start = useCallback(async () => {
    if (!book || !geo || state.phase === "working") return undefined;
    cancelled.current = false;
    const plan = buildPlan(book);
    setState({ ...IDLE, phase: "working", total: plan.length });
    let slowPages = 0;
    const bail = () => { setJob(null); setState({ ...IDLE, phase: "cancelled" }); };

    try {
      const doc = await createPdf();
      for (let i = 0; i < plan.length; i++) {
        if (cancelled.current) { bail(); return undefined; }
        const item = plan[i];
        let base64 = null;
        if (item.kind !== "blank") {
          setState((s) => ({ ...s, step: `Page ${i + 1} : récupération des photos…` }));
          const ids = item.kind === "back" ? []
            : item.kind === "front" ? [book.cover.photoId].filter(Boolean)
            : pagePhotoIds(book, item.pageIndex); // (une moitié de double page : la photo de la double page)
          const urls = await withOriginalFiles(ids, urlById);
          if (cancelled.current) { bail(); return undefined; }

          // Dessin + capture, avec nouvel essai si la page se fige.
          let shot = null, lastErr = null;
          for (let attempt = 1; attempt <= MAX_PAGE_TRIES && !shot; attempt++) {
            if (attempt > 1) {
              setJob(null);                 // détruit la vue qui s'est figée
              setState((s) => ({ ...s, step: `Page ${i + 1} : ça a bloqué, nouvel essai (${attempt}/${MAX_PAGE_TRIES})…` }));
              await sleep(RETRY_PAUSE_MS);
              if (cancelled.current) { bail(); return undefined; }
            } else {
              setState((s) => ({ ...s, step: `Page ${i + 1} : dessin…` }));
            }
            const t0 = Date.now();
            // Nouvelle clé à chaque essai : le rendu repart de zéro (nouvelle vue native, compteurs remis à 0).
            const run = { ...item, key: attempt === 1 ? item.key : `${item.key}~${attempt}`, urlById: urls };
            try {
              shot = await renderToJpeg(run);
              if (__DEV__) console.log(`[pdf] ${run.key} prête en ${Date.now() - t0} ms (photos chargées : ${shot.ok}, essai ${attempt})`);
            } catch (e) {
              if (cancelled.current || e?.code === "PDF_CANCELLED") { bail(); return undefined; }
              lastErr = e;
              if (__DEV__) console.log(`[pdf] ${run.key} échec essai ${attempt} :`, e?.code ?? e?.message);
            }
          }
          if (!shot) throw lastErr ?? pdfError("PDF_TIMEOUT", `Page ${i + 1} impossible à dessiner`);
          if (!shot.ok) slowPages += 1;
          base64 = await FileSystem.readAsStringAsync(shot.uri, { encoding: FileSystem.EncodingType.Base64 });
          FileSystem.deleteAsync(shot.uri, { idempotent: true }).catch(() => {});
        }
        await addPdfPage(doc, geo.pdf, base64);
        setState((s) => ({ ...s, done: i + 1, slowPages, step: "" }));
        await yieldToUi();
      }
      setJob(null);

      const base64 = await pdfToBase64(doc);
      const slug = (book.cover.title || "livre").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "livre";
      const path = `${FileSystem.cacheDirectory}pellicule-${slug}-${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
      const info = await FileSystem.getInfoAsync(path);
      const result = { uri: path, pages: plan.length, sizeMo: Math.round(((info.size ?? 0) / (1024 * 1024)) * 10) / 10 };
      setState({ phase: "done", done: plan.length, total: plan.length, slowPages, error: null, result });
      return result; // l'écran de commande en a besoin pour envoyer le fichier
    } catch (e) {
      setJob(null);
      setState({ ...IDLE, phase: "error", error: String(e?.message ?? e) });
      throw e; // l'écran de commande relance tout, puis affiche l'erreur et propose « Réessayer »
    }
  }, [book, geo, state.phase]);

  // Interrompt TOUT de suite, même si une page est figée.
  const cancel = useCallback(() => {
    cancelled.current = true;
    abortWait.current?.(pdfError("PDF_CANCELLED", "Annulé"));
  }, []);
  const reset = useCallback(() => setState(IDLE), []);

  return {
    state, start, cancel, reset,
    totalPages: book ? buildPlan(book).length : 0,
    rendererProps: { job, book, urlById, geo, viewRef, onReady },
  };
}
