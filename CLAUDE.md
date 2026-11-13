# Pellicule — Contexte projet & instructions IA

> Fichier de passation. Lu en début de session pour retrouver l'état du projet
> sans re-scanner tout le code. **À maintenir à jour** à chaque étape importante.
> Dernière mise à jour : 2026-11-09 (`feature/photos-floues` fusionnée dans `main` ; libellés livre photo de la Galerie et `photo_info` des commandes, §16).

---

## 1. C'est quoi Pellicule

App mobile de **tri de photos**. L'utilisateur passe sa photothèque en revue via
un **swipe façon Tinder** : garder / supprimer / imprimer. Objectif : vider le
trop-plein de photos sans y passer des heures.

- Ancien nom : **Phototri** (encore le `slug` technique). Nom public : **Pellicule**.
- Porteur : **Augustin**, **non-développeur**. Il apprend React Native et Git.
- Stade : **V1 en cours**, déjà buildée et configurée pour la beta (TestFlight).
  Ce n'est plus un prototype.

---

## 2. État actuel (au 2026-11-08)

- **`main` contient** : progression, thème « sauge », barre de menu, Galerie, livre photo carré, **et
  (fusion fast-forward du 8 nov., `6cc5887`) la branche `feature/comptes`** : comptes Supabase (connexion e-mail,
  déconnexion, suppression, sauvegarde de la progression), livre photo 21×28 cm Gelato (couvertures, PDF d'essai
  validé le 7 nov.), abonnements Coups de cœur (tirages / magnets), Galerie « Pellicule » + « Chambre noire ».
- **Fusionnée aussi dans `main` le 9 nov. (fast-forward, `53e7cfa`, pas encore poussée)** : `feature/photos-floues` =
  **« Photos floues » en mode Tri** (voir §14), nouveau tuto d'onboarding, reprise d'un tri Album (§15). Module natif ajouté →
  **rebuild nécessaire** (déjà fait sur iOS et Android). **Fusionnée AVANT d'avoir testé l'étape 6** (corbeille avec confirmation,
  swipe direct, mémoire des photos gardées) : à tester.
- Branche de travail : `main` (pas de nouvelle branche créée pour l'instant).
- ⏸ **STANDBY (décision d'Augustin, 7 nov.)** : la suite de « livre photo → commande » (prix, écran
  « Commander », paiement, envoi du fichier, commande Gelato). Détail et reprise : §8 et §13.
- Branches déjà fusionnées dans `main`, supprimables : `feature/progression`,
  `feature/themes`, `feature/barre-menu`, `feature/livre-photo`, `feature/comptes`, `feature/photos-floues`, `octobre27`.
- Test au quotidien : **simulateur iOS du Mac** (`npx expo start --dev-client`, Fast Refresh).
  Test sur vrai téléphone : **app de dev Android** sur le téléphone d'Augustin (build EAS
  `development`, Metro en Wi-Fi) ; TestFlight sur l'iPhone de sa femme pour les versions beta.

Tous les gros bugs de la phase proto sont **réglés** :
NavigationContainer unique · écrans câblés au navigateur · vraies photos
(`expo-media-library`) · état persisté (Zustand `persist` + AsyncStorage) ·
`app.json` + `eas.json` complets · aucun secret en clair.

---

## 3. Stack technique (versions réelles)

- **Expo 54** / **React Native 0.81** / **React 19** · New Architecture activée.
- **React Navigation 7** — stack JS (`createStackNavigator`).
- **Zustand 5** pour l'état global (avec `persist`).
- JavaScript (pas TypeScript, sauf le strict nécessaire).
- Workflow natif : **dev-client Expo** (dossier `ios/` généré par prebuild, ignoré par Git).
- Libs clés : expo-media-library, expo-notifications, expo-file-system,
  expo-image, expo-linear-gradient, react-native-reanimated + gesture-handler,
  react-native-webview, **react-native-purchases (RevenueCat — installé mais PAS encore branché)**,
  **react-native-svg** (icônes), **expo-font + @expo-google-fonts/outfit** (police),
  **@supabase/supabase-js + react-native-url-polyfill** (comptes, JS pur → pas de rebuild),
  polices du livre photo (Playfair, Caveat, Bebas, Great Vibes, Fredoka) chargées par `components/book/bookFonts.js`,
  **react-native-view-shot** (natif → rebuild : « photographie » les pages hors écran) + **pdf-lib** (assemble le PDF),
  **`modules/pellicule-sharpness`** (module Expo LOCAL, Swift + Kotlin, natif → rebuild : mesure de netteté d'une photo,
  autolinké depuis le dossier `modules/`, pas dans `package.json`).
- Police **Outfit** intégrée au build (plugin `expo-font` dans `app.json`, 6 graisses 400→900
  sous le nom « Outfit ») → `fontWeight` marche tel quel. Ajouter un module natif = rebuild
  (`npx expo prebuild --platform ios --clean` puis `npx expo run:ios`).

---

## 4. Carte du code (où trouver quoi)

Racine : `/Users/augustindevasselot/Documents/phototri/`

- `App.js` — point d'entrée unique. Monte la navigation, vérifie la permission
  photo au démarrage, gère le tap sur une notif (→ lance une session de tri).
- `index.js` — bootstrap Expo.
- `app.json` — config app + build (permissions, plugins, icône).
- `eas.json` — profils de build EAS (development / preview / production).

