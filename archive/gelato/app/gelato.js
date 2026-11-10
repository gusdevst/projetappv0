// services/gelato.js
// Dimensions de la couverture à plat d'un livre Gelato (4ᵉ de couverture + dos + face avant).
// On les demande à la fonction serveur `gelato-cover` (Supabase), qui détient la clé Gelato.
// Les valeurs ne bougent pas pour un même produit et un même nombre de pages : on les garde en mémoire
// ET sur le téléphone, pour que l'aperçu marche aussi hors connexion après un premier chargement.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const CACHE_KEY = (pageCount) => `pellicule.gelato.cover.v1.${pageCount}`;
const memory = new Map();

const rect = (o) => ({ x: o.left, y: o.top, w: o.width, h: o.height });

// Transforme la réponse brute de Gelato en un objet simple. Tout est en millimètres, origine = coin haut-gauche.
//   total : la couverture à plat entière (avec le rabat autour du carton et le fond perdu)
//   edge  : le contour du carton · back / jointBack / spine / jointFront / front : les 5 bandes de gauche à droite
export function normalizeCover(g) {
  if (g?.measureUnit !== "mm") throw new Error(`Unité inattendue : ${g?.measureUnit}`);
  return {
    pagesCount: g.pagesCount,
    total: { w: g.wraparoundInsideSize.width, h: g.wraparoundInsideSize.height },
    edge: rect(g.wraparoundEdgeSize),
    back: rect(g.contentBackSize),
    jointBack: rect(g.jointBackSize),
    spine: rect(g.spineSize),
    jointFront: rect(g.jointFrontSize),
    front: rect(g.contentFrontSize),
  };
}

export async function getCoverDimensions(pageCount) {
  if (memory.has(pageCount)) return memory.get(pageCount);

  // 1. déjà vu sur ce téléphone ?
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY(pageCount));
    if (cached) {
      const dims = JSON.parse(cached);
      memory.set(pageCount, dims);
      return dims;
    }
  } catch (e) { /* cache illisible : on redemande */ }

  // 2. sinon, on demande à Gelato (via notre fonction serveur)
  const { data, error } = await supabase.functions.invoke(`gelato-cover?pageCount=${pageCount}`, { method: "GET" });
  if (error || !data?.ok) {
    throw new Error("Dimensions de couverture indisponibles (connexion internet ?).");
  }
  const dims = normalizeCover(data.gelato);
  memory.set(pageCount, dims);
  AsyncStorage.setItem(CACHE_KEY(pageCount), JSON.stringify(dims)).catch(() => {});
  return dims;
}
