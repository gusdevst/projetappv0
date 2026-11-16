// services/printOrder.js
// Commande d'un TIRAGE SIMPLE (10 × 15 ou 10 × 10 cm, 20 tirages minimum) : même circuit que le livre et le poster, table `orders`, kind = 'print'.
//   1. createPrintOrder   → ligne `orders` en « draft » (adresse RECOPIÉE, nombre de tirages, format)
//   2. uploadPrintPhotos  → chaque photo (fichier ORIGINAL) déposée dans le dossier privé `print-files/<compte>/<commande>/<n>.<ext>`,
//                           puis ligne en « file_ready » avec la description de chaque photo dans `spec.photos`
//   3. submitPrintOrder   → fonction serveur `imprimeur-order` : vérifie, recalcule le prix, passe en « received »
//      ⚠️ NE PART PAS chez imprimeur.fr (même règle que les posters, 16 nov. 2026).
// Pas de paiement ici (Stripe viendra entre « Payer » et l'étape 1). SQL : supabase/sql/orders_tirages_abonnement.sql.
// Les photos partent telles quelles (HEIC possible sur iPhone : à convertir quand un imprimeur le demandera).

import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase";
import { addressSnapshot } from "./addresses";
import { fail, session, isNetworkError, callOrderFunction } from "./bookOrder";
import { PRINT_PRODUCT, printOneShotCents } from "./printProducts";

const BUCKET = "print-files";
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", webp: "image/webp" };

export const printFormatOf = (key) => PRINT_PRODUCT.formats.find((f) => f.key === key) ?? PRINT_PRODUCT.formats[0];

const shapeOf = (w, h) => {
  if (!w || !h) return null;
  if (Math.abs(w - h) / Math.max(w, h) < 0.02) return "square";
  return w > h ? "landscape" : "portrait";
};

// Fichier original d'une photo du téléphone (téléchargé depuis iCloud si besoin).
async function originalFile(photoId) {
  const info = await MediaLibrary.getAssetInfoAsync(photoId, { shouldDownloadFromNetwork: true });
  if (!info?.localUri) throw fail("photo", "Une photo est introuvable sur le téléphone.");
  const ext = (info.localUri.split("?")[0].split(".").pop() || "jpg").toLowerCase();
  return { uri: info.localUri, ext: MIME[ext] ? ext : "jpg", width: info.width ?? null, height: info.height ?? null };
}

// Description de la commande (colonne `spec`). source.photoIds = ids de photos de CE téléphone (pour reprendre une commande interrompue).
export function printOrderSpec({ format, photoIds }) {
  const f = printFormatOf(format);
  return {
    product: "print", format: f.key, formatLabel: f.label,
    sheetMm: { width: f.widthMm, height: f.heightMm },
    crop: "cover",            // la photo remplit le tirage, recadrée au centre (même règle que l'abonnement)
    count: photoIds.length,
    source: { photoIds },
  };
}

export const printTitle = (format, count) => `${count} tirages ${printFormatOf(format).label}`;

// 1. Crée la commande (brouillon).
export async function createPrintOrder({ format, photoIds, address }) {
  const s = await session();
  const { data, error } = await supabase.from("orders").insert({
    user_id: s.user.id,
    kind: "print",
    album_id: null,
    title: printTitle(format, photoIds.length),
    product: format,
    pages: null,
    quantity: photoIds.length,
    spec: printOrderSpec({ format, photoIds }),
    address: addressSnapshot(address),
  }).select("*").single();
  if (error) throw fail(isNetworkError(error) ? "network" : "server", `Commande refusée (${error.code ?? "?"}) : ${error.message}`);
  return data;
}

// 2. Dépose les photos, puis passe la commande en « file_ready ». onProgress(fait, total) alimente la barre.
//    `shouldStop()` : l'écran peut interrompre l'envoi (annulation).
export async function uploadPrintPhotos(order, photoIds, { onProgress, shouldStop } = {}) {
  const s = await session();
  const folder = `${s.user.id}/${order.id}`;
  const photos = [];
  for (let i = 0; i < photoIds.length; i++) {
    if (shouldStop?.()) throw fail("server", "Annulé", "cancelled");
    onProgress?.(i, photoIds.length);
    let file;
    try { file = await originalFile(photoIds[i]); }
    catch (e) { throw e.kind ? e : fail("photo", e?.message ?? "Photo illisible."); }
    const path = `${folder}/${i + 1}.${file.ext}`;
    let res;
    try {
      res = await FileSystem.uploadAsync(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, file.uri, {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, // le fichier part tel quel, sans passer par la mémoire
        headers: {
          Authorization: `Bearer ${s.access_token}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": MIME[file.ext],
          "x-upsert": "true", // un 2e essai remplace la photo déjà déposée
        },
      });
    } catch (e) {
      throw fail(isNetworkError(e) ? "network" : "server", `Envoi de la photo ${i + 1} : ${e?.message ?? e}`);
    }
    if (res.status < 200 || res.status >= 300) throw fail("server", `Photo ${i + 1} refusée (${res.status}) : ${res.body?.slice?.(0, 160)}`);
    photos.push({ path, w: file.width, h: file.height, shape: shapeOf(file.width, file.height) });
  }
  onProgress?.(photoIds.length, photoIds.length);
  const spec = { ...(order.spec ?? {}), photos };
  const { data, error } = await supabase.from("orders")
    .update({ file_path: folder, spec, status: "file_ready", error: null, updated_at: new Date().toISOString() })
    .eq("id", order.id).select("*").single();
  if (error) throw fail(isNetworkError(error) ? "network" : "server", `Commande non mise à jour : ${error.message}`);
  return data;
}

// 3. Le serveur vérifie, recalcule le prix et passe la commande en « received » (rien n'est envoyé à imprimeur.fr).
export const submitPrintOrder = (orderId) => callOrderFunction("submit", orderId);

export { printOneShotCents };
