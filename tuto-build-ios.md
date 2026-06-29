# 📱 Tuto Build iOS — Pellicule (pour Augustin)

> **Contexte :** ton app s'appelle "Pellicule", bundle ID `com.phototri.app`, stack Expo + EAS Build.  
> Ce tuto couvre la création du build TestFlight (bêta privée).

---

## Prérequis — à avoir AVANT de commencer

- [ ] Un compte **Apple Developer** actif (99 $/an sur developer.apple.com)
- [ ] **EAS CLI** installé (`npm install -g eas-cli`)
- [ ] Être connecté à EAS (`eas login`)
- [ ] Ton projet est à jour sur GitHub (branche `main` propre)

---

## Étape 1 — Vérifier que ton eas.json est prêt

Ouvre `/phototri/eas.json`. Le profil `preview` actuel ressemble à ça :

```json
"preview": {
  "distribution": "internal",
  "android": {
    "buildType": "apk"
  }
}
```

Pour iOS TestFlight, **ajoute la ligne iOS** pour que le profil ressemble à :

```json
"preview": {
  "distribution": "internal",
  "android": {
    "buildType": "apk"
  },
  "ios": {
    "simulator": false
  }
}
```

> **Pourquoi ?** Sans ça, EAS ne sait pas comment préparer le build iOS.

---

## Étape 2 — Connecter ton Apple Developer Account à EAS

Dans le terminal, à la racine du projet :

```bash
eas credentials
```

- Choisis **iOS**
- Choisis **Build Credentials**
- EAS va te demander de te connecter à ton Apple Developer Account
- Il va créer automatiquement les certificats et provisioning profiles (c'est lui qui gère tout)

> **Métaphore :** EAS est comme un notaire — il prépare tous les papiers officiels Apple à ta place.

---

## Étape 3 — Créer l'app dans App Store Connect

1. Va sur [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Clique **"Mes apps"** → **"+"** → **Nouvelle app**
3. Remplis :
   - **Plateforme** : iOS
   - **Nom** : Pellicule
   - **Langue principale** : Français
   - **Bundle ID** : `com.phototri.app` (doit correspondre exactement à ton app.json)
   - **SKU** : `pellicule-app` (identifiant interne, pas visible par les users)
4. Clique **Créer**

> **Pourquoi ?** Apple a besoin que l'app existe dans leur système avant de recevoir ton build.

---

## Étape 4 — Lancer le build iOS

Dans le terminal, à la racine du projet :

```bash
eas build --platform ios --profile preview
```

EAS va :
1. Uploader ton code sur ses serveurs
2. Compiler l'app (prend ~10-15 min)
3. Te donner un lien pour suivre le build en live

Tu peux suivre la progression sur [expo.dev](https://expo.dev) → ton projet.

> **Note :** Le build se passe sur les serveurs d'Expo, pas sur ton Mac. Tu peux fermer le terminal une fois qu'il a uploadé.

---

## Étape 5 — Envoyer le build sur TestFlight

Une fois le build terminé, dans le terminal :

```bash
eas submit --platform ios --latest
```

EAS va envoyer automatiquement le `.ipa` (le fichier de l'app iOS) vers App Store Connect.

> **Métaphore :** C'est comme envoyer un colis chez Apple — ils vont le vérifier avant de le mettre à disposition de tes testeurs.

Après environ **15-30 minutes**, Apple traite le build et il apparaît dans l'onglet **TestFlight** de ton app sur App Store Connect.

---

## Étape 6 — Ajouter tes testeurs

Dans App Store Connect → **TestFlight** → **Testeurs internes** :

1. Clique **"+"**
2. Entre l'adresse email Apple ID du testeur
3. Le testeur reçoit une invitation par email

Pour des testeurs **externes** (jusqu'à 10 000 personnes) :
- **TestFlight** → **Testeurs externes** → crée un groupe
- Attention : Apple fait une review légère (~1-2 jours) avant l'activation

---

## Résumé des commandes

```bash
# 1. Se connecter
eas login

# 2. Gérer les certificats Apple
eas credentials

# 3. Builder
eas build --platform ios --profile preview

# 4. Soumettre à TestFlight
eas submit --platform ios --latest
```

---

## En cas de problème fréquent

| Erreur | Solution |
|--------|----------|
| "Bundle ID not found" | Vérifier que l'app est créée dans App Store Connect avec le bon Bundle ID |
| "Provisioning profile expired" | Relancer `eas credentials` et laisser EAS renouveler |
| Build échoué | Aller sur expo.dev, cliquer sur le build en erreur, lire les logs |
| "Missing push notification entitlement" | Normal pour une bêta, ignorer |
