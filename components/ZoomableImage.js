// components/ZoomableImage.js
// Affiche une photo avec pinch-to-zoom, pan (déplacement quand zoomée),
// double-tap (toggle 1x ↔ 2x), et swipe horizontal pour naviguer entre photos
// (uniquement quand non-zoomée).
//
// Props :
//   - uri          : string — URL de la photo
//   - onSwipeNext  : () => void — appelé sur swipe gauche (photo non zoomée)
//   - onSwipePrev  : () => void — appelé sur swipe droite (photo non zoomée)
//
// Nécessite react-native-gesture-handler + react-native-reanimated installés
// et que l'app racine soit wrappée dans <GestureHandlerRootView> (cf. App.js).

import { useEffect } from "react";
import { Image, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const { width: SW, height: SH } = Dimensions.get("window");

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const SWIPE_THRESHOLD = 80;

export function ZoomableImage({ uri, onSwipeNext, onSwipePrev, style }) {
  const scale       = useSharedValue(1);
  const savedScale  = useSharedValue(1);
  const translateX  = useSharedValue(0);
  const translateY  = useSharedValue(0);
  const savedX      = useSharedValue(0);
  const savedY      = useSharedValue(0);

  // Reset complet à chaque changement de photo (navigation)
  useEffect(() => {
    scale.value       = 1;
    savedScale.value  = 1;
    translateX.value  = 0;
    translateY.value  = 0;
    savedX.value      = 0;
    savedY.value      = 0;
  }, [uri]);

  // Pinch pour zoomer
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = savedScale.value * e.scale;
      scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
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

  // Pan — quand zoomée, déplace l'image ; sinon, swipe horizontal pour naviguer
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedX.value + e.translationX;
        translateY.value = savedY.value + e.translationY;
      } else {
        // Non zoomée — on suit le doigt horizontalement seulement (preview swipe)
        translateX.value = e.translationX;
      }
    })
    .onEnd((e) => {
      if (scale.value > 1) {
        savedX.value = translateX.value;
        savedY.value = translateY.value;
      } else {
        if (e.translationX < -SWIPE_THRESHOLD && onSwipeNext) {
          runOnJS(onSwipeNext)();
          translateX.value = withTiming(0, { duration: 150 });
        } else if (e.translationX > SWIPE_THRESHOLD && onSwipePrev) {
          runOnJS(onSwipePrev)();
          translateX.value = withTiming(0, { duration: 150 });
        } else {
          translateX.value = withSpring(0);
        }
      }
    });

  // Double-tap → toggle zoom 1x / 2x
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

  // Composition : pinch + pan + double-tap actifs en parallèle
  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          { width: SW, height: SH, alignItems: "center", justifyContent: "center" },
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
}
