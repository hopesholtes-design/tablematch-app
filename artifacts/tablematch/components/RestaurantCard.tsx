import React, { useRef } from "react";
import {
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import type { Restaurant } from "@/context/SessionContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

interface Props {
  restaurant: Restaurant;
  onSwipe: (liked: boolean) => void;
  isTop: boolean;
  index: number;
}

export function RestaurantCard({ restaurant, onSwipe, isTop, index }: Props) {
  const colors = useColors();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const swiped = useRef(false);

  const triggerSwipe = (liked: boolean) => {
    if (swiped.current) return;
    swiped.current = true;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(liked ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    }
    onSwipe(liked);
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.4;
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 300 });
        runOnJS(triggerSwipe)(true);
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 300 });
        runOnJS(triggerSwipe)(false);
      } else {
        translateX.value = withSpring(0, { damping: 15 });
        translateY.value = withSpring(0, { damping: 15 });
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-20, 0, 20],
      Extrapolate.CLAMP
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD * 0.5], [0, 1], Extrapolate.CLAMP),
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD * 0.5, 0], [1, 0], Extrapolate.CLAMP),
  }));

  const stackScale = 1 - index * 0.04;
  const stackTranslateY = index * -10;

  if (!isTop) {
    return (
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale: stackScale }, { translateY: stackTranslateY }],
            zIndex: -index,
            backgroundColor: colors.card,
          },
        ]}
      >
        <Image source={{ uri: restaurant.photo }} style={styles.image} />
        <View style={[styles.info, { backgroundColor: colors.card }]}>
          <Text style={[styles.name, { color: colors.foreground }]}>{restaurant.name}</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, cardStyle, { backgroundColor: colors.card, zIndex: 10 }]}>
        <Image source={{ uri: restaurant.photo }} style={styles.image} resizeMode="cover" />

        {/* Like overlay */}
        <Animated.View style={[styles.overlay, styles.likeOverlay, likeOpacity]}>
          <View style={[styles.badge, { borderColor: "#4CAF50" }]}>
            <Ionicons name="heart" size={28} color="#4CAF50" />
            <Text style={[styles.badgeText, { color: "#4CAF50" }]}>LIKE</Text>
          </View>
        </Animated.View>

        {/* Nope overlay */}
        <Animated.View style={[styles.overlay, styles.nopeOverlay, nopeOpacity]}>
          <View style={[styles.badge, { borderColor: "#F44336" }]}>
            <Ionicons name="close" size={28} color="#F44336" />
            <Text style={[styles.badgeText, { color: "#F44336" }]}>NOPE</Text>
          </View>
        </Animated.View>

        {/* Info */}
        <View style={[styles.info, { backgroundColor: colors.card }]}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {restaurant.name}
            </Text>
            <View style={styles.rating}>
              <Ionicons name="star" size={14} color="#FFB800" />
              <Text style={[styles.ratingText, { color: colors.foreground }]}>{restaurant.rating.toFixed(1)}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={[styles.cuisine, { color: colors.mutedForeground }]}>{restaurant.cuisine}</Text>
            {restaurant.price ? (
              <Text style={[styles.price, { color: colors.primary }]}>{restaurant.price}</Text>
            ) : null}
          </View>

          <Text style={[styles.address, { color: colors.mutedForeground }]} numberOfLines={1}>
            {restaurant.address}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    width: SCREEN_WIDTH - 32,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: 380,
  },
  overlay: {
    position: "absolute",
    top: 24,
    padding: 8,
    zIndex: 20,
  },
  likeOverlay: {
    left: 20,
    transform: [{ rotate: "-15deg" }],
  },
  nopeOverlay: {
    right: 20,
    transform: [{ rotate: "15deg" }],
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  badgeText: {
    fontSize: 18,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
  },
  info: {
    padding: 16,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    flex: 1,
    marginRight: 8,
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cuisine: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  price: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  address: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
