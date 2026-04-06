# Chatbot Juridique — Docker & CI/CD Guide

> Complete step-by-step instructions for running the project locally with Docker
> and automating builds/deploys with GitHub Actions.

---

# PART 1: RUNNING WITH DOCKER

---

## 1.1 Architecture Overview

```
┌──────────────────┐     ┌───────────────────┐     ┌────────────────────────┐
│    Frontend       │────▶│     Backend       │────▶│     PostgreSQL         │
│  React + Vite     │     │    FastAPI        │     │   + pgvector           │
│                   │     │                   │     │                        │
│  DEV:  :5173      │     │  DEV:  uvicorn    │     │  Image: pgvector/      │
│  PROD: nginx :80  │     │  PROD: gunicorn   │     │  pgvector:0.8.2-pg18   │
└──────────────────┘     └───────────────────┘     └────────────────────────┘
         │                         │
    Vite proxy (dev)          Reads PDFs from
    nginx proxy (prod)        documents_juridiques/
    routes /api/* and         volume mount
    /token → backend:8000
```

**What each service does:**
- **db** — PostgreSQL database with the pgvector extension for vector similarity search (used by RAG)
- **backend** — FastAPI Python server that handles authentication, chat sessions, document uploads, and AI-powered legal Q&A via Groq API + FAISS
- **frontend** — React + TypeScript UI built with Vite. In dev mode it runs the Vite dev server with hot reload. In production it's a static build served by nginx, which also reverse-proxies API calls to the backend

## 1.2 Prerequisites

Before you begin, make sure you have:

1. **Docker Desktop** installed and running  
   - Download: https://docs.docker.com/get-docker/
   - Verify: `docker --version` (should be ≥ 24.0)
   - Verify: `docker compose version` (should be ≥ 2.20)

2. **Your existing Docker images** (these will be reused, not re-downloaded):
   - `python:3.12-slim-bookworm` — backend base
   - `node:20-alpine` — frontend base
   - `pgvector/pgvector:0.8.2-pg18-trixie` — database
   - `nginx:1.27-alpine` — production frontend only

3. **A Groq API key** — Get one free at https://console.groq.com

## 1.3 Project File Structure

```
chatbot-juridique/
│
├── .env.example                  # Template for environment variables
├── .env                          # Your actual secrets (git-ignored)
├── .dockerignore                 # Files excluded from Docker build context
├── .gitignore                    # Files excluded from git
│
├── docker-compose.yml            # Development orchestration (hot reload)
├── docker-compose.prod.yml       # Production orchestration (optimized)
│
├── backend/
│   ├── Dockerfile                # Multi-stage: base → dev → production
│   ├── requirements.txt          # Python dependencies (pinned versions)
│   ├── main.py                   # FastAPI application entry point
│   ├── models.py                 # SQLAlchemy models + DB connection
│   ├── auth.py                   # JWT authentication + bcrypt hashing
│   ├── rag.py                    # FAISS + SentenceTransformer RAG engine
│   ├── seed.py                   # Database seed script with demo data
│   └── tests/
│       └── test_api.py           # Unit tests for CI
│
├── fastapi_v2/                   # Frontend (React + Vite)
│   ├── Dockerfile                # Multi-stage: deps → dev → build → nginx
│   ├── package.json
│   ├── vite.config.ts            # Dev proxy + Docker file watching
│   └── src/
│       ├── App.tsx
│       └── pages/
│           ├── Login.tsx
│           ├── Chat.tsx
│           └── Admin.tsx
│
├── docker/
│   ├── nginx/
│   │   └── nginx.conf            # Production: static files + reverse proxy
│   └── postgres/
│       └── init.sql              # Enables pgvector extension on first run
│
├── documents_juridiques/         # PDF legal documents for RAG
│   └── Code du travail.pdf
│
└── .github/
    └── workflows/
        ├── ci.yml                # CI: lint, test, build on every push/PR
        └── cd.yml                # CD: build & push Docker images on main
```

---

## 1.4 Step-by-Step: Development Mode

Development mode gives you **hot reload** for both backend and frontend — code changes
are reflected instantly without rebuilding containers.

### Step 1: Create your environment file

```powershell
# From the project root (chatbot-juridique/)
copy .env.example .env
```

