# Resume Parser & Job Matcher

**Live demo:** [bubbly-adventure-production.up.railway.app](https://bubbly-adventure-production.up.railway.app)

A personal job-search tool: upload your resume, it parses out your skills,
experience, and education, then matches you against real job listings pulled
in from a dozen live sources - ranked by a hybrid skill + semantic score.

## Features

- Resume parsing (PDF/DOCX) - extracts skills, years of experience,
  education, job titles, languages, and certifications
- Job matching - hybrid score combining skill overlap, TF-IDF semantic
  similarity, experience-level fit, and nice-to-have skills
- Job aggregation from Remotive, RemoteOK, Arbeitnow, We Work Remotely,
  Working Nomads, Adzuna, Reed, and Jooble, plus direct company boards on
  Greenhouse, Lever, and Ashby (Jane Street, Jump Trading, Optiver, and
  others)
- Google Sign-In or email/password auth
- Forgot-password flow (emails a reset link if SMTP is configured; safely
  no-ops otherwise)
- Save jobs, track applications, dark mode
- Daily background sync so new listings show up automatically - no manual
  refresh needed

## Stack

- **Backend**: FastAPI, SQLAlchemy, PostgreSQL, spaCy, APScheduler
- **Frontend**: React, Vite, Tailwind CSS
- **Infra**: Docker Compose locally, Railway for deployment

## Running locally

```bash
git clone <this repo>
cd resume-job-matcher
cp .env.example .env   # fill in whichever optional keys you have
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

The database schema is created automatically on first boot -- no migration
step. There's no seed data; the app starts empty and fills in once the
job-sync scheduler runs (about 2 minutes after startup, then once a day).

## Configuration

Everything in `.env` is optional except the database connection, which
`docker-compose.yml` already sets up for you locally. See `.env.example` for
the full list and where to get each key:

- `GOOGLE_CLIENT_ID` - enables the "Sign in with Google" button
- `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`, `REED_API_KEY`, `JOOBLE_API_KEY` -
  each additional job source you configure adds more listings to the sync
- `SMTP_SERVER` / `SMTP_USER` / `SMTP_PASSWORD` - sends real
  forgot-password emails; without these, the reset link just gets logged
  instead
- `ENABLE_JOB_SYNC_SCHEDULER` / `JOB_SYNC_INTERVAL_HOURS` - controls the
  automatic job sync

Sources without keys configured just no-op during sync - nothing breaks if
you leave some blank.

## Useful commands

```bash
make dev          # docker-compose up --build
make sync-jobs    # trigger a job sync manually
make logs         # tail all container logs
make clean        # stop containers, wipe volumes and __pycache__
```

See the `Makefile` for the full list.

## Deployment

See `DEPLOYMENT.md` for the Railway setup (backend, frontend, and Postgres
as three services from this same repo).

## Project structure

```
backend/
  routes/          # FastAPI routers (auth, resumes, jobs, matching, applications)
  services/        # resume parsing, skill extraction, matching, job sourcing
  data/            # job sync entrypoint
  models.py        # SQLAlchemy models
frontend/
  src/pages/       # route-level views
  src/components/  # shared UI pieces
  src/services/    # API client
```
