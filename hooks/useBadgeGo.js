// hooks/useBadgeGo.js
// Où mène le bouton d'un badge du Labo (cta.to dans services/achievements.js).
// Partagé par l'écran Progression, la brique du Labo, le Bilan et la fenêtre de déblocage.
import { useNavigation } from "@react-navigation/native";

export function useBadgeGo() {
  const navigation = useNavigation();
  return (to) => {
    if (to === "prints") navigation.navigate("PrintNew");
    else if (to === "poster") navigation.navigate("PosterIntro");
    else if (to === "abo") navigation.navigate("SubscriptionIntro");
    else navigation.navigate("Main", { screen: "GalleryTab" }); // « labo » : livres et tirages se créent dans le Labo
  };
}
