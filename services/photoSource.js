// Origine d'une photo : vient-elle de WhatsApp ?
// Deux indices combinés :
//  1. le NOM du fichier, ex. IMG-20260712-WA0003.jpg (surtout Android) ;
//  2. le DOSSIER : un album dont le titre contient « whatsapp » ("WhatsApp Images" sur Android).
// Sur iOS, WhatsApp range les photos dans la pellicule sous des noms IMG_1234 : ces deux
// indices y marchent peu. Le panneau [DEV] (components/dev/SharpnessDevTest.js) affiche
// ce qui est réellement détecté sur chaque téléphone.
import { getAlbums, getAlbumAssetIds } from "./photoLibrary";

const WA_FILENAME = /^(IMG|PTT|STK|DOC|AUD)-\d{8}-WA\d+/i;
const WA_ALBUM_TITLE = /whatsapp/i;

export function isWhatsAppName(filename) {
  return typeof filename === "string" && WA_FILENAME.test(filename);
}

/**
 * Cherche les albums WhatsApp du téléphone et liste leurs photos.
 * @returns {Promise<{ ids: Set<string>, albums: {title: string, count: number}[] }>}
 */
export async function loadWhatsAppAlbumInfo() {
  const ids = new Set();
  const albums = [];
  try {
    const all = await getAlbums();
    for (const album of all) {
      if (!WA_ALBUM_TITLE.test(album.title || "")) continue;
      const albumIds = await getAlbumAssetIds(album.id);
      albums.push({ title: album.title, count: albumIds.size });
      albumIds.forEach((id) => ids.add(id));
    }
  } catch {
    // Pas de dossier WhatsApp lisible : on se rabat sur le nom du fichier seul.
  }
  return { ids, albums };
}
