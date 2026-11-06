# Pellicule — Contexte projet & instructions IA

> Fichier de passation. Lu en début de session pour retrouver l'état du projet
> sans re-scanner tout le code. **À maintenir à jour** à chaque étape importante.
> Dernière mise à jour : 2026-11-06 (comptes Supabase + livre photo 21×28 cm).

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

## 2. État actuel (au 2026-11-06)

- **`main` contient** (testé, poussé sur GitHub le 6 nov.) : progression, thème « sauge »,
  barre de menu, Galerie, livre photo carré (`d49d903 coup de coeurs`).
- Branche de travail : **`feature/comptes`** (créée le 6 nov. depuis `main`) — **comptes Supabase**
  (connexion e-mail, déconnexion, suppression, sauvegarde de la progression : testés par Augustin)
  + **livre photo 21×28 cm Gelato** et écran « Vérifier ton livre » (codés, à tester sur simulateur).
  À fusionner dans `main` après test.
- Branches déjà fusionnées dans `main`, supprimables : `feature/progression`,
  `feature/themes`, `feature/barre-menu`, `feature/livre-photo`, `octobre27`.
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
  polices du livre photo (Playfair, Caveat, Bebas, Great Vibes, Fredoka) chargées par `components/book/bookFonts.js`.
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
  `BookCheck`, `Auth`.

**store/**
- `useAuthStore.js` — session de connexion Supabase (`session`, `ready`, `init()` appelé dans App.js).
  Pas de persist : Supabase mémorise la session lui-même (AsyncStorage).
- `usePhotoStore.js` (~600 l.) — **cerveau de l'app**. État du tri, filtres albums,
  réglages de rappels, flags "vu une fois". Persisté via AsyncStorage.
  Contient aussi le **carnet de bord** `dailyLog`, le chrono de tri, `lifetimeSorted`,
  `achievements` (galons/badges datés) et la file `pendingUnlocks` (non persistée).

**screens/** (13)
- `OnboardingScreen` · `PermissionDeniedScreen` — arrivée + permissions.
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
- `PhotoBookScreen` — éditeur de livre photo d'un album (orientation, nombre de pages, couverture, doubles pages).
  `BookPageEditorScreen` — une page en grand (mise en page, titre, recadrage). `BookCheckScreen` —
  « Vérifier ton livre » avant impression (3 vues : contrôles · photos de faible qualité · et maintenant ?).

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
  `BookCover`, `BlankPage`, `COVER_STYLE`, `BookControls` (`LayoutPicker`, `Chip`…), `PhotoPickerSheet`,
  `AlbumPickerSheet`, `CroppedImage`, `TiltSlider`, `bookFonts`.

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
- `photoBook.js` — logique pure du livre (orientation, pages 30→200 par 2, mises en page, recadrage).
- `bookCheck.js` — contrôles avant impression + `PRINT_SPEC` (specs Gelato).

**hooks/** — `useAndroidBack` (bouton retour Android), `useNotificationReminder`
(logique d'activation des rappels, partagée).

**constants/** — `theme.js` : **plusieurs palettes** (`PALETTES.ardoise` = ancienne bleue,
`PALETTES.sauge` = nouvelle). L'interrupteur `THEME_ACTIF` choisit celle utilisée → `C`.
Aussi `FONT` ("Outfit"), styles `S`. Ne jamais écrire une couleur en dur : passer par `C`.

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

**Gelato** (impression, pas encore branché) : produit retenu
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
9. **Texte du tuto à changer avant l'envoi de photos** : « Pellicule n'envoie aucune photo sur un serveur »
   (Réglages → tuto, Onboarding). Vrai aujourd'hui (seuls e-mail + chiffres de progression partent) ;
   faux dès que les pages du livre seront envoyées pour impression → texte + accord clair de l'utilisateur.
10. **Livres de l'ancien format** (24 pages, carrés) : signalés par « Vérifier ton livre » (30 pages min,
    nombre pair). Les albums de peu de photos donnent beaucoup de pages vides à 30 pages (non bloquant).
11. **`progressSync`** : `freedMo` et `purgedCount` ne sont **pas** synchronisés (dépendent de la photothèque
    de chaque téléphone). Coups de cœur / albums / livres non plus (ids de photos propres au téléphone).

---

## 8. Prochaines étapes probables

1. **Tester sur simulateur** le livre 21×28 (orientation, pages, mises en page) et « Vérifier ton livre »,
   puis fusionner `feature/comptes` dans `main`.
2. **Livre photo → impression (Gelato)**, dans l'ordre :
   a. dessiner chaque page **hors écran** puis l'enregistrer en image à la bonne taille
      (210×280 mm + 4 mm de fond perdu, ≥ 150 dpi) — bibliothèque native de capture → **rebuild** ;
      assembler un **PDF d'essai** (bouton « Créer le PDF » de `BookCheckScreen`, barre de progression) ;
   b. compte Gelato + **clé API** (côté serveur Supabase uniquement) → largeur du dos selon le nombre de
      pages, couverture à plat ;
   c. envoi des pages sur Supabase Storage (avec accord clair de l'utilisateur ; changer le texte du tuto),
      fonction serveur qui crée la commande Gelato ;
   d. **paiement** : qui encaisse, marge, TVA (€ HT vs livraison en $) — à décider avec Augustin.
3. **Tirages photo** (Coups de cœur) : même chaîne que le livre, après lui.
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
