import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io, Socket } from "socket.io-client";

export interface Restaurant {
  id: string;
  name: string;
  photo: string;
  cuisine: string;
  rating: number;
  price: string;
  address: string;
  mapsLink: string;
}

export interface SessionFilters {
  radiusMiles: 1 | 5 | 10 | 25;
  maxPrice: 1 | 2 | 3 | 4;
  vibes: string[];
}

type ConnectionStatus = "idle" | "connecting" | "waiting" | "ready" | "disconnected";

interface SessionState {
  sessionId: string | null;
  userId: string | null;
  restaurants: Restaurant[];
  currentIndex: number;
  matchedRestaurant: Restaurant | null;
  allMatches: Restaurant[];
  connectionStatus: ConnectionStatus;
  userCount: number;
  partnerSwiping: boolean;
}

interface SessionContextValue extends SessionState {
  createSession: (lat: number, lng: number, filters: SessionFilters) => void;
  joinSession: (sessionId: string) => void;
  swipe: (restaurantId: string, liked: boolean) => void;
  dismissMatch: () => void;
  disconnect: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const SOCKET_URL = `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`;

const INITIAL_STATE: SessionState = {
  sessionId: null,
  userId: null,
  restaurants: [],
  currentIndex: 0,
  matchedRestaurant: null,
  allMatches: [],
  connectionStatus: "idle",
  userCount: 0,
  partnerSwiping: false,
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const partnerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<SessionState>(INITIAL_STATE);

  const getOrCreateSocket = useCallback(() => {
    if (socketRef.current?.connected) return socketRef.current;

    const socket = io(SOCKET_URL, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setState((s) => ({ ...s, connectionStatus: s.connectionStatus === "idle" ? "connecting" : s.connectionStatus }));
    });

    socket.on("session_created", async ({ sessionId, userId, restaurants, userCount }: {
      sessionId: string; userId: string; restaurants: Restaurant[]; userCount: number;
    }) => {
      await AsyncStorage.setItem("tablematch_session", JSON.stringify({ sessionId, userId }));
      setState((s) => ({
        ...s,
        sessionId,
        userId,
        restaurants,
        currentIndex: 0,
        allMatches: [],
        userCount,
        connectionStatus: "waiting",
      }));
    });

    socket.on("session_joined", async ({ sessionId, userId, restaurants, userCount }: {
      sessionId: string; userId: string; restaurants: Restaurant[]; userCount: number;
    }) => {
      await AsyncStorage.setItem("tablematch_session", JSON.stringify({ sessionId, userId }));
      setState((s) => ({
        ...s,
        sessionId,
        userId,
        restaurants,
        currentIndex: 0,
        allMatches: [],
        userCount,
        connectionStatus: userCount >= 2 ? "ready" : "waiting",
      }));
    });

    socket.on("partner_joined", ({ userCount }: { userCount: number }) => {
      setState((s) => ({
        ...s,
        userCount,
        connectionStatus: userCount >= 2 ? "ready" : "waiting",
      }));
    });

    socket.on("partner_left", () => {
      setState((s) => ({ ...s, userCount: s.userCount - 1, connectionStatus: "waiting" }));
    });

    socket.on("partner_swiping", () => {
      setState((s) => ({ ...s, partnerSwiping: true }));
      if (partnerTimerRef.current) clearTimeout(partnerTimerRef.current);
      partnerTimerRef.current = setTimeout(() => {
        setState((s) => ({ ...s, partnerSwiping: false }));
      }, 2000);
    });

    socket.on("match", ({ restaurant }: { restaurant: Restaurant }) => {
      setState((s) => ({
        ...s,
        matchedRestaurant: restaurant,
        // Accumulate into history (avoid duplicates)
        allMatches: s.allMatches.some((r) => r.id === restaurant.id)
          ? s.allMatches
          : [...s.allMatches, restaurant],
      }));
    });

    socket.on("error", ({ message }: { message: string }) => {
      console.warn("Socket error:", message);
      setState((s) => ({ ...s, connectionStatus: "disconnected" }));
    });

    socket.on("disconnect", () => {
      setState((s) => ({ ...s, connectionStatus: "disconnected" }));
    });

    socketRef.current = socket;
    return socket;
  }, []);

  const createSession = useCallback((lat: number, lng: number, filters: SessionFilters) => {
    setState((s) => ({ ...s, connectionStatus: "connecting" }));
    const socket = getOrCreateSocket();
    socket.emit("create_session", { lat, lng, filters });
  }, [getOrCreateSocket]);

  const joinSession = useCallback((sessionId: string) => {
    setState((s) => ({ ...s, connectionStatus: "connecting" }));
    const socket = getOrCreateSocket();
    socket.emit("join_session", { sessionId });
  }, [getOrCreateSocket]);

  const swipe = useCallback((restaurantId: string, liked: boolean) => {
    if (!state.sessionId || !state.userId) return;
    socketRef.current?.emit("swipe", {
      sessionId: state.sessionId,
      userId: state.userId,
      restaurantId,
      liked,
    });
    setState((s) => ({ ...s, currentIndex: s.currentIndex + 1 }));
  }, [state.sessionId, state.userId]);

  const dismissMatch = useCallback(() => {
    setState((s) => ({ ...s, matchedRestaurant: null }));
  }, []);

  const disconnect = useCallback(async () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    await AsyncStorage.removeItem("tablematch_session");
    setState(INITIAL_STATE);
  }, []);

  useEffect(() => {
    return () => {
      partnerTimerRef.current && clearTimeout(partnerTimerRef.current);
    };
  }, []);

  return (
    <SessionContext.Provider value={{ ...state, createSession, joinSession, swipe, dismissMatch, disconnect }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be inside SessionProvider");
  return ctx;
}
