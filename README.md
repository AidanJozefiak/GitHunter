# GitHunter

> AI-powered GitHub profile analyzer for recruiters and developers

**[▶ Live demo](https://git-hunter-nu.vercel.app/)** · **[Full walkthrough](https://github.com/user-attachments/assets/d8d318c7-d034-4e95-a8eb-225ffc930945)**

![GitHunter demo](docs/demo.gif)

GitHunter takes any GitHub username and generates a comprehensive hiring-grade report, with AI scoring, code quality analysis, strengths/weaknesses, technical highlights, and exportable PDF or Google Slides presentations.

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the App](#running-the-app)
- [API Reference](#api-reference)
- [Hosting Guide](#hosting-guide)
- [Testing](#testing)
- [Project Structure](#project-structure)

---

## Features

- **GitHub Profile Analysis** — Fetches user data, repositories, commits, pull requests, stars, forks, and pinned repos via the GitHub REST and GraphQL APIs.
- **AI Scoring (Gemini)** — Scores candidates across five weighted categories: Code Quality, Project Complexity, Documentation, Consistency, and Technical Breadth. Powered by Google Gemini.
- **Job Description Matching** — Paste a job listing and the AI re-weights its scoring criteria to match what that role actually needs.
- **Dual View Modes** — Switch between a **Recruiter** view (hiring recommendation, overall fit) and a **Developer** view (technical deep-dive).
- **PDF Export** — Download a formatted report PDF for any analyzed profile.
- **Google Slides Export** — Generate a shareable presentation from any report via the Google Slides API.
- **Enterprise Portal** — A dashboard listing all archived candidate reports (backed by Supabase), with one-click navigation to any profile report.
- **Redis Caching** — Reports and job statuses are cached in Redis to avoid redundant API calls. Gracefully falls back to direct API calls if Redis is unavailable.
- **Job Queue** — Analysis jobs are queued via Bull (Redis-backed) so the frontend can poll for progress without blocking.

---

## Architecture Overview

```
┌──────────────────────────────────────────┐
│              Frontend (HTML/JS)          │
│  interface.css · script.js               │
│  ReportView.html · EnterpriseView.html   │
└────────────────┬─────────────────────────┘
                 │ HTTP (REST)
┌────────────────▼─────────────────────────┐
│           Backend (Node/Express)         │
│  POST /api/analyze   → enqueue job       │
│  GET  /api/status/:jobId                 │
│  GET  /api/report/:jobId                 │
│  GET  /api/download/:jobId  (PDF)        │
│  POST /api/slides/generate               │
│  GET  /api/enterprise/list               │
└──────┬───────────────┬───────────────────┘
       │               │
┌──────▼──────┐  ┌─────▼──────────────────┐
│    Redis    │  │     External APIs      │
│ Job Queue   │  │  GitHub REST + GraphQL │
│ Report Cache│  │  Google Gemini AI      │
└─────────────┘  │  Google Slides API     │
                 │  Supabase (archive)    │
                 └────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript, Chart.js |
| Backend | Node.js, Express 5 |
| AI Analysis | Google Gemini (`gemini-3-flash-preview`) |
| Job Queue | Bull + Redis |
| Caching | Redis (ioredis) |
| PDF Generation | PDFKit |
| Slides Export | Google Slides API (OAuth or Service Account) |
| Long-term Archive | Supabase (PostgreSQL) |
| Testing | Jest, Supertest |

---

## Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later
- **Redis** (local or hosted — e.g. Redis Cloud, Upstash)
- **GitHub Personal Access Token** *(optional but strongly recommended — raises rate limit from 60 to 5,000 req/hour)*
- **Google Gemini API key** — for AI scoring ([get one here](https://aistudio.google.com/apikey))
- **Google OAuth credentials** *(optional)* — for Google Slides export
- **Supabase project** *(optional)* — for the Enterprise archive portal

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/GitHunter.git
cd GitHunter
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials — see [Configuration](#configuration) below.

### 4. Start Redis

If running Redis locally:

```bash
redis-server
```

Or point `REDIS_URL` at a hosted Redis instance. The app runs without Redis but loses caching and the job queue.

---

## Configuration

All configuration lives in `backend/.env`. Copy `backend/.env.example` and fill in the values:

```env
# GitHub (REQUIRED) — one analysis makes 300-400 API calls.
# Unauthenticated (60/hour) cannot complete a single run; authenticated is 5,000/hour.
# Create a fine-grained token at https://github.com/settings/personal-access-tokens
# No scopes and no repository access are needed, it only reads public data.
GITHUB_TOKEN=your_token_here

# Redis (required for job queue and caching)
REDIS_URL=redis://localhost:6379

# Cache TTL in seconds (default: 1 hour)
REPORT_CACHE_TTL=3600

# Gemini model id. Avoid -preview models in production; they get retired without notice.
GEMINI_MODEL=gemini-flash-latest

# Comma-separated list of origins allowed to call this API (CORS).
ALLOWED_ORIGINS=https://git-hunter-nu.vercel.app

# Abuse and cost guards on POST /api/analyze
ANALYZE_RATE_LIMIT=3          # per IP per hour
DAILY_ANALYSIS_CAP=40         # global, all users, per day

# Google Gemini API key (required for AI analysis)
# Get one at: https://aistudio.google.com/apikey
GEMINI_API_KEY=your_api_key_here

# --- Google Slides (optional) ---
# OAuth is recommended for personal use (no Workspace required)
# See backend/docs/GOOGLE_SLIDES_OAUTH_SETUP.md for setup instructions
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REFRESH_TOKEN=

# Optional: clone this Drive file as the slide template
# SLIDES_TEMPLATE_ID=

# Optional: save generated slides to this Drive folder
# SLIDES_DRIVE_FOLDER_ID=

# How long (ms) before deleting the server's copy of the presentation (default: 5 min)
# SLIDES_CLEANUP_DELAY_MS=300000

# --- Supabase (REQUIRED for the archive + demo gallery) ---
# Reports are archived here permanently; the frontend reads demo reports
# directly from Supabase so the gallery works even when the backend is asleep.
# See backend/docs/SUPABASE_SETUP.md for the table schema and RLS policy.
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

---

## Running the App

### Start the backend

```bash
cd backend
npm start
# Server running on port 5000
```

The server defaults to port **5000**. Override with `PORT=3000 npm start`.

### Open the frontend

```bash
# Using Python's built-in server
cd frontend
python3 -m http.server 8080
# Visit http://localhost:8080/ReportView.html
```

> **Note:** `API_BASE` in `script.js` auto-detects the environment — `http://localhost:5000` when served from localhost, the production backend otherwise. Override it by setting `window.GITHUNTER_API_BASE` before `script.js` loads.

---

## API Reference

All routes are prefixed with `/api`.

### Analyze a GitHub profile

```
POST /api/analyze
Content-Type: application/json

{
  "username": "torvalds",
  "view": "recruiter",           // "recruiter" (default) | "developer"
  "jobDescription": "..."        // optional: paste a job listing to tune scoring weights
}
```

**Response:** `202 Accepted` → `{ "jobId": "42" }`

---

### Poll job status

```
GET /api/status/:jobId
```

**Response:** `{ "status": "queued|processing|completed|failed", "progress": 0-100 }`

---

### Fetch completed report

```
GET /api/report/:jobId
```

Returns the full report including:
- `report` — GitHub user data and repository stats
- `scores` — overall and per-category scores (0–100)
- `scoreBreakdown` — plain-English explanation of the score
- `strengthsWeaknesses` — strengths and weaknesses arrays
- `technicalHighlights` — notable frameworks, patterns, and repos
- `improvementSuggestions` — actionable improvement items
- `hiringRecommendation` — final hire/no-hire recommendation

---

### Fetch latest report by username

```
GET /api/report/latest/:username
```

Returns the most recently cached report for that username.

---

### Download PDF report

```
GET /api/download/:jobId
GET /api/download/latest/:username
```

Returns a `Content-Disposition: attachment` PDF response.

---

### Generate Google Slides presentation

```
POST /api/slides/generate
Content-Type: application/json

{ "username": "torvalds" }
```

**Response:** `{ "url": "...", "copyUrl": "...", "presentationId": "..." }` — open `copyUrl` to save a copy to your Drive.

---

### Enterprise portal

```
GET /api/enterprise/list
```
Returns `[{ username, score, avatar_url }]` for all archived reports in Supabase.

```
GET /api/enterprise/ensure/:username
```
Ensures a report is in Redis (loads from Supabase if missing).

---

## Hosting Guide

GitHunter runs on free tiers across four services. This is the live deployment.

| Component | Service | Notes |
|---|---|---|
| Frontend | Vercel | Static, no build step, global CDN |
| Backend | Render Web Service | Free tier; sleeps after ~15 min idle |
| Cache + job queue | Render Key Value | Free tier, 25MB, no disk persistence |
| Report archive | Supabase (Postgres) | Free tier; permanent storage |

### Why the demo doesn't touch the backend

An analysis makes 300–400 GitHub API calls and takes 2–4 minutes, and a free-tier
backend takes ~50 seconds to wake from sleep. Asking a first-time visitor to sit
through that would fail.

Instead, a set of pre-analyzed profiles is flagged `is_demo = true` in Supabase, and
the frontend reads those rows **directly from Supabase** using the publishable key,
constrained by a row-level security policy to demo rows only. The gallery loads in
under a second and works whether or not the backend is awake. Live analysis of a new
username is the only path that touches the API.

### Backend — Render

1. **New → Key Value** (free). Copy the **Internal** connection URL.
2. **New → Web Service**, connect the repo:
   - Root Directory: `backend`
   - Build: `npm install`
   - Start: `node index.js`
3. Add every variable from [Configuration](#configuration). Leave all `GOOGLE_*`
   unset to disable Slides export.
4. Verify: `curl https://<your-backend>.onrender.com/api/health` → `{"ok":true,"redis":true,"slides":false}`

`redis: true` is the one that matters — Bull's job queue hard-requires Redis, so
`POST /api/analyze` fails without it (the cache alone degrades gracefully).

### Database — Supabase

Create a project, then run the schema and RLS policy in
[`backend/docs/SUPABASE_SETUP.md`](backend/docs/SUPABASE_SETUP.md).

Two keys, and they are not interchangeable:

- **Secret key** (`sb_secret_...`) — backend only. Bypasses RLS.
- **Publishable key** — safe in frontend code. Restricted by RLS to demo rows.

### Frontend — Vercel

Import the repo, set **Root Directory** to `frontend`, framework preset **Other**,
no build command. Then set `ALLOWED_ORIGINS` on the backend to the Vercel URL or
every browser request fails CORS.

### Seeding the demo gallery

Raise `ANALYZE_RATE_LIMIT` temporarily, run an analysis per profile (one at a time —
each takes 2–4 minutes), then flag them:

```sql
update archived_reports set is_demo = true where username in ('torvalds', ...);
```

Set `ANALYZE_RATE_LIMIT` back to 3 afterwards.

### Keeping it alive

Two free-tier timers will silently kill the deployment:

- Render spins the backend down after ~15 minutes idle
- **Supabase pauses a free project after 7 days of low activity**

`.github/workflows/keepalive.yml` pings both during waking hours. The Supabase pause
is the dangerous one — it happens with no warning, and the demo gallery depends on it.


## Testing

```bash
cd backend

# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests (requires running backend)
npm run test:integration

# Cache integration tests (requires Redis)
npm run test:cache:integration

# v2 suite (AI analysis, Redis, Slides, user routes)
npm run test:v2
```

---

## Project Structure

```
GitHunter/
├── backend/
│   ├── index.js                   # Entry point — loads env, starts server
│   ├── package.json
│   ├── .env.example
│   ├── docs/
│   │   ├── GOOGLE_SLIDES_OAUTH_SETUP.md
│   │   └── SUPABASE_SETUP.md
│   ├── scripts/
│   │   ├── obtain-google-oauth-token.js   # One-time OAuth token helper
│   │   └── diagnose-slides-config.js      # Slides config debugger
│   ├── src/
│   │   ├── index.js               # Express app setup, CORS, route mounting
│   │   ├── config/
│   │   │   └── env.js             # Centralised environment config + defaults
│   │   ├── routes/
│   │   │   ├── analyze.js         # POST /api/analyze, GET /api/status, /report, /download
│   │   │   ├── user.js            # GET /api/user/:username
│   │   │   ├── matchmaker.js      # GET /api/matchmaker
│   │   │   ├── slides.js          # POST /api/slides/generate
│   │   │   └── enterprise.js      # GET /api/enterprise/list|ensure
│   │   ├── services/
│   │   │   ├── aiService.js       # Gemini prompt building + scoring + normalisation
│   │   │   ├── githubService.js   # GitHub API calls, report building, repo sorting
│   │   │   ├── githubApi.js       # Axios instance with GitHub auth headers
│   │   │   ├── analysisService.js # Orchestrates GitHub → AI → cache pipeline
│   │   │   ├── overviewService.js # Per-repo README, commits, pull requests
│   │   │   ├── pdfService.js      # PDFKit report generation
│   │   │   ├── slidesService.js   # Google Slides presentation generation
│   │   │   └── archiveService.js  # Supabase read/write for report archive
│   │   ├── utils/
│   │   │   ├── cache.js           # Redis connection + report/job status helpers
│   │   │   ├── queue.js           # Bull job queues (analysis + cleanup)
│   │   │   └── codeParser.js      # Code file utilities
│   │   ├── workers/
│   │   │   └── analysisWorker.js  # Bull worker — processes analysis jobs
│   │   └── codeSource/
│   │       ├── apiSource.js       # Fetches code samples from GitHub repos
│   │       └── index.js
│   └── tests/
│       ├── v1/                    # Unit + integration tests
│       └── v2/                    # AI analysis, Redis, Slides, route tests
└── frontend/
    ├── index.html                 # Main search + report UI (entry point)
    ├── ReportView.html            # Redirect stub (legacy links)
    ├── EnterpriseView.html        # Enterprise candidate portal
    ├── script.js                  # All frontend logic (search, polling, rendering)
    ├── interface.css              # Styles
    └── res/                       # Icons and logo assets
```

---

## Credits

Built at St. John's Hacks 2026 by Richard Perez, Justin Cracchiolo, Brandon Singh, and Aidan Jozefiak.

## License

ISC
