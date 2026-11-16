// services/posterOrder.js
// Commande d'un poster : même circuit que le livre (services/bookOrder.js), table `orders` avec kind = 'poster'.
//   1. createPosterOrder  → ligne `orders` en « draft » (adresse RECOPIÉE, quantité, description du fichier `spec`)
//   2. (l'écran fabrique l'image JPEG avec PosterPrintRenderer)
//   3. uploadPosterFile   → JPEG déposé dans le dossier privé `print-files`, ligne en « file_ready »
//   4. submitPosterOrder  → fonction serveur `imprimeur-order` : prix recalculé, ligne passée en « received ».
//      ⚠️ NE PART PAS chez imprimeur.fr (décision d'Augustin, 16 nov. 2026) : la commande reste chez Pellicule (Supabase).
// Pas de paiement (Stripe viendra entre « Payer » et l'étape 1). SQL : supabase/sql/orders_posters.sql.

import * as FileSystem from "expo-file-system/legacy";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase";
import { addressSnapshot } from "./addresses";
import { fail, session, isNetworkError, callOrderFunction } from "./bookOrder";
import { POSTER_FORMATS, posterIsLandscape, posterSizeLabel } from "./posterProducts";

const BUCKET = "print-files";
export const POSTER_FILE_DPI = 150; // résolution visée (150 dpi = le minimum demandé par imprimeur.fr)

// Taille du fichier à fabriquer pour une FEUILLE portrait du format (px), à `dpi` : { w, h }.
export const posterFilePx = (format, dpi = POSTER_FILE_DPI) => {
  const f = POSTER_FORMATS[format];
  return { w: Math.round((f.widthMm / 25.4) * dpi), h: Math.round((f.heightMm / 25.4) * dpi) };
};

// Titre affiché de la commande.
export function posterOrderTitle({ collage, title, format }) {
  const name = POSTER_FORMATS[format]?.name ?? "";
  if (collage) return collage.title?.trim() || `Poster pêle-mêle ${name}`;
  return title?.text?.trim() || `Poster ${name}`;
}

// Description complète de la commande (colonne `spec`) : le format et ce qu'il faut pour refaire le fichier si on reprend la commande.
//   source : de quoi redessiner le poster (ids de photos de CE téléphone, recadrage, titre, pêle-mêle).
//   file   : rempli plus tard par uploadPosterFile (taille réelle en pixels, résolution, sens).
export function posterOrderSpec({ params, format, quantity, photo }) {
  const f = POSTER_FORMATS[format];
  const { collage, photoId, crop, title } = params;
  const landscape = !collage && posterIsLandscape(photo);
  return {
    product: "poster",
    kind: collage ? "collage" : "single",
    format, formatName: f.name,
    sheetMm: { width: f.widthMm, height: f.heightMm },   // la feuille (toujours portrait chez imprimeur.fr)
    sizeLabel: posterSizeLabel(format, landscape),         // ce que voit l'utilisateur
    landscape,                                             // poster horizontal : image tournée de 90° dans la feuille portrait
    photos: collage ? collage.photoIds.length : 1,
    quantity,
    source: { photoId: photoId ?? null, crop: crop ?? null, title: title ?? null, collage: collage ?? null },
  };
}

// 1. Crée la commande (brouillon). `address` = adresse de l'app (voir services/addresses.js).
export async function createPosterOrder({ params, format, quantity, address, photo }) {
  const s = await session();
  const { data, error } = await supabase.from("orders").insert({
    user_id: s.user.id,
    kind: "poster",
    album_id: null,
    title: posterOrderTitle({ collage: params.collage, title: params.title, format }),
    product: format,
    pages: null,
    quantity,
    spec: posterOrderSpec({ params, format, quantity, photo }),
    address: addressSnapshot(address),
  }).select("*").single();
  if (error) throw fail(isNetworkError(error) ? "network" : "server", `Commande refusée (${error.code ?? "?"}) : ${error.message}`);
  return data;
}

// 3. Dépose le JPEG dans le dossier privé, ajoute sa taille réelle à `spec.file`, passe la commande en « file_ready ».
//    `file` = { px: { w, h }, dpi, rotated90 } (ce que PosterPrintRenderer a vraiment fabriqué).
export async function uploadPosterFile(order, uri, file) {
  const s = await session();
  const path = `${s.user.id}/${order.id}.jpg`;
  let res;
  try {
    res = await FileSystem.uploadAsync(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, uri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, // le fichier part tel quel, sans passer par la mémoire
      headers: {
        Authorization: `Bearer ${s.access_token}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "image/jpeg",
        "x-upsert": "true", // un 2e essai remplace le fichier déjà déposé
      },
    });
  } catch (e) {
    throw fail(isNetworkError(e) ? "network" : "server", `Envoi du poster : ${e?.message ?? e}`);
  }
  if (res.status < 200 || res.status >= 300) throw fail("server", `Poster refusé (${res.status}) : ${res.body?.slice?.(0, 160)}`);

  let bytes = null;
  try { bytes = (await FileSystem.getInfoAsync(uri))?.size ?? null; } catch (e) { /* taille inconnue : sans gravité */ }
  const spec = { ...(order.spec ?? {}), file: { mime: "image/jpeg", ...file, bytes } };
  const { data, error } = await supabase.from("orders")
    .update({ file_path: path, spec, status: "file_ready", error: null, updated_at: new Date().toISOString() })
    .eq("id", order.id).select("*").single();
  if (error) throw fail(isNetworkError(error) ? "network" : "server", `Commande non mise à jour : ${error.message}`);
  return data;
}

// 4. Le serveur vérifie, recalcule le prix et passe la commande en « received » (rien n'est envoyé à imprimeur.fr).
export const submitPosterOrder = (orderId) => callOrderFunction("submit", orderId);
