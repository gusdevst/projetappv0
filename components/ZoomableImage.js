// components/ZoomableImage.js
// Photo zoomable avec pinch, pan, double-tap et swipe 4 directions.
//
// Props :
//   uri           : string — URL de la photo
//   onSwipeLeft   : () => void — swipe vers la gauche (photo non zoomée)
//   onSwipeRight  : () => void — swipe vers la droite
//   onSwipeUp     : () => void — swipe vers le haut
//   onSwipeDown   : () => void — swipe vers le bas
//
// Ref (imperatif) :
//   flyOff(dir, callback) — anime la carte hors écran dans la direction donnée
//                           ("left" | "right" | "up" | "down"), puis appelle callback()
//
// Nécessite react-native-gesture-handler + react-native-reanimated.
// L'app racine doit être wrappée dans <GestureHandlerRootView> (cf. App.js).

import { forwardRef, useEffect, useImperativeHandle } from "react";
import { Dimensions } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const { width: SW, height: SH } = Dimensions.get("window");

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const SWIPE_THRESHOLD = 80;
const FLY_DURATION = 280;

export const ZoomableImage = forwardRef(function ZoomableImage(
  { uri, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, style },
  ref
) {
  const scale      = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX     = useSharedValue(0);
  const savedY     = useSharedValue(0);

  // Reset complet à chaque changement de photo
  useEffect(() => {
    scale.value      = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedX.value     = 0;
    savedY.value     = 0;
  }, [uri]);

  // ── Méthode imperative : flyOff(dir, callback) ─────────────────────────────
  // Permet aux boutons (🗑, 🖨) de déclencher l'animation depuis l'extérieur.
  useImperativeHandle(ref, () => ({
    flyOff: (dir, callback) => {
      const toX = dir === "left" ? -SW * 1.5 : dir === "right" ? SW * 1.5 : 0;
      const toY = dir === "up"   ? -SH * 1.5 : dir === "down"  ? SH * 1.5 : 0;

      translateX.value = withTiming(toX, { duration: FLY_DURATION }, (finished) => {
        if (finished) {
          if (callback) runOnJS(callback)();
          translateX.value = 0;
          translateY.value = 0;
        }
      });
      translateY.value = withTiming(toY, { duration: FLY_DURATION });
    },
  }));

  // ── Pinch — zoomer / dézoomer ──────────────────────────────────────────────
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= MIN_SCALE) {
        scale.value      = withTiming(MIN_SCALE);
        savedScale.value = MIN_SCALE;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedX.value     = 0;
        savedY.value     = 0;
      }
    });

  // ── Pan — déplacer (zoomée) ou swiper (non zoomée) ────────────────────────
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        // Zoomée : on déplace la photo
        translateX.value = savedX.value + e.translationX;
        translateY.value = savedY.value + e.translationY;
      } else {
        // Non zoomée : on suit le doigt pour prévisualiser le swipe
        translateX.value = e.translationX;
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (scale.value > 1) {
        savedX.value = translateX.value;
        savedY.value = translateY.value;
        return;
      }

      const absX = Math.abs(e.translationX);
      const absY = Math.abs(e.translationY);

      // Seuil non atteint → rebond au centre
      if (absX < SWIPE_THRESHOLD && absY < SWIPE_THRESHOLD) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        return;
      }

      // Détermine direction dominante, puis anime la sortie + appelle le callback
      const flyAndCall = (toX, toY, callback) => {
        if (callback) {
          translateX.value = withTiming(toX, { duration: FLY_DURATION }, (finished) => {
            if (finished) {
              runOnJS(callback)();
              translateX.value = 0;
              translateY.value = 0;
            }
          });
          translateY.value = withTiming(toY, { duration: FLY_DURATION });
        } else {
          // Pas de callback (direction non mappée) → rebond
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
        }
      };

      if (absX >= absY) {
        if (e.translationX < 0) flyAndCall(-SW * 1.5, 0, onSwipeLeft);
        else                    flyAndCall(SW * 1.5,  0, onSwipeRight);
      } else {
        if (e.translationY < 0) flyAndCall(0, -SH * 1.5, onSwipeUp);
        else                    flyAndCall(0,  SH * 1.5,  onSwipeDown);
      }
    });

  // ── Double-tap — toggle zoom 1x / 2x ──────────────────────────────────────
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(280)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value      = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value     = 0;
        savedY.value     = 0;
      } else {
        scale.value      = withTiming(2);
        savedScale.value = 2;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => {
    // Légère rotation pendant le swipe horizontal (uniquement quand non zoomée)
    const rotateDeg =
      scale.value <= 1
        ? interpolate(
            translateX.value,
            [-SW / 2, 0, SW / 2],
            [-15, 0, 15],
            Extrapolation.CLAMP
          )
        : 0;

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { rotate: `${rotateDeg}deg` },
      ],
    };
  });

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          {
            width: SW,
            height: SH,
            alignItems: "center",
            justifyContent: "center",
          },
          animatedStyle,
          style,
        ]}
      >
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
});
