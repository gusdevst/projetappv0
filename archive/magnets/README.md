# Archive Magnets (abonnement « 9 magnets 5 × 5 cm ») — retirés de l'app le 14 nov. 2026

Décision d'Augustin : **on ne propose plus les magnets directement**. L'app ne vend plus que les tirages 10 × 15 cm (abonnement).
Tout le code et les textes sont gardés ici, **hors de l'app** (Metro ne lit pas ce dossier).

## L'offre telle qu'elle était
- **9 magnets carrés 5 × 5 cm, aimantés, 9,90 € TTC / mois**, livraison comprise, pour moi ou pour un proche.
- **Fabrication manuelle par Augustin** (pas de partenaire d'impression : imprimeur.fr ne fait pas de magnets).
- `spec` envoyé dans chaque commande : `{ widthMm: 50, heightMm: 50, crop: "center", finish: "gloss", layout: "3x3" }`.
- Sélection du mois : 9 photos en grille 3 × 3, recadrées au centre ; photo en grand = aperçu carré.
- Textes : « Tes plus beaux souvenirs, sur ton frigo » · « Chaque mois, 9 de tes coups de cœur deviennent des magnets. » ·
  « 9 aimants 5 × 5 cm » · « Petit mot glissé dans l'envoi » · « Tes magnets sont carrés (5 × 5 cm) : chaque photo est recadrée au centre ».
- Hypothèses d'Augustin / de l'analyse Gemini (non vérifiées) : feuille aimantée A4 ≈ 0,40 €, port lettre suivie ≈ 2,10 €,
  20 magnets par A4, **temps de fabrication ignoré** (3-5 min par commande), prix Cheerz à re-vérifier.
  Prodigi `M-MAG-FRI-3X2` (7,6 × 5,1 cm) = 2,40 € pièce + 7,73 € de port depuis le Royaume-Uni : pas compétitif à 9,90 €.
  La fonction `supabase/functions/prodigi-price` reste dans le dépôt (option `&copies=N` ajoutée en local, jamais déployée).

## Fichiers archivés (`app/` = version d'avant le retrait, à copier à la place du fichier actuel)
| Fichier | Rôle |
|---|---|
| `app/SubscriptionMagnetsScreen.js` | page de détail des magnets (grille 3 × 3, 3 atouts, prix, « Choisir les magnets »). Route `SubscriptionMagnets` |
| `app/ProductArt.js` | `MagnetTile`, `MagnetGrid` (3 × 3), `MagnetCluster` (magnets éparpillés « frigo ») + `PrintTile`, `useKeptUrls` |
| `app/SubscriptionIntroScreen.js` | présentation de l'abonnement avec les deux offres (magnets en vedette + NOUVEAU, tirages) |
| `app/SubscriptionSetupScreen.js` | réglage de l'abonnement, avec `ProductPicker` (choix magnets / tirages) |
| `app/PrintNewScreen.js` | « Nouveaux tirages » avec la 3ᵉ carte « Magnets » (9,90 € / mois → `SubscriptionMagnets`) |
| `app/SubscriptionRow.js` | brique d'abonnement (vignette magnets, libellé « Magnets · pour moi ») |
| `app/subscription.js` | `constants/subscription.js` d'avant : `SUB_PRODUCTS.magnets`, `SUB_MAGNETS`, `SUB_MAGNETS_PRICE_LABEL`, `SUB_PRICES.magnets` |
| `supabase-sql/*.sql` | SQL d'avant (colonne `product` avec `'magnets'` autorisé) |

## Ce qui a été retiré dans l'app
`SubscriptionMagnetsScreen` (fichier supprimé, route retirée de `AppNavigator`) · composants magnets de `ProductArt` · carte « Magnets » de `PrintNewScreen` ·
choix magnets / tirages (`SubscriptionSetupScreen`, `SubscriptionIntroScreen`) · branches magnets de `SubscriptionRow`, `SubscriptionMonthScreen`,
`SubscriptionListScreen`, `SubscriptionManageScreen`, `GalleryHomeScreen` · mentions « magnets » du tuto (`constants/tutorialSlides.js`),
de Réglages et de `services/printProducts.js`.

## Pour les remettre
1. Recopier les fichiers de `app/` à leur place (`screens/`, `components/`, `constants/`) — attention : `constants/subscription.js` et d'autres ont pu changer depuis,
   fusionner à la main plutôt qu'écraser.
2. Remettre `import { SubscriptionMagnetsScreen }` et la route `SubscriptionMagnets` dans `navigation/AppNavigator.js`.
3. Remettre les mentions du tuto / de Réglages / de `printProducts.js` (voir « Ce qui a été retiré »).
4. Le dernier commit qui contient tout le code magnets intact est **`917372a`** (`git show 917372a:screens/SubscriptionMagnetsScreen.js`) ;
   les changements non commités de `constants/subscription.js` d'avant le retrait sont dans `app/subscription.js`.

## Données déjà créées
- Un abonnement « magnets » éventuellement resté sur un téléphone / dans la table Supabase `subscriptions` (colonne `product = 'magnets'`) **n'est plus reconnu comme tel** :
  `productOf()` le traite comme des **tirages** (`SUB_PRODUCTS.prints`), avec son ancien `count` (9). Seulement des abonnements de test à ce jour.
  Les contraintes SQL (`check (product in ('prints', 'magnets'))`) n'ont **pas** été modifiées : rien à relancer côté Supabase.
- Les photos déjà imprimées en magnets gardent leur marque (`printedPhotos[id].product === "magnets"`) : l'écran de la Galerie affiche toujours « (magnets) » pour elles.
