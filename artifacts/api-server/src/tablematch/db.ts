import { DatabaseSync } from "node:sqlite";
import path from "path";

const DB_PATH = path.join(process.cwd(), "tablematch.db");

let _db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT    NOT NULL,
        user_id    TEXT,
        event_type TEXT    NOT NULL,
        metadata   TEXT    NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
      CREATE INDEX IF NOT EXISTS idx_events_type    ON events(event_type);
    `);
  }
  return _db;
}

// ── Write ──────────────────────────────────────────────────────────────────

export function logEvent(
  sessionId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
  userId?: string,
): void {
  try {
    getDb()
      .prepare(
        "INSERT INTO events (session_id, user_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(sessionId, userId ?? null, eventType, JSON.stringify(metadata), Date.now());
  } catch (err) {
    console.error("[db] logEvent error:", err);
  }
}

// ── Read (for admin dashboard) ─────────────────────────────────────────────

interface EventRow {
  session_id: string;
  user_id: string | null;
  event_type: string;
  metadata: string;
  created_at: number;
}

export function getAdminStats() {
  const db = getDb();

  // Funnel counts (distinct sessions at each stage)
  const funnelTypes = [
    "session_started",
    "filters_set",
    "second_user_joined",
    "swipe_right",
    "match_created",
  ] as const;

  const funnel: Record<string, number> = {};
  for (const t of funnelTypes) {
    const row = db
      .prepare("SELECT COUNT(DISTINCT session_id) as n FROM events WHERE event_type = ?")
      .get(t) as { n: number };
    funnel[t] = row.n;
  }

  // Sessions that had at least one swipe (left or right)
  const firstSwipeRow = db
    .prepare(
      "SELECT COUNT(DISTINCT session_id) as n FROM events WHERE event_type IN ('swipe_left', 'swipe_right')",
    )
    .get() as { n: number };
  funnel["first_swipe"] = firstSwipeRow.n;

  // Total sessions
  const totalSessions = funnel["session_started"] || 0;

  // Sessions with 2 users
  const twoUserSessions = funnel["second_user_joined"] || 0;
  const pctTwoUsers = totalSessions
    ? Math.round((twoUserSessions / totalSessions) * 100)
    : 0;

  // Sessions with matches
  const sessionsWithMatches = funnel["match_created"] || 0;

  // Total match events
  const totalMatchesRow = db
    .prepare("SELECT COUNT(*) as n FROM events WHERE event_type = 'match_created'")
    .get() as { n: number };

  const matchesPerSession =
    twoUserSessions > 0
      ? (totalMatchesRow.n / twoUserSessions).toFixed(2)
      : "0.00";

  // Avg time to first match (ms → minutes)
  const matchTimes = db
    .prepare(
      `SELECT s.session_id,
              s.created_at AS started_at,
              MIN(m.created_at) AS first_match_at
       FROM events s
       JOIN events m ON s.session_id = m.session_id
       WHERE s.event_type = 'session_started'
         AND m.event_type = 'match_created'
       GROUP BY s.session_id`,
    )
    .all() as Array<{ session_id: string; started_at: number; first_match_at: number }>;

  let avgTimeToMatchMin = "—";
  if (matchTimes.length > 0) {
    const avgMs =
      matchTimes.reduce((sum, r) => sum + (r.first_match_at - r.started_at), 0) /
      matchTimes.length;
    avgTimeToMatchMin = (avgMs / 60000).toFixed(1) + " min";
  }

  // Top matched restaurants
  const matchEvents = db
    .prepare(
      "SELECT metadata FROM events WHERE event_type = 'match_created' ORDER BY created_at DESC LIMIT 500",
    )
    .all() as Array<{ metadata: string }>;

  const restaurantCounts = new Map<string, number>();
  for (const row of matchEvents) {
    try {
      const meta = JSON.parse(row.metadata) as { restaurantName?: string };
      if (meta.restaurantName) {
        restaurantCounts.set(
          meta.restaurantName,
          (restaurantCounts.get(meta.restaurantName) ?? 0) + 1,
        );
      }
    } catch {
      // ignore
    }
  }
  const topRestaurants = [...restaurantCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Most selected vibes
  const filterEvents = db
    .prepare(
      "SELECT metadata FROM events WHERE event_type = 'filters_set' ORDER BY created_at DESC LIMIT 500",
    )
    .all() as Array<{ metadata: string }>;

  const vibeCounts = new Map<string, number>();
  for (const row of filterEvents) {
    try {
      const meta = JSON.parse(row.metadata) as { vibes?: string[] };
      for (const vibe of meta.vibes ?? []) {
        vibeCounts.set(vibe, (vibeCounts.get(vibe) ?? 0) + 1);
      }
    } catch {
      // ignore
    }
  }
  const topVibes = [...vibeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([vibe, count]) => ({ vibe, count }));

  return {
    totalSessions,
    pctTwoUsers,
    matchesPerSession,
    avgTimeToMatchMin,
    sessionsWithMatches,
    funnel,
    topRestaurants,
    topVibes,
  };
}

// ── Match boost (feedback loop) ────────────────────────────────────────────

export function getMatchBoostMap(): Map<string, number> {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT metadata FROM events WHERE event_type = 'match_created' LIMIT 1000",
      )
      .all() as Array<{ metadata: string }>;

    const counts = new Map<string, number>();
    for (const row of rows) {
      try {
        const meta = JSON.parse(row.metadata) as { restaurantId?: string };
        if (meta.restaurantId) {
          counts.set(meta.restaurantId, (counts.get(meta.restaurantId) ?? 0) + 1);
        }
      } catch {
        // ignore
      }
    }
    return counts;
  } catch {
    return new Map();
  }
}
