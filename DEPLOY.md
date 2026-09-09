# Deploying this project

Vercel is a great fit for the Next.js frontend, but not for the FastAPI + PyTorch
backend — Vercel's Python functions currently cap at a 500MB bundle (5GB only in a beta
that needs Fluid Compute + Active CPU pricing) and Vercel's own docs frame that as
edge-case territory for ML models, not a recommended pattern. So this splits the backend
and frontend across two services, which is also what `plan.md` originally intended
("public web demo will be hosted separately, preferably Hugging Face Spaces"):

- **Backend** (`src/api.py`, PyTorch model) → **Hugging Face Spaces** (Docker SDK, free tier)
- **Frontend** (`frontend/`, Next.js) → **Vercel**

## 1. Backend → Hugging Face Spaces

1. Create a free account at huggingface.co if you don't have one.
2. Click **New Space** (top-right → "New" → "Space").
   - Space name: anything, e.g. `pneumonia-xray-api`.
   - **SDK: Docker** → template "Blank".
   - Visibility: Public (so your Vercel frontend can reach it) or Private if you upgrade
     to a plan that supports private Space-to-Space calls — Public is simplest.
   - Hardware: the free **CPU basic** tier is enough for this model.
3. Once the Space is created, open its **Files** tab and upload these files/folders
   (drag-and-drop works, no git required):
   - `Dockerfile` (provided — see below)
   - `requirements.txt` (already in your project root)
   - the whole `src/` folder (all 6 files)
   - `artifacts/best_model.pt` (create an `artifacts` folder in the Space and upload the
     checkpoint into it — this is the one place the model weights need to leave your
     machine; nothing else from `artifacts/` is needed for serving)
4. The Space will build automatically after each upload (watch the **Logs** tab). Once it
   says "Running", your API is live at:
   `https://<your-username>-<space-name>.hf.space`
5. Sanity check: open `https://<your-username>-<space-name>.hf.space/health` in a
   browser — you should see `{"ready": true, "device": "cpu"}`.

Free-tier Spaces sleep after a period of inactivity; the first request after a while
will be slow (cold start, ~20-60s) while it wakes up and reloads the model. That's normal
for a free demo.

### CORS

`src/api.py` was updated to allow requests from any origin (`allow_origins=["*"]`) since
this API has no authentication/cookies (`allow_credentials=False`) — that's safe here and
means you don't have to keep an allowlist in sync with Vercel's production and preview
URLs. If you'd rather restrict it, set an `ALLOWED_ORIGINS` environment variable on the
Space (comma-separated list of exact origins, e.g.
`https://your-app.vercel.app,http://localhost:3000`) under the Space's **Settings →
Variables**.

## 2. Frontend → Vercel

You don't need GitHub for this — the Vercel CLI can deploy straight from your machine:

```powershell
cd frontend
npm install -g vercel      # one-time
vercel login               # opens a browser to authenticate
vercel                     # first deploy: answer the prompts (link/create project)
```

When it asks for the project settings, accept the auto-detected Next.js framework. After
the first `vercel` run it creates a preview deployment; run `vercel --prod` to promote it
to your production URL (or just answer "yes" to the prompt asking to deploy to
production).

Then set the one environment variable the frontend needs, pointing at your Space:

```powershell
vercel env add NEXT_PUBLIC_API_URL
```

Paste in `https://<your-username>-<space-name>.hf.space` when prompted, select all three
environments (Production/Preview/Development), then redeploy so the build picks it up:

```powershell
vercel --prod
```

(If you'd rather use the Vercel dashboard/GitHub integration instead of the CLI: push this
repo to GitHub, "Add New Project" in Vercel, import the repo, set **Root Directory** to
`frontend`, add `NEXT_PUBLIC_API_URL` under Project Settings → Environment Variables with
the same value, then deploy.)

## 3. Verify

Open your Vercel URL, upload a test X-ray, and click Analyze. If it fails, check:
- Browser console/network tab — a CORS or connection error usually means
  `NEXT_PUBLIC_API_URL` is missing/wrong, or the Space is still asleep/building.
- The Space's `/health` endpoint directly, to confirm the model loaded.

## Worth knowing before this goes public

Per `CLAUDE.md`, the decision threshold (0.95) baked into `artifacts/best_model.pt` was
selected by sweeping over the locked test set rather than validation data — the reported
92.3%/90.5% test metrics aren't a fully clean held-out evaluation. Not a blocker for a
portfolio/demo deployment, but worth being upfront about (and the app already carries a
clear "not a diagnosis" disclaimer, which should stay regardless of where it's hosted).