Now open `.env` in your editor and fill in the real values:

```env
# These two are REQUIRED — the app won't start without them
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
DB_PASSWORD=toto99

# These have sensible defaults, change only if needed
DB_USER=postgres
DB_NAME=chatbot_db
DB_HOST=db
DB_PORT=5432
JWT_SECRET=super-secret-key-pour-ce-tp-1234
```

**Why `DB_HOST=db`?** Inside Docker's network, services refer to each other by their
service name defined in docker-compose.yml. The PostgreSQL service is named `db`, so
the backend connects to `db:5432` instead of `localhost:5432`.

### Step 2: Build and start all services

```powershell
docker compose up --build
```

**What this command does, step by step:**

1. **Reads `docker-compose.yml`** — finds 3 services: `db`, `backend`, `frontend`
2. **Reads `.env`** — injects your environment variables into each service
3. **Builds the backend image** (`backend/Dockerfile`, target: `dev`):
   - Uses your local `python:3.12-slim-bookworm` image
   - Installs system libs (`libpq-dev` for PostgreSQL driver)
   - Installs Python packages from `requirements.txt`
   - Creates a non-root user `appuser` for security
   - Sets command: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
4. **Builds the frontend image** (`fastapi_v2/Dockerfile`, target: `dev`):
   - Uses your local `node:20-alpine` image
   - Runs `npm ci` to install dependencies
   - Sets command: `npx vite --host 0.0.0.0 --port 5173`
5. **Starts `db` first** — Docker waits for its healthcheck (`pg_isready`) to pass
6. **Starts `backend`** — only after `db` is healthy. Runs `init_db()` which creates
   tables and seeds 4 default test users
7. **Starts `frontend`** — only after `backend` is up. Vite dev server proxies
   `/api/*` and `/token` requests to `http://backend:8000`

### Step 3: Access the application

Once you see logs like `Uvicorn running on http://0.0.0.0:8000` and `VITE ready`:

| Service    | URL                          | What you see                        |
|------------|------------------------------|-------------------------------------|
| Frontend   | http://localhost:5173        | Login page (React app)              |
| Backend    | http://localhost:8000/docs   | FastAPI auto-generated Swagger docs |
| Database   | localhost:5432               | Connect via pgAdmin or psql         |

**Default login credentials** (created by `init_db()`):
- Email: `ahmed@test.com` / Password: `password123`
- Email: `sarah@test.com` / Password: `password123`

### Step 4: Seed with richer demo data (optional)

```powershell
docker compose exec backend python seed.py
```

This creates 6 users and 6 realistic chat sessions covering Moroccan labor law,
family law, commercial law, and real estate law — in both French and Arabic.

To wipe everything and re-seed from scratch:

```powershell
docker compose exec backend python seed.py --reset
```

### Step 5: Develop with hot reload

Your local source code is **bind-mounted** into the containers:

| Local path              | Container path      | Effect                              |
|-------------------------|---------------------|-------------------------------------|
| `./backend/`            | `/app/backend/`     | Edit Python → uvicorn auto-reloads  |
| `./fastapi_v2/`         | `/app/`             | Edit React/TS → Vite HMR instant    |
| `./documents_juridiques/` | `/app/documents_juridiques/` | Add PDFs → available immediately |

**You don't need to rebuild** after code changes. Just save the file.

### Step 6: Stop development

```powershell
# Stop containers (database data is preserved in a Docker volume)
docker compose down

# Stop AND delete all data (database wiped)
docker compose down -v
```

---

## 1.5 Step-by-Step: Production Mode

Production mode builds optimized images with **gunicorn** (backend) and **nginx** (frontend).

### Step 1: Ensure `.env` has production values

```env
DB_PASSWORD=a_very_strong_password_here
GROQ_API_KEY=gsk_your_real_key
JWT_SECRET=generate-a-random-64-char-string-for-production
```

> In production, `JWT_SECRET` is **required** — the compose file will refuse to start
> without it (`JWT_SECRET:?JWT_SECRET is required in production`).

### Step 2: Build and start in detached mode

```powershell
docker compose -f docker-compose.prod.yml up --build -d
```

**What's different from dev:**

