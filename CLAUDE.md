# Pellicule — Contexte projet & instructions IA

> Fichier de passation. Lu en début de session pour retrouver l'état du projet
> sans re-scanner tout le code. **À maintenir à jour** à chaque étape importante.
> Dernière mise à jour : 2026-10-13.

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

## 2. État actuel (au 2026-09-21)

- Dernière vraie activité de code : **7 juillet 2026** (~2 mois de pause).
- Dernier commit : `57779fe "notifs"` — a branché la **demande d'autorisation
  des notifications dans l'onboarding** (`screens/OnboardingScreen.js`).
- **Travail en cours NON commité** sur la branche `check-swipe-tutorial-coherence` :
  7 fichiers modifiés (tutoriel + onboarding + carte + réglages + store).
  → à sécuriser en priorité, risque de perte.

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
  react-native-webview, **react-native-purchases (RevenueCat — installé mais PAS encore branché)**.

---

## 4. Carte du code (où trouver quoi)

Racine : `/Users/augustindevasselot/Documents/phototri/`

- `App.js` — point d'entrée unique. Monte la navigation, vérifie la permission
  photo au démarrage, gère le tap sur une notif (→ lance une session de tri).
- `index.js` — bootstrap Expo.
- `app.json` — config app + build (permissions, plugins, icône).
- `eas.json` — profils de build EAS (development / preview / production).

**navigation/**
- `AppNavigator.js` — déclare les 13 écrans. Un seul NavigationContainer (dans App.js).

**store/**
- `usePhotoStore.js` (~474 l.) — **cerveau de l'app**. État du tri, filtres albums,
  réglages de rappels, flags "vu une fois". Persisté via AsyncStorage.

**screens/** (13)
- `OnboardingScreen` · `PermissionDeniedScreen` — arrivée + permissions.
- `HomeScreen` (~906 l.) · `TriModeScreen` — accueil + choix du mode de tri.
- `SwipeScreen` (~668 l.) — le tri par swipe (cœur de l'app).
- `GalleryScreen` (~864 l.) · `MomentScreen` — galerie / albums / moments.
- `DuplicatesScreen` (~668 l.) — détection et tri des doublons.
- `MapScreen` — tri par lieu (GPS).
- `RappelsScreen` — réglage des notifications de rappel.
- `SummaryScreen` — bilan de session.
- `SettingsScreen` · `PartenairesScreen` — réglages + partenaires impression.

**components/** — briques UI réutilisables : `BackButton`, `Toggle`, `PhotoGrid`,
`ZoomableImage`, `RowSetting`, `AlbumFiltersBar`, `SessionTutoOverlay` (overlay tuto).

**services/** — logique métier, pas d'UI :
- `photoLibrary.js` — wrapper expo-media-library (permission, chargement, suppression).
- `photoAnalysis.js` — calculs purs sur les photos (pas d'I/O).
- `notificationService.js` — rappels locaux "pense à trier".
- `gpsCache.js` — cache persistant des coordonnées GPS.

**hooks/** — `useAndroidBack` (bouton retour Android), `useNotificationReminder`
(logique d'activation des rappels, partagée).

**constants/** — `theme.js` (couleurs `C`, styles `S`).

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
- Branche de travail actuelle : `check-swipe-tutorial-coherence` (= main + 7 fichiers WIP).
- Branches plus anciennes (juin) probablement abandonnées : `fix/stabilisation-beta`,
  `feature/notifications`, `feature/couleurs`. À nettoyer un jour.
- **Augustin commit et push lui-même depuis VS Code.** Ne pas push depuis le shell.
- Messages de commit à soigner (éviter "notifs", "cache" → dur à relire 2 mois après).

---

## 7. Dettes connues (à traiter, non bloquant)

1. **Repo pollué** : des dossiers d'outils IA sont suivis par Git alors qu'ils ne
   devraient pas — `claude-code/` (41 Mo, avec son propre `.git`), `.gemini/`,
   `.qoder/`, `.kiro/`. À sortir du suivi Git (`git rm -r --cached` + `.gitignore`).
2. **6 branches** : clarifier / supprimer les mortes.
3. **RevenueCat installé mais pas configuré** (`Purchases.configure` absent) → le
   Premium payant n'est pas encore actif.
4. **Écrans très longs** (`HomeScreen` 906 l., `GalleryScreen` 864 l.) → à découper
   en composants quand on y retouchera.

---

## 8. Prochaines étapes probables

1. Sécuriser le WIP (commit des 7 fichiers).
2. Relancer l'app sur téléphone pour confirmer que rien n'a bougé après 2 mois.
3. Nettoyer le repo (dossiers pollués) et les branches.
4. Finir le tutoriel / onboarding (le chantier en cours).
5. Plus tard : brancher RevenueCat (Premium), backend pour l'IA "Album IA".

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

## 10. Session 12-13 oct. 2026 (branche `octobre27`, non commité)

- Partage HD par swipe (action "share" réglable) → `services/photoShare.js`, `ZoomableImage` prop `bounceDirs`.
- Dates 1970 : repli sur `modificationTime` dans `services/photoLibrary.js`.
- Accueil Tri : carte objectif (jours restants, mois dès 180 j), barre de stats supprimée,
  briques "Par date" (calendrier direct, `components/RangeCalendarPicker.js`) + "Même instant" (ex-Doublons, icône 📷),
  lignes Corbeille (Vider + compteur `freedMo` Go libérés) et Rappel (interrupteur). Par lieu / Par visage supprimés.
- Accueil Album : carte "Ton prochain album" (mosaïque), filtre ❤️ en pastille, liste "Mes albums"
  (Coups de cœur = album auto en tête, menu ··· renommer/supprimer), partenaires réduits à un bandeau.
- Par lieu (🌍) revenu en mode Album uniquement (carte agrandie). Écran orphelin : `MomentScreen`.
