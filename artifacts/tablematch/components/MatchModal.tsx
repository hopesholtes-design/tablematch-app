import React, { useEffect } from "react";
import {
  Dimensions,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import type { Restaurant } from "@/context/SessionContext";

interface Props {
  restaurant: Restaurant;
  onKeepSwiping: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export function MatchModal({ restaurant, onKeepSwiping }: Props) {
  const colors = useColors();
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const titleScale = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200 });
    scale.value = withDelay(100, withSpring(1, { damping: 12, stiffness: 100 }));
    titleScale.value = withDelay(400, withSequence(
      withSpring(1.2, { damping: 8 }),
      withSpring(1, { damping: 12 })
    ));

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: titleScale.value }],
  }));

  const openMaps = () => {
    Linking.openURL(restaurant.mapsLink);
  };

  return (
    <Animated.View style={[styles.overlay, containerStyle]}>
      <LinearGradient
        colors={["rgba(0,0,0,0.85)", "rgba(0,0,0,0.95)"]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.card, cardStyle, { backgroundColor: colors.card }]}>
        <Image
          source={{ uri: restaurant.photo }}
          style={styles.photo}
          resizeMode="cover"
        />

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.7)"]}
          style={styles.photoGradient}
        />

        <View style={styles.content}>
          <Animated.View style={titleStyle}>
            <Text style={styles.matchEmoji}>It's a Match!</Text>
          </Animated.View>
          <Text style={styles.subtitle}>You both liked this place</Text>

          <View style={styles.restaurantInfo}>
            <Text style={[styles.restaurantName, { color: colors.foreground }]}>
              {restaurant.name}
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.chip}>
                <Ionicons name="restaurant-outline" size={13} color={colors.primary} />
                <Text style={[styles.chipText, { color: colors.mutedForeground }]}>
                  {restaurant.cuisine}
                </Text>
              </View>
              <View style={styles.chip}>
                <Ionicons name="star" size={13} color="#FFB800" />
                <Text style={[styles.chipText, { color: colors.mutedForeground }]}>
                  {restaurant.rating.toFixed(1)}
                </Text>
              </View>
              {restaurant.price ? (
                <View style={styles.chip}>
                  <Text style={[styles.chipText, { color: colors.primary }]}>
                    {restaurant.price}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.address, { color: colors.mutedForeground }]} numberOfLines={2}>
              {restaurant.address}
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.mapsButton, { backgroundColor: colors.primary }]}
              onPress={openMaps}
              activeOpacity={0.85}
            >
              <Ionicons name="map" size={20} color="#fff" />
              <Text style={styles.mapsButtonText}>Open in Maps</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.keepButton, { borderColor: colors.border }]}
              onPress={onKeepSwiping}
              activeOpacity={0.75}
            >
              <Text style={[styles.keepButtonText, { color: colors.foreground }]}>
                Keep Swiping
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  photo: {
    width: "100%",
    height: 220,
  },
  photoGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  content: {
    padding: 24,
    gap: 8,
  },
  matchEmoji: {
    fontSize: 32,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
    color: "#FF6B6B",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#888",
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  restaurantInfo: {
    gap: 8,
    marginBottom: 8,
  },
  restaurantName: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  address: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  mapsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  mapsButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  keepButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  keepButtonText: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },
});
