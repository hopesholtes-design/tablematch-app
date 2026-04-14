import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import type { SessionFilters } from "@/context/SessionContext";

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

const VIBE_OPTIONS: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { label: "Cozy", icon: "cafe-outline" },
  { label: "Trendy", icon: "flash-outline" },
  { label: "Romantic", icon: "heart-outline" },
  { label: "Casual", icon: "sunny-outline" },
  { label: "Lively", icon: "musical-notes-outline" },
];

interface Props {
  onConfirm: (filters: SessionFilters) => void;
  onBack: () => void;
  loading: boolean;
}

export function FilterStep({ onConfirm, onBack, loading }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [radius, setRadius] = useState<SessionFilters["radiusMiles"]>(5);
  const [maxPrice, setMaxPrice] = useState<SessionFilters["maxPrice"]>(3);
  const [vibes, setVibes] = useState<string[]>([]);

  const toggleVibe = (vibe: string) => {
    setVibes((prev) => {
      if (prev.includes(vibe)) return prev.filter((v) => v !== vibe);
      if (prev.length >= 2) return [...prev.slice(1), vibe];
      return [...prev, vibe];
    });
  };

  const handleConfirm = () => {
    onConfirm({ radiusMiles: radius, maxPrice, vibes });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, {
        paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Set your vibe</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, {
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100,
        }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Radius */}
        <Section label="Distance" colors={colors}>
          <View style={styles.pillRow}>
            {RADIUS_OPTIONS.map((opt) => (
              <Pill
                key={opt.value}
                label={opt.label}
                selected={radius === opt.value}
                onPress={() => setRadius(opt.value)}
                colors={colors}
              />
            ))}
          </View>
        </Section>

        {/* Price */}
        <Section label="Price range" colors={colors}>
          <View style={styles.pillRow}>
            {PRICE_OPTIONS.map((opt) => (
              <PricePill
                key={opt.value}
                label={opt.label}
                value={opt.value}
                maxPrice={maxPrice}
                onPress={() => setMaxPrice(opt.value)}
                colors={colors}
              />
            ))}
          </View>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Shows up to {PRICE_OPTIONS.find((o) => o.value === maxPrice)?.label} — includes cheaper options
          </Text>
        </Section>

        {/* Vibe */}
        <Section label="Vibe" colors={colors}>
          <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>Pick up to 2</Text>
          <View style={styles.vibeGrid}>
            {VIBE_OPTIONS.map((opt) => {
              const selected = vibes.includes(opt.label);
              return (
                <TouchableOpacity
                  key={opt.label}
                  style={[
                    styles.vibeChip,
                    {
                      backgroundColor: selected ? "#FF6B6B" : colors.secondary,
                      borderColor: selected ? "#FF6B6B" : colors.border,
                    },
                  ]}
                  onPress={() => toggleVibe(opt.label)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={opt.icon}
                    size={16}
                    color={selected ? "#fff" : colors.mutedForeground}
                  />
                  <Text style={[styles.vibeLabel, { color: selected ? "#fff" : colors.foreground }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>
      </ScrollView>

      {/* CTA */}
      <View style={[styles.footer, {
        paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 16,
        backgroundColor: colors.background,
        borderTopColor: colors.border,
      }]}>
        <TouchableOpacity
          style={[styles.ctaButton, loading && { opacity: 0.7 }]}
          onPress={handleConfirm}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Ionicons name="location" size={20} color="#fff" />
          <Text style={styles.ctaText}>
            {loading ? "Finding restaurants..." : "Find Restaurants"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Section({
  label,
  children,
  colors,
}: {
  label: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{label}</Text>
      {children}
    </View>
  );
}

function Pill({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        {
          backgroundColor: selected ? "#FF6B6B" : colors.secondary,
          borderColor: selected ? "#FF6B6B" : colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.pillText, { color: selected ? "#fff" : colors.foreground }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function PricePill({
  label,
  value,
  maxPrice,
  onPress,
  colors,
}: {
  label: string;
  value: number;
  maxPrice: number;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const active = value <= maxPrice;
  const selected = value === maxPrice;
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        {
          backgroundColor: selected ? "#FF6B6B" : active ? "#FF6B6B22" : colors.secondary,
          borderColor: selected ? "#FF6B6B" : active ? "#FF6B6B88" : colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[
        styles.pillText,
        { color: selected ? "#fff" : active ? "#FF6B6B" : colors.mutedForeground },
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 0,
  },
  section: {
    marginTop: 28,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  subLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: -6,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
  },
  pillText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  vibeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  vibeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
  },
  vibeLabel: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FF6B6B",
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: "#FF6B6B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