**navigation/**
- `AppNavigator.js` — une pile (stack). Son 1er écran `Main` = **barre d'onglets** (bottom-tabs) :
  `Home`, `ProgressTab`, `GalleryTab` (section albums), `SettingsTab` (params `inTab: true` →
  pas de bouton retour). Progress, Gallery, Settings existent AUSSI dans la pile (ouverts depuis un
  autre écran, avec bouton retour). Swipe, Bilan… passent par-dessus la barre.
  Depuis un écran de la pile, aller sur l'accueil = `navigate("Main", { screen: "Home", params })`.
  Un seul NavigationContainer (dans App.js). Écrans de pile ajoutés : `PhotoBook`, `BookPageEditor`,
  `BookCheck`, `Auth`, `BlurryPhotos`, `BlurCalibration` (déclaré seulement en `__DEV__`).

**store/**
- `useAuthStore.js` — session de connexion Supabase (`session`, `ready`, `init()` appelé dans App.js).
  Pas de persist : Supabase mémorise la session lui-même (AsyncStorage).
- `usePhotoStore.js` (~600 l.) — **cerveau de l'app**. État du tri, filtres albums,
  réglages de rappels, flags "vu une fois". Persisté via AsyncStorage.
  Contient aussi le **carnet de bord** `dailyLog`, le chrono de tri, `lifetimeSorted`,
  `achievements` (galons/badges datés) et la file `pendingUnlocks` (non persistée).
  Photos floues : `blurKeptIds` (persisté), `addBlurKept(ids)`, `addDeletedMany(photos)` (corbeille en lot, **hors progression**).
- `useBlurStore.js` — état EN MÉMOIRE de l'analyse de netteté (`status`, `done` / `total`, `scores` = le cache,
  `rev` = compteur de publications, `whatsapp` = albums WhatsApp trouvés). Alimenté par `photoAnalysisQueue`.

**screens/** (13)
- `OnboardingScreen` · `PermissionDeniedScreen` — arrivée + permissions. L'onboarding affiche les **8 pages de
  `constants/tutorialSlides.js`** (rendues par `components/TutorialSlide.js`, **les mêmes que Réglages → « Tutoriel »**) :
  bouton rappels (demande les notifications, « Plus tard » possible), page compte (ouvre `Auth`, ajouté à la pile d'onboarding),
  dernière page = accès aux photos. Modifier un texte du tuto = modifier `tutorialSlides.js`.
- `HomeScreen` (~906 l.) · `TriModeScreen` — accueil + choix du mode de tri.
- `SwipeScreen` (~668 l.) — le tri par swipe (cœur de l'app).
- `GalleryScreen` (~864 l.) · `MomentScreen` — galerie / albums / moments.
- `DuplicatesScreen` — « Même instant » : photos prises à quelques secondes d'écart
  (ex-Doublons). CTA sur les bords (`SwipeEdgeHints`), comme le swipe.
- `ProgressScreen` — progression : série 🔥, galon, graphe semaine/mois, chrono, badges.
- `MapScreen` — tri par lieu (GPS).
- `RappelsScreen` — réglage des notifications de rappel.
- `SummaryScreen` — bilan de session.
- `SettingsScreen` · `PartenairesScreen` — réglages + partenaires impression.
  `SettingsScreen` : carte « Ton compte » en haut (`AccountCard`), « Supprimer mon compte » dans la section Compte.
- `GalleryHomeScreen` — onglet Galerie (albums, livres photo, tirages = Coups de cœur, corbeille).
- `AuthScreen` — connexion / création de compte par e-mail + état « Regarde ta boîte mail ».
  Apple et Google : **pas encore** (boutons volontairement absents).
- `PhotoBookScreen` — éditeur de livre photo d'un album : format (1 ligne : orientation + pages − / +, maintenir
  pour défiler), couverture (style · couleur de fond · titre, listes **dépliables** ; bouton « ✂ Recadrer la photo » ;
  aperçu « Couverture à plat »), doubles pages (**glisser pour tourner**), bande « Toutes les pages » (liste
  défilante `FlatList` de react-native-gesture-handler, suit la page affichée).
  `BookPageEditorScreen` — une page en grand (mise en page, titre, recadrage ; glisser = page suivante).
  `BookCheckScreen` — « Vérifier ton livre » avant impression (3 vues : contrôles · photos de faible qualité ·
  et maintenant ?). **« Créer le PDF » (PDF d'essai) visible seulement en `__DEV__`.**
- `BlurryPhotosScreen` — « Photos floues » (mode Tri) : grille 3 colonnes, tout coché, coche = garder, photo = grand format,
  pastille WhatsApp, boutons corbeille (feuille `BlurConfirmSheet`) et « Les trier une par une (swipe) » (→ `Swipe` direct).
  `BlurCalibrationScreen` — **`__DEV__`** : photos rangées de la plus floue à la plus nette, seuil réglable, répartition.
  `HomeScreen` : ligne « Photos floues » sous « Même instant » (mode Tri) ; la brique « Créer un livre photo » du mode Album a été retirée.
  `SummaryScreen` : bouton « Vider » sur la brique « Supprimées » (vide toute la corbeille, même confirmation que l'accueil).

**components/** — briques UI réutilisables :
- `AppText` — **remplace le `Text` de React Native partout** (applique Outfit). Dans un nouveau
  fichier : `import Text from "../components/AppText";` (jamais `Text` depuis "react-native").
- `Icons` — icônes au trait (react-native-svg) : `<Icon name="shuffle" color={C.accent} />`.
  `IconsBoard` = planche de toutes les icônes en bas de Réglages (`__DEV__` seulement).
- `TabBar` — barre du bas : Accueil · Progression · [⇄ bouton central Tri/Album] · Galerie · Réglages.
- `Logo` — logo dessiné (piste B) aux couleurs du thème (cœur : moitié `accent`, moitié `album`).
- `home/` — morceaux de l'accueil : `HomeHeader` (logo + nom, pastille « Mode Tri / Mode Album »),
  `TriHero` (phrase des jours, pastille photos/session, barre, pastille corbeille, bouton 🔀, Lancer un tri),
  `FolderSheet` (Toute la photothèque / Screenshots / dossiers), `ui` (`SHADOW`, `SectionTitle`, `ListRow`).
- Autres : `BackButton`, `Toggle`, `PhotoGrid`,
`ZoomableImage`, `RowSetting`, `AlbumFiltersBar`, `SessionTutoOverlay` (overlay tuto),
`SwipeEdgeHints` (actions sur les bords), icônes dessinées `ExitIcon` / `SwapIcon` / `RankShield`,
`ProgressCard` (carte accueil), `RankCard` + `BadgesGrid` (écran Progression),
`DayValidatedToast` + `AchievementUnlocks` (bandeaux / fenêtre de déblocage),
`AccountCard` (carte compte des Réglages).
- `book/` — livre photo : `BookPage` (page à n'importe quelle taille, `size` = largeur, `ratio` = hauteur/largeur),
  `BookCover` (6 styles, zone utile + fond perdu, photo recadrable), `BlankPage`, `COVER_STYLE`,
  `coverTitleColor`, `BookControls` (`LayoutPicker`, `Chip`, `ToolButton`…), `PhotoPickerSheet`,
  `AlbumPickerSheet`, `CroppedImage`, `TiltSlider`, `bookFonts`, `FlatCover` (4ᵉ + dos + face avant, à partir
  des dimensions Gelato), `PrintPageRenderer` (dessine une page hors écran à la taille d'impression).
- `BlurConfirmSheet` — feuille « Mettre N photos à la corbeille ? » (Photos floues). `dev/SharpnessDevTest` — **`__DEV__`**,
  carte en bas des Réglages : test du module, avancement de l'analyse, diagnostic WhatsApp, accès au calibrage.
  `Icons` : icône `blur` ajoutée.

**modules/pellicule-sharpness/** — module natif local : `ios/PelliculeSharpnessModule.swift` (miniature 512 px via
PHImageManager, sans iCloud) et `android/.../PelliculeSharpnessModule.kt` (miniature via ContentResolver + BitmapFactory).
Même formule des deux côtés : **variance du Laplacien** d'une miniature en gris. `getSharpness(id)` → `{ score, width, height }`
ou `null` (photo illisible / seulement sur iCloud). Si on change la formule : modifier LES DEUX fichiers + monter
`BLUR_ALGO_VERSION` + rebuild.

**services/** — logique métier, pas d'UI :
- `photoLibrary.js` — wrapper expo-media-library (permission, chargement, suppression).
- `photoAnalysis.js` — calculs purs sur les photos (pas d'I/O).
- `notificationService.js` — rappels locaux. Quotidien / 2x par jour = **rappels datés
  sur 30 j** (1er = message série 🔥), reprogrammés par `refreshReminders()` à chaque
  passage en arrière-plan (App.js).
- `progressStats.js` — calculs purs sur `dailyLog` : sommes, série 🔥 (`computeStreak`,
  seuil `STREAK_MIN` = 10, joker 1/semaine), chrono (`avgFor20`).
- `achievements.js` — **liste des 10 galons + 14 badges** (noms, seuils) et leurs règles.
- `dateKey.js` — `dayKey()` (date locale "AAAA-MM-JJ"). Fichier sans dépendance pour
  éviter une boucle d'imports store ↔ services. Le store le ré-exporte.
- `gpsCache.js` — cache persistant des coordonnées GPS.
- `supabase.js` — client Supabase (URL + clé **publishable**, session dans AsyncStorage).
- `auth.js` — connexion, création, renvoi du mail, déconnexion, suppression de compte ; erreurs en français.
- `progressSync.js` — sauvegarde de la progression (table `progress`) : fusion à la connexion, envoi 5 s
  après chaque changement. **Seulement des chiffres** (`dailyLog`, `lifetimeSorted`, `achievements`,
  `shuffleLaunchCount`, `best20Ms`) ; jamais de photos, coups de cœur ni albums (ids propres au téléphone).
- `photoBook.js` — logique pure du livre (orientation, pages 30→200 par 2, mises en page, recadrage des pages
  ET de la couverture, `COVER_STYLES`, `COVER_BGS` = 26 couleurs, `setCoverStyle` → titre repasse en « auto »).
- `bookCheck.js` — contrôles avant impression + `PRINT_SPEC` (specs Gelato).
- `gelato.js` — dimensions de la couverture à plat (appelle la fonction `gelato-cover`, cache mémoire + téléphone).
- `bookPdf.js` — géométrie des pages (mm → pixels → points PDF), plan du PDF, assemblage `pdf-lib`
  (boîtes de rognage / fond perdu). Ordre : couverture à plat · garde blanche · pages · page blanche de fin.
- `photoShare.js` — fichier original d'une photo (`getShareableUri`, aussi utilisé pour le PDF : photos HD, iCloud).
- **Chaîne d'analyse des photos (photos floues ; servira aussi aux futures étiquettes « plage / chien »)** :
  `sharpness.js` (enveloppe du module natif ; `isSharpnessAvailable` = false si pas de rebuild) ·
  `photoAnalysisQueue.js` (`startPhotoAnalysis()` appelé dans `App.js` : file progressive, 2 photos à la fois, récentes d'abord,
  stoppée en arrière-plan ; ne mesure que les photos sans résultat à jour ; `restartPhotoAnalysis` / `resetPhotoAnalysis` pour le dev) ·
  `photoAnalysisCache.js` (fichier JSON `photo-analysis-v1.json` dans le dossier documents :
  `{ [idPhoto]: { m: modificationTime, blur: { s, v } } }` ; une future analyse ajoutera sa clé à côté de `blur`) ·
  `photoSource.js` (WhatsApp : nom `IMG-…-WA0003` OU dossier contenant « whatsapp ») ·
  `blurDetection.js` (pur : `isBlurFresh`, `blurryPhotos(...)` = photos sous le seuil, exclusions) ·
  `blurMetrics.js` (**inutilisé**, voir §14 : 4 mesures abandonnées car elles demandaient un rebuild).
  `photoLibrary.js` : chaque photo porte aussi `modificationTime` (clé du cache).

**hooks/** — `useAndroidBack` (bouton retour Android), `useNotificationReminder`
(logique d'activation des rappels, partagée), `useBookPdf` (fabrique le PDF d'essai : dessin hors écran →
capture JPEG → PDF → fichier partageable ; progression, annulation, étape affichée),
`useBlurryPhotos` (liste des photos floues + avancement de l'analyse, pour l'accueil et l'écran Photos floues).

**supabase/** — `config.toml` + `functions/` : `gelato-cover` (dimensions de couverture), `gelato-price`
(coût d'impression et livraison Gelato ; ajoutée le 6 nov., **non testée par Claude**). Fonctions Deno côté serveur.

**constants/** — `theme.js` : **plusieurs palettes** (`PALETTES.ardoise` = ancienne bleue,
`PALETTES.sauge` = nouvelle). L'interrupteur `THEME_ACTIF` choisit celle utilisée → `C`.
Aussi `FONT` ("Outfit"), styles `S`. Ne jamais écrire une couleur en dur : passer par `C`.
`blurConfig.js` : **tous les réglages des photos floues** (version de la formule, seuils normal / WhatsApp, cadence de l'analyse).

---

## 5. Config build & stores

- iOS bundle id : `com.phototri.app` · Android package : `com.phototri.app`
- EAS projectId : `9505ec18-08e3-4669-8002-a4992177bd04` · owner : `augustindevasselot`
- App Store Connect : app créée (ascAppId `6786287707`) → cible TestFlight.
- Build beta : `eas build --profile preview` puis `eas submit`.

**Supabase** (comptes, créé le 6 nov.) : projet `pellicule`, URL `https://xemwkqqpgvefumfvcehj.supabase.co`,
région Europe. La clé **publishable** (`sb_publishable_…`) est dans `services/supabase.js` : elle est faite
pour être dans l'app, c'est la **RLS** (sécurité par ligne) qui protège les données.
**Ne jamais mettre la clé `secret` / `service_role` dans l'app ni dans Git.**
- Table `progress` (`user_id` pk → `auth.users` on delete cascade, `data` jsonb, `updated_at`), RLS :
  chaque compte ne voit / crée / modifie que sa ligne.
- Fonction SQL `public.delete_my_account()` (security definer) : supprime le compte appelant
  (`delete from auth.users where id = auth.uid()`). Nécessaire au bouton « Supprimer mon compte ».
- Tableau de bord : Authentication → Users (UID, e-mail, dernière connexion) · Logs → Auth.
- Confirmation d'e-mail **activée** par défaut. Le lien du mail mène à une page vide (Site URL =
  localhost) : le compte est bien confirmé, puis « J'ai confirmé, continuer » dans l'app.

> ⚠️ **GELATO RETIRÉ DE L'APP (9 nov. 2026, décision d'Augustin : « on oublie Gelato pour le moment »).** Tout ce paragraphe est de l'archive ; le code et les specs sont dans `archive/gelato/` (README = specs, `app/` = anciens fichiers, `supabase-functions/` = copies). Les fonctions `gelato-cover` / `gelato-price` restent déployées mais ne servent plus. Plus de `services/gelato.js`, `FlatCover`, `PRINT_SPEC`, couverture à plat. Les livres existants sans `product` sont convertis en layflat (`upgradeLegacyBook`, migration du store v3).

**Gelato** (impression ; PDF conforme aux specs, **commande pas encore branchée — standby**) : produit retenu
`photobooks-hardcover_pf_210x280-mm-8x11-inch_pt_170-gsm-65lb-coated-silk_cl_4-4_ccl_4-4_bt_glued-left_ct_matt-lamination_prt_1-0_cpt_130-gsm-65-lb-cover-coated-silk_ver`
(livre photo couverture rigide 21×28 cm, pages 30→200 de 2 en 2). Prix vu : 15,46 € HT + 5,39 $ de
livraison pour 30 pages. Specs PDF : **un seul PDF** — page 1 = couverture à plat (dos + 4ᵉ + 1ʳᵉ),
page 2 blanche (garde), pages intérieures une par une (pas en double page), dernière page blanche ;
fond perdu **4 mm**, marge de sécurité **4 mm**, images **150 dpi min / 300 max**, sRGB accepté,
PDF/X-4 recommandé, sans traits de coupe, zone code-barres réservée sur la 4ᵉ. Largeur du dos :
via l'API Gelato `GET /v3/products/{productUid}/cover-dimensions?pageCount=…` (clé API requise,
à garder côté serveur Supabase). Les pages de documentation de Gelato bloquent la lecture automatique (403).
**Fait le 6 nov.** : clé dans les secrets Supabase (`GELATO_API_KEY`) ; fonction `supabase/functions/gelato-cover`
déployée (`--no-verify-jwt` = version d'essai, **à protéger par une connexion avant la mise en ligne**) :
`GET https://xemwkqqpgvefumfvcehj.supabase.co/functions/v1/gelato-cover?pageCount=30` (pair, 30→200).
Réponse testée (mm) : `pagesCount` = pages demandées + 4 · couverture à plat `wraparoundInsideSize`
478×326 (30 p.) · dos `spineSize.width` 6 mm (30 p.), 9 (60), 11 (100), 19 (200) · panneaux 208×286 à 20 mm
du haut ; dos arrière / dos / dos avant séparés par des charnières de 8 mm ; face avant à `left` = 250 (30 p.).
Redéployer : `npx supabase functions deploy gelato-cover --no-verify-jwt` (après `login` + `link`).
`gelato-price` (coût d'impression + livraison, options `?pageCount=`, `?all=1`, `?country=FR`, `?quote=1`) est dans le
dépôt, déployée de la même façon ; réponse brute de Gelato, **à lire et nettoyer** quand on reprendra les prix.

**imprimeur.fr (9 nov., branche `feature/catalogue-produit`, fonction déployée, à commiter)** : 2ᵉ fournisseur d'impression (France, Hauts-de-France),
secret Supabase `ImprimeurFR_API_Key` (clé **`impr_test_`** = rien d'imprimé ni facturé). API : `https://imprimeur.fr/api/v1`, `Authorization: Bearer`,
doc `imprimeur.fr/docs/api` + `docs/api/openapi.yaml`, 120 appels/min. Fonction `supabase/functions/imprimeur-catalogue` (lecture seule, `--no-verify-jwt`) :
catalogue (`GET /products`) + port (`POST /shipping/rates`, adresse fictive) + specs fichiers. Produits : album, print, poster, frame, calendar (éditeur seul).
**Pas de magnets.** Prix HT relevés : album 21×29,7 rigide 14,40 € (24 p.) + 0,26 €/page ; 21×21 rigide 12,00 € + 0,22 €/p. ; port Colissimo 4,97 € / Chronopost 8,25 €
(forfait par commande) ; tirage 10×15 : 20 minimum, `extra_page_price` 0,20 € (`unit_price` à 0,00 : ambigu, à confirmer). Fichiers : **URL publique** (pas d'upload),
album = 1 PDF, fond perdu 5 mm ; dpi / couverture / dos **non publiés** (gabarit sur le site). Un 502 Cloudflare passager est arrivé quand 45 appels partent d'un coup
(→ retry ajouté le 9 nov. : 3 tentatives, attente 2 s puis 4 s ; **fonction à redéployer**). Prix publics du site = « dès », ne pas s'y fier : prendre ceux de l'API.
**Branché dans l'app (9 nov., ✅ codé, à tester)** : `services/bookProducts.js` = 2 formats layflat (rigide, 24 → 120 pages, fond perdu 5 mm) :
`a4` 21 × 29,7 vertical (coût 16,90 € HT + 0,39 €/page au-delà de 24) et `paysage` 21 × 15 horizontal (14,90 € + 0,39 €/page) + port 4,97 € ;
**prix de vente TTC, livraison comprise** : **a4 34,90 € (24 p.)** + 0,65 €/page · **paysage 29,90 €** + 0,65 €/page (prix de base fixés par Augustin le 9 nov. ; marge ≈ 7,2 € / 5,1 € HT à 24 p.,
≈ 21,8 € / 19,6 € à 120 p., avant frais de paiement ; TVA 20 % = hypothèse). `book.product` (absent = ancien livre Gelato 21×28, 30 → 200 p., inchangé, sans prix) ;
nouveaux livres = `a4` par défaut ; `PhotoBookScreen` : pastilles de format (remplacent vertical/horizontal pour les nouveaux livres) + ligne de prix ;
`BookCheckScreen` : prix dans le récap et dans « Commander ». **Gabarits imprimeur.fr reçus le 9 nov. (4 PDF de 26 pages pour 24 pages : 21x29.7, 29.7x21, 21x15, 15x21 cm)** : page 1 = « couverture de Face », pages 1 → N,
dernière page = « couverture de Dos » ; **pas de dos / tranche, pas de garde blanche, pas de couverture à plat** ; chaque page = **format exact**
(210×297, 210×150… ; MediaBox = TrimBox = BleedBox → **fond perdu 0**, alors que la fiche album dit 5 mm : à valider par une commande TEST `impr_test_`) ; pas de dpi dans les gabarits
(150 supposé, sécurité 5 mm supposée). **PDF d'essai layflat codé** (`services/bookPdf.js` `buildPlan`, kinds `front` / `back`, `PrintPageRenderer` ; dos = uni, couleur de fond de la
couverture ; testé en script : 26 pages / bonnes tailles, pas encore sur l'appareil). La couverture à plat Gelato est archivée (`archive/gelato/`).
**Haut de l'éditeur (9 nov., ✅ codé, à tester)** : (1) nom de l'album + icône ✓ « enregistré automatiquement » à droite ; (2) carte format « 24 pages · 21 × 29,7 cm » + tarif en gris dessous + à droite les 2 pastilles vertical / horizontal ; **toucher la carte = page « Format du livre »** (`BookFormatChooser` en mode `current`, cartes des formats avec prix pour le nombre de pages actuel) ; (3) carte remplissage : « N / M photos placées », barre, nombre de pages − / +, et **« Compléter automatiquement »** (ordre : *Par date, la plus récente à la fin* ou *Ordre de l'album* ; remplit les cadres vides puis **ajoute des pages** par 2 jusqu'à 120 ; annonce « +N pages · prix » avant de valider ; `completeBook` dans `photoBook.js`). Polices **Élégante et Ronde retirées** (un livre qui les avait repasse en Moderne).
**Éditeur de couverture (9 nov., ✅ codé, à tester sur appareil)** : à l'arrivée sur la couverture il n'y a presque rien. **Les outils dépendent du toucher** : toucher le **titre** → panneau Titre (texte, police, taille, couleur, position **Auto** [haut / milieu / bas pour les styles « sur la photo »] ou **Manuelle** = titre glissable au doigt, `cover.titleXY = {x, y}` en parts de la couverture) ; toucher la **photo** → deux boutons « Changer la photo » / « Recadrer » (le recadrage garde ses outils). **Style de couverture : toujours visible.** **Couleur de fond : seulement si le style la montre** (`COVER_STYLES_WITH_BG` = centrée, polaroïd, bandeau, titre seul ; proposée tout de suite après le choix du style ; le dos du livre prend toujours cette couleur). Changer de style remet le titre en auto. À vérifier : glisser le titre pendant que l'écran défile (le défilement est coupé pendant le glissé).
**Double page (9 nov., ✅ codée d'après `Claude outputs/maquette-double-page.html`, à tester sur appareil)** : 5ᵉ bouton « Double page » dans la mise en page (`LayoutPicker`). Une double page = UNE photo sur 2 pages face à face :
pages de l'aperçu (2–3), (4–5)… = index (1,2), (3,4)… ; **la page 1 et la dernière page (nombre pair) ne peuvent pas** (seules face à la couverture / à la fin). Modèle : page de gauche `{ double: "left", layout: 1, slots: [id], crops }`,
page de droite `{ double: "right", slots: [null] }` (photo et recadrage seulement à gauche ; `photoBook.js` : `setDouble`, `clearDouble`, `canDouble`, `pagePhotoIds`, `sanitizeDoubles`).
Rendu : `DoublePage` (`BookPage.js`) = grand cadre sur 2 pages avec marge 5 % aux bouts, pas de marge au centre ; pli en pointillés dans l'éditeur seulement ; `half` = une seule moitié pour le PDF.
Éditeur : toucher « Double page » (confirmation si des photos retournent dans l'album) → choix de la photo → toucher la photo = « Changer / Recadrer / Séparer en 2 pages » ; choisir 1-4 photos sépare la double page ; réduire le nombre de pages
coupant une double page la sépare. `completeBook` / `autofill` ignorent la moitié droite. Contrôle qualité : largeur = 1,9 page (≈ 2 356 px à 150 dpi en A4). PDF : chaque moitié = une page avec la même photo décalée.
`BookPageEditorScreen` d'une page de double page = message « retourne à l'aperçu ». **Pas encore** : « sans marge » (grisé dans la maquette, attend la réponse d'imprimeur.fr sur le fond perdu) ; raccord au centre à vérifier sur un échantillon papier.
**Pas encore** : commande réelle, URL publique du PDF (Supabase Storage) pour `file_urls`. **Création d'un livre (9 nov., à tester)** : 1re ouverture d'un album → `components/book/BookFormatChooser.js` (présentation du layflat « ouverture à 180° » + les 2 formats avec prix, « Choisir » crée le livre via `createBook(album, product)`) ; le livre démarre **toujours à 24 pages** (le minimum, quelle que soit la taille de l'album ; avant : calculé sur le nombre de photos, ce qui donnait 30 pages). `PhotoBookScreen` ne crée plus le livre tout seul. **Abonnement tirages** : une seule offre = **20 tirages 10×15 à 12,90 € / mois** (prix fixé par Augustin ; hypothèse d'Augustin 0,18 € HT / tirage → coût 8,57 € HT (3,60 + port 4,97) contre 10,75 € HT encaissés → **marge ≈ 2,18 € par envoi**, ≈ 1,74 € avec les frais de paiement)
(minimum imprimeur.fr ; coût ≈ 9 € HT) ; les choix 5/10/15 tirages et leur grille de prix ont été **supprimés du code** (9 nov.). Magnets inchangés (9,90 €, fabrication manuelle).

---

## 6. Git — comment on travaille

- Repo : `https://github.com/gusdevst/projetappv0` (public, handle `gusdevst`).
- **Branche de référence = `main`** (la plus à jour ; `retourbeta` y est déjà intégrée).
- Branche de travail actuelle : `feature/comptes` (un commit par petite étape = points de sauvegarde).
- **Piège de publication** : si VS Code répond « You don't have permissions to push » et propose un fork,
  répondre **Cancel** (jamais « Create Fork »). Cause rencontrée le 6 nov. : le Trousseau d'accès du Mac
  gardait un identifiant GitHub `augustindevasselot` (sans droits) pour `github.com` ; il faut le supprimer
  (Trousseau d'accès → `github.com`) pour que le compte `gusdevst` serve. Deux remotes identiques
  (`origin`, `upstream`) existent : choisir **origin**.
- Branches plus anciennes (juin) probablement abandonnées : `fix/stabilisation-beta`,
  `feature/notifications`, `feature/couleurs`. À nettoyer un jour.
- **Augustin commit et push lui-même depuis VS Code.** Ne pas push depuis le shell.
- Messages de commit à soigner (éviter "notifs", "cache" → dur à relire 2 mois après).

---

## 7. Dettes connues (à traiter, non bloquant)

1. **Repo pollué** : des dossiers d'outils IA sont suivis par Git alors qu'ils ne
   devraient pas — `claude-code/` (41 Mo, avec son propre `.git`), `.gemini/`,
   `.qoder/`, `.kiro/`, et les maquettes `Claude outputs/` (ajouté au `.gitignore`
   le 27 oct.). À sortir du suivi Git (`git rm -r --cached` + `.gitignore`).
2. **6 branches** : clarifier / supprimer les mortes.
3. **RevenueCat installé mais pas configuré** (`Purchases.configure` absent) → le
   Premium payant n'est pas encore actif.
4. **Écrans très longs** (`GalleryScreen` ~860 l.) → à découper en composants quand on y
   retouchera. `HomeScreen` découpé le 30 oct. (~990 l., dont la fenêtre partenaires inutilisée).
5. **Fenêtre « Nos partenaires impression »** dans `HomeScreen` (PRODUCTS, Cheerz/CEWE/Photobox) :
   plus aucun bouton ne l'ouvre. À supprimer ou rebrancher (décision d'Augustin).
6. **Code mort à supprimer** (suppression de fichiers = permission à demander) : `AlbumFiltersBar`,
   `ExitIcon`, `SwapIcon`, `IconsBoard` (plus affichée), `MomentScreen` (orphelin, encore déclaré
   dans le navigateur). Quelques `TextInput` hors Accueil/Galerie pas encore en Outfit.
7. **Android : jamais d'ombre (`elevation`) sur un fond transparent** (`${couleur}12`, rgba) →
   rectangle gris. Fond opaque (ex. `C.sage`) ou pas d'ombre.
8. **Comptes — reste à faire** : connexion **Apple** et **Google** (config chez Apple / Google Cloud +
   rebuild) ; **« Mot de passe oublié »** et lien de confirmation d'e-mail (il faut relier l'app aux liens
   des mails : deep link / Site URL) ; textes légaux (« conditions », politique de confidentialité = « bientôt »).
9. ✅ **Texte du tuto « Pellicule n'envoie aucune photo sur un serveur »** : remplacé le 8 nov. (nouveau tuto, §14) par
   « Le tri reste sur ton téléphone. Une photo n'en sort que si tu la valides pour l'impression. » (à tester).
   Reste à faire avant la mise en ligne : politique de confidentialité + contact de suppression (voir §13).
10. **Livres de l'ancien format** (24 pages, carrés) : signalés par « Vérifier ton livre » (30 pages min,
    nombre pair). Les albums de peu de photos donnent beaucoup de pages vides à 30 pages (non bloquant).
11. **`progressSync`** : `freedMo` et `purgedCount` ne sont **pas** synchronisés (dépendent de la photothèque
    de chaque téléphone). Coups de cœur / albums / livres non plus (ids de photos propres au téléphone).
12. **Fonctions Gelato ouvertes** (`gelato-cover`, `gelato-price` déployées avec `--no-verify-jwt`) : elles ne
    montrent jamais la clé, mais n'importe qui peut les appeler. **Exiger un compte connecté avant la mise en ligne.**
13. **PDF d'essai** : réservé à `__DEV__`. Un livre de 200 pages pèse lourd en mémoire (tester 30-60 pages d'abord).
    Le rendu hors écran peut varier selon l'appareil ; les photos sont lues depuis les **fichiers originaux**
    (`getShareableUri`, iCloud inclus) avec un délai de 15 s par page avant de capturer quand même.
14. **Intérieur de couverture** : affiché en page blanche hachurée « Intérieur de couverture » dans l'aperçu.
    C'est voulu : chez Gelato, la page 2 du fichier (garde) et la dernière page restent **blanches** (non imprimées).
    Libellé à reprendre (« Garde (non imprimée) ») si Augustin le souhaite — **ne pas changer ses textes sans accord**.
15. **Photos floues — précision de la mesure** : ✅ **codé le 9 nov., à tester après rebuild**. Le module natif renvoie 4 mesures
    (`lap` = d'origine, `top` = moyenne des 4 cases les plus nettes d'une grille 4 × 4, `lap2` / `lap4` = image réduite 2 / 4 fois) ;
    `BLUR_METRIC = "top"` décide (portrait net sur fond lisse sauvé) ; seuils par mesure dans `BLUR_THRESHOLDS`, **calibrés par
    Augustin le 9 nov.** (lap 100 / 150 · top 150 / 300 · r12 0,35 / 0,45 · r24 0,3 / 0,55 ; normal / WhatsApp) ; `BLUR_ALGO_VERSION = 2` → toute la photothèque est remesurée. Écran de calibrage : choix de la mesure
    (Laplacien / Zone nette / Fin-moyen / Moyen-gros). Une app pas reconstruite n'enregistre rien (exige les 4 mesures). Limite connue :
    une photo floue mais très bruitée (nuit) peut encore passer pour nette (essayer `r12` au calibrage si ça gêne).
16. ✅ (réglée le 9 nov., voir n°15) **Photos floues — seuil normal pas calibré** (100, valeur de départ). Seul le seuil WhatsApp a été réglé (150, sur l'Android d'Augustin).
    Les scores iOS et Android ne sont pas forcément comparables (même formule, décodeurs différents) : si besoin, un seuil par plateforme.
17. **Détection WhatsApp sur iOS non vérifiée** : sur Android elle marche (5 142 par nom, 5 130 par dossier). Sur iOS, WhatsApp range dans
    la pellicule sous des noms `IMG_1234`, sans dossier : les photos WhatsApp y passeront probablement avec le seuil normal (le panneau
    `[DEV]` n'existe pas en TestFlight pour le vérifier). Règle de secours possible : sans date de prise de vue + petite taille.
18. **Cache d'analyse jamais nettoyé** (les photos supprimées de la photothèque restent dans `photo-analysis-v1.json`, quelques Ko ; **laissé tel quel, décision d'Augustin du 8 nov.**) ; les photos
    seulement sur iCloud sont réessayées à chaque lancement (sans téléchargement). L'analyse tourne aussi en version publiée (≈ 43 ms / photo sur Android).
19. **Brique « Supprimées » du bilan : « Vider »** vide **toute** la corbeille, pas seulement les photos de la session (la confirmation annonce le total).

---

## 8. Prochaines étapes probables

1. ✅ `feature/comptes` (8 nov.) et `feature/photos-floues` (9 nov.) fusionnées dans `main`. **À faire : tester l'étape 6 de « Photos floues »**,
   puis pousser `main` depuis VS Code (choisir **origin**).
1bis. **Recherche en mode Album** (partie 1 de `Claude outputs/maquette-recherche-flou.html`, **pas codée**) : champ « l'été 2026 à la plage »,
   période (été, Noël…) + contenu (plage, chien…) ; nouvelle ligne « Par contenu » dans « Affiner la sélection ». Le contenu demande des
   **étiquettes** (analyse d'image sur le téléphone) : même chaîne que le flou (`photoAnalysisQueue` + cache), mais un autre module natif
   (rebuild). Décidé par Augustin : « été » = **juillet et août**.
1ter. **Connexion Apple / Google** : à rediscuter avec Augustin (voir aussi n° 4).
2. ⏸ **Livre photo → commande (Gelato) — EN STANDBY depuis le 7 nov.** Déjà fait : produit, clé API (secret
   Supabase), dimensions de couverture, couverture à plat, PDF d'essai conforme (validé), fonction de prix.
   **Reste, dans l'ordre :**
   a. **Prix** : afficher un prix = coût Gelato (`gelato-price`) + livraison + TVA + **marge** ;
   b. écran **« Commander »** (récap, adresse de livraison, prix) après « Vérifier ton livre » — **compte connecté exigé** ;
   c. **paiement** (ex. Stripe ; un livre physique n'a pas à passer par l'achat intégré Apple) ;
   d. **envoi du PDF** sur Supabase Storage (espace privé, accord clair de l'utilisateur, **changer le texte du tuto**) ;
   e. fonction serveur qui **crée la commande Gelato** (d'abord en « brouillon » sans impression, puis une vraie
      commande test) + suivi de commande dans l'app ;
   f. sécurité (JWT sur les fonctions) et légal (conditions de vente, confidentialité, TVA).
   **3 décisions d'Augustin avant de reprendre** : sa **marge**, **qui encaisse** (compte Stripe), **pays de
   livraison** (France seule au début ?).
3. **Tirages photo** (Coups de cœur) : même chaîne que le livre, après lui. Débouche sur
   l'**abonnement mensuel Coups de cœur** (maquette validée le 6 nov., voir §13).
4. Comptes : Apple, Google, mot de passe oublié + liens des mails (avant la mise en ligne).
5. TestFlight + APK Android (`eas build --profile preview`) de la version avec comptes.
6. Nettoyer le repo (dossiers pollués, `Claude outputs/`) et les branches mortes.
7. Gamification étape D : points + récompenses partenaires (Supabase peut servir de serveur).
8. Brancher RevenueCat (Premium), backend pour l'IA "Album IA".
9. Plus tard : choix de la couleur par l'utilisateur (le mécanisme `PALETTES` est prêt).

---

## 9. Comment bosser avec Augustin (règles à respecter)

- **Il n'est pas développeur.** Sois ultra pédagogue, mais sans blabla.
- **Phrases courtes, pas de mots de remplissage, ne narre pas.**
- **Une seule étape à la fois**, puis attendre sa validation avant la suite.
- Expliquer le **pourquoi**, avec des **métaphores concrètes**.
- Toujours donner le **chemin exact** du fichier et **quoi copier/coller**.
- Pas de gros dumps de code. Vérifier la cohérence imports/exports.
- Agir comme un **CTO senior qui forme un junior**.
- Français.

---

## 10. Session 12-13 oct. 2026 (branche `octobre27`, fusionnée dans `main`)

- Partage HD par swipe (action "share" réglable) → `services/photoShare.js`, `ZoomableImage` prop `bounceDirs`.
- Dates 1970 : repli sur `modificationTime` dans `services/photoLibrary.js`.
- Accueil Tri : carte objectif (jours restants, mois dès 180 j), barre de stats supprimée,
  briques "Par date" (calendrier direct, `components/RangeCalendarPicker.js`) + "Même instant" (ex-Doublons, icône 📷),
  lignes Corbeille (Vider + compteur `freedMo` Go libérés) et Rappel (interrupteur). Par lieu / Par visage supprimés.
- Accueil Album : carte "Ton prochain album" (mosaïque), filtre ❤️ en pastille, liste "Mes albums"
  (Coups de cœur = album auto en tête, menu ··· renommer/supprimer), partenaires réduits à un bandeau.
- Par lieu (🌍) revenu en mode Album uniquement (carte agrandie). Écran orphelin : `MomentScreen`.

---

## 11. Sessions 16-27 oct. 2026 (branche `feature/progression`)

**Même instant** : sortie `ExitIcon`, CTA GARDER/SUPPRIMER sur les bords (cliquables,
`SwipeEdgeHints` prop `downBottom`), groupes renommés « N photos du même instant ».

**Accueil**
- Toggle 🧹 Tri / 📕 Créer un album + pastille ⇄ au centre (`SwapIcon`), fond blanc,
  flèches à la couleur du mode. Briques de même hauteur (`flex: 1`, bug iOS).
- Corbeille + Rappel sur **une seule carte coupée en deux** (« Vider › » + interrupteur).
- Carte **« Cette semaine »** (`ProgressCard`) : photos · Mo, % vs même période semaine
  passée, mini-barres 7 j, pastille 🔥, chrono. Tap → `ProgressScreen`.
- Mode Album : filtres sur une ligne (2025 et ❤️ Coups de cœur retirés).
- **Icône album unifiée = 📕** partout. 📁 gardé uniquement pour les dossiers du téléphone.

**Progression / gamification** (tout se calcule depuis `dailyLog`, source unique)
- `dailyLog[jour] = { sorted, freedMo, timedCount, activeMs }`.
  Triée = gardée (✅/❤️) ou supprimée ; pas "j'hésite" ni album. ↩ annuler décompte.
  Mo comptés quand on **vide la corbeille**. Chrono : pauses > 60 s et actions < 0,2 s ignorées.
- **Série 🔥** : journée validée à 10 photos, joker 1 jour raté/semaine, record.
  Bandeau « 🔥 Journée validée ! » pendant le tri (1 fois/jour).
- **10 galons** (Recrue 25 → Légende vivante 10 000), écusson bronze/argent/or + chevrons.
- **14 badges** : ménage Go (Coup de balai 1 Go, Coup d'aspirateur 3, Grand ménage de
  printemps 5, Nickel chrome 10), Éclair, Cœur d'or (50 ❤️), Premier album, Galerie nette,
  Étincelle / Flamme / Volcan (3/7/30 j d'affilée), Habitué / Assidu / Fidèle (10/30/100 j validés).
- Déblocages : bandeau badge (pas de blocage du swipe) ; fenêtre « Nouveau galon »
  seulement sur Bilan / accueil. 1re vérification de l'install = silencieuse.
- Onboarding : slide 🔥 « Fais grimper ta série » (entre Rappels et Album).
- Préférences d'Augustin : il valide les maquettes (HTML) avant chaque UI, et
  **on ne change pas ses textes sans son accord**.

---

## 12. Session 30 oct. 2026 (branche `feature/themes`) — thème « sauge »

**Maquettes validées** (dans `Claude outputs/`, hors Git) : `maquette-accueil-sauge-v2.html`
(accueil complet, feuilles Par date / Dossiers, bouton 🔀, pastille session),
`maquette-progression-sauge.html`. Palette : fonds blanc cassé chaud, vert forêt `#4c7a2b`
(Tri), terracotta `#b8653f` (Album), nuances sauge `#dfe8d2 / #c9d9b4 / #a9c48b`.

**Fait (commits dans l'ordre)** : palette sauge + ardoise gardée → couleurs en dur rebranchées
(hors Accueil) → Outfit + react-native-svg → `AppText` partout → `Icons` → `shuffleOn` dans
le store → accueil refait (en-tête, héros Tri, Trier autrement, Au quotidien, mode Album) + nettoyage.

**Accueil — décisions d'Augustin**
- En-tête : logo dessiné + « Pellicule » à **gauche**, pastille « Mode Tri / Mode Album » à droite
  (touchable). Sous-titre « Tes souvenirs méritent mieux » supprimé. ⚙️ = onglet Réglages.
- Héros Tri, **sur une ligne** : « Ta galerie sera triée dans ≈ X jours » (futur, demandé par Augustin) ;
  « à raison d'une session de [30 ▾] photos par jour » → la pastille ouvre 10/20/30/40/50
  (même réglage `randomCount` que Réglages, défaut **30**). Pas de phrase d'aide sous le choix.
- **Corbeille** : petite pastille blanche sous le pourcentage (« 🗑 12 dans la corbeille · 340 Mo [Vider] »),
  **seulement si la corbeille contient des photos**. Section « Au quotidien » supprimée.
- **Rappel** : déplacé dans l'onglet **Progression** (carte sous l'objectif du jour).
- **Barre de menu en bas** (option « bouton de mode au centre ») : le mode Tri/Album est dans le store
  (`homeMode`, non persisté) pour que le bouton central puisse le changer. Barre agrandie à la demande.
- Bouton principal : « Lancer un tri » (+ nombre de photos dessous).
- **Bouton 🔀 façon Spotify** à gauche du bouton : éteint = gris ; allumé = vert (pas de point,
  pas de bandeau) et le bouton devient « Lancer un tri aléatoire · N photos au hasard ».
  État `shuffleOn` persisté. Pas de ligne « Aléatoire » dans la liste (trop lourd).
- Mode Tri : **plus de pastilles de filtres**. Dates → « Par date » (calendrier + raccourcis
  7 derniers jours / Mois dernier / année en cours). Screenshots + dossiers → « Dossiers »
  (sous-titre « Screenshots et dossiers du téléphone »).
- Mode Album : filtres Toutes / 2026 / Dossier gardés, mosaïque 1+2, « + Nouvel album », menu ···.

**Autres écrans faits** : Progression (série en héros, semaine L→D avec ✓/🃏, galon restylé ;
**badges : couleurs gardées telles quelles**, demandé par Augustin), Swipe (icônes au trait, ❤️ plein
vert, halos aux couleurs du thème), Bilan + fenêtre « Nouveau galon ». Maquettes correspondantes dans
`Claude outputs/` (swipe, bilan, logo, barre-menu, accueil-compact, corbeille-discrete).

**31 oct.**
- **Galerie** (onglet, `screens/GalleryHomeScreen.js`) : une seule page, sans barre de choix —
  Coups de cœur en tête, albums (menu ··· renommer/imprimer/supprimer), « + Nouvel album »,
  « Sans album », « Imprimer tes albums · BIENTÔT », Corbeille (si non vide). Toucher une carte →
  `GalleryScreen` (pile, flèche retour). « Mes albums » retiré de l'accueil.
- **Accueil Album** : plus de pastilles de filtres ni de barre de filtres combinés ; les filtres actifs
  s'affichent dans leur ligne avec ✕ (Par date = 1 période à la fois, Par lieu, Dossiers « Dossiers du
  téléphone »). Haut : « 48 photos » + poids (Mo/Go) + **période couverte** (« du 3 juin au 28 août 2026 »,
  « en août 2026 », « le 14 juillet 2026 »). « Ton prochain album » retiré.
- **Accueil Tri** : sous la barre « 62 % · 1 240 / 2 000 photos triées » (plus de Go triés).
  **% stable après vidage de la corbeille** : `purgedCount` (store, persisté) compte les photos
  supprimées pour de bon ; ajouté au trié ET au total (aussi pour le badge « Galerie nette »).
- **Progression** en 3 sections : AUJOURD'HUI (série compacte, objectif, semaine, joker,
  « Rappel quotidien »), TES CHIFFRES (graphe), TES RÉCOMPENSES (galon + badges).
- **24 badges** (+10 : Centurion, Marathonien, Turbo 🚀, Collectionneur, Archiviste, Grand romantique,
  Sans pitié, Week-end studieux, Joueur (`shuffleLaunchCount`), Légende = tous les autres).
- Écrans outils repeints (Réglages, Rappels, Même instant, Carte, Choix du mode, Partenaires,
  Permission, tuto), Onboarding (tuiles illustrées, textes mis à jour : onglet Galerie / Progression /
  bouton central).
- **Icônes de l'app** régénérées depuis le logo B (`assets/icon.png`, `adaptive-icon.png`,
  `splash-icon.png`) ; `app.json` : fond splash `#f4f3ef`, fond icône Android `#dfe8d2`,
  couleur des notifications `#4c7a2b`. Planche d'icônes retirée de Réglages.


**2 nov.** — Galerie (`GalleryHomeScreen`) : « Mes albums » en grille de 3 (vignettes carrées, ＋ dans le titre),
« Mes livres photo » toujours affichée (＋ → `AlbumPickerSheet`), « Mes tirages photos » = Coups de cœur
(« N photos à imprimer », impression à brancher plus tard). Ligne « Imprimer tes albums » supprimée.
Bug corrigé : Coups de cœur vides → `GalleryScreen` ne garde que les photos encore présentes dans la photothèque.

---

## 13. Session 6 nov. 2026 (branche `feature/comptes`) — comptes + livre photo 21×28

**Git** : `feature/progression`, `feature/themes`, `feature/livre-photo` fusionnées dans `main` (fast-forward,
d49d903), poussée par Augustin. `feature/comptes` créée depuis `main`.

**Comptes (Supabase)** — maquette validée : `maquette-compte-connexion.html` (hors Git).
- Compte **facultatif**, accessible dans **Réglages** (aucun écran bloquant au lancement).
- `AuthScreen` : onglets Connexion / Créer un compte ; création → écran « Regarde ta boîte mail » →
  « J'ai confirmé, continuer ». « Se déconnecter » (confirmation) et « Supprimer mon compte » (fonction SQL).
- **Sauvegarde de la progression** (`progressSync.js`) : à la connexion, fusion téléphone + compte (max par
  jour pour `dailyLog`, union des badges avec la date la plus ancienne, plus grand `lifetimeSorted`,
  meilleur chrono) ; envoi différé 5 s + au passage en arrière-plan (`flushProgress`). Un autre compte sur le
  même téléphone ne récupère pas la progression locale du premier (`pellicule.sync.lastUserId`).
- Testé par Augustin : création, déconnexion / reconnexion, ligne dans la table `progress`.

**Livre photo — décisions d'Augustin** (maquettes `maquette-livre-verification.html`,
`maquette-livre-format-21x28.html`, validées)
- **Un seul format papier : 21×28 cm**, au choix **vertical ou horizontal** pour tout le livre
  (`book.orientation`, `pageRatio`). Nombre de pages **30 → 200, de 2 en 2** : compteur − / + ou saisie
  (remplace les boutons 24/32/48/64). Mises en page 1→4 photos ; **en horizontal, 2 photos côte à côte**
  (`layoutRows`) ; titre « Milieu » seulement s'il y a ≥ 2 lignes de photos.
- **« Imprimer ce livre »** ouvre `BookCheckScreen` : couverture, pages vides, photos de faible qualité
  (taille vs cadre à 150 dpi), nombre de pages accepté (≥ 30, pair), photos de l'album non placées.
  Alertes **non bloquantes**. Vue « Et maintenant ? » : PDF d'essai et Commander = **BIENTÔT**.
- Aucun prix affiché pour l'instant (à calculer : coût Gelato + livraison + TVA + marge).

**Suite du livre photo (6-7 nov.)** — maquettes validées : `maquette-livre-pdf-essai.html`,
`maquette-livre-couverture-styles.html` (hors Git).
- **Couverture** : 6 styles (Pleine page · Photo centrée · Polaroïd · Bandeau · Cadre fin · Titre seul) et **26 couleurs
  de fond** (`cover.style`, `cover.bg`) ; le fond sert aussi au dos et à la 4ᵉ de couverture. Le titre est en
  couleur **« auto »** (clair sur fond foncé, foncé sur fond clair, blanc sur la photo) dès qu'on change de style ;
  « Position » seulement pour Pleine page / Cadre fin. **Photo de couverture recadrable** (`cover.crop`, comme les
  pages : zoom, déplacer, pivoter, redresser, recentrer). Livres existants = Pleine page, fond crème.
- **UI compacte** (demandée par Augustin pour gagner de la place) : style, couleur de fond = une ligne (vignette +
  nom + « Changer ▾ ») qui **déplie** la liste ; format + pages sur **une ligne** (pastilles vertical / horizontal,
  « 21 × 28 cm », − 30 +, maintenir − / + pour défiler de 2 en 2, toucher le chiffre pour saisir).
- **Glisser pour tourner les pages** dans l'aperçu et dans l'éditeur de page (désactivé pendant un recadrage).
- **Couverture à plat** (4ᵉ + dos + face) : dimensions demandées à Gelato (`gelato-cover`) selon le nombre de pages
  (30 p. → 478×326 mm, dos 6 mm). Aperçu en bas de la section Couverture ; dos = fond + titre à la verticale.
- **PDF d'essai** (dev seulement) : chaque page dessinée hors écran à 150 dpi, fond perdu 4 mm → capture JPEG →
  PDF avec boîtes de rognage. Photos prises depuis les fichiers originaux. **Augustin confirme que le PDF respecte
  les specs Gelato.**
- **Décision d'Augustin (7 nov.) : la suite (prix → commande → paiement) est mise en standby** ; voir §8.

**Abonnement mensuel Coups de cœur — maquette validée par Augustin** (`maquette-abonnement-coups-de-coeur.html`,
hors Git, 11 écrans). Entrée = carte « Abonnement » dans la Galerie, section « Mes tirages photos ».
- Chaque mois (le 1er) : tirage au hasard de **10 coups de cœur** → notification → grille de validation
  (↻ par photo : au hasard / choisir / retirer ; « Tout retirer au sort ») → **validation obligatoire** → suivi
  (validée, impression, expédiée, livrée).
- **Abonnement pour un proche** : même mode de sélection, prénom + adresse + petit mot, **x photos** (5/10/15/20) ;
  le proche n'a pas de compte. Plusieurs abonnements possibles, pause / résiliation, historique.
- Choix par défaut posés par Claude, **à confirmer** : format 10×15 cm ; pas validé à temps = rien ne part, mois non
  facturé ; une photo envoyée ne repart jamais ; moins de 10 ❤️ dispo = écran « Il te manque N coups de cœur ».
- **Prix décidé (6 nov.)** : **7,99 € / mois par abonnement, livraison incluse** (10 tirages). Total affiché si
  2 abonnements : 15,98 €. **Grille (7 nov.)** : 5 photos 4,99 € · 10 : 7,99 € · 15 : 10,99 € · 20 : 13,99 €
  (+3 € par tranche de 5 dès 10 ; modifiable dans `constants/subscription.js`). **À vérifier** : marge réelle
  (coût d'impression + port Gelato + TVA). **À vérifier** aussi : un envoi d'objets réels n'a pas à passer
  par l'achat intégré Apple (RevenueCat) → paiement carte possible. Texte du tuto « aucune photo sur un serveur »
  à changer (dette n°9). L'abonnement exige un compte connecté.
- **Fournisseur de tirages** : pas de lien API pour l'instant, Augustin imprimera **à la main au début**
  (donc plus besoin de Gelato pour les tirages ; la marge reste à vérifier avec le futur fournisseur).
- **Code — ordre de développement** (une étape à la fois, validée par Augustin) :
  1. ✅ codée, **à tester** : carte « Abonnement » (`GalleryHomeScreen`) + `SubscriptionIntroScreen` (écran 2)
     + `constants/subscription.js` (prix 7,99 €, 10 photos, format, jours) + icône `mail`. Le bouton
     « Démarrer l'abonnement » affiche encore « Bientôt disponible ».
  2. ✅ codée, **à tester** : `SubscriptionSetupScreen` (écrans 3-4, onglets Pour moi / Pour un proche) +
     `store/useSubscriptionStore.js` (persisté ; `subs[]`). Exige d'être connecté (sinon renvoi vers `Auth`).
     « S'abonner » enregistre **sans paiement** ; adresse avec **recherche en tapant** (`components/AddressInput.js` +
     `services/addressSearch.js`, API publique Géoplateforme/BAN, France, sans clé ; introuvable → saisie manuelle
     gardée) + « Nom sur l'enveloppe » + complément facultatif (`sub.recipient`, `sub.address` 2ᵉ ligne) ; prix par nombre de
     photos dans `SUB_PRICE_BY_COUNT` (un nombre sans prix = bouton grisé).
  3. ✅ codée, **à tester** : `SubscriptionMonthScreen` (écrans 6-7-8 + 11 « Il te manque N coups de cœur ») ;
     logique pure dans `services/printSelection.js` (tirage, ↻ au hasard, remise d'aplomb, photos déjà validées
     exclues ; testée à part) ; store : `selections[subId]["2026-11"] = {photoIds, size, status draft|validated}`.
     Tirage créé à la 1re ouverture du mois (pas encore le 1er automatique). Valider = figé **sur le téléphone**
     (rien envoyé). La carte « Abonnement » de la Galerie ouvre cet écran si on a un abonnement, sinon la
     présentation (provisoire : l'étape 4 la fera ouvrir « Mes abonnements »). Bandeau 💡 de l'écran 11 retiré
     (règle « moins de N photos → on envoie ce qu'on a ou on saute » pas décidée : bloqué si moins de N).
  4. ✅ codée, **à tester** : `SubscriptionListScreen` (écran 10 « Mes abonnements » : cartes, total, pause,
     résiliation = statut `cancelled`, historique gardé), `SubscriptionTrackingScreen` (écran 9, ouvert après
     « Valider »), `SubscriptionHistoryScreen`. La carte Galerie ouvre « Mes abonnements » (ou la présentation
     si aucun abonnement). Étapes de suivi dans `services/printSelection.js` (`STAGES`, `selection.stage`,
     absent = « validée ») : **personne ne les fait avancer pour l'instant** (viendra du serveur / d'Augustin).
     « Livrée : autour du… » = validation + 7 jours (estimation).
  5. ✅ codée, **à tester sur vrai téléphone/simulateur** : `services/subscriptionNotifications.js` — notification
     locale « Ta sélection de <mois> est prête » le **1er à 9 h** (une par abonnement actif ; `Sélection pour
     <prénom>` pour un proche). Seul le **prochain** 1er est programmé, reprogrammé au lancement, en arrière-plan et à
     chaque changement d'abonnement ; plafond 4 (iOS = 64 notifs, ~60 prises par les rappels de tri). Tap → écran
     « Sélection du mois » de l'abonnement (`App.js`, `data.action = "subscription_month"`). La permission est
     demandée à l'abonnement. `notificationService` n'annule plus que les rappels de tri (avant : tout).
     **Dates au choix (7 nov.)** : par abonnement, `selectionDay` (jour de réception = notif à 9 h, 1 par défaut) et
     `sendDay` (jour d'envoi à l'impression = dernier jour pour valider, 25 par défaut, toujours après), 1 → 28 ;
     choisies au réglage et modifiables dans « Mes abonnements » (`components/SubDaysFields.js`, `subDays(sub)` donne
     les défauts). **Bouton « Tester la notification (mode dev) »** dans « Mes abonnements » (`__DEV__` seulement :
     notif dans 5 s). Le tirage n'attend pas `selectionDay` (ouvrable avant).
     **Pas gérés** : abonnement avec « Je valide chaque envoi » désactivé (aucune notif, aucun envoi auto),
     rappel avant le 25 si non validé. Le tirage reste créé à la 1re ouverture (pas à 9 h le 1er).
  6. ✅ codée, **à tester après avoir lancé le SQL** : « Valider et envoyer » (`SubscriptionMonthScreen`) demande l'accord
     (« seront envoyées à Pellicule pour être imprimées »), envoie les photos originales (`services/printOrders.js`,
     `submitSelection`) dans le dossier privé `print-photos/<compte>/<abonnement>/<mois>/` puis écrit une ligne dans
     la table `print_orders` ; **la sélection n'est figée que si tout est parti** (sinon elle reste modifiable +
     message). `syncOrderStatuses()` relit `status` (validated / printing / shipped / delivered) à l'ouverture de
     « Mes abonnements », du suivi et de l'historique → le suivi de l'app avance quand Augustin change `status`
     dans Supabase. **SQL à coller une fois** dans Supabase → SQL Editor : `supabase/sql/print_orders.sql`
     (table + dossier + sécurité RLS). Impression à la main : Table Editor → `print_orders` (adresse, nom, petit
     mot, chemins) + Storage → `print-photos`. Photos envoyées **telles quelles** (HEIC possible sur iPhone, pas de
     réduction : aucun module natif ajouté, pas de rebuild).
     **Pas fait** : **paiement** (aujourd'hui une validation = tirages gratuits), suppression des fichiers après
     impression, suppression des fichiers à la suppression du compte (`delete_my_account` ne vide pas le dossier),
     envoi automatique si « Je valide chaque envoi » est désactivé. **Texte du tuto à changer** (dette n°9) : il dit
     encore « Pellicule n'envoie aucune photo sur un serveur » → faux dès maintenant ; proposition à valider avec
     Augustin avant de modifier (Réglages → tuto, Onboarding).
  **Décisions d'Augustin (7 nov.)** : texte du tuto **gardé tel quel** (aujourd'hui inexact pour l'abonnement ;
  si besoin le préciser « pour le tri ») ; **information données personnelles** ajoutée au réglage de l'abonnement
  (bloc « Tes données » : photos + nom + adresse envoyés à l'imprimeur, supprimés après impression ; pour un proche :
  accord de la personne) — **à compléter avant la mise en ligne** : politique de confidentialité + adresse de contact
  pour demander la suppression (pas encore de page ni de contact) ; **paiement en standby** ; **nettoyage** :
  Augustin supprime lui-même les photos dans Supabase → Storage (`print-photos`) après impression (supprimer par le
  Storage, pas par SQL : le SQL ne retire pas le fichier).
  **Magnets : RELANCÉ (7 nov.), version « je fabrique moi-même », ✅ codé, à tester** — type d'envoi au choix à
  l'abonnement : **tirages photo** (10 × 15 cm, 5/10/15/20, 4,99 → 13,99 €) ou **magnets** (**9 magnets carrés de
  5 × 5 cm, 9,90 € / mois**, livraison comprise ; pour moi ou pour un proche). `constants/subscription.js` :
  `SUB_PRODUCTS` (libellés + `spec` = taille finale en mm / recadrage centré / disposition 3×3, à adapter selon le
  futur partenaire), `SUB_PRICES` par produit, `productOf(sub)` (anciens abonnements = tirages). `sub.product` ;
  choix par cartes dans `SubscriptionSetupScreen` ; la sélection du mois affiche 9 photos en grille 3×3 + note
  « recadrées au centre » ; la commande (`print_orders`) a deux colonnes en plus, `product` et `spec` (**relancer
  `supabase/sql/print_orders.sql`** : il ajoute les colonnes sans rien casser). Partenaire d'impression
  **pas choisi** (Augustin, Gelato, Prodigi…) : l'app envoie déjà tout ce qu'il faut.
  **Hypothèses à challenger (analyse Gemini d'Augustin, non vérifiée)** : coûts matière (feuille aimantée A4 à
  0,40 €, papier, encre) et port (lettre suivie ~2,10 €) à confirmer par devis ; marge calculée sur le prix **TTC**
  (9,90 € TTC = 8,25 € HT) ; **temps de fabrication ignoré** (3-5 min par commande → ~30 h/mois pour 500 abonnés,
  pas « quelques heures ») ; 9 magnets 5 × 5 n'occupent que 45 % d'une A4 (20 par feuille) → 2 commandes par feuille ;
  finition (collage papier/aimant sans protection, découpe nette 5 × 5 à coins arrondis) ; prix Cheerz à re-vérifier
  (12,90 € + port selon Gemini, 16,90 € le coffret Smartbox d'après notre recherche) ; Prodigi `M-MAG-FRI-3X2`
  (magnet 7,6 × 5,1 cm) mesuré à **2,40 € pièce + 7,73 € de port** depuis le Royaume-Uni → pas compétitif à 9,90 €.
  **Maquette « magnets mis en avant » VALIDÉE (7 nov.), ✅ codée, à tester** : `maquette-abonnement-magnets.html`
  (hors Git). `components/ProductArt.js` (`MagnetTile`, `MagnetGrid`, `MagnetCluster`, `PrintTile`,
  `useKeptUrls` = les vrais coups de cœur, aplats sauge à défaut) remplace les émojis ; `SubscriptionIntroScreen`
  refait (visuel de magnets éparpillés, deux offres, magnets en grand + NOUVEAU, présélectionnés, « Voir le détail ›»
  quand la carte magnets est déjà sélectionnée) ; nouvel écran `SubscriptionMagnetsScreen` (détail : grille 3×3,
  3 atouts, prix, « Plutôt des tirages photo ? ») ; `SubscriptionSetupScreen` : choix avec vignettes, magnets
  présélectionnés (`route.params.product`). Photos Cheerz fournies = inspiration seulement (non reprises) ; pastille
  NOUVEAU à retirer après le lancement (à faire).
  Anciennes notes de l'analyse Prodigi : option « photo standard » ou « magnets » par abonnement. Prodigi `M-MAG-FRI-3X2`
  = magnet 7,6 × 5,1 cm, **2,40 € pièce + 7,73 € de port pour 1** (Royal Mail Airmail non suivi, **depuis le
  Royaume-Uni**, TVA/douane France à vérifier) → trop cher à l'unité pour 7,99 €. Existe aussi `M-MAG-FRI-4X6`
  (15,2 × 10,2 cm). Format carré « 6 × 6 » voulu pour concurrencer Cheerz (9 magnets) : SKU **non trouvé**, à copier
  depuis le catalogue Prodigi. `supabase/functions/prodigi-price` : option `&copies=N` ajoutée **en local, pas
  déployée** (à faire : `npx supabase functions deploy prodigi-price --no-verify-jwt`).
  · 7. Paiement (standby ; carte via Stripe ? pas l'achat intégré Apple pour des objets réels, à vérifier).

**Carte « Tri par lieu » (`MapScreen`, 7 nov.) — ✅ codé, à tester** : par défaut (aucun lieu touché) la sélection est
**automatique = les lieux visibles sur la carte**, qui suit le déplacement et le zoom (la carte Leaflet dans la
WebView envoie `{visible:[clés]}` à chaque `moveend`, 250 ms après l'arrêt). Toucher des lieux = sélection manuelle
(prioritaire) ; « Tout désélectionner » revient à l'automatique. Bouton « Trier ces N photos » (grisé si 0 dans la zone) ;
« Ajouter comme filtre » (mode Album) garde la sélection automatique (« N lieux visibles », id court par hachage).
La vue initiale est inchangée (centrée sur le 1er lieu, zoom 6) donc la sélection de départ est la zone autour de lui.

**Galerie — abonnements en cours (8 nov.) : maquette VALIDÉE, ✅ codée, à tester** :
`maquette-galerie-abonnements.html` (hors Git). `GalleryHomeScreen` : avec au moins un abonnement non résilié, la carte
« Abonnement » est remplacée par la section **« Mes abonnements »** (`components/SubscriptionRow.js` : vignette
magnets/tirages avec les vrais coups de cœur, « Magnets · pour moi » / « Tirages · <prénom> », prix, pastille d'état,
« ··· »), « Gérer › » (→ `SubscriptionList`) et « + Ajouter un abonnement » (→ présentation). État calculé par
`subStatus()` (`services/printSelection.js`) : `paused` « En pause », `validated` « ✓ Validée · en préparation » /
« ✓ En impression »…, `soon` « Prochaine sélection le <jour> » (avant le jour de réception choisi), `todo` « À valider
avant le <jour d'envoi> ». Toucher une ligne : sélection du mois, suivi si validée, liste si en pause. Menu « ··· » :
voir la sélection / le suivi, changer les dates (ouvre `SubscriptionList` avec `route.params.editDaysFor`),
pause / reprendre, résilier (confirmation). **Point orange sur l'onglet Galerie** (`TabBar`,
`hooks/useSubscriptionTodo.js`) tant qu'un abonnement actif est « à valider ». Sans abonnement : carte inchangée.

**Sélection du mois — photo en grand (8 nov.) : ✅ codé, à tester** (`SubscriptionMonthScreen`) : toucher une photo de la grille
l'ouvre en grand (calque dans l'écran, pas un `Modal`, pour que la feuille « Remplacer cette photo » s'ouvre par-dessus).
Magnets : aperçu **carré recadré au centre** (« Aperçu du magnet 5 × 5 cm ») ; tirages : photo entière. Boutons :
« Changer cette photo » (ouvre la feuille : une autre au hasard / choisir moi-même / retirer ; la grande vue montre ensuite la
nouvelle photo) et « Retour à la grille » (aussi ✕ et bouton retour Android). Sélection validée : seulement « Retour à la grille ».
Pas de défilement gauche/droite entre photos (idée possible).

**Corbeille déplacée + badges en liste (8 nov.) : ✅ codé, à tester** (demande d'Augustin).
- **Galerie** : la ligne « Corbeille » est supprimée de `GalleryHomeScreen`.
- **Accueil, mode Tri** : la pastille corbeille/« Vider » est retirée de `TriHero` ; elle est maintenant en **pied de la carte
  « Cette semaine »** (`ProgressCard`, props `trashCount`, `trashSizeLabel`, `onOpenTrash`, `onEmptyTrash`, `emptying`),
  seulement s'il y a des photos supprimées : « N dans la corbeille · X Mo » (toucher = voir la corbeille, `Gallery` section
  `deleted`, pour restaurer) + bouton « Vider » (même confirmation qu'avant, `handleEmptyTrash` dans `HomeScreen`).
- **Badges** (`components/BadgesGrid.js`, écran Progression) : **un badge par ligne** au lieu de la grille de briques —
  ligne 1 : emoji · nom · (✓ + date si gagné, sinon avancement) ; ligne 2 : l'explication pour l'obtenir (`desc`) ; mini-barre
  d'avancement pour ceux à gagner. Ordre inchangé.

**Carte « Cette semaine » : rappel à la place du chrono (8 nov.) : ✅ codé, à tester** (`ProgressCard`) : la ligne « ⏱ 20 photos
en ≈ … » est supprimée de la carte (le chrono reste dans l'écran Progression). À la place : « 🔔 Rappel activé · chaque jour à
9h00 » (ou « 9h00 · 21h00 » en 2 rappels / « tous les 2 jours » / « chaque semaine à … »), ou « Rappel désactivé · Activer ».
**Toucher cette ligne** : quotidien / hebdo / rappel coupé → feuille de choix d'heure sur l'accueil
(`components/TimePickerSheet.js`, molettes heures/minutes) ; 2 rappels ou « tous les 2 jours » → écran Rappels. Valider appelle
`updateReminderTime(h, m)` (`hooks/useNotificationReminder.js`) : reprogramme le rappel, enregistre l'heure et, si les rappels étaient
coupés, active le rappel quotidien à cette heure (la permission est demandée à ce moment-là).

**Corrections et gestion par abonnement (8 nov.) : ✅ codé, à tester** (retours d'Augustin).
- **Bouton 🔀 aléatoire — carré gris derrière après 2-3 appuis** : cause probable = ombre Android qui apparaît/disparaît + bouton
  `TouchableOpacity` (fondu d'opacité). `TriHero` : `Pressable`, ombre **toujours** présente, fonds opaques, bordure toujours là
  (invisible éteint). Si le carré revient : même piège que la dette n°7 (ombre sur fond non opaque).
- **« Envoi impossible, vérifie ta connexion » n'était PAS un problème de connexion** : sondage Supabase du 8 nov. → la table
  `print_orders` existe mais la colonne `product` **n'existait pas** (le SQL n'avait pas été relancé après l'option magnets) →
  l'insertion était refusée. **À faire : relancer `supabase/sql/print_orders.sql`** (sans risque). Désormais les erreurs sont typées
  (`services/printOrders.js` : `kind` = `network` / `photo` / `server`) et l'alerte dit la vraie cause ; en mode dev elle affiche
  aussi le détail technique.
- **Bouton « Gérer »** dans l'en-tête de la sélection du mois (`SubscriptionMonthScreen`) → nouvelle page
  **`SubscriptionManageScreen`** (gestion d'UN abonnement) : résumé de l'abonnement, « Voir ma sélection » / « Voir le suivi »,
  « Historique des envois » (de cet abonnement : `SubscriptionHistory` accepte `route.params.subId`), « Changer les dates d'envoi »
  (feuille), « Mettre en pause » / « Reprendre », « Résilier » (confirmation, la page se ferme), bloc « Livraison » (lecture seule),
  « Tester la notification » (dev seulement).
- **« Mes abonnements » simplifié** (`SubscriptionListScreen`) : plus de boutons globaux ni de question « pour quel abonnement ? » ;
  **toucher une carte ouvre la gestion de cet abonnement** ; restent les lignes « + Offrir / M'abonner » et le total.
  Le menu « ··· » de la Galerie ouvre la gestion (dates ouvertes directement pour « Changer les dates »).

**Galerie « Pellicule » + « Chambre noire » (9 nov.) : ✅ codée (Augustin attendait le code ; réponses par défaut prises), à tester** :
`screens/GalleryHomeScreen.js` refait d'après `maquette-galerie-chambre-noire.html`. **1. PELLICULE** : « Mes albums » en **liste**
(`ListRow` : mosaïque 44 px, nom, « N photos · il y a … », menu « ··· » renommer / supprimer, ＋ dans le titre, petit mot « PELLICULE »
au-dessus du titre) puis « Sans album ». **2. CHAMBRE NOIRE** : bloc rouge sombre pleine largeur (dégradé + ampoule, teintes
`DARKROOM`), titre seul « Chambre noire », **toujours visible, rien à ouvrir** : **Coups de cœur** (guirlande `DarkroomCover` pleine
largeur + « N à imprimer · M imprimées ›», toucher = tous les coups de cœur), **Livres photo** (étagère de couvertures + « ＋ Nouveau »
et tuile « Créer un livre »), **Abonnements** (`SubscriptionRow`, « Gérer › », « + Ajouter un abonnement » / « Recevoir mes coups de
cœur chaque mois » si aucun). Remplace « Mes tirages photos », « Mes livres photo » et la carte « Abonnement ». Choix pris par défaut
(à confirmer) : mot « PELLICULE » gardé, abonnements dans la Chambre noire.

**Photos déjà imprimées + galon dans le Bilan (9 nov.) : ✅ codé, à tester** (demandes d'Augustin).
- **Marque « déjà imprimée » sur chaque photo** : `useSubscriptionStore.printedPhotos[photoId] = { at, subId, month, product }`, posée à
  la **validation** d'une sélection (`validateSelection`), persistée (AsyncStorage), conservée même si l'abonnement est retiré.
  `printedMapOf()` (`services/printSelection.js`) + hook `hooks/usePrintedPhotos.js` y ajoutent les photos des sélections déjà
  validées avant cette marque (rien à migrer). **Une photo imprimée n'est plus jamais proposée** : exclue du tirage, de « ↻ une autre
  au hasard » et de « Choisir moi-même » (`SubscriptionMonthScreen`), pour tous les abonnements. Elle **reste dans les coups de cœur** :
  pastille « 🖨 Imprimée » sur la vignette (`PhotoGrid` prop `badgeFor`, `GalleryScreen`), ligne « Déjà imprimée le 12 nov. (magnets) »
  dans la photo en grand, et la carte Galerie dit « N à imprimer · M imprimées ». Pas (encore) de moyen de réimprimer volontairement
  une photo déjà imprimée. Les marques vivent sur le téléphone (ids de photos propres à l'appareil, comme les coups de cœur).
- **Bilan** (`SummaryScreen`) : les blocs d'une même ligne ont la même hauteur ; le bloc « Mo libérés » affiche le **prochain galon**
  (écusson + nom, barre d'avancement, « encore N photos pour ce galon » ; « 🏆 Galon maximum atteint » au sommet), d'après `rankInfo(lifetimeSorted)`.

**Chambre noire — retouches (9 nov.) : ✅ codé, à tester** (`GalleryHomeScreen`, `DarkroomCover`) : la tuile pointillée « Créer un livre »
prend maintenant **la forme exacte d'une couverture** (`pageRatio` du 1er livre, sinon 21×28 vertical) ; **guirlande** : tirages plus
grands (34×42 au lieu de 26×32), photo plus grande (30×31), teinte rouge 12 % au lieu de 35 %, 3 à 4 tirages au lieu de 3 à 5, bloc
plus haut (150) ; le petit titre sous « Chambre noire » devient **« TIRAGES PHOTOS »** (la ligne dessous reste « Coups de cœur »).
**Maquette en attente de choix** : `maquette-chambre-noire-abonnements.html` (hors Git) — 4 pistes pour remplacer les briques d'abonnement
**blanches** (qui jurent sur fond rouge sombre) : A verre dépoli · **B bacs de développement (brun-rouge `DARKROOM.tray`, ma préférée)** ·
C papier crème · D étiquette sombre à liseré lumineux selon l'état. S'appliquerait à `SubscriptionRow` + la ligne « + Ajouter »
**dans la Chambre noire seulement** (la page « Gérer » garde les cartes claires). Rien de codé pour ce point.

**Briques d'abonnement de la Chambre noire : style B + D choisi par Augustin (9 nov.) — ✅ codé, à tester** : `SubscriptionRow` a une prop
`dark` (utilisée seulement dans la Chambre noire de `GalleryHomeScreen` ; la page « Gérer » garde les cartes claires). Brique brun-rouge
pleine (`DARKROOM.tray` + liseré `trayEdge`, comme les bacs de la guirlande) ; **liseré lumineux à gauche** selon l'état (rouge `todoGlow` =
à valider, vert `C.sage3` = validée, gris = pause / à venir) ; l'**action « À valider » en pastille rouge vive** (`todoBg`), les autres
états en simple texte coloré. Nouvelles couleurs dans `DARKROOM` : `trayEdge`, `todoBg`, `todoGlow`.
**Onglet Galerie** (`TabBar`) : le point orange est remplacé par une **pastille avec le nombre** de sélections à valider (« 9+ » au-delà),
d'après `useSubscriptionTodo()`.

**Mode swipe — date complète de la photo (9 nov.) : ✅ codé, à tester** (`SwipeScreen`, `services/photoDate.js`, `services/photoLibrary.js`) : sous le lieu,
l'en-tête affiche « 12 mars 2024 » (date de prise de vue) au lieu de l'année seule ; « **Reçue le** 12 mars 2024 » quand la photo n'a pas de date de
prise (WhatsApp, web, vieux transferts) et qu'on s'est rabattu sur la date de modification du fichier = date d'arrivée (`photo.dateIsReceived`,
posé à chaque chargement de la photothèque ; une photo déjà mémorisée avant ce changement n'a pas le repère → affichée comme date de prise
jusqu'au prochain chargement). Sans date exploitable : année seule. **La photo en grand de la Galerie (`GalleryScreen`) affiche aussi la date complète / « Reçue le … »** (le repère est relu dans la photothèque à jour).

**Mode swipe — barre de suivi en bas (9 nov.) : ✅ codé, à tester** (`SwipeScreen`) : une barre **discrète** (3 px, fond blanc 14 %, remplissage sauge / terracotta à 75 %) sous les boutons d'action, à 18 px du bas (avancement `pct`).
**La fine barre du haut a été retirée (8 nov., demande d'Augustin) : il ne reste que celle du bas.**

**Abonnements sur Supabase — table `subscriptions` (9 nov.) : ✅ codé, à tester APRÈS avoir lancé `supabase/sql/subscriptions.sql`** (question d'Augustin :
« que se passe-t-il dans Supabase quand l'user s'abonne / met en pause ? » → avant : RIEN, tout restait sur le téléphone ; seule la validation d'une sélection
écrivait `print_orders` + photos). Maintenant `services/subscriptionSync.js` (`startSubscriptionSync()` dans `App.js`, `flushSubscriptions()` au passage en
arrière-plan) : **envoi** différé 3 s à chaque changement d'abonnement (créer, pause, reprise, résiliation, dates, adresse) vers `subscriptions` (1 ligne par
abonnement : produit, nombre, adresse, dates, `status` active / paused / cancelled, `validate_each`…), seulement les abonnements du compte connecté ;
**récupération** à la connexion / au lancement : abonnements du compte absents du téléphone remis (nouveau téléphone) + historique des envois depuis
`print_orders` (sélections « validées » restaurées **sans photos** : `photoCount`, `restored: true` — pour ne pas revalider un mois déjà envoyé) ;
en cas de doublon **le téléphone gagne**. Augustin voit ses abonnés dans Table Editor → `subscriptions`. Fonctions pures testées : `toRow`, `fromRow`,
`mergeRemoteSubs`, `restoreSelections`. **Limites** : les marques « déjà imprimée » restent propres au téléphone (ids de photos) ; le store des abonnements
n'est pas filtré par compte (un 2ᵉ compte sur le même téléphone verrait les abonnements du 1er) ; pas de paiement.

**SQL Supabase — où sont les sources (9 nov.)** : dans le dépôt, `supabase/sql/` : `print_orders.sql` (commandes + dossier `print-photos`),
`subscriptions.sql` (abonnements), `compte_et_progression.sql` (**copie de secours reconstituée** de `progress` + `delete_my_account`, créées le 6 nov.
sans fichier : à lancer seulement si perdues). Les « requêtes sauvegardées » du SQL Editor de Supabase ne sont que des brouillons : ce qui compte, c'est que
le SQL a été **exécuté** (tables et fonctions restent). Vérifié par l'API le 9 nov. : tables `progress`, `print_orders` (avec `product`, `spec`) et
`subscriptions` présentes. **Non vérifiables de l'extérieur** : le dossier `print-photos` (Storage) et la fonction `delete_my_account` (Database → Functions).

---

## 14. Session 8 nov. 2026 (branche `feature/photos-floues`) — « Photos floues » en mode Tri

**Git** : `feature/comptes` fusionnée dans `main` (fast-forward), `feature/photos-floues` créée depuis `main`.
Maquette validée : `Claude outputs/maquette-recherche-flou.html`, partie 2 (la partie 1, recherche en mode Album, n'est **pas** codée).

**Ce que fait la fonction**
- Un module natif mesure la netteté (variance du Laplacien, miniature 512 px, gris) ; une file l'applique à toute la photothèque en
  arrière-plan, app ouverte, et garde les résultats dans un fichier (clé = id + date de modification + version de formule `BLUR_ALGO_VERSION`).
  **Exclus** : vidéos (jamais chargées), screenshots (`isScreenshot`), photos en corbeille, photos déjà décidées « à garder »
  (❤️, conservées, album) et photos confirmées gardées depuis l'écran Photos floues (`blurKeptIds`).
- Accueil, mode Tri, sous « Même instant » : ligne « Photos floues » / « Repérées automatiquement », pastille rouge pâle avec le nombre ;
  visible seulement s'il y en a ou pendant l'analyse (sous-titre « analyse en cours (32 %) » — mis en sous-titre car la phrase complète
  de la maquette était trop longue pour une ligne). Pas de pastille « NOUVEAU » (c'était une annotation de la maquette).
- Écran « Photos floues » : en-tête (total + poids, « Tout décocher / Tout cocher »), « Dont N photos [WhatsApp] », grille 3 colonnes toute
  cochée, coche = garder, photo = grand format (sans pincer pour zoomer), pastille verte WhatsApp, aide en bas, deux boutons sur les photos **cochées** :
  1. « Mettre N photos à la corbeille » → feuille de confirmation (maquette C) → `addDeletedMany` (corbeille de Pellicule, restaurable) +
     `addBlurKept` pour les décochées → retour à l'accueil ;
  2. « Trier les N photos cochées (swipe) » (texte de la maquette, corrigé le 8 nov.) → **`Swipe` directement** (`{ queue, mode: "menage" }`), sans passer par l'accueil (décision d'Augustin ;
     l'autre option était un filtre sur l'accueil comme « Par date »). Texte repris de la maquette (la consigne écrite disait
     « Trier les 212 photos cochées (swipe) »).
- **Décision validée par Augustin (8 nov.)** : la corbeille **en lot ne compte pas** dans la progression (`dailyLog`, `lifetimeSorted`, série 🔥, chrono) —
  sinon un seul appui validerait la journée. Les suppressions par swipe comptent comme avant.
- Textes nouveaux (non présents dans la maquette, à valider) : « Aucune photo floue pour l'instant. » / « Analyse en cours (x %)… » (liste vide) ;
  accords au singulier de la feuille de confirmation.

**Seuils** (`constants/blurConfig.js`) : normal = 100 (valeur de départ, pas calibré) ; **WhatsApp = 150** (réglé par Augustin avec l'écran de
calibrage). Attention : plus HAUT que le normal, contrairement à l'hypothèse de départ (« WhatsApp plus tolérant ») : sur ses photos, c'est
l'inverse qui marchait. Score bas = flou ; une photo est floue si son score est SOUS le seuil.

**Mesures réelles** (Android d'Augustin) : ≈ 43 ms par photo ; WhatsApp = 5 142 photos par nom, 5 130 par dossier (« WhatsApp Images » 5 129 + « WhatsApp » 1),
8 suspectes non détectées ; au départ 19 photos floues dont 15 WhatsApp (seuils 100 / 50).

**Outils `__DEV__`** (carte en bas des Réglages, `components/dev/SharpnessDevTest.js`) : mesure 8 photos au hasard (score + temps), avancement de
l'analyse, nombre de photos floues, diagnostic WhatsApp, « Relancer », « Tout effacer et recalculer », accès à l'écran de calibrage
(`BlurCalibrationScreen` : onglets Normales / WhatsApp, seuil −10/−50/+10/+50, répartition par tranches, grille triée, bord rouge = signalée, grand
format avec score exact, ligne « À mettre dans constants/blurConfig.js »). Les seuils réglés dans l'écran ne changent rien ailleurs.

**Essai annulé (8 nov.)** : renvoyer 4 mesures du module natif (laplacien global, zone la plus nette, rapports fin/moyen et moyen/gros) pour mieux
classer les photos à scène atypique. Annulé à la demande d'Augustin (**pas de rebuild** voulu) : tout est revenu au dernier commit, sauf le seuil
WhatsApp. Reprendre = rebuild iOS + Android + `BLUR_ALGO_VERSION = 2`.

**Tuto d'onboarding refait (8 nov.) — ✅ codé, à tester** (maquette validée : `Claude outputs/maquette-tuto-onboarding.html`).
8 pages : bienvenue · un geste par photo (+ partage à un proche d'un swipe, réglable) · rappels (+ série 🔥, « Plus tard ») · bouton central ⇄
(créer ses albums → livre photo) · le ❤️ → Chambre noire · la Chambre noire (pastilles « bientôt » sur les tirages et la commande des livres :
**à retirer au fur et à mesure**) · compte facultatif (3 puces : suivre sa progression, imprimer, s'abonner ; « Créer mon compte » / « Plus tard ») ·
autorisations (photos, notifications) + phrase de confidentialité. Une phrase par ligne. Pages = `constants/tutorialSlides.js` ;
visuels dessinés dans `components/TutorialSlide.js` (barre du bas, guirlande de la Chambre noire) ; icône `user` ajoutée à `Icons`.
Réglages → « Tutoriel » utilise les mêmes pages (contenu seul, sans boutons d'action). Titre de la page 4 gardé : « Deux modes, un seul bouton »
(proposition « Crée tes albums » non tranchée). Apple / Google : à ajouter sur la page compte quand ces connexions existeront.

**Autres changements de la session** : bilan de tri (`SummaryScreen`) → bouton « Vider » sur la brique « Supprimées » ; mode Album de l'accueil →
brique « Créer un livre photo » retirée (les livres se créent depuis la Galerie, Chambre noire).

**Rebuild** : module natif ajouté (étape 1) → `npx expo prebuild --platform ios --clean` puis `npx expo run:ios` ; Android = build EAS `development`.
Rien d'autre n'a demandé de rebuild depuis.

**À tester / pas vérifié**
- Étape 6 entière : feuille de confirmation, corbeille en lot (photos restaurables dans la corbeille), mémoire des photos gardées après
  fermeture de l'app, swipe direct puis retour sur la grille, série 🔥 inchangée après un lot.
- Kotlin du module : compile et tourne (test Android d'Augustin OK) ; Swift idem (test iOS OK).
- Détection WhatsApp sur iOS (dette n°17) ; seuil normal (dette n°16) ; bouton « Vider » du bilan ; retrait de la brique livre du mode Album.
- Dettes ouvertes : n°15 à 19 (§7).


---

## 15. Session 8 nov. 2026 (suite) — reprendre un tri Album

**✅ codé, à tester** (demande d'Augustin : commencer un album avec des filtres, quitter en plein swipe, reprendre plus tard).
- `usePhotoStore` : `albumSession = { albumId, photoIds, idx, updatedAt }` (persisté ; ids seulement, la photothèque est rechargée à chaque
  ouverture) + `startAlbumSession`, `setAlbumSessionIdx(albumId, idx)`, `clearAlbumSession`. `deleteAlbum` et `reset` l'effacent. **Un seul tri en cours** :
  lancer un autre tri Album remplace le précédent (les photos déjà ajoutées à l'album restent).
- `SwipeScreen` (mode album) : note la file à l'entrée, la position à chaque photo (`idx`), accepte `route.params.startIdx` ; efface à la
  dernière photo seulement. Quitter par « ← Retour », par l'icône sortie (« Fin de tri » → bilan) ou fermer l'appli = tri gardé ; le bilan ne supprime pas l'album vide tant qu'un tri est en attente.
- `HomeScreen` (mode Album) : section **« Album en cours »** **sous « Affiner la sélection »** (maquette A validée le 9 nov. :
  `maquette-album-en-cours.html`, hors Git) = une `ListRow` à contour terracotta : mosaïque des 4 dernières photos de l'album, nom,
  « N / M photos passées en revue », barre (`ListRow` a une prop `progress`), ✕ = abandonner (confirmation). Toucher = reprendre :
  la file est reconstruite depuis la photothèque (photos supprimées / en corbeille ignorées). Le mot « tri » est évité (fait penser au mode Tri).
- **Bug « le tri ne se lance pas depuis la carte » (Android, mode Album, scan GPS fini) — cause NON confirmée**, 3 correctifs de prudence :
  `MapScreen` (bouton → « Ouverture… », un seul appui, navigation après 50 ms, réarmé au retour), `TriModeScreen` (un seul « Lancer »),
  `SwipeScreen` (la liste de l'aperçu d'album n'est plus recalculée à chaque swipe : elle parcourait toute la photothèque ; badge = `albumCount`).
  Si ça fige encore : ajouter des `console.log` avec horodatage autour de `navigate("TriMode")` et du montage de `SwipeScreen`.
- Les filtres (Par date / Par lieu) ne sont PAS mémorisés : seule la file de photos l'est.


---

## 16. Session 9 nov. 2026 (suite) — libellés livre photo + commandes

- **Galerie, libellés du livre photo** (demande d'Augustin : plusieurs produits à venir, « 30 p. » n'a plus de sens partout) :
  dans un album (`GalleryScreen`), le bouton dit « 📖 Livre photo en cours » (ou « 📖 Créer un livre photo ») au lieu de « Mon livre photo · 30 p. » ;
  la feuille « Quel album ? » (`AlbumPickerSheet`) n'affiche plus que le **nombre de photos** de chaque album (plus « livre de 30 pages »).
  **Gardé volontairement** : le nombre de pages sur les livres en cours de la Chambre noire (étagère « 30 pages · N % rempli » et menu appui long).
  Un livre créé démarre à 24 pages minimum (layflat imprimeur.fr, depuis le 9 nov. ; avant : 30 pages Gelato) ; réglé ensuite dans l'éditeur.
  Quand les magnets / tirages auront leur propre écran de création : prévoir un choix du produit (« ＋ Nouveau » de la Chambre noire, bouton de l'album).
- **`print_orders.photo_info`** (jsonb, ajouté le 9 nov.) : par photo `{ path, w, h, shape }` (`shape` = portrait · landscape · square), écrit par
  `submitSelection` (`services/printOrders.js`, `shapeOf`). Sert à repérer les photos horizontales. **SQL à relancer** (ou seulement
  `alter table public.print_orders add column if not exists photo_info jsonb;`) sinon l'envoi est refusé. Dimensions Android pas vérifiées (portrait bien noté « portrait » ?).
- **Format des photos envoyées** : fichier ORIGINAL tel quel (HEIC possible sur iPhone ; à convertir en JPEG avec un imprimeur partenaire).
  **Règle de recadrage pas fixée** : `spec.crop = "none"` pour les tirages 10 × 15 (2:3, alors qu'une photo de téléphone est en 3:4). Proposition (pas validée) :
  remplir le papier (rogner ~11 % au centre) et tourner les photos horizontales, comme pour les magnets ; il faudrait alors adapter la note de la sélection du mois.


---

## 17. Session 10 nov. 2026 — recherche par contenu (« l'été 2026 à la plage »)

**Décisions d'Augustin** : on code tout sans nouveau modèle (pas de CLIP) ; dictionnaire français → étiquettes anglaises ; « été » = juillet + août.
**✅ codé, à tester (étapes 1 à 3) ; pas commité. Il faut un rebuild Android + iOS pour le module natif (Android : déjà fait le 10 nov.).**
- **Module natif `modules/pellicule-labels/`** (Swift = Vision `VNClassifyImageRequest`, Kotlin = ML Kit Image Labeling `17.0.9`, modèle embarqué).
  `getLabels(id)` → `{ labels: [{ text, confidence }], width, height }` ou null ; miniature 512 px comme le flou ; étiquettes EN. Enveloppe : `services/imageLabels.js`.
  **Mesuré (Android d'Augustin, 8 photos WhatsApp)** : ≈ 101 ms / photo (≈ 30 min pour 20 000 photos, une fois). Qualité : bonne pour plage / chien / montagne / forêt / fleurs…,
  vague sinon (« Fun, Leisure, Vacation, Smile » en tête sur beaucoup de photos). **ML Kit n'a que 430 étiquettes** : PAS Sun, Sea, Snow, Cloud, Water, Child, Kid, Boy, Girl, Birthday, Wedding
  (liste officielle : developers.google.com/ml-kit/vision/image-labeling/label-map). Il a Sunset, Sky, Baby, Person, Selfie, Beach, Sand, Dog, Cat, Mountain, Forest, Party, Cake…
  **iOS non testé** (Vision a ~1 300 étiquettes ; à vérifier : child, sea, snow…). Piste future si besoin de mots libres : modèle type CLIP (lourd, rebuild, v2).
- **Analyse de fond** : `services/photoAnalysisQueue.js` fait 2 passes (netteté PUIS étiquettes), même cache `photo-analysis-v1.json` : `{ m, blur: {…}, tags: { l: [["Beach", 87]…], v } }`
  (`putEntry` fusionne sans écraser l'autre analyse). Réglages : `constants/labelsConfig.js` (version `LABELS_ALGO_VERSION`, 8 étiquettes gardées ≥ 15 %, recherche ≥ 50 %, sauvegarde tous les 400).
  `useBlurStore` a `labelsStatus / labelsTotal / labelsDone`. **Changer le module ou ce qu'on garde = monter `LABELS_ALGO_VERSION`.**
- **Dictionnaire** `constants/searchVocabulary.js` : 86 idées (`id, fr, group, words, labels, minPct?, approx?`), à relire / corriger. Idées `approx` (modèle sans l'étiquette exacte) :
  Soleil, Enfants (minPct 40), Mer, Neige, Anniversaire, Mariage, Vacances (minPct 80). Les étiquettes en minuscules sont des candidates iOS (comparaison sans casse, `_` = espace).
- **Lecture de phrase** `services/searchParser.js` (`parseQuery`, `describeQuery`, `matchPeriod`, `duplicateWords`) : sans accents / pluriels ; périodes (saisons, mois, années, Noël = 20→26 déc.,
  « cet été » = la plus récente commencée, « l'été dernier » = la plus récente terminée, « cette année », « ce mois-ci ») ; plusieurs sujets = « l'un OU l'autre » par défaut (bascule « Les deux à la fois » dans la feuille) ; formules de demande ignorées (« je veux faire un album sur… ») ; mots inconnus + suggestions.
  Boutons de la feuille : « Créer un album avec ces photos » (applique les filtres ET ouvre `TriMode` avec la file, `handleApplySearch(payload, create)`) et « Appliquer les filtres seulement ».
  La feuille de recherche monte au-dessus du clavier (écoute `Keyboard`, `Modal statusBarTranslucent`) — corrigé le 10 nov. après test Android.
  `services/contentSearch.js` (`searchContent` → résultats + `notAnalyzed`), `services/labelSearch.js` (cache, fréquences).
- **Écran** (maquette `Claude outputs/maquette-recherche-flou.html`, partie 1) : `components/home/ContentSearchSheet.js` (feuille « Chercher dans tes photos » : champ, « J'AI COMPRIS »,
  résultat dont WhatsApp, avancement de l'analyse, « Appliquer ces filtres ») ; `HomeScreen` mode Album : champ de recherche + pastille NOUVEAU (**à retirer après le lancement**), ligne « Par contenu »
  dans « Affiner la sélection ». Appliquer crée un filtre `date` (`date-recherche`) et un filtre `contenu` (`contenu-recherche`) dans `albumFilters` (snapshot d'ids + `query`, intersection ET comme les autres).
  Icône `search` ajoutée à `Icons`. Carte `[DEV]` (Réglages) : `components/dev/LabelsDevTest.js` (test 8 photos, progression, recherche en français, étiquettes fréquentes, seuil −/+10).
- **Pas encore** : réglage du dictionnaire / des seuils sur les vraies photos ; test iOS ; le filtre est un instantané (si l'analyse continue après « Appliquer », les photos ajoutées ensuite n'y sont pas) ;
  le filtre « contenu » n'existe qu'en mode Album ; pas de recherche en mode Tri. **Idée suivante : « Magic Album »** (cf. flexilivre.com/album-photo/intelligent : tri qualité, regroupement par moments, couverture
  selon le thème) en réutilisant ces étiquettes.
- **Chambre noire refaite (10 nov.) : ✅ codé, à tester** (maquette `Claude outputs/maquette-chambre-noire-tirages-v2.html`, validée) :
  **une seule ampoule** (celle du coin du bloc ; `DarkroomCover` n'en a plus, lueur recentrée à droite) ; mot **« Coups de cœur »** (cœur + texte) posé au-dessus du fil,
  **plus de ligne ni de compteurs** « N à imprimer · M imprimées » sous la guirlande (scène 150 px, fil descendu de ~10 px, tirages à 90 %) ;
  titre « TIRAGES PHOTOS » avec **« ＋ Imprimer » + pastille BIENTÔT** (alerte « Bientôt disponible » : impression à la carte, hors abonnement, pas encore faite) ;
  les **abonnements TIRAGES** s'affichent **sous la guirlande** (même `SubscriptionRow dark` qu'avant) ; sans aucun abonnement : bouton pointillé « Recevoir mes coups de cœur chaque mois » (NOUVEAU) au même endroit ;
  la section « ABONNEMENTS » plus bas ne liste que les **magnets** + « Gérer › » + « Ajouter un abonnement », et n'apparaît que si on a déjà un abonnement.
  **Impression à la carte (maquette, pas codée)** : feuille « Quelles photos imprimer ? » (coups de cœur / un album / toute la photothèque) → grille à cocher (20 tirages minimum, hypothèse imprimeur.fr) → récap + adresse + paiement (standby, prix à fixer).
- **Chambre noire — suite (10 nov.) : ✅ codé, à tester.** Titres de section en **version D** (`DarkLabel` : voyant rouge + titre gras « Tirages photos » / « Livres photo » + filet lumineux + action à droite ; maquette `maquette-chambre-noire-titres.html`).
  **Section « Abonnements » retirée** de la Chambre noire : les abonnements TIRAGES restent en brique sous la guirlande ; les magnets ne s'affichent plus dans la Galerie, seulement dans **Réglages** (nouvelles lignes sous la carte compte :
  « Gérer mes abonnements » → `SubscriptionList` ; « Commandes et paiements » → `SubscriptionHistory` en attendant un vrai écran de commandes / paiement). « ＋ Nouveau » (Livres photo) ouvre la feuille « Quel album ? » (`AlbumPickerSheet`) puis l'éditeur `PhotoBook` ;
  « ＋ Imprimer » affiche seulement une alerte « Bientôt disponible ».



- **Recherche — règles de combinaison + validation (10 nov., soir) : ✅ codé, à tester** (demande d'Augustin).
  **La PÉRIODE est le filtre, les sujets se cumulent en « OU » à l'intérieur.** Exemple : « 2026, voyage, enfants, été, coucher de soleil, amis » =
  photos de 2026 qui sont (voyage OU enfants OU été OU coucher de soleil OU amis). Pour que ça marche, `parseQuery` découpe la phrase aux **virgules** :
  une saison / un mois n'est rattaché à une année que dans le **même morceau** (« l'été 2026, la plage » = été 2026 ET plage) ; cité à part et avec une année
  ailleurs, c'est un **sujet de plus** (`parsed.seasons`, reconnu par la date de la photo, dans `searchContent`). **Sans virgules**, « 2026 voyage été » reste « été 2026 »
  (rattachement par proximité, comme avant). Une saison sans aucune année (« la plage en été ») = la période elle-même (tous les étés).
  **Validation** : rien n'est appliqué avant un bouton ; chaque idée comprise (période, sujets, saison) a une **case** (décochée = ignorée, état `off`) ;
  boutons « Valider ce filtre » (retour à l'accueil, filtres posés) et « Valider et créer l'album tout de suite » (ancien « Créer un album »).
  **Accueil mode Album** : la **barre de recherche est la 1re ligne d'« Affiner la sélection »** (plus de champ au-dessus du compteur) ; la ligne « Par contenu » est **supprimée** :
  la barre, quand elle est active, a un contour terracotta, affiche la phrase + ce qui est filtré (sujets · période) et sa ✕ retire les filtres de la recherche (`contenu-recherche` + `date-recherche`).

- **Recherche par PAYS (« Maroc ») — 10 nov., soir : ✅ codé, à tester** (demande d'Augustin ; choix : frontières **hors ligne**, pas de géocodage Apple/Google → aucune coordonnée ne sort du téléphone, pas de rebuild).
  Le pays est déduit du **GPS de la photo** (`geoPhotos` du store, rempli par `scanGeo` en arrière-plan ; `services/gpsCache.js`). `services/countryLookup.js` : `countryAt(lat, lng)` → id de pays (`"maroc"`),
  point-dans-polygone sur `constants/countries-50m.json` (TopoJSON **Natural Earth 50m**, copié du paquet npm `world-atlas@2.0.2`, ISC / domaine public, 756 Ko, chargé au 1er usage) ; cache en mémoire par case de ~2 km ;
  un point juste en mer (plage, côte simplifiée) est rattaché au pays le plus proche **à moins de 25 km**. `constants/countryNames.js` = noms français + variantes (clé = nom anglais du fichier ; Somaliland → Somalie,
  Chypre du Nord → Chypre ; quelques alias : Angleterre / Écosse → Royaume-Uni, Bali → Indonésie, Tahiti → Polynésie, Dubaï → Émirats, Zanzibar → Tanzanie ; petits territoires sans nom = non cherchables).
  `parseQuery` → `parsed.places` ; **le pays est un FILTRE comme la période** (plusieurs pays = l'un OU l'autre ; ET avec période et sujets : « Maroc 2025, plage » = plage, au Maroc, en 2025).
  `searchContent(..., { geoById })` filtre par pays et renvoie `notLocated` (photos sans position : WhatsApp, captures… ou scan GPS pas fini). La feuille affiche une ligne 📍 cochable, « N photos géolocalisées là-bas »,
  et l'avancement de la localisation. Appliquer pose un filtre `pays-recherche` de type **`lieu`** (donc visible aussi dans « Par lieu » ; la ✕ de la barre de recherche le retire avec les autres).
  **Limites connues** : villes → voir la puce suivante ; **régions non gérées** (« Bretagne », « Provence » = mot inconnu) ; dans ce fichier **le Maroc inclut le Sahara occidental**
  (Laâyoune, Dakhla = Maroc ; décision de données à valider si besoin) et **Ceuta / Melilla comptent comme Maroc** (frontière à 50m) ; îlots minuscules absents (Lampedusa → aucun pays) ; la Guyane, la Réunion… sont dans « France ».

- **Recherche par VILLE (« Marrakech ») — 10 nov., soir : ✅ codé, à tester** (Augustin a choisi le seuil **30 000 habitants**, hors ligne).
  Données : `constants/cities.json` = **GeoNames `cities15000`** (CC BY 4.0 → **crédit affiché en bas de Réglages**, ne pas le retirer), filtré à ≥ 30 000 hab. → **18 223 villes, 526 Ko**, fabriqué par `scripts/build-cities.mjs`
  (`node scripts/build-cities.mjs cities15000.txt 30000` ; fichier source à retélécharger sur download.geonames.org/export/dump/cities15000.zip ; quartiers PPLX, quartiers de Paris et noms à chiffre exclus ; changer le seuil = relancer le script).
  `services/cityLookup.js` : `cityKeysAt(lat, lng)` → **toutes** les villes dont la photo est proche (rayon = 9 km à 30 000 hab., 20 km à 300 000, 31 km à 3 M, plafond 40 km) : une photo de Versailles compte pour Versailles ET Paris ;
  hors rayon = pas de ville (reste dans son pays). Grille de cases de 1° + cache par case de ~2 km. Villes de même nom (Valencia ES / VE) = UN lieu (on cherche autour de chacune).
  Noms français : `constants/cityNames.js` (~110 exceptions : Londres, Le Caire, Pékin, Marrakech/Marrakesh, Fès, Tanger… ; clé = nom exact dans `cities.json`) ; une ville absente de cette table s'écrit comme dans GeoNames (souvent l'anglais pour les grandes : Munich, Naples, Geneva).
  **À compléter au fil des mots « pas compris »** (ajouter une ligne). Parseur : les villes passent APRÈS les idées du dictionnaire, les pays, les mots-outils, mois, saisons, années (jamais prises pour une ville) ; `COMMON_WORDS` écarte « orange » et « sale » ;
  suggestions « Tu voulais dire » pour une ville = faute d'une lettre seulement. Id de lieu = `v:<nom>` (kind `"city"`), pays = `maroc`… ; plusieurs lieux = l'un OU l'autre. Le filtre posé est toujours `pays-recherche` (type `lieu`).
  **Pas encore** : régions / départements, villages < 30 000 hab. (rattachés à la grande ville proche si < rayon), choix entre deux villes homonymes (ex. « Valencia » = Espagne + Venezuela). Le 1er mot tapé construit l'index (~45 ms) puis c'est instantané.

---

## 18. Session 10 nov. 2026 (suite) — posters (imprimeur.fr) dans la Chambre noire

**✅ codé, à tester (pas commité).** Maquette validée par Augustin : `Claude outputs/maquette-poster.html` (6 écrans, hors Git).
- **Relevé imprimeur.fr (API, clé TEST, fonction `imprimeur-catalogue?products=poster`)** : produit `poster`, finition unique `standard` (« Poster seul »), 1 exemplaire minimum.
  Les formats s'affichent « 20×30 / 30×40 / 42×59 / 59×84 cm » mais les tailles RÉELLES sont **A4 / A3 / A2 / A1** (210×297, 297×420, 420×594, 590×840 mm). Prix HT :
  3,22 · 4,86 · 10,98 · 15,00 € ; port = forfait par commande (Colissimo 4,97 € / Chronopost 8,25 € HT), **identique pour les 4 formats et pour 5 exemplaires**.
  Papier pelliculé brillant 250 g (le Fine Art 305 g du site n'est PAS proposé par l'API), livré roulé, production 1-3 j ouvrés. Fichier : un JPG/PNG par exemplaire (URL publique).
  **Inconnus** : dpi minimum (150 supposé), fond perdu (0 supposé), comportement d'une photo horizontale sur un poster vertical → à valider par une commande TEST.
- **Prix de vente proposés (TTC, livraison comprise), à confirmer par Augustin** : A4 14,90 · A3 17,90 · A2 27,90 · A1 34,90 € (marge ≈ 4,2 / 5,1 / 7,3 / 9,1 € HT avant frais de paiement ; le port n'est payé qu'une fois par commande).
- **Code** : `services/posterProducts.js` (formats, prix, coût, marge, `posterQuality` = dpi + part coupée au recadrage « cover », `bestPosterFormat`, textes de la présentation) ·
  `components/poster/PosterParts.js` (`PosterFrame`, `PosterWall` = bloc de la Chambre noire, `PosterHeroScene`) · écrans `PosterIntroScreen` (présentation, 1re fois seulement via `posterIntroSeen`
  dans `usePhotoStore`, ⓘ du bloc pour la rouvrir) → `PosterPickScreen` (source : coups de cœur / un album / toute la photothèque avec recherche par contenu, grille 3 colonnes, une coche) →
  `PosterFormatScreen` (4 formats à l'échelle, prix, qualité Parfait / Bonne / Un peu juste / Trop petite, avertissement si > 25 % de photo coupée) → `PosterRecapScreen` (quantité, nom + adresse,
  total ; **« Payer » grisé « BIENTÔT »**, rien n'est enregistré ni envoyé). `GalleryHomeScreen` : bloc **POSTERS** (badge NOUVEAU, ⓘ, « ＋ Créer ») entre les tirages et les livres photo.
  `ContentSearchSheet` : nouvelle prop `pickMode` (un seul bouton « Voir ces photos »). Pas de rebuild nécessaire (JS pur).
- **Pas encore** : « Ajuster » le recadrage (recadrage au centre seulement) ; panier de plusieurs posters différents ; envoi du fichier (URL publique Supabase Storage) et commande imprimeur.fr ; paiement (standby) ;
  « Satisfait ou refait » affiché dans la présentation : **à vérifier dans les CGV d'imprimeur.fr** ; la source « photothèque + recherche » sera partagée avec « ＋ Imprimer » des tirages à la carte (pas codé).
- **Tirages photo : « ＋ Nouveau » + page produit (10 nov.) : ✅ codé, à tester** (maquette `maquette-tirages-nouveau.html`, validée ; icône polaroïd à côté du titre). « ＋ Imprimer / BIENTÔT » est remplacé par **« ＋ Nouveau »** (bloc Tirages photos) → écran **`PrintNew`** (`screens/PrintNewScreen.js`) :
  présentation du produit (éventail de 3 tirages avec les vrais coups de cœur, pastille 10 × 15 cm, 4 points) puis deux formules : **Abonnement** (12,90 € / mois, 20 tirages → « S'abonner » ouvre `SubscriptionIntro`) et **Tirage simple** (« Choisir » = alerte « Bientôt disponible » : grille de choix, récap et paiement pas codés),
  « Comment ça marche », « Bon à savoir ». Données : `services/printProducts.js` (formats 10×15 et 10×10, 20 minimum, jusqu'à 1 000 : lus dans l'API imprimeur.fr ; **aucun papier ni finition annoncé par l'API → ne pas écrire « brillant »**).
  ⚠️ **Prix du tirage simple = EXEMPLE** (14,90 € pour 20, + 0,35 € par tirage en plus) : à fixer par Augustin. Icône `polaroid` ajoutée à `components/Icons.js`.
  Un flux **Poster** (`PosterIntro` / `PosterPick` / `PosterFormat` / `PosterRecap`, bloc « Posters » de la Chambre noire) a été ajouté en parallèle : pas touché ici.

- **Retouches du 10 nov. (soir) : ✅ codées, à tester.** Chambre noire : ordre Tirages → Livres photo → Posters ; titres de section 15 px, « Posters » en minuscules, « ＋ Nouveau » partout ; blocs en
  pointillés retirés (tirages et poster) ; texte / icône « Coups de cœur » réduits. `PrintNewScreen` : 3e carte **Magnets** (9,90 € / mois) après « Tirage simple » → `SubscriptionMagnets`.
  **Étape abonnement et parcours poster recolorés en terracotta** (`C.album` / `C.albumSoft`, plus de vert) : `SubscriptionIntro`, `SubscriptionMagnets`, `SubscriptionSetup`, `SubDaysFields`, `Toggle` (prop `color`) ;
  les écrans de suivi (`SubscriptionMonth`, `SubscriptionList`, `SubscriptionManage`, `SubscriptionTracking`, `SubscriptionHistory`, `SubscriptionRow` clair) sont aussi en terracotta (demande d'Augustin) ; seul reste vert le liseré « validée » des briques sombres de la Chambre noire (`C.sage3`). Les pastilles de qualité du poster restent vertes / orange / rouges (sens).
  **Choix de la photo du poster = un seul écran** (`PosterPickScreen` : onglets Coups de cœur · Albums · Photothèque, plus de page « d'où vient la photo ? »).
  **Poster horizontal** : le poster suit le sens de la photo (`posterIsLandscape`, `posterDims`, `posterSizeLabel`, `PosterFrame landscape`) ; l'ancien message « les posters sont verticaux » est supprimé.
  ⚠️ imprimeur.fr ne liste que des formats « portrait » pour le poster : on enverra l'image tournée de 90° dans une feuille verticale (même feuille physique) ; à valider par une commande TEST.
- **Page « Cadre ton poster » refaite (10 nov., soir) : ✅ codée, à tester sur appareil.** `PosterFormatScreen` : grand aperçu du poster avec la photo, **glisser = déplacer, pincer = zoomer** (réutilise `CroppedImage` du livre, via
  `PosterFrame` props `crop` / `editable` / `onCropChange`), boutons − / ＋ / « Recentrer » ; 4 pastilles de format avec la qualité de la photo **à ce zoom** (`posterQuality(photo, key, zoom)` = dpi ÷ zoom, la donnée que
  Augustin aime) ; **prix discret** (une ligne au-dessus du bouton « Continuer », plus sur chaque format). Le recadrage `{ scale, x, y }` passe à `PosterRecapScreen` (aperçu recadré). Pas de rotation ni de redressement (le livre en a).
  À vérifier : le pincer / glisser dans un `ScrollView` (le geste doit gagner sur le défilement) ; la fabrication du fichier final doit appliquer ce même recadrage.

## 19. Accueil : haut du mode Album calqué sur le mode Tri (10 nov. 2026) — ✅ codé, à tester
Maquette validée : `Claude outputs/maquette-album-accueil.html` (piste A + vraie photo dans le bac du mode Tri).
- **Mode Tri** (`TriHero`, prop `photoUrl`) : la photo qui tombe dans le bac est une **vraie photo de l'appareil = la prochaine à trier** (`queue[0]` dans `HomeScreen`) ; sans photo, le dessin d'origine reste.
- **Mode Album** : nouveau `components/home/AlbumHero.js` (même construction que le mode Tri, en terracotta) : album ouvert dessiné + vraie photo de la sélection (`queue[0]`) → « Ton prochain album : **48 photos** »
  → « 2,3 Go · du 3 juin au 28 août 2026 » → barre « 48 sur 12 480 photos de ta photothèque » → « Créer un album ». **Plus de mosaïque ni de gros chiffre.** « Affiner la sélection » et tout le bas ne changent pas.
  **Pas de bouton loupe à côté de « Créer un album »** (idée gardée pour plus tard, décision d'Augustin) ; la barre est gardée (à confirmer à l'usage).
- `components/home/FallingPhoto.js` : photo réelle, cadre blanc, inclinée, posée par-dessus un dessin SVG (partagée par les deux héros).

## 20. Retouches du 11 nov. 2026 — ✅ codées, à tester
- **Poster : décocher une photo** (`PosterPickScreen`, `toggleSelect`) : toucher la photo déjà cochée la décoche.
- **« Créer un album » (accueil mode Album) = feuille par le bas** : nouveau `components/home/AlbumLaunchSheet.js` (« Dans quel album ? » : ligne « Nouvel album » avec le nom + « Commencer », puis « MES ALBUMS » triés par dernière modification ;
  toucher un album = ajouter les photos dedans). Le tri démarre **directement** (`Swipe` avec `queue`, `mode: "album"`, `albumId`, `albumName`), **sans** l'ancienne page « Créer un nouvel album / Continuer un album existant » ni le filtre par mois
  (`TriModeScreen` étapes 1-2). Branché dans `HomeScreen` (`launchSheetOpen`, `launchQueue`, `launchAlbumSort`, `handleCreateAlbumAndSort`) pour le bouton « Créer un album » ET pour « Valider et créer l'album tout de suite » de la recherche.
  **Pas encore converti** : `MapScreen` (« Trier ces N photos » en mode Album) et `MomentScreen` passent encore par `TriMode` (ancienne page).
- **Poster « pêle-mêle » (plusieurs photos sur un poster) : maquette `Claude outputs/maquette-poster-pele-mele.html`, EN ATTENTE DE VALIDATION, rien de codé.** Principe : l'app compose UNE image (même technique que les pages du livre : `react-native-view-shot`, pas de rebuild),
  imprimeur.fr reçoit un fichier par poster → mêmes formats et prix. 3 styles (Grille · Mosaïque · Pêle-mêle polaroïd + titre manuscrit), 6 fonds, « Mélanger », 2 à 12 photos, qualité = photo la plus petite.
- **Poster « pêle-mêle » codé (11 nov.) : ✅ à tester sur appareil** (maquette validée `maquette-poster-pele-mele.html`). `services/posterCollage.js` (dispositions pures : **Grille · Mosaïque · Pêle-mêle** polaroïd ; 2 à 12 photos ;
  6 fonds ; titre facultatif en Caveat réservant une bande en bas ; graine = « Mélanger » ; `collageQuality` = dpi de la PLUS PETITE photo, chaque photo « cover » dans sa case ÷ son zoom ; `bestCollageFormat`) ·
  `components/poster/CollagePoster.js` (rendu à n'importe quelle largeur : servira aussi au fichier d'impression) · `PosterPickScreen` : sélecteur « Une photo / Pêle-mêle » (cases numérotées dans l'ordre, décocher en retouchant) →
  `PosterCollageScreen` (aperçu, toucher une photo = recadrer / retirer dans un Modal avec `GestureHandlerRootView`, style, fond, titre, mélanger) → `PosterFormat` / `PosterRecap` avec `route.params.collage`.
  Posters en collage toujours **verticaux**. **Pas encore** : fabrication du fichier d'impression (dessiner `CollagePoster` hors écran avec `react-native-view-shot` à 150 dpi → JPG → URL publique ; même chaîne que le livre),
  remplacer une photo par une autre depuis l'écran de composition (seulement recadrer / retirer), page de présentation du poster qui ne parle pas encore du pêle-mêle.

## 21. Réponse du support imprimeur.fr (11 nov. 2026) — remplace les hypothèses des §5, §13 et §18

**Contexte stratégique (dit par Augustin)** : imprimeur.fr est une **filiale de Flexilivre**, un **concurrent B2C** (livres photo). Je n'ai trouvé aucune source publique qui le confirme (recherches du 11 nov.) : à prendre comme information d'Augustin.
imprimeur.fr se présente comme du **print on demand B2B** (flux de commandes par API, impression à l'unité, envoi direct aux clients du professionnel). L'API renvoie `403 siret_required` / `payment_method_required` : **une clé live exige un SIRET et un moyen de paiement**.
Conséquences : données clients (photos, adresses) chez la filiale d'un concurrent → à traiter (RGPD, CGV écrites) ; ne rien dire de la feuille de route (Magic Album…) ; garder une porte de sortie (Gelato archivé, `GELATO_API_KEY` conservée, fonction `prodigi-price`) et une couche « fournisseur » côté serveur.

**Confirmé par le support** :
- **Fond perdu** : le PDF est **exactement au format fini** (210×297 pour l'A4, pas 220×307). Les 5 mm de fond perdu sont **compris** dans ce format : le fond va jusqu'au bord, **rien d'important (texte, visage) dans les 5 mm du bord** = aussi la marge de sécurité. → `bleedMm = 0` et `safeMm = 5` (corrects).
- **Couverture rigide** : même format que les pages ; rembord sur le carton et tranche gérés par eux ; le visuel peut être très légèrement ajusté au montage (d'où les 5 mm). **Pas d'autre marge.**
- **Intérieur des couvertures non imprimé** : une **page de garde blanche** (autre papier, non imprimable) au début et à la fin ; la page 1 lui fait face (= notre aperçu). **Dos** : texte possible par le paramètre API **`slice`** (texte, alignement, couleur du texte, couleur de fond) → pas encore dans l'app.
- **Fichier** : **150 dpi minimum** (inutile > 300) ; **RVB** de préférence (Adobe RGB 1998 idéal, **sRGB accepté**), conversion chez eux ; tout PDF standard (PDF/X-4 si norme, pas PDF/X-1a) ; poids sans limite pratique mais **au-delà de 8 Mo le serveur doit accepter `Accept-Ranges: bytes`** (à vérifier sur Supabase Storage).
- **Double page** : PDF en **pages simples comme le gabarit** (chaque moitié sur une page) ; **layflat = pas de pli, la question du raccord ne se pose pas** ; « format premium ». → la réserve « raccord au centre » est levée ; **« sans marge » (photo jusqu'au bord) n'est plus bloqué** (à coder).
- **Tirages** : prix de l'API exacts = **0,20 € HT par tirage, 20 minimum, aucune dégressivité** (lot de 20 = 4,00 € HT) ; **port 4,97 € HT** Colissimo quel que soit le nombre. **L'hypothèse « 0,18 € » d'Augustin (9 nov.) était fausse.**
  Marge de l'abonnement 12,90 € TTC (10,75 € HT) : 10,75 − 8,97 = **1,78 € HT, ≈ 1,3 € après frais de paiement** (et non 2,18 / 1,74).

**Pas couvert par la réponse (à redemander)** : tirages et posters (fond perdu / marge, recadrage si le ratio ne colle pas : la fiche dit « l'image est centrée »), poster horizontal (l'API ne liste que des formats portrait), CGV B2B / API écrites (confidentialité, usage des données, préavis de changement de prix), « satisfait ou refait ».
**Le support demande** : « présenter le projet en deux lignes, avec formats et volumes envisagés » → réponse à envoyer, **minimale** (voir la discussion du 11 nov.).

**Audit des specs dans l'app (11 nov., ✅ corrigé)** : tailles vérifiées contre l'API (`width_mm` × `height_mm`) : albums 210×297 / 210×150 ✓ · posters 210×297, 297×420, 420×594, 590×840 ✓ · tirages 100×150 et 100×100 ✓.
Corrigé : tirage de l'abonnement `spec` 102×152 → **100×150**, recadrage « cover » (comptes rendus de commande) ; commentaires « à confirmer » levés dans `bookProducts.js` ; coût réel 0,20 € dans `printProducts.js` ;
**titre de couverture en position manuelle = toujours dans les 5 mm de sécurité** (`BookCover` prop `safe`, `ManualTitle` clampe avec la largeur estimée du texte) ; **contrôle de la photo de couverture** (150 dpi, `checkBook` → `coverLow`, ligne dans « Vérifier ton livre »).
**Encore ouvert** : « sans marge » (photo au bord) pas codé · titre sur le dos (`slice`) pas codé · tirages/posters : fond perdu et recadrage pas confirmés par écrit · poster horizontal · HEIC → JPEG pas fait · fichier d'impression du poster pas fait.

**Plan du « pont » imprimeur.fr SANS SIRET (décision d'Augustin, 11 nov. : aller le plus loin possible, brancher le vrai compte le jour de la sortie).** La clé **`impr_test_`** crée de vraies commandes **fictives** (rien d'imprimé ni facturé, statuts qui évoluent chaque minute, faux suivi) :
tout est donc testable de bout en bout. Le jour J = remplacer le secret `ImprimeurFR_API_Key` par une clé `impr_live_` (SIRET + moyen de paiement chez imprimeur.fr) et déclarer l'URL du webhook pour cette clé. Aucun code à changer si on respecte :
(1) aucune adresse / clé imprimeur.fr dans l'app (tout passe par des fonctions Supabase) ; (2) prix **recalculés côté serveur** ; (3) un drapeau serveur « commandes réelles » (`ORDERS_LIVE`) pour cacher / griser « Commander » en production tant que le pont n'est pas fait.
Blocs, dans l'ordre : **A** tables `orders` + dossier Storage `print-files` + RLS · **B** fabrication des fichiers sur le téléphone (PDF livre page par page, JPEG poster, JPEG tirages avec HEIC converti et recadrage 2:3) + envoi avec progression → liens signés (vérifier `Accept-Ranges`) ·
**C** fonction `imprimeur-order` (compte connecté exigé, `POST /orders`, `Idempotency-Id`, `external_id`) · **D** fonction `imprimeur-webhook` (statuts `transmitted` / `mailed` / `delivered` + n° de suivi → app) · **E** emplacement du paiement (Stripe plus tard : `payment_status`, la fonction refuse une clé live non payée) ·
**F** écrans « Commander » (livre, poster, tirage) + suivi · **G** tâche mensuelle de l'abonnement (cron). Paiement et mentions légales exigent aussi une entité (SIRET) : standby.

**Dos du livre (11 nov., ✅ codé, à tester via le PDF d'essai `__DEV__`)** : la dernière page du PDF (couverture de dos) = couleur de fond de la couverture + **logo Pellicule au centre et « Fait avec Pellicule ❤️ »** dessous (demande d'Augustin : sur CHAQUE livre) ;
`components/book/BackCover.js` (`BACK_COVER_TEXT`), tailles proportionnelles à la largeur (logo 13 %, texte 2,6 %), texte sombre sur fond clair / blanc sur fond foncé (le logo a sa pastille claire). **Aperçu du dos dans l'éditeur (11 nov., ✅ codé, à tester)** : sur la couverture, bascule **Face | Dos** sous l'aperçu ; « Dos » montre `BackCover` (même rendu que le PDF), masque les outils de la face et affiche toujours « COULEUR DU DOS » (le dos prend `cover.bg`, même couleur que la face pour les styles qui la montrent).
**Marges dans une page (11 nov.)** : cadre extérieur = 5 % de la largeur de la page (≈ 10,5 mm sur 210 mm) ; **écart entre deux photos d'une même page = 2 % de la largeur (≈ 4,2 mm, minimum 3 pt à l'écran)**, identique en lignes et en colonnes, pas réglable (`BookPage`, `pad` et `gap`).

**Retouches du 11 nov. (soir) : ✅ codées, à tester.** **Brique d'abonnement** (`SubscriptionRow`) : 2ᵉ ligne = « **Abonnement · 20 tirages par mois** », **plus de prix** sur la brique. **Barre de recherche** de l'accueil Album : pastille NOUVEAU retirée.
**Chambre noire** : « ＋ Nouveau » → « **＋ Créer** » sur Tirages, Livres photo et Posters ; **« ＋ Créer » (et le bloc) du poster ouvrent TOUJOURS la page produit `PosterIntro`** (plus de ⓘ ; `posterIntroSeen` n'est plus lu).
**Page produit poster** : 🇫🇷 après « Imprimé en France » (kicker + 1re puce) ; **les 4 formats se touchent** et le format touché s'affiche **à l'échelle avec un iPhone à côté** (`components/poster/PosterScale.js`, iPhone 72 × 147 mm, A3 par défaut).
Idées d'autres comparaisons (feuille A4, personne, canapé, réalité augmentée en v2) : **maquette `Claude outputs/maquette-poster-echelle.html`, EN ATTENTE DE CHOIX d'Augustin.**

**Poster — échelle (11 nov., choix d'Augustin)** : on garde les comparaisons **1 (iPhone) et 2 (feuille A4)** — pastilles « iPhone | Feuille A4 » dans `PosterScale` (✅ codé) ; **pas** la personne ni le canapé ; **il aime beaucoup l'idée 5 « Voir chez moi » (réalité augmentée)**.
**« Voir chez moi » : maquette `Claude outputs/maquette-poster-voir-chez-moi.html` (5 écrans : bouton sous l'aperçu · repérage du mur · poster à la vraie taille avec choix du format · photo + « Commander » · plan B photo + feuille A4), EN ATTENTE DE VALIDATION, rien de codé.**
Pistes techniques (recherche du 11 nov., rien d'installé) : **ViroReact** (`@reactvision/react-viro` 2.54, cible la nouvelle architecture, ARKit + ARCore, plans verticaux, utilisable avec Expo en dev build — **compatibilité Expo 54 / RN 0.81 NON vérifiée**, à tester par un « spike » sur une branche à part) ;
module Expo **local** ARKit (iOS seulement, comme `pellicule-labels`) ; **plan B sans AR**, tous téléphones : photo du mur avec une **feuille A4** (21 × 29,7 cm) comme règle d'échelle. Tout demande un **rebuild** (module natif). Pas d'ARKit/ARCore dans le projet aujourd'hui (ni `expo-camera`).

**Poster — retouches du 11 nov. (soir) : ✅ codées, à tester.** (1) **Pêle-mêle sans chevauchement** : chaque tirage tient ENTIER dans sa propre case ; **plus d'inclinaison (retirée le 11 nov. à la demande d'Augustin : tirages droits, `rot: 0`)**, seulement un léger décalage au hasard ; (à l'origine : inclinés de 2° à 6°) de la grille (`collageLayout`, style `pelemele`) ; testé sur 1 320 dispositions (2 à 12 photos, 60 graines, avec / sans titre) : **0 chevauchement, 0 tirage hors marge** ; le plus petit tirage = 43 mm de large sur un A4 (12 photos, sans inclinaison).
(2) **Titre sur le poster d'UNE photo** (`PosterFormatScreen`, « TITRE (FACULTATIF) » sous l'aperçu ; dès qu'il y a un texte : police [Moderne, Manuscrite, Affiche, Calligraphie], position [haut, milieu, bas], couleur [blanc, noir]) ; dessiné par `PosterFrame` (prop `title`, marge 8 % de la largeur) ; passé à `PosterRecap` (`route.params.title`).
Le pêle-mêle (plusieurs photos) avait déjà son titre (écran de composition). **Le fichier d'impression n'est pas encore fabriqué** : il devra reprendre ce titre (poster d'une photo) et celui du pêle-mêle.


**Pêle-mêle — retouches du 11 nov. (après-midi) : ✅ codées, à tester.** **Jusqu'à 16 photos** (`COLLAGE_MAX = 16`) ; le style **Pêle-mêle** aligne les tirages polaroïd sur les **mêmes lignes et les mêmes colonnes** (tous de même taille, centrés dans leur case ;
une dernière ligne incomplète reste sur les colonnes : centrée si le nombre de cases vides est pair, sinon à gauche) ; plus de décalage au hasard (le « Mélanger » change l'ordre des photos). Testé : 0 chevauchement, 0 tirage hors marge de 2 à 16 photos.
**Titre du pêle-mêle = mêmes polices que le livre** (Moderne, Manuscrite, Affiche, Calligraphie, `COVER_FONTS` / `COVER_STYLE.font`) : sélecteur « Police » sous le champ titre (`PosterCollageScreen`, `collage.titleFont`), rendu par `CollagePoster` (prop `titleFont`, défaut Manuscrite). Position (bande du bas) et couleur (selon le fond) restent automatiques.
**Page de présentation du poster à refaire sur le modèle de « Nouveaux tirages » / « Choisis ton format » (encart orange) : maquette `Claude outputs/maquette-poster-presentation.html` (3 pistes : A formules en cartes Une photo / Pêle-mêle [ma préférée], B formats en cartes + un bouton, C onglets dans l'encart), EN ATTENTE DE CHOIX d'Augustin, rien de codé.**

**Page de présentation du poster refaite (11 nov., après-midi) : ✅ codée, à tester** (choix d'Augustin : piste C de `maquette-poster-presentation.html` SANS onglets). `PosterIntroScreen` = en-tête de « Nouveaux tirages » (flèche terracotta, « Posters photo » / « Nouveau poster ») + **encart orange pâle** (« IMPRIMÉ EN FRANCE 🇫🇷 », « Tes plus beaux souvenirs, en grand ») avec **`components/poster/PosterProjection.js`** :
les 4 formats projetés côte à côte **à la même échelle avec leur prix**, **un iPhone à côté de l'A4**, et des **pêle-mêle dans certains formats** (A4 et A2 = une photo, A3 = pêle-mêle de 6, A1 = pêle-mêle de 16, avec les vrais coups de cœur) pour montrer le multi-photos ; pastille **« 🚚 Livré sous 3 à 7 jours »** à la place de « 250 g »
(`POSTER_DELIVERY_LABEL` dans `posterProducts.js` : **« x jours » choisi par Claude = fabrication 1-3 j + Colissimo 2-4 j, à confirmer**) ; points ✓ en pastilles blanches (1er point : une photo ou 2 à 16 en pêle-mêle) ; bouton « Créer mon poster » → `PosterPick` (qui a le sélecteur Une photo / Pêle-mêle).
**Supprimés de la page** : pastilles des 4 formats, comparaison à l'échelle (iPhone / feuille A4 : `PosterScale.js` n'est plus utilisé nulle part, à supprimer si Augustin est d'accord), « Comment ça marche », « Bon à savoir ». « Livré roulé et protégé, chez toi en 2 à 4 jours » devient « Livré roulé et protégé ».

**Retouches du 12 nov. : ✅ codées, à tester.** **Page de présentation du poster** : l'image (`PosterProjection`) montre **UN format à la fois** (le poster remplit la hauteur, un iPhone à la même échelle à côté ; A3 = pêle-mêle de 6, A1 = pêle-mêle de 16, A4 / A2 = une photo) et **se met à jour quand on touche un des 4 formats placés SOUS l'encart orange** (nom, taille, prix) ;
la projection sur le mur (« Voir chez moi ») viendra dans cette image quand elle sera développée. **Choix des photos du poster** (`PosterPickScreen`) : **plus d'interrupteur « Une photo / Pêle-mêle »** : une photo cochée = poster simple (« Choisir cette photo »), **2 photos ou plus = pêle-mêle détecté automatiquement** (« Composer · N photos », cases numérotées dès la 2ᵉ, jusqu'à 16) ;
la sélection suit d'un onglet / d'un album / d'une recherche à l'autre.

**Retouche du 12 nov. (poster, page de présentation) : ✅ codée, à tester.** Sur l'image (`PosterProjection`), la pastille « 🚚 Livré sous 3 à 7 jours » est remplacée par **« Impression haute définition »** ; ce point est retiré de la liste ✓ du bloc orange (`POSTER_HIGHLIGHTS`). `POSTER_DELIVERY_LABEL` reste dans `posterProducts.js` mais n'est plus affichée (« x jours » jamais confirmé).
**Retouche du 12 nov. (suite) : ✅ codée, à tester.** Plus AUCUNE pastille sur l'image du poster (`PosterProjection`) ; « Impression haute définition » est revenu en 1er point de la liste ✓ du bloc orange (`POSTER_HIGHLIGHTS`). Remplace la note précédente.
