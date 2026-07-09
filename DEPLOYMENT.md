# Deploying to Railway

This repo has two services (backend, frontend) plus a database. Railway can
run all three from this one repo. Order matters below because the frontend
needs the backend's URL, and the backend needs the frontend's URL -- so
backend goes first, then frontend, then a quick loop back to the backend.

## 1. Push to GitHub

Push this folder to a GitHub repo (you said you've got this covered). Just
double check `.env` isn't in it -- `git status` should not list it. It's in
`.gitignore` already, but worth a glance before your first push since it has
your real API keys in it.

## 2. Create the Railway project

1. New Project -> Deploy from GitHub repo -> pick this repo.
2. Add a database: New -> Database -> PostgreSQL. Note its service name
   (usually "Postgres") -- you'll reference it from the backend.

## 3. Backend service

1. New -> GitHub repo -> same repo again. In its Settings -> Source, set
   **Root Directory** to `backend`. Railway will pick up `backend/railway.toml`
   and `backend/Dockerfile` automatically.
2. Settings -> Networking -> Generate Domain. Copy that URL (something like
   `resume-matcher-backend-production.up.railway.app`) -- you'll need it in
   step 4 and 5.
3. Variables tab, add:

   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=<any long random string>
   ENVIRONMENT=production
   CORS_ORIGINS=["http://localhost:5173"]
   FRONTEND_URL=http://localhost:5173

   GOOGLE_CLIENT_ID=<from your .env>
   ADZUNA_APP_ID=<from your .env>
   ADZUNA_APP_KEY=<from your .env>
   REED_API_KEY=<from your .env>
   JOOBLE_API_KEY=<from your .env>

   SMTP_SERVER=<your real SMTP host, or leave unset>
   SMTP_PORT=587
   SMTP_USER=<your real SMTP user, or leave unset>
   SMTP_PASSWORD=<your real SMTP password, or leave unset>

   ENABLE_JOB_SYNC_SCHEDULER=true
   JOB_SYNC_INTERVAL_HOURS=24
   ```

   `${{Postgres.DATABASE_URL}}` is Railway's syntax for pulling a variable
   from another service in the same project -- replace `Postgres` with
   whatever you actually named that service if you changed it.
   `CORS_ORIGINS`/`FRONTEND_URL` are placeholders for now; step 5 replaces
   them with the real frontend URL.

4. Deploy. Check the logs -- you should see uvicorn start up, then (about 2
   minutes later) `[scheduler] Starting scheduled job sync...`.

## 4. Frontend service

1. New -> GitHub repo -> same repo again. Root Directory: `frontend`.
2. This one needs **Build Variables** specifically (not regular runtime
   variables) since Vite bakes them into the JS bundle when it builds, not
   when it runs:

   ```
   VITE_API_URL=https://<your backend domain from step 3.2>/api
   VITE_GOOGLE_CLIENT_ID=<same value as backend's GOOGLE_CLIENT_ID>
   ```

3. Settings -> Networking -> Generate Domain. Copy this URL too.
4. Deploy.

## 5. Close the loop

Now that both URLs exist:

- Back on the **backend** service's Variables, update:
  ```
  CORS_ORIGINS=["https://<your frontend domain from step 4.3>"]
  FRONTEND_URL=https://<your frontend domain from step 4.3>
  ```
  Redeploy the backend for this to take effect.

- In Google Cloud Console (Credentials -> your OAuth client -> Authorized
  JavaScript origins), add `https://<your frontend domain>` alongside
  `http://localhost:5173`. Takes a minute or two to propagate.

## 6. Test it

Open the frontend URL. Register an account, try Google sign-in, upload a
resume. Jobs won't show up immediately -- the first sync runs ~2 minutes
after the backend deploys, and only pulls from whichever sources have real
API keys set (empty ones just no-op, see backend logs). Give it a few
minutes, then check the backend service's logs in Railway for the
`[scheduler]` sync summary.

## Notes

- No manual migration step needed -- the backend creates its tables on
  first boot. There's also no seed data, per your call earlier this
  project ("i dont want any seeded jobs") -- it starts empty and fills in
  from the real sources on the first scheduled sync.
- Free Railway usage has monthly credit limits; three always-on services
  (Postgres + backend + frontend) plus a recurring job sync will use more
  of that than an app that's just idle most of the time. Worth keeping an
  eye on usage in Railway's dashboard the first few days.
- Local Docker Compose still works exactly as before for development --
  none of this changes anything about running it on your machine.
