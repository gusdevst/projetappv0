# Archive Gelato (livre photo 21 × 28 cm) — retiré de l'app le 9 nov. 2026

Décision d'Augustin : **on oublie Gelato pour le moment**. L'app ne fabrique plus que des livres **layflat imprimeur.fr**
(`services/bookProducts.js`). Tout ce qui concernait Gelato est gardé ici, **hors de l'app** (Metro ne lit pas ce dossier).
Pour revenir à Gelato : remettre ces fichiers à leur place, rebrancher `bookSpec` (branche « gelato »), `buildPlan` et le rendu de la couverture à plat.

## Produit retenu
`photobooks-hardcover_pf_210x280-mm-8x11-inch_pt_170-gsm-65lb-coated-silk_cl_4-4_ccl_4-4_bt_glued-left_ct_matt-lamination_prt_1-0_cpt_130-gsm-65-lb-cover-coated-silk_ver`
Livre photo couverture rigide 21 × 28 cm (8 × 11 po), 170 g couché soie, pelliculage mat, collé à gauche.
Pages de **30 à 200, de 2 en 2**, vertical ou horizontal au choix pour tout le livre.
Prix vu : 15,46 € HT + 5,39 $ de livraison pour 30 pages (comparé le 9 nov. à imprimeur.fr : ≈ 20,1 € HT vs 20,93 € HT en A4 layflat).

## Specs du fichier (support.gelato.com, nov. 2026)
- Images **150 dpi minimum** (300 max), sRGB accepté, PDF/X-4 recommandé, sans traits de coupe.
- **Fond perdu 4 mm**, zone de sécurité 4 mm. Zone code-barres réservée sur la 4ᵉ de couverture.
- **Un seul PDF** : page 1 = couverture à plat (dos + 4ᵉ + 1ʳᵉ) · page 2 blanche (garde) · pages intérieures une par une
  (pas en double page) · dernière page blanche. `pagesCount` renvoyé par Gelato = pages demandées + 4.
- Dimensions de la couverture à plat (API Gelato `GET /v3/products/{uid}/cover-dimensions?pageCount=…`, en mm) :
  30 p. → 478 × 326 mm, dos 6 mm · 60 p. → dos 9 mm · 100 p. → dos 11 mm · 200 p. → dos 19 mm.
  Panneaux 208 × 286 à 20 mm du haut ; charnières de 8 mm entre dos arrière / dos / dos avant ; face avant à `left` = 250 (30 p.).

## Fichiers archivés
| Fichier | Rôle |
|---|---|
| `app/gelato.js` | demande les dimensions de la couverture à plat à la fonction serveur `gelato-cover` (cache mémoire + téléphone) |
| `app/FlatCover.js` | dessine la couverture à plat (4ᵉ + dos + face, rabat, fond perdu) |
| `app/bookCheck.gelato-v1.js` | `PRINT_SPEC` (specs ci-dessus) + contrôles d'avant impression, version Gelato |
| `app/bookPdf.gelato-and-v1.js` | géométrie des pages / de la couverture à plat, plan du PDF Gelato, assemblage `pdf-lib` |
| `supabase-functions/gelato-cover.ts` | fonction Deno : dimensions de couverture (secret `GELATO_API_KEY`) |
| `supabase-functions/gelato-price.ts` | fonction Deno : coût d'impression + livraison (`?pageCount=`, `?all=1`, `?country=FR`, `?quote=1`) |

Les deux fonctions restent **déployées** sur Supabase (projet `xemwkqqpgvefumfvcehj`, `--no-verify-jwt`) et leurs sources
restent aussi dans `supabase/functions/` : elles ne servent plus à l'app. Les supprimer côté serveur : `npx supabase functions delete gelato-cover` (idem `gelato-price`).
Le secret `GELATO_API_KEY` est toujours dans Supabase.

## Anciens livres déjà créés
Un livre créé avant le 9 nov. (sans `book.product`) est **converti** en layflat au démarrage de l'app : vertical → A4 21 × 29,7, horizontal → 21 × 15,
nombre de pages ramené entre 24 et 120 (les photos des pages en trop retournent dans l'album). Voir `services/photoBook.js` (`upgradeLegacyBook`).
