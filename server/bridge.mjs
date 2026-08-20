#!/usr/bin/env node
/**
 * Rollcall — local database bridge.
 *
 * Browsers cannot open PostgreSQL / MySQL sockets, so this tiny server does it
 * for them. It runs fully offline:
 *
 *   node server/bridge.mjs --engine postgres --db rollcall --user postgres --password secret
 *   node server/bridge.mjs --engine mysql    --db rollcall --user root     --password secret
 *
 * Flags (or ROLLCALL_* env vars): --engine --host --port --db --user --password --bind --port 8787
 *
 * It also serves ../dist so http://127.0.0.1:8787 IS the app, talking to YOUR database.
 * Real tables are created automatically on first use.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ---------------- cli / env ---------------- */

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else out[key] = "true";
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const ENGINE = (args.engine || process.env.ROLLCALL_DB_ENGINE || "postgres").toLowerCase();
if (ENGINE !== "postgres" && ENGINE !== "mysql") {
  console.error(`Unknown engine "${ENGINE}" — use --engine postgres or --engine mysql`);
  process.exit(1);
}
const APP_PORT = Number(args.serve || process.env.ROLLCALL_SERVE || 8787);
const BIND = args.bind || process.env.ROLLCALL_BIND || "127.0.0.1";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, "../dist");

function dbSettings(query) {
  const env = process.env;
  return {
    host: query.get("host") || env.ROLLCALL_DB_HOST || "127.0.0.1",
    port: Number(query.get("port") || env.ROLLCALL_DB_PORT || (ENGINE === "mysql" ? 3306 : 5432)),
    database: query.get("db") || env.ROLLCALL_DB_NAME || "rollcall",
    user: query.get("user") || env.ROLLCALL_DB_USER || (ENGINE === "mysql" ? "root" : "postgres"),
    password: query.get("password") ?? env.ROLLCALL_DB_PASSWORD ?? "",
  };
}

/* ---------------- database ---------------- */

function toNumbered(text) {
  let i = 0;
  return text.replace(/\?/g, () => `$${++i}`);
}

