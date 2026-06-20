const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Bserpents";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const SESSION_COOKIE = "bs_admin";
const SESSION_TOKEN = crypto.randomBytes(32).toString("hex");
const DATA_DIR = path.join(__dirname, "data");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
    })
  : null;
let databaseReady;

const activities = [
  "OXYPILLS",
  "ΜΠΟΥΚΕΣ",
  "PAWNRUNS",
  "METAL DET",
  "ΑΤΜ",
  "ΛΗΣΤΕΙΕΣ",
  "CORNERING",
  "ΑΛΛΟ"
];

app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"],
  maxAge: "1h"
}));

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        if (index === -1) return [item, ""];
        return [
          decodeURIComponent(item.slice(0, index)),
          decodeURIComponent(item.slice(index + 1))
        ];
      })
  );
}

function isAdmin(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] === SESSION_TOKEN;
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: "Χρειάζεται κωδικός admin." });
  }
  next();
}

async function ensureStore() {
  if (pool) {
    databaseReady ||= pool.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        patch TEXT NOT NULL,
        amount TEXT NOT NULL,
        city_hours TEXT NOT NULL DEFAULT '',
        activities JSONB NOT NULL DEFAULT '[]'::jsonb,
        other_text TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL,
        created_at_text TEXT NOT NULL
      )
    `).then(() => pool.query(`
      CREATE INDEX IF NOT EXISTS idx_submissions_created_at
      ON submissions(created_at DESC)
    `));
    await databaseReady;
    return;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(SUBMISSIONS_FILE);
  } catch {
    await fs.writeFile(SUBMISSIONS_FILE, "[]\n", "utf8");
  }
}

async function readSubmissions() {
  await ensureStore();
  if (pool) {
    const result = await pool.query(`
      SELECT id, name, patch, amount, city_hours, activities,
             other_text, created_at, created_at_text
      FROM submissions
      ORDER BY created_at DESC
    `);
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      patch: row.patch,
      amount: row.amount,
      cityHours: row.city_hours,
      activities: row.activities,
      otherText: row.other_text,
      createdAt: new Date(row.created_at).toISOString(),
      createdAtText: row.created_at_text
    }));
  }

  const raw = await fs.readFile(SUBMISSIONS_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeSubmissions(submissions) {
  await ensureStore();
  await fs.writeFile(SUBMISSIONS_FILE, `${JSON.stringify(submissions, null, 2)}\n`, "utf8");
}

async function insertSubmission(item) {
  await ensureStore();
  if (pool) {
    await pool.query(`
      INSERT INTO submissions (
        id, name, patch, amount, city_hours, activities,
        other_text, created_at, created_at_text
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
    `, [
      item.id,
      item.name,
      item.patch,
      item.amount,
      item.cityHours,
      JSON.stringify(item.activities),
      item.otherText,
      item.createdAt,
      item.createdAtText
    ]);
    return;
  }

  const submissions = await readSubmissions();
  submissions.unshift(item);
  await writeSubmissions(submissions);
}

async function deleteSubmission(id) {
  await ensureStore();
  if (pool) {
    const result = await pool.query("DELETE FROM submissions WHERE id = $1", [id]);
    return result.rowCount > 0;
  }

  const submissions = await readSubmissions();
  const nextSubmissions = submissions.filter((item) => item.id !== id);
  if (nextSubmissions.length === submissions.length) return false;
  await writeSubmissions(nextSubmissions);
  return true;
}

function cleanText(value, max = 120) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function localTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: "Europe/Athens",
    dateStyle: "full",
    timeStyle: "medium"
  }).format(date);
}

function validateSubmission(body) {
  const name = cleanText(body.name);
  const patch = cleanText(body.patch);
  const amount = cleanText(body.amount, 60);
  const cityHours = cleanText(body.cityHours, 60);
  const otherText = cleanText(body.otherText, 160);
  const selectedActivities = Array.isArray(body.activities)
    ? body.activities.filter((item) => activities.includes(item))
    : [];

  if (!name) return { error: "Γράψε ΟΝΟΜΑ." };
  if (!patch) return { error: "Γράψε PATCH." };
  if (!amount) return { error: "Γράψε πόσα έφερες." };
  if (!cityHours) return { error: "Γράψε ώρες στην πόλη." };
  if (selectedActivities.length === 0) return { error: "Βάλε τουλάχιστον ένα τικ στο τι έκανες." };
  if (selectedActivities.includes("ΑΛΛΟ") && !otherText) {
    return { error: "Συμπλήρωσε τι είναι το ΑΛΛΟ." };
  }

  const now = new Date();
  return {
    submission: {
      id: crypto.randomUUID(),
      name,
      patch,
      amount,
      cityHours,
      activities: selectedActivities,
      otherText,
      createdAt: now.toISOString(),
      createdAtText: localTimestamp(now)
    }
  };
}

async function notifyDiscord(submission) {
  if (!DISCORD_WEBHOOK_URL) return;

  const description = [
    `**ΟΝΟΜΑ:** ${submission.name}`,
    `**PATCH:** ${submission.patch}`,
    `**ΔΗΛΩΝΩ ΟΤΙ ΕΦΕΡΑ ΤΟΣΑ:** ${submission.amount}`,
    `**ΩΡΕΣ ΣΤΗΝ ΠΟΛΗ:** ${submission.cityHours}`,
    `**ΚΑΙ ΕΚΑΝΑ:** ${submission.activities.join(", ")}`,
    submission.otherText ? `**ΑΛΛΟ:** ${submission.otherText}` : "",
    `**ΗΜΕΡΟΜΗΝΙΑ:** ${submission.createdAtText}`
  ].filter(Boolean).join("\n");

  const response = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Black Serpents Form",
      avatar_url: "",
      embeds: [{
        title: "Νέα αίτηση Black Serpents",
        description,
        color: 0xff7a18,
        timestamp: submission.createdAt
      }]
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Discord webhook failed: ${response.status} ${text}`);
  }
}

