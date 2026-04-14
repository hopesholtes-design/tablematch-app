import { Router } from "express";
import { getAdminStats } from "../tablematch/db";

const router = Router();

function checkAuth(req: { headers: { authorization?: string } }, password: string): boolean {
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Basic ")) return false;
  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
  const colonIdx = decoded.indexOf(":");
  const pass = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : decoded;
  return pass === password;
}

function bar(value: number, max: number, width = 20): string {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function pct(a: number, b: number): string {
  return b > 0 ? ((a / b) * 100).toFixed(0) + "%" : "—";
}

router.get("/", (req, res) => {
  const adminPassword = process.env["ADMIN_PASSWORD"];

  if (!adminPassword) {
    return res.status(503).send(
      `<html><body style="font-family:monospace;padding:40px">
        <h2>Admin not configured</h2>
        <p>Set the <code>ADMIN_PASSWORD</code> environment variable to enable the admin dashboard.</p>
      </body></html>`,
    );
  }

  if (!checkAuth(req, adminPassword)) {
    res.set("WWW-Authenticate", 'Basic realm="TableMatch Admin"');
    return res.status(401).send("Unauthorized");
  }

  let stats;
  try {
    stats = getAdminStats();
  } catch (err) {
    return res.status(500).send(
      `<html><body style="font-family:monospace;padding:40px"><h2>DB error</h2><pre>${String(err)}</pre></body></html>`,
    );
  }

  const {
    totalSessions,
    pctTwoUsers,
    matchesPerSession,
    avgTimeToMatchMin,
    sessionsWithMatches,
    funnel,
    topRestaurants,
    topVibes,
  } = stats;

  const funnelSteps = [
    { key: "session_started",    label: "Session started"    },
    { key: "filters_set",        label: "Filters set"        },
    { key: "second_user_joined", label: "2nd user joined"    },
    { key: "first_swipe",        label: "First swipe"        },
    { key: "match_created",      label: "Match created"      },
  ];
  const funnelMax = funnel["session_started"] || 1;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TableMatch Admin</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f0f10; color: #e8e8ea; min-height: 100vh; padding: 32px 24px; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .sub { color: #888; font-size: 13px; margin-bottom: 32px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .card { background: #1a1a1e; border: 1px solid #2a2a2e; border-radius: 12px; padding: 20px; }
  .card-val { font-size: 32px; font-weight: 800; color: #ff6b6b; line-height: 1; }
  .card-lbl { font-size: 12px; color: #888; margin-top: 6px; text-transform: uppercase; letter-spacing: .04em; }
  .section { margin-bottom: 32px; }
  .section h2 { font-size: 15px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 16px; border-bottom: 1px solid #2a2a2e; padding-bottom: 8px; }
  .funnel-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; font-size: 14px; }
  .funnel-label { width: 160px; flex-shrink: 0; color: #ccc; }
  .funnel-bar { font-family: monospace; color: #ff6b6b; letter-spacing: -1px; }
  .funnel-count { color: #888; font-size: 13px; min-width: 80px; }
  .funnel-pct { color: #555; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; color: #666; font-weight: 500; padding: 6px 12px; border-bottom: 1px solid #2a2a2e; }
  td { padding: 8px 12px; border-bottom: 1px solid #1a1a1e; color: #ccc; }
  tr:hover td { background: #1a1a1e; }
  .empty { color: #555; font-size: 13px; padding: 16px 0; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  @media (max-width: 700px) { .two-col { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<h1>TableMatch Admin</h1>
<p class="sub">Analytics dashboard &mdash; refreshes on reload</p>

<div class="grid">
  <div class="card">
    <div class="card-val">${totalSessions}</div>
    <div class="card-lbl">Total sessions</div>
  </div>
  <div class="card">
    <div class="card-val">${pctTwoUsers}%</div>
    <div class="card-lbl">Sessions with 2 users</div>
  </div>
  <div class="card">
    <div class="card-val">${matchesPerSession}</div>
    <div class="card-lbl">Matches / session</div>
  </div>
  <div class="card">
    <div class="card-val">${avgTimeToMatchMin}</div>
    <div class="card-lbl">Avg time to match</div>
  </div>
  <div class="card">
    <div class="card-val">${sessionsWithMatches}</div>
    <div class="card-lbl">Sessions with matches</div>
  </div>
</div>

<div class="section">
  <h2>Conversion funnel</h2>
  ${funnelSteps
    .map((s) => {
      const n = funnel[s.key] ?? 0;
      return `<div class="funnel-row">
      <span class="funnel-label">${s.label}</span>
      <span class="funnel-bar">${bar(n, funnelMax)}</span>
      <span class="funnel-count">${n.toLocaleString()}</span>
      <span class="funnel-pct">${pct(n, funnelMax)}</span>
    </div>`;
    })
    .join("")}
</div>

<div class="two-col">
  <div class="section">
    <h2>Top matched restaurants</h2>
    ${
      topRestaurants.length === 0
        ? `<p class="empty">No matches recorded yet.</p>`
        : `<table>
        <thead><tr><th>#</th><th>Restaurant</th><th>Matches</th></tr></thead>
        <tbody>
          ${topRestaurants
            .map(
              (r, i) =>
                `<tr><td>${i + 1}</td><td>${r.name}</td><td>${r.count}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>`
    }
  </div>

  <div class="section">
    <h2>Most selected vibes</h2>
    ${
      topVibes.length === 0
        ? `<p class="empty">No vibe data yet.</p>`
        : `<table>
        <thead><tr><th>Vibe</th><th>Selections</th></tr></thead>
        <tbody>
          ${topVibes
            .map((v) => `<tr><td>${v.vibe}</td><td>${v.count}</td></tr>`)
            .join("")}
        </tbody>
      </table>`
    }
  </div>
</div>

</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  return res.send(html);
});

export default router;
