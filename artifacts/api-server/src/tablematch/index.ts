import { Server as SocketServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { logger } from "../lib/logger";
import { fetchRestaurants, type RestaurantFilters } from "./restaurants";
import { logEvent, saveSession, loadSession, deleteSession } from "./db";

interface Restaurant {
  id: string;
  name: string;
  photo: string;
  cuisine: string;
  rating: number;
  price: string;
  address: string;
  mapsLink: string;
}

interface SessionUser {
  userId: string;
  socketId: string;
}

interface Session {
  sessionId: string;
  users: SessionUser[];
  restaurants: Restaurant[];
  swipes: Array<{ userId: string; restaurantId: string; liked: boolean }>;
  matches: string[];
  filters: RestaurantFilters;
  createdAt: number;
}

const sessions = new Map<string, Session>();

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function shuffleForUser(arr: Restaurant[], userId: string): Restaurant[] {
  const seeded = [...arr];
  const seed = userId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  for (let i = seeded.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [seeded[i], seeded[j]] = [seeded[j], seeded[i]];
  }
  return seeded;
}

export function initSocket(httpServer: HttpServer) {
  const io = new SocketServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/api/socket.io",
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    // ── Create session ─────────────────────────────────────────────────────
    socket.on(
      "create_session",
      async ({
        lat,
        lng,
        filters,
      }: {
        lat: number;
        lng: number;
        filters?: RestaurantFilters;
      }) => {
        // Input validation
        const clampedLat = Math.max(-90, Math.min(90, Number(lat)));
        const clampedLng = Math.max(-180, Math.min(180, Number(lng)));
        if (isNaN(clampedLat) || isNaN(clampedLng)) {
          socket.emit("error", { message: "Invalid location coordinates" });
          return;
        }
        const lat_ = clampedLat;
        const lng_ = clampedLng;

        const sessionId = generateId();
        const userId = generateId();
        const resolvedFilters: RestaurantFilters = {
          radiusMiles: Math.min(50, filters?.radiusMiles ?? 5) as RestaurantFilters["radiusMiles"],
          maxPrice: filters?.maxPrice ?? 4,
          vibes: filters?.vibes ?? [],
        };

        logEvent(sessionId, "session_started", { lat: lat_, lng: lng_, ...resolvedFilters }, userId);
        logEvent(sessionId, "filters_set", { radiusMiles: resolvedFilters.radiusMiles, maxPrice: resolvedFilters.maxPrice, vibes: resolvedFilters.vibes }, userId);
        logEvent(sessionId, "invite_sent", { sessionId }, userId);

        const restaurants = await fetchRestaurants(lat_, lng_, sessionId, resolvedFilters);

        const session: Session = {
          sessionId,
          users: [{ userId, socketId: socket.id }],
          restaurants,
          swipes: [],
          matches: [],
          filters: resolvedFilters,
          createdAt: Date.now(),
        };

        sessions.set(sessionId, session);
        saveSession(sessionId, session);
        await socket.join(sessionId);

        socket.emit("session_created", {
          sessionId,
          userId,
          restaurants: shuffleForUser(restaurants, userId),
          userCount: 1,
        });

        logger.info({ sessionId, userId }, "Session created");
      },
    );

    // ── Join session ───────────────────────────────────────────────────────
    socket.on("join_session", async ({ sessionId }: { sessionId: string }) => {
      // Rehydrate from DB if evicted from memory
      if (!sessions.has(sessionId)) {
        const stored = await loadSession(sessionId) as Session | null;
        if (stored) {
          stored.users = []; // clear stale socket refs — users must reconnect
          sessions.set(sessionId, stored);
        }
      }

      const session = sessions.get(sessionId);

      if (!session) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      if (session.users.length >= 2) {
        socket.emit("error", { message: "Session is full" });
        return;
      }

      const userId = generateId();
      session.users.push({ userId, socketId: socket.id });
      await socket.join(sessionId);

      logEvent(sessionId, "second_user_joined", { userCount: session.users.length }, userId);

      // Boost restaurants already liked by first user
      const likedByUser1 = session.swipes
        .filter((s) => s.userId === session.users[0]?.userId && s.liked)
        .map((s) => s.restaurantId);

      let userRestaurants = shuffleForUser(session.restaurants, userId);

      if (likedByUser1.length > 0) {
        const liked = userRestaurants.filter((r) => likedByUser1.includes(r.id));
        const rest = userRestaurants.filter((r) => !likedByUser1.includes(r.id));
        const boosted: Restaurant[] = [];
        let li = 0;
        for (let i = 0; i < rest.length; i++) {
          boosted.push(rest[i]);
          if (li < liked.length && i < 5) boosted.push(liked[li++]);
        }
        while (li < liked.length) boosted.push(liked[li++]);
        userRestaurants = boosted;
      }

      saveSession(sessionId, session);

      socket.emit("session_joined", {
        sessionId,
        userId,
        restaurants: userRestaurants,
        userCount: session.users.length,
      });

      io.to(sessionId).emit("partner_joined", { userCount: session.users.length });
      logger.info({ sessionId, userId }, "User joined session");
    });

    // ── Rejoin session (reconnect after drop) ──────────────────────────────
    socket.on("rejoin_session", async ({ sessionId, userId }: { sessionId: string; userId: string }) => {
      // Try memory first, then DB
      if (!sessions.has(sessionId)) {
        const stored = await loadSession(sessionId) as Session | null;
        if (stored) {
          stored.users = stored.users.filter((u) => u.userId !== userId);
          sessions.set(sessionId, stored);
        }
      }

      const session = sessions.get(sessionId);
      if (!session) {
        socket.emit("rejoin_failed", { reason: "Session not found" });
        return;
      }

      // Update or add this user's socket ID
      const existing = session.users.find((u) => u.userId === userId);
      if (existing) {
        existing.socketId = socket.id;
      } else {
        if (session.users.length >= 2) {
          socket.emit("rejoin_failed", { reason: "Session is full" });
          return;
        }
        session.users.push({ userId, socketId: socket.id });
      }

      await socket.join(sessionId);
      saveSession(sessionId, session);

      socket.emit("session_joined", {
        sessionId,
        userId,
        restaurants: shuffleForUser(session.restaurants, userId),
        userCount: session.users.length,
      });

      io.to(sessionId).emit("partner_joined", { userCount: session.users.length });
      logger.info({ sessionId, userId }, "User rejoined session");
    });

    // ── Swipe ──────────────────────────────────────────────────────────────
    socket.on(
      "swipe",
      ({
        sessionId,
        userId,
        restaurantId,
        liked,
      }: {
        sessionId: string;
        userId: string;
        restaurantId: string;
        liked: boolean;
      }) => {
        const session = sessions.get(sessionId);
        if (!session) return;

        const existing = session.swipes.find(
          (s) => s.userId === userId && s.restaurantId === restaurantId,
        );
        if (!existing) {
          session.swipes.push({ userId, restaurantId, liked });

          const restaurant = session.restaurants.find((r) => r.id === restaurantId);
          logEvent(
            sessionId,
            liked ? "swipe_right" : "swipe_left",
            { restaurantId, restaurantName: restaurant?.name ?? restaurantId },
            userId,
          );
        }

        socket.to(sessionId).emit("partner_swiping");

        if (liked) {
          const otherUsers = session.users.filter((u) => u.userId !== userId);
          for (const other of otherUsers) {
            const otherLiked = session.swipes.find(
              (s) => s.userId === other.userId && s.restaurantId === restaurantId && s.liked,
            );

            if (otherLiked && !session.matches.includes(restaurantId)) {
              session.matches.push(restaurantId);
              const matchedRestaurant = session.restaurants.find((r) => r.id === restaurantId);

              logEvent(
                sessionId,
                "match_created",
                { restaurantId, restaurantName: matchedRestaurant?.name ?? restaurantId },
                userId,
              );

              saveSession(sessionId, session);
              io.to(sessionId).emit("match", { restaurant: matchedRestaurant });
              logger.info({ sessionId, restaurantId }, "Match found!");
            }
          }
        }
      },
    );

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Socket disconnected");

      for (const [sessionId, session] of sessions.entries()) {
        const idx = session.users.findIndex((u) => u.socketId === socket.id);
        if (idx !== -1) {
          const userId = session.users[idx]?.userId;
          session.users.splice(idx, 1);
          io.to(sessionId).emit("partner_left");

          // Log abandonment only if session never got a match
          if (session.matches.length === 0) {
            logEvent(sessionId, "session_abandoned", {
              userCount: session.users.length,
              matchCount: session.matches.length,
              duration: Date.now() - session.createdAt,
            }, userId);
          }

          if (session.users.length === 0) {
            sessions.delete(sessionId);
            // Keep DB record for potential rejoin; it will expire naturally
            logger.info({ sessionId }, "Session evicted from memory (users=0)");
          }
        }
      }
    });
  });

  return io;
}
