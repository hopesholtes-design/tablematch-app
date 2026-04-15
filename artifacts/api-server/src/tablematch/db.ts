import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
  ssl: process.env["NODE_ENV"] === "production"
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

let _initialized = false;

async function initDb(): Promise<void> {
  if (_initialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id         SERIAL PRIMARY KEY,
      session_id TEXT   NOT NULL,
      user_id    TEXT,
      event_type TEXT   NOT NULL,
      metadata   TEXT   NOT NULL DEFAULT '{}',
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
    CREATE INDEX IF NOT EXISTS idx_events_type    ON events(event_type);
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT   PRIMARY KEY,
      data       TEXT   NOT NULL,
      updated_at BIGINT NOT NULL
    );
  `);
  _initialized = true;
}

initDb().catch((err) => console.error("[db] init error:", err));

// ── Session persistence ────────────────────────────────────────────────────

export async function saveSession(sessionId: string, data: unknown): Promise<void> {
  try {
    await initDb();
    await pool.query(
      `INSERT INTO sessions (session_id, data, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (session_id) DO UPDATE
         SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
      [sessionId, JSON.stringify(data), Date.now()],
    );
  } catch (err) {
    console.error("[db] saveSession error:", err);
  }
}

export async function loadSession(sessionId: string): Promise<unknown | null> {
  try {
    await initDb();
    const result = await pool.query(
      "SELECT data FROM sessions WHERE session_id = $1",
      [sessionId],
    );
    if (result.rows.length === 0) return null;
    return JSON.parse(result.rows[0].data as string);
  } catch (err) {
    console.error("[db] loadSession error:", err);
    return null;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await pool.query("DELETE FROM sessions WHERE session_id = $1", [sessionId]);
  } catch (err) {
    console.error("[db] deleteSession error:", err);
  }
}

// ── Write ──────────────────────────────────────────────────────────────────

export function logEvent(
  sessionId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
  userId?: string,
): void {
  initDb()
    .then(() =>
      pool.query(
        "INSERT INTO events (session_id, user_id, event_type, metadata, created_at) VALUES ($1, $2, $3, $4, $5)",
        [sessionId, userId ?? null, eventType, JSON.stringify(metadata), Date.now()],
      ),
    )
    .catch((err) => console.error("[db] logEvent error:", err));
}

// ── Read (for admin dashboard) ─────────────────────────────────────────────

export async function getAdminStats() {
  await initDb();

  const funnelTypes = [
    "session_started",
    "filters_set",
    "second_user_joined",
    "swipe_right",
    "match_created",
  ] as const;

  const funnelQueries = funnelTypes.map((t) =>
    pool
      .query("SELECT COUNT(DISTINCT session_id) AS n FROM events WHERE event_type = $1", [t])
      .then((r) => [t, Number(r.rows[0]?.n ?? 0)] as const),
  );

  const firstSwipeQ = pool
    .query(
      "SELECT COUNT(DISTINCT session_id) AS n FROM events WHERE event_type IN ('swipe_left', 'swipe_right')",
    )
    .then((r) => Number(r.rows[0]?.n ?? 0));

  const totalMatchesQ = pool
    .query("SELECT COUNT(*) AS n FROM events WHERE event_type = 'match_created'")
    .then((r) => Number(r.rows[0]?.n ?? 0));

  const matchTimesQ = pool.query(`
    SELECT s.session_id,
           s.created_at AS started_at,
           MIN(m.created_at) AS first_match_at
    FROM events s
    JOIN events m ON s.session_id = m.session_id
    WHERE s.event_type = 'session_started'
      AND m.event_type = 'match_created'
    GROUP BY s.session_id, s.created_at
  `);

  const matchEventsQ = pool.query(
    "SELECT metadata FROM events WHERE event_type = 'match_created' ORDER BY created_at DESC LIMIT 500",
  );

  const filterEventsQ = pool.query(
    "SELECT metadata FROM events WHERE event_type = 'filters_set' ORDER BY created_at DESC LIMIT 500",
  );

  const [funnelEntries, firstSwipeN, totalMatchesN, matchTimesR, matchEventsR, filterEventsR] =
    await Promise.all([
      Promise.all(funnelQueries),
      firstSwipeQ,
      totalMatchesQ,
      matchTimesQ,
      matchEventsQ,
      filterEventsQ,
    ]);

  const funnel: Record<string, number> = Object.fromEntries(funnelEntries);
  funnel["first_swipe"] = firstSwipeN;

  const totalSessions = funnel["session_started"] ?? 0;
  const twoUserSessions = funnel["second_user_joined"] ?? 0;
  const pctTwoUsers = totalSessions
    ? Math.round((twoUserSessions / totalSessions) * 100)
    : 0;
  const sessionsWithMatches = funnel["match_created"] ?? 0;
  const matchesPerSession =
    twoUserSessions > 0
      ? (totalMatchesN / twoUserSessions).toFixed(2)
      : "0.00";

  const matchTimes = matchTimesR.rows as Array<{
    session_id: string;
    started_at: string;
    first_match_at: string;
  }>;
  let avgTimeToMatchMin = "—";
  if (matchTimes.length > 0) {
    const avgMs =
      matchTimes.reduce(
        (sum, r) => sum + (Number(r.first_match_at) - Number(r.started_at)),
        0,
      ) / matchTimes.length;
    avgTimeToMatchMin = (avgMs / 60000).toFixed(1) + " min";
  }

  const restaurantCounts = new Map<string, number>();
  for (const row of matchEventsR.rows as Array<{ metadata: string }>) {
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

  const vibeCounts = new Map<string, number>();
  for (const row of filterEventsR.rows as Array<{ metadata: string }>) {
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

export async function getMatchBoostMap(): Promise<Map<string, number>> {
  try {
    await initDb();
    const result = await pool.query(
      "SELECT metadata FROM events WHERE event_type = 'match_created' LIMIT 1000",
    );
    const counts = new Map<string, number>();
    for (const row of result.rows as Array<{ metadata: string }>) {
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
