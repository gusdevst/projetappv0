// Les pages du tuto : UNE seule source, utilisée par l'onboarding (premier lancement)
// ET par Réglages → « Tutoriel ». Maquette validée : Claude outputs/maquette-tuto-onboarding.html.
//
// Champs d'une page :
//   visual  : "logo" | "swipe" | "bell" | "bar" | "heart" | "darkroom" | "user" | "lock"  (voir components/TutorialSlide.js)
//   title   : titre
//   body    : liste de blocs de texte. « \n » = retour à la ligne (une phrase par ligne).
//             **gras** ; {{pastille}} en fin de bloc = petite pastille orange (ex. « bientôt »).
//   list    : true = blocs alignés à gauche, séparés (listes) ; sinon texte centré.
//   cta     : texte du gros bouton (défaut : « Continuer ») — seulement dans l'onboarding
//   later   : lien « Plus tard » sous le bouton — seulement dans l'onboarding
//   foot    : petite note sous le bouton — seulement dans l'onboarding
//   notif   : le bouton demande l'autorisation des notifications et active le rappel quotidien
//   account : le bouton ouvre l'écran de connexion / création de compte
//   final   : le bouton demande l'accès aux photos (dernière page)
export const TUTORIAL_SLIDES = [
  {
    visual: "logo",
    title: "Bienvenue sur Pellicule",
    body: ["Vide ta photothèque sans y passer des heures.\nUn geste par photo, quelques minutes par jour."],
  },
  {
    visual: "swipe",
    title: "Un geste par photo",
    body: [
      "Swipe la photo vers une action, ou touche l'action écrite au bord : garder, supprimer ou décider plus tard.\nTu peux aussi la partager à un proche d'un simple swipe.\nUne erreur ? Tu peux annuler.\nLes gestes se règlent dans les Réglages.",
    ],
  },
  {
    visual: "bell",
    title: "Un rappel pour ne pas lâcher",
    body: ["Trie au moins 10 photos par jour pour faire grimper ta série 🔥.\nPellicule te le rappelle à l'heure que tu choisis."],
    cta: "Activer les rappels",
    later: "Plus tard",
    foot: "Tu pourras changer l'heure et la fréquence à tout moment.",
    notif: true,
  },
  {
    visual: "bar",
    title: "Deux modes, un seul bouton",
    body: ["Touche le bouton ⇄ au centre de la barre pour créer tes albums souvenirs.\nTu pourras ensuite imprimer chaque album en livre photo."],
  },
  {
    visual: "heart",
    title: "Le ❤️, pour tes plus belles photos",
    body: [
      "Pendant le tri, touche le ❤️ sur celles que tu adores.\nElles vont dans ta Chambre noire, dans l'onglet Galerie : c'est là qu'elles deviennent des tirages, des magnets ou un livre photo.",
    ],
  },
  {
    visual: "darkroom",
    title: "La Chambre noire",
    list: true,
    body: [
      "**Coups de cœur** : tes photos à imprimer. {{bientôt}}",
      "**Livres photo** : compose ton livre 21 × 28 cm. {{commande bientôt}}",
      "**Abonnement** : chaque mois, Pellicule te propose une sélection de tes coups de cœur.\nTu la reçois chez toi en magnets ou en tirages.",
    ],
  },
  {
    visual: "user",
    title: "Un compte, si tu veux",
    list: true,
    body: ["•  Suivre ta progression", "•  Imprimer tes photos", "•  T'abonner"],
    cta: "Créer mon compte",
    later: "Plus tard",
    account: true,
  },
  {
    visual: "lock",
    title: "Ce dont Pellicule a besoin",
    list: true,
    body: [
      "**Tes photos** : pour te les montrer et les trier.\nChoisis « Toutes les photos » pour que rien ne manque.",
      "**Les notifications** : pour tes rappels, facultatif.",
      "Le tri reste sur ton téléphone.\nUne photo n'en sort que si tu la valides pour l'impression.",
    ],
    cta: "Autoriser l'accès aux photos",
    foot: "Tu peux changer ce choix dans les Réglages de ton téléphone.",
    final: true,
  },
];
