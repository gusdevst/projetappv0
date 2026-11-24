# Transfert de Pellicule vers mon compte Claude perso

> Kit préparé le 24 nov. 2026. À supprimer une fois le transfert fini.
> Le code, Git, Supabase, Expo ne bougent pas : seul « Claude » change de compte.

## ⚠️ Le Mac est celui de malibou : il sera rendu
**Sur GitHub (sauvé dès que c'est poussé)** : tout le code, `CLAUDE.md`, `.claude/skills/`, les tutos, `supabase/` (SQL + fonctions).
**Seulement sur ce Mac (à sauver à la main)** : `Claude outputs/` (59 maquettes) → `SAUVEGARDE-maquettes-Claude-outputs.zip`.
**Se recrée tout seul sur le nouveau Mac** : `node_modules/` (`npm install`), `ios/` (`npx expo prebuild`), `.expo/`, `supabase/.temp/` (`npx supabase link`).
**Aucun secret sur le disque** : clés dans Supabase (secrets), certificats et keystore chez EAS (Expo).
**À vérifier** : mots de passe enregistrés dans le Trousseau / navigateur du Mac malibou (Expo, Supabase, Apple, GitHub, imprimeur.fr).

## Plan, une étape à la fois
1. Sauver les maquettes (zip → cloud perso).
2. Commit + push depuis VS Code (CLAUDE.md, test, ce fichier).
3. Vérifier que j'ai mes mots de passe hors de ce Mac.
4. Claude perso : projet « Pellicule » + instructions (bloc A) + mémoire (bloc B).
5. Nouveau Mac : installer les outils, cloner, `npm install`, se reconnecter (EAS, Supabase), relancer le simulateur.
6. Test : premier message (fin du fichier).
7. Nettoyage côté malibou : effacer le dossier du Mac, retirer Pellicule de la mémoire du compte malibou.

## Ce qui reste sur le compte malibou (à recopier)
1. Les instructions du projet « Pellicule » → bloc A.
2. Ce que Claude sait de moi sur Pellicule (mémoire) → bloc B.
3. Une idée notée hors CLAUDE.md → bloc C.
4. L'historique des conversations : **ne se transfère pas**. CLAUDE.md le remplace.

---

## Bloc A — Instructions du projet (à coller tel quel)

```
Projet Pellicule (ex-Phototri) : app mobile React Native / Expo de tri de photos.
Je ne suis PAS développeur — sois ultra pédagogue, mais sans blabla.

AU DÉBUT DE CHAQUE SESSION : lis le fichier CLAUDE.md à la racine du repo
(Documents/phototri/). Il contient l'état du projet, la carte du code et les dettes.
Ne re-scanne pas tout le code, appuie-toi dessus.

Repo GitHub : github.com/gusdevst/projetappv0 (branche de référence : main).
Je commit et push moi-même depuis VS Code — ne push jamais depuis le shell.

Règles de travail (non négociables) :
- Phrases courtes, pas de mots de remplissage, ne narre pas.
- UNE étape à la fois, puis attends ma validation.
- Explique le POURQUOI avec des métaphores concrètes.
- Toujours le chemin exact du fichier + ce que je dois copier/coller.
- Pas de gros dumps de code. Vérifie la cohérence imports/exports.
- Agis comme un CTO senior qui forme un junior. En français.
- Ne modifie jamais mes textes / formulations sans mon accord explicite.
```

Liens à attacher au projet : `https://github.com/gusdevst/projetappv0`

## Bloc B — Mémoire à importer (coller dans le 1er message, avec « mémorise ça »)

```
Mémorise ces faits sur moi et mon projet :
- Je développe Pellicule (ex-Phototri), app mobile de tri de photos (React Native / Expo, iOS + Android).
- Je ne suis pas développeur, j'apprends React Native et Git.
- Je n'ai pas d'iPhone : je teste les betas iOS via TestFlight sur l'iPhone de ma femme, et sur le simulateur iOS du Mac. Je teste Android sur mon propre téléphone (app de dev EAS).
- Le back-end est sur Supabase (comptes, commandes, abonnements).
- Imprimeur choisi : imprimeur.fr (Gelato mis de côté).
- Je valide les maquettes HTML avant chaque écran.
- Ne jamais modifier mes formulations sans mon accord.
```

## Bloc C — Idée pas encore dans CLAUDE.md

« Gestion doublon » : pendant le swipe, une bande de miniatures au-dessus des boutons
si des photos similaires (prises à moins de 5 min) arrivent dans les ~20 prochaines photos.
Libellé « X photos similaires arrivent → ». Point de départ : `similarPhotos` dans `SwipeScreen`.

## Premier message à envoyer sur le compte perso

```
Lis CLAUDE.md à la racine de Documents/phototri et TRANSFERT-CLAUDE-PERSO.md.
Dis-moi en 5 lignes où on en est et ce qui reste à tester.
```