| Aspect           | Development                    | Production                           |
|------------------|--------------------------------|--------------------------------------|
| Backend server   | uvicorn with `--reload`        | gunicorn with 4 uvicorn workers      |
| Frontend         | Vite dev server (HMR)          | Static build served by nginx         |
| Proxy            | Vite dev proxy                 | nginx reverse proxy                  |
| Backend port     | Exposed at :8000               | Internal only (nginx proxies to it)  |
| DB port          | Exposed at :5432               | Internal only (not accessible)       |
| Source mounts    | Yes (hot reload)               | No (code baked into image)           |
| App URL          | http://localhost:5173          | http://localhost:80                   |

### Step 3: Access

Open **http://localhost** — nginx serves the React app and proxies API calls to the backend.

### Step 4: View logs and manage

```powershell
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# View only backend logs
docker compose -f docker-compose.prod.yml logs -f backend

# Restart backend only
docker compose -f docker-compose.prod.yml restart backend

# Stop everything
docker compose -f docker-compose.prod.yml down
```

---

## 1.6 Useful Docker Commands

```powershell
# Check running containers and their status
docker compose ps

# Open a bash shell inside the backend container
docker compose exec backend bash

# Open a psql shell in the database
docker compose exec db psql -U postgres -d chatbot_db

# Rebuild only one service (e.g., after changing Dockerfile)
docker compose up --build backend

# View real-time logs for a specific service
docker compose logs -f frontend

# Remove unused images to free disk space
docker image prune -f

# See disk usage by Docker
docker system df
```

---

## 1.7 Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `DB_PASSWORD is required` error | Missing `.env` file | Run `copy .env.example .env` and fill in values |
| Backend can't connect to DB | DB not ready yet | The healthcheck handles this — wait 10-15 seconds. If persistent: `docker compose down -v` then restart |
| Frontend shows "Network Error" | Backend not proxied correctly | Check that `vite.config.ts` has `/api` and `/token` proxy entries |
| File changes not detected (Windows) | Filesystem events don't cross Docker VM | `CHOKIDAR_USEPOLLING=true` is set in docker-compose.yml. For backend, uvicorn `--reload` handles it |
| `FAISS index not found` on first start | Normal — index builds on first run | Wait ~60 seconds. The backend will process PDFs from `documents_juridiques/` |
| Port 5432 already in use | Local PostgreSQL running | Stop your local PostgreSQL, or change `DB_PORT` in `.env` to `5433` |
| Port 5173/8000 already in use | Another dev server running | Stop the other server or change ports in docker-compose.yml |

---

# PART 2: CI/CD WITH GITHUB ACTIONS

---

## 2.1 What is CI/CD?

- **CI (Continuous Integration)** — Automatically runs lint, type-checks, tests, and build
  validation every time you push code or open a pull request. Catches bugs before they
  reach the main branch.

- **CD (Continuous Delivery)** — After CI passes on the `main` branch, automatically builds
  production Docker images and pushes them to GitHub Container Registry (GHCR). Optionally
  deploys to your server.

## 2.2 Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CI Pipeline (ci.yml)                        │
│            Triggers: push/PR to main or develop                 │
│                                                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │  Frontend    │   │   Backend    │   │  Docker Build        │ │
│  │             │   │              │   │  Validation          │ │
│  │ npm ci       │   │ pip install  │   │                      │ │
│  │ npm run lint │   │ ruff check   │   │ Build backend image  │ │
│  │ tsc --noEmit │   │ pytest       │   │ Build frontend image │ │
│  │ npm run build│   │              │   │ (no push, just test) │ │
│  └──────┬──────┘   └──────┬───────┘   └──────────┬───────────┘ │
│         │                  │            depends on ▲             │
│         └──────────────────┴───────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                    (only on push to main)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CD Pipeline (cd.yml)                        │
│                                                                 │
│  ┌─────────────┐   ┌──────────────────┐   ┌─────────────────┐  │
│  │  Run CI     │──▶│  Build & Push    │──▶│  Deploy         │  │
│  │  (gate)     │   │  to GHCR         │   │  (optional)     │  │
│  └─────────────┘   └──────────────────┘   └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 2.3 Step-by-Step: Setting Up GitHub Actions

### Step 1: Create a GitHub repository

