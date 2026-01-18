### TypeScript Express Starter with CORS + Drizzle ORM (Neon)

A minimal Express server written in TypeScript with CORS configured, plus Drizzle ORM configured for a Neon Postgres database and a full CRUD demo script.

#### Prerequisites
- Node.js 18+ (recommended LTS)
- npm
- A Neon Postgres connection string

#### Quick start (API server)
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables:
   - Copy `.env.example` to `.env` and adjust values as needed.
   - Add your Neon connection string to `DATABASE_URL`.
   ```bash
   cp .env.example .env
   # then edit .env
   ```
3. Start the dev server (auto-reloads on change):
   ```bash
   npm run dev
   ```
   It listens on `http://localhost:4000` by default.

4. Test the health route:
   ```bash
   curl -i http://localhost:4000/health
   ```
   You should see `200 OK` with JSON like `{ "status": "ok", "time": "..." }`.

#### CORS configuration
CORS is enabled and restricted by origin. Allowed origins are read from the `ALLOWED_ORIGINS` environment variable (comma-separated list). Requests without an `Origin` header (e.g., curl, some mobile apps) are allowed by default.

- Example `.env`:
  ```env
  # Comma-separated list of origins allowed to access this API
  ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

  # Port the server will listen on
  PORT=4000

  # Neon Postgres connection string (do not commit secrets)
  DATABASE_URL=postgresql://[user]:[password]@[neon_hostname]/[dbname]?sslmode=require&channel_binding=require
  ```

If a browser request comes from an origin not in the list, it will be blocked with a CORS error. Typical allowed methods: GET, POST, PUT, PATCH, DELETE, OPTIONS. Allowed headers include `Content-Type` and `Authorization`. Credentials are enabled.

#### Drizzle + Neon (Neon Serverless HTTP driver)
- Config files:
  - `drizzle.config.ts` — Drizzle Kit configuration
  - `src/schema.ts` — Database schema (`demo_users` table)
  - `src/db.ts` — Drizzle client using `drizzle-orm/neon-http` and `@neondatabase/serverless`
  - `src/crud.ts` — CRUD demo script (Create, Read, Update, Delete)
- Migrations directory: `./drizzle`

##### Migration workflow
1. Generate migrations from the schema:
   ```bash
   npm run db:generate
   ```
2. Apply migrations to your Neon database:
   ```bash
   npm run db:migrate
   ```

##### Run CRUD demo
```bash
npm run demo:crud
```
Expected output shows log messages for each C-R-U-D step and completes without errors.

#### Scripts
- `npm run dev` — Start the server in development with `tsx` (auto-restart).
- `npm run build` — Compile TypeScript to JavaScript into `dist/`.
- `npm start` — Run the compiled server from `dist/`.
- `npm run typecheck` — Type-check without emitting files.
- `npm run db:generate` — Generate Drizzle migrations from `src/schema.ts`.
- `npm run db:migrate` — Apply migrations to the database.
- `npm run demo:crud` — Run the CRUD demo script using Drizzle.

#### Project structure
```
├─ drizzle.config.ts
├─ drizzle/                # Generated migrations
├─ src/
│  ├─ app.ts               # Express app: middleware, CORS, routes, error handlers
│  ├─ index.ts             # HTTP server bootstrap
│  ├─ db.ts                # Drizzle client (Neon HTTP)
│  ├─ schema.ts            # Drizzle schema
│  └─ crud.ts              # CRUD demo script
├─ tsconfig.json
├─ package.json
└─ README.md
```

#### Notes
- Do not hardcode your database credentials in source files.
- Ensure `DATABASE_URL` is set before running migrations or the CRUD demo.
- This project uses ESM (`"type": "module"`) and NodeNext module resolution; when importing local TypeScript files in source, include the `.js` extension (handled by tsx/tsc at runtime/build).
