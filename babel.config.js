// babel.config.js
// Préréglage Expo requis pour transformer le code de l'app.
// IMPORTANT : babel-preset-expo (SDK 54) inclut automatiquement le plugin
// react-native-worklets/plugin nécessaire à react-native-reanimated 4
// (utilisé par ZoomableImage — le cœur du swipe). Sans ce fichier, le swipe
// peut planter sur le build EAS ("worklet" / écran figé).
//
// On résout babel-preset-expo depuis le dossier d'expo plutôt que par son nom :
// dans ce projet il n'est pas "hissé" à la racine de node_modules, et un nom nu
// ("babel-preset-expo") échouerait à la résolution, en local comme sur EAS.
const path = require("path");
const presetExpo = require.resolve("babel-preset-expo", {
  paths: [path.dirname(require.resolve("expo/package.json"))],
});

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [presetExpo],
  };
};
