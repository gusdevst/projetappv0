# Notes pour l'App Review Apple — Pellicule

## Où coller ça

App Store Connect → ta fiche app → onglet **App Review** → section **App Review Information** → champ **Notes**.

C'est un champ privé : seul l'examinateur Apple le voit, jamais les utilisateurs. Limite : 300 caractères.

## Pourquoi c'est utile ici

Ton app demande l'accès complet à la photothèque (lecture + suppression). C'est le genre de permission qu'Apple scrute de près. Expliquer clairement à quoi ça sert évite un rejet ou un aller-retour avec l'équipe de review.

## Texte à copier-coller (français, 300 caractères max)

```
Pellicule aide à trier sa photothèque : swipe pour garder ou supprimer, détection des doublons, regroupement par date et lieu. Aucun compte, aucun serveur : tout est traité localement. Accès photos requis pour trier/supprimer ; localisation lue depuis les métadonnées des photos.
```

(279 caractères — marge de sécurité sous la limite de 300.)

## Explication rapide

- **Pas de compte** : tu le dis clairement, ça rassure l'examinateur (pas besoin de credentials de test).
- **Tout en local** : gros point pour la confidentialité, Apple aime ça, et c'est vrai — Pellicule n'a pas de serveur.
- **Justification des permissions** : chaque permission (photos, localisation, notifications) est reliée à une fonctionnalité précise. C'est le point le plus important du texte.
- **Instructions de test** : un examinateur qui sait où cliquer valide plus vite.

## À vérifier avant de soumettre

Assure-toi que les fonctionnalités décrites correspondent à ce qui est vraiment actif dans la version envoyée (par exemple si "Reconnaissance des visages" ou "Partenaires impression" sont encore marqués "Bientôt disponible" dans l'app, ne les présente pas comme fonctionnels dans les notes).