function toCsvCell(value) {
  const text = Array.isArray(value) ? value.join(", ") : String(value || "");
  return `"${text.replace(/"/g, '""')}"`;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, now: localTimestamp() });
});

app.post("/api/login", (req, res) => {
  if (req.body?.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Λάθος κωδικός." });
  }

  res.cookie(SESSION_COOKIE, SESSION_TOKEN, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 12
  });
  res.json({ ok: true });
});

app.post("/api/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.post("/api/submissions", async (req, res) => {
  const result = validateSubmission(req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });

  await insertSubmission(result.submission);

  try {
    await notifyDiscord(result.submission);
  } catch (error) {
    console.error(error);
  }

  res.status(201).json({
    ok: true,
    submission: {
      id: result.submission.id,
      createdAtText: result.submission.createdAtText
    }
  });
});

app.get("/api/submissions", requireAdmin, async (_req, res) => {
  res.json({ submissions: await readSubmissions() });
});

app.delete("/api/submissions/:id", requireAdmin, async (req, res) => {
  if (!await deleteSubmission(req.params.id)) {
    return res.status(404).json({ error: "Η αίτηση δεν βρέθηκε." });
  }
  res.json({ ok: true });
});

app.get("/api/submissions.csv", requireAdmin, async (_req, res) => {
  const submissions = await readSubmissions();
  const rows = [
    ["Ημερομηνία", "Όνομα", "Patch", "Τόσα", "Ώρες στην πόλη", "Τι έκανε", "Άλλο"].map(toCsvCell).join(","),
    ...submissions.map((item) => [
      item.createdAtText,
      item.name,
      item.patch,
      item.amount,
      item.cityHours,
      item.activities,
      item.otherText
    ].map(toCsvCell).join(","))
  ];

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"black-serpents-submissions.csv\"");
  res.send(`\uFEFF${rows.join("\n")}`);
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Black Serpents form running at http://localhost:${PORT}`);
});
