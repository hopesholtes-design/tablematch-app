import React, { useCallback, useEffect } from "react";
import {
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSession } from "@/context/SessionContext";
import { RestaurantCard } from "@/components/RestaurantCard";
import { MatchModal } from "@/components/MatchModal";
import { router } from "expo-router";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function SwipeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    restaurants,
    currentIndex,
    matchedRestaurant,
    allMatches,
    connectionStatus,
    partnerSwiping,
    swipe,
    dismissMatch,
    userCount,
    disconnect,
    sessionId,
  } = useSession();

  const nopeScale = useSharedValue(1);
  const likeScale = useSharedValue(1);

  // If not in a session, go back to home
  useEffect(() => {
    if (!sessionId && connectionStatus === "idle") {
      router.replace("/");
    }
  }, [sessionId, connectionStatus]);

  const handleSwipe = useCallback((liked: boolean) => {
    const restaurant = restaurants[currentIndex];
    if (!restaurant) return;
    swipe(restaurant.id, liked);
  }, [restaurants, currentIndex, swipe]);

  const handleNopePress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    nopeScale.value = withSequence(withTiming(0.85, { duration: 80 }), withTiming(1, { duration: 120 }));
    handleSwipe(false);
  };

  const handleLikePress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    likeScale.value = withSequence(withTiming(0.85, { duration: 80 }), withTiming(1, { duration: 120 }));
    handleSwipe(true);
  };

  const nopeButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nopeScale.value }],
  }));

  const likeButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const visibleCards = restaurants.slice(currentIndex, currentIndex + 3);
  const isEnd = currentIndex >= restaurants.length && restaurants.length > 0;
  const isWaiting = connectionStatus === "waiting" || userCount < 2;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, {
        paddingTop: insets.top + (Platform.OS === "web" ? 67 : 12),
        borderBottomColor: colors.border,
      }]}>
        <TouchableOpacity onPress={async () => { await disconnect(); router.replace("/"); }} hitSlop={16}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>TableMatch</Text>
          <View style={[styles.statusDot, {
            backgroundColor: userCount >= 2 ? "#4CAF50" : "#FFB800",
          }]} />
          <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
            {userCount >= 2 ? "Both connected" : "Waiting..."}
          </Text>
        </View>

        {/* Match count badge */}
        <View style={styles.matchBadgeContainer}>
          {allMatches.length > 0 ? (
            <View style={[styles.matchBadge, { backgroundColor: "#FF6B6B" }]}>
              <Ionicons name="heart" size={11} color="#fff" />
              <Text style={styles.matchBadgeText}>{allMatches.length}</Text>
            </View>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>
      </View>

      {/* Partner activity indicator */}
      {partnerSwiping && (
        <View style={[styles.partnerBanner, { backgroundColor: colors.secondary }]}>
          <Ionicons name="hand-left-outline" size={14} color={colors.mutedForeground} />
          <Text style={[styles.partnerText, { color: colors.mutedForeground }]}>
            Partner is swiping...
          </Text>
        </View>
      )}

      {/* Cards / End / Waiting area */}
      {isEnd ? (
        <EndScreen
          allMatches={allMatches}
          colors={colors}
          insets={insets}
          onNewSession={async () => { await disconnect(); router.replace("/"); }}
        />
      ) : isWaiting ? (
        <View style={styles.cardsArea}>
          <View style={styles.centerState}>
            <Ionicons name="people-outline" size={48} color={colors.primary} />
            <Text style={[styles.stateTitle, { color: colors.foreground }]}>Waiting for partner</Text>
            <Text style={[styles.stateSubtitle, { color: colors.mutedForeground }]}>
              They need to join with your session code.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.cardsArea}>
          {[...visibleCards].reverse().map((restaurant, reverseIdx) => {
            const actualIdx = visibleCards.length - 1 - reverseIdx;
            return (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                onSwipe={handleSwipe}
                isTop={actualIdx === 0}
                index={actualIdx}
              />
            );
          })}
        </View>
      )}

      {/* Progress */}
      {!isEnd && !isWaiting && restaurants.length > 0 && (
        <View style={styles.progressRow}>
          <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
            {currentIndex + 1} of {restaurants.length}
          </Text>
        </View>
      )}

      {/* Action buttons */}
      {!isEnd && !isWaiting && (
        <View style={[styles.actions, {
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 16,
        }]}>
          <Animated.View style={nopeButtonStyle}>
            <TouchableOpacity
              style={[styles.actionButton, styles.nopeButton]}
              onPress={handleNopePress}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={32} color="#F44336" />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={likeButtonStyle}>
            <TouchableOpacity
              style={[styles.actionButton, styles.likeButton]}
              onPress={handleLikePress}
              activeOpacity={0.8}
            >
              <Ionicons name="heart" size={30} color="#FF6B6B" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* Match popup (still works as before) */}
      {matchedRestaurant && (
        <MatchModal
          restaurant={matchedRestaurant}
          onKeepSwiping={dismissMatch}
        />
      )}
    </View>
  );
}