```powershell
cd chatbot-juridique

# Initialize git if not already done
git init

# Add all files (secrets are protected by .gitignore)
git add .
git commit -m "Initial commit: Dockerized chatbot with CI/CD"

# Create repo on GitHub (via browser or CLI)
# Then link and push:
git remote add origin https://github.com/YOUR_USERNAME/chatbot-juridique.git
git branch -M main
git push -u origin main
```

> **Important:** The `.gitignore` file already excludes `.env` (your secrets),
> `node_modules`, `__pycache__`, and FAISS index files. They will NOT be pushed.

### Step 2: Add repository secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret Name    | Value                               | Required? |
|----------------|-------------------------------------|-----------|
| `GROQ_API_KEY` | Your Groq API key (`gsk_...`)       | Yes — needed for backend tests that call the AI |

**Secrets you do NOT need to add:**
- `GITHUB_TOKEN` — automatically provided by GitHub Actions (used for GHCR push)
- `DB_PASSWORD` — the CI uses a hardcoded test password for the ephemeral test database

### Step 3: Verify CI triggers

The CI pipeline is already configured in `.github/workflows/ci.yml`. It will
**automatically run** when you:

- **Push** to `main` or `develop` branches
- **Open a pull request** targeting `main` or `develop`

After pushing, go to your repo → **Actions** tab to see it running.

### Step 4: Understand what CI checks

**Frontend job** (`fastapi_v2/`):
1. `npm ci` — Install exact dependency versions from `package-lock.json`
2. `npm run lint` — ESLint checks for code quality issues
3. `npx tsc --noEmit` — TypeScript compiler checks for type errors (without generating output)
4. `npm run build` — Ensures the production build completes without errors
5. Uploads the `dist/` build artifact (downloadable for 7 days)

**Backend job** (`backend/`):
1. Spins up a **real PostgreSQL + pgvector** service container for testing
2. `pip install -r requirements.txt` — Install all Python dependencies
3. `pip install ruff pytest httpx` — Install test/lint tools
4. `ruff check .` — Fast Python linter (like ESLint for Python)
5. `pytest tests/ -v` — Runs unit tests against the real database:
   - Tests module imports work
   - Tests password hashing (bcrypt)
   - Tests JWT token creation and verification
   - Tests RAG text chunking logic
   - Tests database URL is built correctly
   - Tests FastAPI app can be created

**Docker build job** (runs after both above pass):
1. Builds the backend production image — validates the Dockerfile works
2. Builds the frontend production image — validates the Dockerfile works
3. Does NOT push images (that's the CD pipeline's job)
4. Uses GitHub Actions cache to speed up subsequent builds

### Step 5: Understand what CD does

The CD pipeline (`.github/workflows/cd.yml`) only runs on **push to `main`**
(not on PRs or develop). It:

1. **Re-runs all CI checks** as a safety gate
2. **Logs into GHCR** (GitHub Container Registry) using the auto-provided `GITHUB_TOKEN`
3. **Builds production Docker images** for backend and frontend
4. **Pushes them to GHCR** with two tags:
   - `latest` — always points to the newest build
   - `<commit-sha>` — unique tag for this exact commit (for rollbacks)

After CD runs, your images will be available at:
```
ghcr.io/YOUR_USERNAME/chatbot-juridique/backend:latest
ghcr.io/YOUR_USERNAME/chatbot-juridique/frontend:latest
```

### Step 6: Pull and deploy on your server (optional)

If you have a VPS/cloud server, you can deploy the pushed images:

```bash
# On your server:

# 1. Clone the repo (only need docker-compose.prod.yml and .env)
git clone https://github.com/YOUR_USERNAME/chatbot-juridique.git
cd chatbot-juridique

# 2. Create production .env
cp .env.example .env
nano .env  # Fill in real production values

# 3. Pull the pre-built images from GHCR
docker login ghcr.io -u YOUR_USERNAME
docker pull ghcr.io/YOUR_USERNAME/chatbot-juridique/backend:latest
docker pull ghcr.io/YOUR_USERNAME/chatbot-juridique/frontend:latest

# 4. Start with the production compose file
docker compose -f docker-compose.prod.yml up -d

# 5. Seed the database (first time only)
docker compose -f docker-compose.prod.yml exec backend python seed.py
```

