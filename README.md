# BarberKece

BarberKece is a personalized digital barbershop platform built with a modular monolith architecture and client-side computer vision.

---

## 1. Prerequisites (Non-Docker Windows Environment)

Docker is **not** required for local development. You only need native installations of the following:

- **Node.js**: `22.x LTS`
- **Corepack**: Enabled (`corepack enable`)
- **pnpm**: `11.24.0` (managed via Corepack)
- **Git**: Latest version
- **PostgreSQL**: `18.x` (installed natively on Windows)

---

## 2. Repository Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/StevenLiem01/BarberKece.git
   cd BarberKece
   ```

2. **Enable pnpm via Corepack:**

   ```bash
   corepack enable
   corepack prepare pnpm@11.24.0 --activate
   ```

3. **Install workspace dependencies:**
   ```bash
   pnpm install
   ```

---

## 3. Environment Configuration

Create a local `.env` file at the root of the workspace by copying `.env.example`:

```bash
# PowerShell / CMD
Copy-Item .env.example .env
```

Review `.env` and configure your credentials:

```env
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://barberkece_dev:YOUR_PASSWORD_HERE@localhost:5432/barberkece_dev
BUSINESS_TIMEZONE=Asia/Jakarta
```

> **Note:** If your PostgreSQL password contains URI-special characters, you must URL-encode them in `DATABASE_URL` (for example: `@` → `%40`, `#` → `%23`, `?` → `%3F`).

---

## 4. PostgreSQL Local Database Setup

BarberKece safety guards strictly enforce database and user names in development (`barberkece_dev`).

1. **Create the development role and database** in native PostgreSQL via `psql` or pgAdmin:

   ```sql
   CREATE ROLE barberkece_dev WITH LOGIN PASSWORD 'YOUR_PASSWORD_HERE';
   CREATE DATABASE barberkece_dev OWNER barberkece_dev;
   ```

2. **Verify database connectivity and safety guards:**

   ```bash
   pnpm db:check
   ```

3. **Apply database migrations:**

   ```bash
   pnpm db:migrate
   ```

4. **Execute database seed workflow:**
   ```bash
   pnpm db:seed
   ```
   _(Note: M0 baseline seeds 0 initial records. It safely validates the connection and prepares the seed foundation for upcoming milestones.)_

---

## 5. Running the Application Locally

### Web Application (Next.js)

Start the Next.js development server:

```bash
pnpm --filter web dev
```

- **URL:** [http://localhost:3000](http://localhost:3000)
- **Expected M0 Behavior:** Displays the baseline BarberKece landing placeholder page.

### Background Worker

Start the background worker process:

```bash
pnpm --filter @barberkece/worker dev
```

- **Expected M0 Behavior:** Starts the worker process with structured Pino logging in watch mode.

---

## 6. Validation & Quality Gates

Run the local test and verification commands:

| Command                      | Description                                           |
| :--------------------------- | :---------------------------------------------------- |
| `pnpm format:check`          | Verifies code formatting across the monorepo          |
| `pnpm format`                | Formats all files with Prettier                       |
| `pnpm --recursive run lint`  | Runs ESLint across all apps and packages              |
| `pnpm --recursive typecheck` | Runs TypeScript compiler checks across all workspaces |
| `pnpm test`                  | Runs unit tests (Vitest)                              |
| `pnpm test:e2e`              | Runs Playwright Chromium E2E smoke tests              |

---

## 7. Common Setup Mistakes

- **Incorrect DB User / Database Name:** The connection check and seed script enforce target identity `barberkece_dev`. Using `postgres` or other database names will trigger safety aborts.
- **Missing Root `.env`:** Ensure `.env` is placed in the project root directory, not inside individual app folders.
- **Skipping Migrations:** Always run `pnpm db:migrate` before executing `pnpm db:seed` or running apps.
- **Node / pnpm Version Mismatch:** Ensure you are using Node 22 with pnpm 11.24.0 activated via Corepack.
