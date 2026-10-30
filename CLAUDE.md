# Pellicule — Contexte projet & instructions IA

> Fichier de passation. Lu en début de session pour retrouver l'état du projet
> sans re-scanner tout le code. **À maintenir à jour** à chaque étape importante.
> Dernière mise à jour : 2026-10-30.

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

## 2. État actuel (au 2026-10-30)

- Branche de travail : **`feature/themes`** (créée depuis `feature/progression` le 30 oct.).
  Chantier : **refonte visuelle « sauge »** (voir §12). Accueil fait, reste les autres écrans.
- `feature/progression` : terminée, commitée, **pas encore fusionnée** dans `main`
  (attend son test TestFlight). C'est aussi le **retour arrière** si le thème casse tout.
- `main` = fin de la session d'octobre (`ab35958 vdefversionoctobre`).
- Ordre de fusion prévu : `feature/progression` → `main`, puis `feature/themes`.
- Test au quotidien : **simulateur iOS du Mac** (`npx expo start --dev-client`, Fast Refresh).
  Test sur vrai téléphone : TestFlight sur l'iPhone de sa femme (Augustin n'a pas d'iPhone).

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
  **react-native-svg** (icônes), **expo-font + @expo-google-fonts/outfit** (police).
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
- `AppNavigator.js` — déclare les 14 écrans (dont `Progress`). Un seul NavigationContainer (dans App.js).

**store/**
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

**components/** — briques UI réutilisables :
- `AppText` — **remplace le `Text` de React Native partout** (applique Outfit). Dans un nouveau
  fichier : `import Text from "../components/AppText";` (jamais `Text` depuis "react-native").
- `Icons` — icônes au trait (react-native-svg) : `<Icon name="shuffle" color={C.accent} />`.
  `IconsBoard` = planche de toutes les icônes en bas de Réglages (`__DEV__` seulement).
- `home/` — morceaux de l'accueil : `HomeHeader` (logo + nom, ⚙️, bascule Tri/Album),
  `TriHero` (jours restants, pastille photos/session, bouton 🔀, Lancer un tri),
  `FolderSheet` (Toute la photothèque / Screenshots / dossiers), `ui` (`SHADOW`, `SectionTitle`, `ListRow`).
- Autres : `BackButton`, `Toggle`, `PhotoGrid`,
`ZoomableImage`, `RowSetting`, `AlbumFiltersBar`, `SessionTutoOverlay` (overlay tuto),
`SwipeEdgeHints` (actions sur les bords), icônes dessinées `ExitIcon` / `SwapIcon` / `RankShield`,
`ProgressCard` (carte accueil), `RankCard` + `BadgesGrid` (écran Progression),
`DayValidatedToast` + `AchievementUnlocks` (bandeaux / fenêtre de déblocage).

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

---

## 6. Git — comment on travaille

- Repo : `https://github.com/gusdevst/projetappv0` (public, handle `gusdevst`).
- **Branche de référence = `main`** (la plus à jour ; `retourbeta` y est déjà intégrée).
- Branche de travail actuelle : `feature/themes` (un commit par petite étape = points de sauvegarde).
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
6. **Avant TestFlight du thème** : retirer `IconsBoard` de Réglages ; passer la couleur des
   notifications (`app.json`, `#2e4d7a` ardoise) en vert sauge ; champs `TextInput` hors
   Accueil pas encore en Outfit.

---

## 8. Prochaines étapes probables

0. **Thème sauge** (§12) : écran Progression, puis maquette + code écran par écran
   (Swipe en priorité, Bilan, Même instant, Galerie, Réglages, Rappels, Carte, Partenaires, Onboarding).
   Plus tard : choix de la couleur par l'utilisateur (le mécanisme `PALETTES` est prêt).
1. Build TestFlight de `feature/progression` et test sur plusieurs jours
   (rappels datés, série, déblocages).
2. Fusionner `feature/progression` dans `main` (`git merge --ff-only`).
3. Nettoyer le repo (dossiers pollués, `Claude outputs/`) et les branches mortes.
4. Gamification étape D : points + récompenses partenaires → **nécessite un serveur**.
5. Brancher RevenueCat (Premium), backend pour l'IA "Album IA".

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
- En-tête : logo + « Pellicule » à **gauche**, ⚙️ à **droite**. Sous-titre « Tes souvenirs méritent mieux » supprimé.
- Héros Tri : « Ta galerie est triée dans ≈ X jours » ; « à raison d'une session de [30 ▾] photos par jour »
  → la pastille ouvre 10/20/30/40/50 (même réglage `randomCount` que Réglages, défaut **30**).
- Bouton principal : « Lancer un tri » (+ nombre de photos dessous).
- **Bouton 🔀 façon Spotify** à gauche du bouton : éteint = gris ; allumé = vert (pas de point,
  pas de bandeau) et le bouton devient « Lancer un tri aléatoire · N photos au hasard ».
  État `shuffleOn` persisté. Pas de ligne « Aléatoire » dans la liste (trop lourd).
- Mode Tri : **plus de pastilles de filtres**. Dates → « Par date » (calendrier + raccourcis
  7 derniers jours / Mois dernier / année en cours). Screenshots + dossiers → « Dossiers »
  (sous-titre « Screenshots et dossiers du téléphone »).
- Mode Album : filtres Toutes / 2026 / Dossier gardés, mosaïque 1+2, « + Nouvel album », menu ···.

