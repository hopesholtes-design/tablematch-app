import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Clipboard as RNClipboard,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useSession, type SessionFilters } from "@/context/SessionContext";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const RADIUS_OPTIONS: Array<{ label: string; value: SessionFilters["radiusMiles"] }> = [
  { label: "1 mi", value: 1 },
  { label: "5 mi", value: 5 },
  { label: "10 mi", value: 10 },
  { label: "25 mi", value: 25 },
];

const PRICE_OPTIONS: Array<{ label: string; value: SessionFilters["maxPrice"] }> = [
  { label: "$", value: 1 },
  { label: "$$", value: 2 },
  { label: "$$$", value: 3 },
  { label: "$$$$", value: 4 },
];

const VIBE_OPTIONS = ["Cozy", "Trendy", "Romantic", "Casual", "Lively"];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { createSession, joinSession, sessionId, connectionStatus } = useSession();

  const [tab, setTab] = useState<"create" | "join">("create");
  const [joinCode, setJoinCode] = useState("");
  const [locating, setLocating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Filter state (inline on New Session tab)
  const [radius, setRadius] = useState<SessionFilters["radiusMiles"]>(5);
  const [maxPrice, setMaxPrice] = useState<SessionFilters["maxPrice"]>(3);
  const [vibes, setVibes] = useState<string[]>([]);

  // Navigate to swipe screen when both users connected
  useEffect(() => {
    if (connectionStatus === "ready") {
      router.push("/swipe");
    }
  }, [connectionStatus]);

  const toggleVibe = (vibe: string) => {
    setVibes((prev) => {
      if (prev.includes(vibe)) return prev.filter((v) => v !== vibe);
      if (prev.length >= 2) return [...prev.slice(1), vibe];
      return [...prev, vibe];
    });
  };

  const handleCreate = async () => {
    setLocating(true);
    const filters: SessionFilters = { radiusMiles: radius, maxPrice, vibes };
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        createSession(37.7749, -122.4194, filters);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      createSession(loc.coords.latitude, loc.coords.longitude, filters);
    } catch {
      createSession(37.7749, -122.4194, filters);
    } finally {
      setLocating(false);
    }
  };

  const handleJoin = () => {
    const code = joinCode.trim();
    if (!code) {
      Alert.alert("Enter a session code", "Ask your partner to share their session code.");
      return;
    }
    joinSession(code);
  };

  const handleCopy = () => {
    if (sessionId) {
      RNClipboard.setString(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isConnecting = connectionStatus === "connecting";
  const isBusy = locating || isConnecting;

  // Waiting screen after session creation
  if (connectionStatus === "waiting" && sessionId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={["#FF6B6B22", "#FF8E5322", "#FF6B6B00"]}
          style={styles.gradientBg}
        />
        <View style={[styles.waitingContent, {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
        }]}>
          <View style={styles.waitingIcon}>
            <Ionicons name="people-outline" size={56} color={colors.primary} />
          </View>
          <Text style={[styles.waitingTitle, { color: colors.foreground }]}>Waiting for your partner</Text>
          <Text style={[styles.waitingSubtitle, { color: colors.mutedForeground }]}>
            Share your session code with your date
          </Text>

          <TouchableOpacity
            style={[styles.codeBox, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleCopy}
            activeOpacity={0.8}
          >
            <Text style={[styles.codeText, { color: colors.primary }]} numberOfLines={1} ellipsizeMode="middle">
              {sessionId}
            </Text>
            <Ionicons
              name={copied ? "checkmark-circle" : "copy-outline"}
              size={22}
              color={copied ? "#4CAF50" : colors.mutedForeground}
            />
          </TouchableOpacity>

          <Text style={[styles.copyHint, { color: colors.mutedForeground }]}>
            {copied ? "Copied!" : "Tap to copy"}
          </Text>

          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient
        colors={["#FF6B6B22", "#FF8E5322", "#FF6B6B00"]}
        style={styles.gradientBg}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24) + 16,
        }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: "#FF6B6B" }]}>
            <Ionicons name="heart" size={28} color="#fff" />
          </View>
          <Text style={[styles.appName, { color: colors.foreground }]}>TableMatch</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Find your perfect restaurant together
          </Text>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: colors.secondary }]}>
          <TouchableOpacity
            style={[styles.tab, tab === "create" && { backgroundColor: colors.background, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }]}
            onPress={() => setTab("create")}
          >
            <Text style={[styles.tabText, { color: tab === "create" ? colors.foreground : colors.mutedForeground }]}>
              New Session
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === "join" && { backgroundColor: colors.background, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }]}
            onPress={() => setTab("join")}
          >
            <Text style={[styles.tabText, { color: tab === "join" ? colors.foreground : colors.mutedForeground }]}>
              Join Session
            </Text>
          </TouchableOpacity>
        </View>

        {tab === "create" ? (
          <View style={styles.panel}>
            {/* Distance */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.foreground }]}>Distance</Text>
              <View style={styles.pillRow}>
                {RADIUS_OPTIONS.map((opt) => {
                  const sel = radius === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.pill, {
                        backgroundColor: sel ? "#FF6B6B" : colors.secondary,
                        borderColor: sel ? "#FF6B6B" : colors.border,
                      }]}
                      onPress={() => setRadius(opt.value)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.pillText, { color: sel ? "#fff" : colors.foreground }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Price */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.foreground }]}>Price</Text>
              <View style={styles.pillRow}>
                {PRICE_OPTIONS.map((opt) => {
                  const active = opt.value <= maxPrice;
                  const sel = opt.value === maxPrice;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.pill, {
                        backgroundColor: sel ? "#FF6B6B" : active ? "#FF6B6B18" : colors.secondary,
                        borderColor: sel ? "#FF6B6B" : active ? "#FF6B6B66" : colors.border,
                      }]}
                      onPress={() => setMaxPrice(opt.value)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.pillText, {
                        color: sel ? "#fff" : active ? "#FF6B6B" : colors.mutedForeground,
                      }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.filterHint, { color: colors.mutedForeground }]}>
                Up to {PRICE_OPTIONS.find((o) => o.value === maxPrice)?.label} — cheaper options included
              </Text>
            </View>

            {/* Vibe */}
            <View style={styles.filterSection}>
              <View style={styles.filterLabelRow}>
                <Text style={[styles.filterLabel, { color: colors.foreground }]}>Vibe</Text>
                <Text style={[styles.filterHint, { color: colors.mutedForeground }]}>pick up to 2</Text>
              </View>
              <View style={styles.vibeRow}>
                {VIBE_OPTIONS.map((vibe) => {
                  const sel = vibes.includes(vibe);
                  return (
                    <TouchableOpacity
                      key={vibe}
                      style={[styles.pill, {
                        backgroundColor: sel ? "#FF6B6B" : colors.secondary,
                        borderColor: sel ? "#FF6B6B" : colors.border,
                      }]}
                      onPress={() => toggleVibe(vibe)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.pillText, { color: sel ? "#fff" : colors.foreground }]}>
                        {vibe}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: "#FF6B6B" }, isBusy && { opacity: 0.7 }]}
              onPress={handleCreate}
              disabled={isBusy}
              activeOpacity={0.85}
            >
              {isBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="heart" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>Start Swiping</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.panel}>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>Join your partner</Text>
            <Text style={[styles.panelDesc, { color: colors.mutedForeground }]}>
              Enter the session code your partner shared with you.
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Paste session code here..."
              placeholderTextColor={colors.mutedForeground}
              value={joinCode}
              onChangeText={setJoinCode}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="join"
              onSubmitEditing={handleJoin}
            />
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: "#FF6B6B" }, isConnecting && { opacity: 0.7 }]}
              onPress={handleJoin}
              disabled={isConnecting}
              activeOpacity={0.85}
            >
              {isConnecting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="enter-outline" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>Join Session</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {connectionStatus === "disconnected" && (
          <View style={[styles.errorBanner, { backgroundColor: "#FF444422", borderColor: "#FF4444" }]}>
            <Ionicons name="warning-outline" size={16} color="#FF4444" />
            <Text style={{ color: "#FF4444", fontSize: 13, fontFamily: "Inter_400Regular" }}>
              Connection failed. Please try again.
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => Linking.openURL(`https://${process.env["EXPO_PUBLIC_DOMAIN"]}/privacy-policy`)}
          activeOpacity={0.7}
        >
          <Text style={[styles.privacyLink, { color: colors.mutedForeground }]}>Privacy Policy</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    gap: 20,
  },
  header: {
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF6B6B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  tabs: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  panel: {
    gap: 16,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  panelDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  filterSection: {
    gap: 8,
  },
  filterLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  filterHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  vibeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1.5,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
    shadowColor: "#FF6B6B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  waitingContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  waitingIcon: {
    marginBottom: 8,
  },
  waitingTitle: {
    fontSize: 26,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  waitingSubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: "100%",
    marginTop: 8,
  },
  codeText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  copyHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  privacyLink: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingVertical: 8,
  },
});
