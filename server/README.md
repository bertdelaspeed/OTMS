# Rollcall — local database bridge

Browsers cannot open PostgreSQL / MySQL sockets. This tiny framework-free Node
server does it for the app, fully offline. It also serves the built app, so one
address gives you Rollcall + your database.

## 1 · Install the drivers (once, from the project root)

```bash
npm install pg mysql2
```

## 2 · Build the app (once)

```bash
npm run build
```

## 3 · Start the bridge

PostgreSQL:

```bash
node server/bridge.mjs --engine postgres --db rollcall --user postgres --password YOUR_PASSWORD
```

MySQL:

```bash
node server/bridge.mjs --engine mysql --db rollcall --user root --password YOUR_PASSWORD
```

Useful flags (all optional, `ROLLCALL_*` env vars work too):

| flag       | default        | meaning                              |
| ---------- | -------------- | ------------------------------------ |
| `--engine` | `postgres`     | `postgres` or `mysql`                |
| `--host`   | `127.0.0.1`    | database host                        |
| `--port`   | 5432 / 3306    | database port                        |
| `--db`     | `rollcall`     | database name (create it first)      |
| `--serve`  | `8787`         | HTTP port for the app + API          |
| `--bind`   | `127.0.0.1`    | use `0.0.0.0` to open it to the LAN  |

Open `http://127.0.0.1:8787` — that is the app. In **Database → Local server**,
the defaults already match; just press **Test connection**, then **Save**.

Tables (`rollcall_people`, `rollcall_teams`, `rollcall_tasks`,
`rollcall_events`) are created automatically on first sync.

## API

- `GET /api/health?engine=…&host=…&db=…&user=…&password=…` — connectivity check
- `GET /api/state?…` — pull the full ledger
- `PUT /api/state?…` — push the full ledger (transactional replace)

The app can also sync over the internet via **Supabase** (REST, table
`rollcall_state`) or **Firebase Realtime Database** — see the setup guide in
the app's Database section.