async function connect(cfg, engine) {
  if (engine === "postgres") {
    const pg = await import("pg");
    pg.types.setTypeParser(1082, (v) => v); // DATE as raw string — no timezone drift
    const c = new pg.Client(cfg);
    await c.connect();
    return {
      run: (text, params = []) => c.query(toNumbered(text), params).then((r) => r.rows),
      close: () => c.end(),
    };
  }
  const mysql = await import("mysql2/promise");
  const c = await mysql.createConnection({ ...cfg, dateStrings: true });
  return {
    run: (text, params = []) => c.execute(text, params).then(([rows]) => rows),
    close: () => c.end(),
  };
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS rollcall_people (
     id VARCHAR(40) PRIMARY KEY,
     name TEXT NOT NULL,
     role TEXT,
     email TEXT,
     phone TEXT,
     joined_at DATE,
     hue INT
   )`,
  `CREATE TABLE IF NOT EXISTS rollcall_teams (
     id VARCHAR(40) PRIMARY KEY,
     name TEXT,
     color VARCHAR(24),
     purpose TEXT,
     member_ids TEXT,
     created_at TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS rollcall_tasks (
     id VARCHAR(40) PRIMARY KEY,
     title TEXT,
     description TEXT,
     team_id VARCHAR(40),
     assignee_ids TEXT,
     status VARCHAR(16),
     start_date DATE,
     due_date DATE,
     created_at TEXT,
     completed_at DATE
   )`,
  `CREATE TABLE IF NOT EXISTS rollcall_events (
     id VARCHAR(40) PRIMARY KEY,
     person_id VARCHAR(40),
     kind VARCHAR(24),
     title TEXT,
     note TEXT,
     event_date DATE,
     end_date DATE,
     created_at TEXT,
     task_id VARCHAR(40)
   )`,
];

async function ensureSchema(db) {
  for (const stmt of DDL) await db.run(stmt);
}

function isoDate(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    const m = `${v.getMonth() + 1}`.padStart(2, "0");
    const d = `${v.getDate()}`.padStart(2, "0");
    return `${v.getFullYear()}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

function list(v) {
  try {
    const a = JSON.parse(v ?? "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

async function readState(db) {
  const [people, teams, tasks, events] = await Promise.all([
    db.run("SELECT * FROM rollcall_people"),
    db.run("SELECT * FROM rollcall_teams"),
    db.run("SELECT * FROM rollcall_tasks"),
    db.run("SELECT * FROM rollcall_events"),
  ]);
  return {
    people: people.map((r) => ({
      id: r.id,
      name: r.name ?? "",
      role: r.role ?? "",
      email: r.email ?? "",
      phone: r.phone ?? "",
      joinedAt: isoDate(r.joined_at) ?? "",
      hue: Number(r.hue ?? 150),
    })),
    teams: teams.map((r) => ({
      id: r.id,
      name: r.name ?? "",
      color: r.color ?? "mint",
      purpose: r.purpose ?? "",
      memberIds: list(r.member_ids),
      createdAt: r.created_at ?? "",
    })),
    tasks: tasks.map((r) => ({
      id: r.id,
      title: r.title ?? "",
      description: r.description ?? "",
      teamId: r.team_id ?? null,
      assigneeIds: list(r.assignee_ids),
      status: r.status ?? "todo",
      startDate: isoDate(r.start_date) ?? "",
      dueDate: isoDate(r.due_date) ?? "",
      createdAt: r.created_at ?? "",
      completedAt: isoDate(r.completed_at),
    })),
    events: events.map((r) => ({
      id: r.id,
      personId: r.person_id ?? "",
      kind: r.kind ?? "observation",
      title: r.title ?? "",
      note: r.note ?? "",
      date: isoDate(r.event_date) ?? "",
      endDate: isoDate(r.end_date),
      createdAt: r.created_at ?? "",
      taskId: r.task_id ?? null,
    })),
  };
}

async function writeState(db, state) {
  await db.run("BEGIN");
  try {
    await db.run("DELETE FROM rollcall_people");
    await db.run("DELETE FROM rollcall_teams");
    await db.run("DELETE FROM rollcall_tasks");
    await db.run("DELETE FROM rollcall_events");
    for (const p of state.people ?? []) {
      await db.run(
        "INSERT INTO rollcall_people (id, name, role, email, phone, joined_at, hue) VALUES (?,?,?,?,?,?,?)",
        [p.id, p.name, p.role ?? "", p.email ?? "", p.phone ?? "", p.joinedAt || null, p.hue ?? 150]
      );
    }
    for (const t of state.teams ?? []) {
      await db.run(
        "INSERT INTO rollcall_teams (id, name, color, purpose, member_ids, created_at) VALUES (?,?,?,?,?,?)",
        [t.id, t.name, t.color ?? "mint", t.purpose ?? "", JSON.stringify(t.memberIds ?? []), t.createdAt ?? ""]
      );
    }
    for (const t of state.tasks ?? []) {
      await db.run(
        "INSERT INTO rollcall_tasks (id, title, description, team_id, assignee_ids, status, start_date, due_date, created_at, completed_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
          t.id,
          t.title,
          t.description ?? "",
          t.teamId ?? null,
          JSON.stringify(t.assigneeIds ?? []),
          t.status ?? "todo",
          t.startDate || null,
          t.dueDate || null,
          t.createdAt ?? "",
          t.completedAt ?? null,
        ]
      );
    }
    for (const e of state.events ?? []) {
      await db.run(
        "INSERT INTO rollcall_events (id, person_id, kind, title, note, event_date, end_date, created_at, task_id) VALUES (?,?,?,?,?,?,?,?,?)",
        [
          e.id,
          e.personId,
          e.kind,
          e.title ?? "",
          e.note ?? "",
          e.date || null,
          e.endDate ?? null,
          e.createdAt ?? "",
          e.taskId ?? null,
        ]
      );
    }
    await db.run("COMMIT");
  } catch (err) {
    await db.run("ROLLBACK").catch(() => {});
    throw err;
  }
}

/* ---------------- http ---------------- */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function send(res, code, body) {
  cors(res);
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res) {
  let file = path.normalize(path.join(DIST, req.url.split("?")[0]));
  if (!file.startsWith(DIST)) {
    res.writeHead(403);
    return res.end();
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIST, "index.html");
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("dist/ not found — run `npm run build` first.");
    }
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    return res.end();
  }

  if (url.pathname === "/api/health") {
    const engine = (url.searchParams.get("engine") || ENGINE).toLowerCase();
    let db;
    try {
      db = await connect(dbSettings(url.searchParams), engine);
      await db.run("SELECT 1 AS ok");
      send(res, 200, { ok: true, engine, time: new Date().toISOString() });
    } catch (e) {
      send(res, 200, { ok: false, engine, message: e.message });
    } finally {
      if (db) await db.close().catch(() => {});
    }
    return;
  }

  if (url.pathname === "/api/state" && req.method === "GET") {
    const engine = (url.searchParams.get("engine") || ENGINE).toLowerCase();
    let db;
    try {
      db = await connect(dbSettings(url.searchParams), engine);
      await ensureSchema(db);
      const state = await readState(db);
      const empty =
        state.people.length === 0 && state.teams.length === 0 && state.tasks.length === 0 && state.events.length === 0;
      send(res, 200, { ok: true, empty, state, updatedAt: new Date().toISOString() });
    } catch (e) {
      send(res, 200, { ok: false, message: e.message });
    } finally {
      if (db) await db.close().catch(() => {});
    }
    return;
  }

  if (url.pathname === "/api/state" && req.method === "PUT") {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 8 * 1024 * 1024) req.destroy();
    });
    req.on("end", async () => {
      let db;
      try {
        const payload = JSON.parse(body || "{}");
        if (!payload.state || !Array.isArray(payload.state.people)) throw new Error("payload.state is missing");
        const engine = (url.searchParams.get("engine") || ENGINE).toLowerCase();
        db = await connect(dbSettings(url.searchParams), engine);
        await ensureSchema(db);
        await writeState(db, payload.state);
        send(res, 200, { ok: true, updatedAt: new Date().toISOString() });
      } catch (e) {
        send(res, 200, { ok: false, message: e.message });
      } finally {
        if (db) await db.close().catch(() => {});
      }
    });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    send(res, 404, { ok: false, message: "unknown endpoint" });
    return;
  }

  serveStatic(req, res);
});

server.listen(APP_PORT, BIND, () => {
  const addr = `http://${BIND === "0.0.0.0" ? "localhost" : BIND}:${APP_PORT}`;
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════════╗");
  console.log("  ║  ROLLCALL · local database bridge                    ║");
  console.log("  ╚══════════════════════════════════════════════════════╝");
  console.log(`  engine   ${ENGINE}`);
  console.log(`  app      ${addr}   (serves ../dist)`);
  console.log(`  api      ${addr}/api/state   (GET = pull · PUT = push)`);
  console.log(`  bind     ${BIND}   (use --bind 0.0.0.0 to open it to the LAN)`);
  console.log("");
});