To enable **automatic deployment via SSH** (fully automated), uncomment the `deploy` 
job in `.github/workflows/cd.yml` and add these secrets:

| Secret Name       | Value                        |
|-------------------|------------------------------|
| `DEPLOY_HOST`     | Your server IP (e.g., `142.93.xxx.xxx`) |
| `DEPLOY_USER`     | SSH username (e.g., `root` or `deploy`) |
| `DEPLOY_SSH_KEY`  | Your private SSH key (full content) |

---

## 2.4 Complete Workflow: Daily Development

Here's the typical daily workflow with Docker + CI/CD:

```
1. Start your dev environment:
   > docker compose up

2. Write code (backend Python or frontend React)
   → Changes auto-reload instantly (hot reload)

3. Test locally in browser:
   → http://localhost:5173

4. Commit and push to a feature branch:
   > git checkout -b feature/new-chat-ui
   > git add .
   > git commit -m "Add new chat UI component"
   > git push origin feature/new-chat-ui

5. Open a Pull Request on GitHub
   → CI automatically runs: lint, type-check, test, build
   → See green checkmarks or red failures in the PR

6. Fix any CI failures, push again
   → CI re-runs automatically

7. Merge PR into main
   → CI runs again on main
   → CD kicks in: builds + pushes Docker images to GHCR
   → (Optional) Auto-deploys to your server

8. Stop dev environment when done:
   > docker compose down
```

---

## 2.5 Environment Variables Reference

| Variable       | Required | Default                              | Where used     | Description                     |
|----------------|----------|--------------------------------------|----------------|---------------------------------|
| `DB_PASSWORD`  | **Yes**  | —                                    | Docker, local  | PostgreSQL password             |
| `GROQ_API_KEY` | **Yes**  | —                                    | Docker, local, CI | Groq API key for LLM        |
| `DB_USER`      | No       | `postgres`                           | Docker, local  | PostgreSQL user                 |
| `DB_NAME`      | No       | `chatbot_db`                         | Docker, local  | PostgreSQL database name        |
| `DB_HOST`      | No       | `db` (Docker) / `localhost` (local)  | Docker, local  | Database hostname               |
| `DB_PORT`      | No       | `5432`                               | Docker, local  | Database port                   |
| `JWT_SECRET`   | **Prod** | `super-secret-key-pour-ce-tp-1234`   | Docker, local  | JWT token signing key           |

---

## 2.6 Troubleshooting CI/CD

| Problem | Fix |
|---------|-----|
| CI fails on `npm ci` | You may be missing `package-lock.json`. Run `npm install` locally and commit the lockfile |
| CI fails on `npm run lint` | Fix ESLint errors locally first: `cd fastapi_v2 && npm run lint` |
| CI fails on `tsc --noEmit` | Fix TypeScript errors: `cd fastapi_v2 && npx tsc --noEmit` |
| CI fails on `ruff check` | Fix Python lint errors: `cd backend && ruff check .` |
| CI fails on pytest | Run tests locally: `cd backend && python -m pytest tests/ -v` |
| CD fails on GHCR push | Check that Actions has `packages: write` permission (it's already set in cd.yml) |
| CD doesn't trigger | CD only runs on push to `main` branch and ignores `.md` file changes |
| Workflow file not detected | Ensure `.github/workflows/ci.yml` is committed and pushed |

---

## 2.7 Local Development Without Docker

The codebase is fully compatible with running without Docker:

```powershell
# Terminal 1: Start PostgreSQL locally (must have it installed)
# Or use your pgvector Docker container standalone:
docker run -d --name chatbot-db -p 5432:5432 -e POSTGRES_PASSWORD=toto99 -e POSTGRES_DB=chatbot_db pgvector/pgvector:0.8.2-pg18-trixie

# Terminal 2: Backend
cd backend
pip install -r requirements.txt
$env:DB_HOST="localhost"    # PowerShell syntax
$env:DB_PASSWORD="toto99"
$env:GROQ_API_KEY="gsk_your_key"
uvicorn main:app --reload --port 8000

# Terminal 3: Frontend
cd fastapi_v2
npm install
npm run dev
```

The Vite proxy in `vite.config.ts` defaults to `http://localhost:8000`, so
API calls from the frontend reach the backend seamlessly.