// ── End screen with match history ──────────────────────────────────────────

type Colors = ReturnType<typeof useColors>;

interface EndScreenProps {
  allMatches: ReturnType<typeof useSession>["allMatches"];
  colors: Colors;
  insets: { top: number; bottom: number };
  onNewSession: () => void;
}

function EndScreen({ allMatches, colors, insets, onNewSession }: EndScreenProps) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        styles.endContent,
        {
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 80,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.endHero}>
        <View style={[styles.endIconBg, { backgroundColor: allMatches.length ? "#FF6B6B15" : colors.secondary }]}>
          <Ionicons
            name={allMatches.length ? "heart" : "restaurant-outline"}
            size={40}
            color={allMatches.length ? "#FF6B6B" : colors.mutedForeground}
          />
        </View>
        <Text style={[styles.endTitle, { color: colors.foreground }]}>
          {allMatches.length ? "You matched!" : "All done!"}
        </Text>
        <Text style={[styles.endSubtitle, { color: colors.mutedForeground }]}>
          {allMatches.length
            ? `${allMatches.length} restaurant${allMatches.length > 1 ? "s" : ""} you both liked`
            : "No matches yet — try swiping again with different filters."}
        </Text>
      </View>

      {/* Match list */}
      {allMatches.length > 0 && (
        <View style={styles.matchList}>
          {allMatches.map((r, i) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.matchRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => Linking.openURL(r.mapsLink).catch(() => null)}
              activeOpacity={0.82}
            >
              <View style={styles.matchRowNumber}>
                <Text style={[styles.matchRowNumberText, { color: colors.mutedForeground }]}>{i + 1}</Text>
              </View>
              <Image source={{ uri: r.photo }} style={styles.matchRowImage} />
              <View style={styles.matchRowInfo}>
                <Text style={[styles.matchRowName, { color: colors.foreground }]} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={[styles.matchRowMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {r.cuisine} · {r.price}
                </Text>
                <View style={styles.matchRowRating}>
                  <Ionicons name="star" size={12} color="#FFB800" />
                  <Text style={[styles.matchRowRatingText, { color: colors.mutedForeground }]}>
                    {r.rating.toFixed(1)}
                  </Text>
                </View>
              </View>
              <Ionicons name="map-outline" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* New session button */}
      <TouchableOpacity
        style={[styles.newSessionBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
        onPress={onNewSession}
        activeOpacity={0.8}
      >
        <Ionicons name="refresh-outline" size={18} color={colors.foreground} />
        <Text style={[styles.newSessionText, { color: colors.foreground }]}>New Session</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  matchBadgeContainer: {
    width: 36,
    alignItems: "flex-end",
  },
  matchBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
  },
  matchBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  partnerBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  partnerText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  cardsArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  centerState: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  stateTitle: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  stateSubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  progressRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
  progressText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 48,
    paddingTop: 8,
  },
  actionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  nopeButton: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#F4433625",
  },
  likeButton: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#FF6B6B25",
  },
  // End screen
  endContent: {
    paddingHorizontal: 20,
    paddingTop: 32,
    gap: 24,
    alignItems: "center",
  },
  endHero: {
    alignItems: "center",
    gap: 10,
  },
  endIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  endTitle: {
    fontSize: 26,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  endSubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  matchList: {
    width: "100%",
    gap: 10,
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  matchRowNumber: {
    width: 22,
    alignItems: "center",
  },
  matchRowNumberText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  matchRowImage: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  matchRowInfo: {
    flex: 1,
    gap: 2,
  },
  matchRowName: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  matchRowMeta: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  matchRowRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  matchRowRatingText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  newSessionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 4,
  },
  newSessionText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
