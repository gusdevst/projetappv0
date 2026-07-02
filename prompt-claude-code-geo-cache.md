# Prompt Claude Code — Refonte du chargement "Tri par lieu" (GPS)

## Contexte du projet

Phototri : app React Native / Expo (JavaScript, pas TypeScript), gestion d'état avec **Zustand** (`store/usePhotoStore.js`).
Le porteur du projet n'est pas développeur mobile. Explique chaque étape simplement, avance **une étape à la fois**, attends validation avant de passer à la suivante, précise toujours le chemin exact des fichiers, et vérifie la cohérence imports/exports. Respecte les conventions déjà en place dans le repo.

Travaille sur une branche dédiée : `feat/geo-cache`. Fais un commit clair à la fin de chaque étape.

## Problème à résoudre

L'écran `screens/MapScreen.js` (menu "Tri par lieu") est lent et se recharge intégralement à chaque visite. Deux causes :

1. **Lenteur récurrente** : le GPS est lu photo par photo via `MediaLibrary.getAssetInfoAsync` (service `services/photoLibrary.js` → `loadPhotoLocation`). Le cache `services/gpsCache.js` ne mémorise QUE les photos AVEC GPS. Les photos SANS GPS (la majorité d'une photothèque) ne sont jamais mémorisées → elles sont re-scannées à chaque ouverture.
2. **Perdu à la navigation** : le résultat du scan (`photosWithGeo`, progression) vit dans le `useState` local de `MapScreen`. En quittant l'écran, le composant est démonté → l'état est perdu → tout se reconstruit au retour.

## Architecture cible (3 couches)

Implémente ces 3 couches, dans cet ordre, chacune validée avant la suivante.

### Étape 1 — Cache négatif (mémoire longue durée)
Fichier : `services/gpsCache.js`.
- Le cache doit mémoriser AUSSI les photos scannées sans GPS, en stockant `null` pour leur `assetId` (ex. `{ "id1": {lat,lng}, "id2": null }`).
- Le cache est rangé par `assetId`. Règle de scan : on ne scanne QUE les photos dont l'`assetId` n'est PAS encore une clé du cache (`!(id in cache)`). Attention : ne pas confondre "clé absente" (jamais scannée) et "valeur null" (scannée, sans GPS). Utilise `Object.prototype.hasOwnProperty` / l'opérateur `in`, pas une simple vérité `if (cache[id])`.
- Les nouvelles photos (ID absent du cache) sont donc scannées automatiquement.
- Adapte la logique de scan de `screens/MapScreen.js` en conséquence : construire `known` à partir des entrées non-null, `toScan` uniquement à partir des IDs absents du cache. Sauvegarder dans le cache aussi bien les GPS trouvés que les `null`.
- Garde `clearGpsCache` pour le debug.

### Étape 2 — État dans le store (mémoire de session)
Fichier : `store/usePhotoStore.js` (+ refonte `screens/MapScreen.js`).
- Déplace l'état du scan géo du composant vers le store Zustand : au minimum `geoPhotos` (photos avec {lat,lng}), `geoScanStatus` (`"idle" | "scanning" | "done"`), `geoScanProgress` ({scanned, total} ou null).
- Ajoute une action `scanGeo()` dans le store qui : lit le cache, calcule `known` / `toScan`, scanne par batches, met à jour `geoPhotos` progressivement, sauvegarde le cache, et gère un verrou pour ne jamais tourner deux fois en parallèle.
- Cet état NE doit PAS être persisté par le middleware `persist` (garde-le hors de `partialize`) — il est reconstruit depuis le cache disque, pas depuis le store persisté.
- `MapScreen` devient un simple consommateur : il lit `geoPhotos` / `geoScanProgress` depuis le store et déclenche `scanGeo()` si le scan n'a jamais été lancé. Au retour sur l'écran, les données sont déjà là → plus de rechargement visible.
- Conserve intégralement les fonctionnalités actuelles de `MapScreen` : clusters, multi-sélection, injection progressive des marqueurs dans la WebView Leaflet, CTA "Trier", "Ajouter comme filtre" (mode album). Vérifie que le recalcul des clusters et l'injection WebView marchent toujours avec l'état venu du store.

### Étape 3 — Pré-chargement en arrière-plan (optionnelle, sécurisée)
Fichiers : là où la photothèque est chargée (`store/usePhotoStore.js` → `loadLibrary`, et/ou `App.js`).
- Après le chargement réussi de la photothèque, déclenche `scanGeo()` en arrière-plan, SANS bloquer l'affichage.
- Garde-fous OBLIGATOIRES :
  - Déclencher via `InteractionManager.runAfterInteractions` pour ne rien exécuter pendant le rendu/animations du démarrage.
  - Scan par batches (garder ~50) avec une micro-pause entre chaque batch pour rendre la main au thread JS (l'UI doit rester fluide, navigation possible pendant le scan).
  - "Fire and forget" : ne pas `await` le scan dans le flux de démarrage.
  - Tout envelopper dans `try/catch` : une erreur de scan ne doit JAMAIS impacter le reste de l'app.
  - Verrou anti double-exécution (réutiliser celui de l'étape 2).
- Grâce au cache négatif (étape 1), ce scan complet n'a lieu qu'une fois ; les démarrages suivants ne traitent que les nouvelles photos.
- Rends cette couche facile à désactiver (un simple flag), au cas où.

## Contraintes

- JavaScript uniquement (pas de TypeScript).
- Respecte les patterns Zustand déjà présents dans `store/usePhotoStore.js` (sélecteurs, `subscribeWithSelector`, `persist`, `partialize`).
- Pas de dépendance nouvelle sans justification.
- Pas de gros dump : propose les modifications fichier par fichier, explique ce qui change et pourquoi.
- Vérifie iOS ET Android (comportement `getAssetInfoAsync`, permissions).

## Tests à faire valider après chaque étape

- Étape 1 : ouvrir "Tri par lieu" deux fois de suite → la 2e ouverture ne re-scanne plus les photos sans GPS (vérifier via logs de progression).
- Étape 2 : ouvrir "par lieu", revenir en arrière, y retourner → la carte et les photos sont déjà là, aucun rechargement.
- Étape 3 : au démarrage, l'écran d'accueil s'affiche instantanément ; naviguer pendant que le scan tourne en fond reste fluide ; ouvrir "par lieu" ensuite → déjà prêt.

## Git

- Branche : `feat/geo-cache`.
- Un commit par étape, messages clairs (ex. `feat(geo): cache négatif GPS pour éviter les re-scans`).
- Ne pas commiter de secrets. Ne pas supprimer de fichiers critiques sans prévenir.

Commence par l'étape 1 seulement. Explique-moi le plan, montre le code, dis-moi comment tester, puis attends ma validation avant l'étape 2.
