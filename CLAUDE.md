# CLAUDE.md

This file gives Claude (or any AI coding assistant) the context needed to work in this
repository without re-discovering it from scratch.

## What this project is

A university/portfolio project that classifies chest X-ray images as **Normal** or
**Pneumonia positive** using a PyTorch CNN, served through a local FastAPI backend and a
Next.js frontend (plus a simpler standalone Gradio app). It is explicitly **not** a
clinical diagnostic tool — every surface (API, Gradio app, frontend) carries a disclaimer
that a qualified clinician must interpret real X-rays.

Per `plan.md`, the target is **>=90% test accuracy** and **>=90% pneumonia precision** on
a locked, patient-independent test split, with recall/F1/ROC-AUC also reported. See
"Current model status" below — the target is technically met, but with an important
caveat about how the decision threshold was chosen.

## Repository layout

```
Pnenia Model/
├── app.py                  # Standalone Gradio app (loads model directly, port 7860)
├── src/
│   ├── data.py              # CLASS_NAMES, dataset root resolution, image verification,
│   │                        #   train/eval transforms, XrayDataset
│   ├── model.py             # create_model() — thin wrapper around timm.create_model
│   ├── train.py             # Training entrypoint: split, class-weighted CE loss,
│   │                        #   AdamW + ReduceLROnPlateau, early stopping,
│   │                        #   choose_threshold(), saves best_model.pt + training_report.json
│   ├── evaluate.py           # One-shot locked-test evaluation -> test_report.json +
│   │                        #   test_confusion_matrix.png
│   └── api.py                # FastAPI backend (port 8000) used by the Next.js frontend
├── notebooks/
│   ├── train_on_kaggle.ipynb        # Clean/reusable Kaggle training notebook template
│   └── notebook88d896ab16 (1).ipynb # The ACTUAL exploratory notebook run on Kaggle that
│                                     #   produced the current artifacts (see caveat below)
├── artifacts/               # Git-ignored. Trained checkpoint + reports (see below)
├── chest_xray/               # Git-ignored dataset (see "Dataset" section — has duplicates)
├── frontend/                 # Next.js 16 / React 19 app (the actual user-facing UI)
│   ├── app/page.js, layout.js, globals.css   # Currently LIVE frontend (see caveat below)
│   └── changed-files-backup-20260826/        # Backup of a fancier, Tailwind-styled,
│                                              #   Poppins-font version of the same files
├── plan.md                   # Original project plan/spec — aspirational in places, see gaps
├── README.md                  # Setup/run instructions (accurate for the current 2-process setup)
├── requirements.txt
├── commands.txt               # Just the shorthand run commands from the README
└── pneumonia-project-source.zip  # Zipped src/ for uploading as a private Kaggle Dataset
```

## How the pieces fit together (2 ways to run it)

**Option A — full app (what README documents):**
1. `python -m uvicorn src.api:app --host 127.0.0.1 --port 8000` — FastAPI backend, loads
   `artifacts/best_model.pt`, exposes `POST /predict` (multipart file upload) and `GET /health`.
2. `cd frontend && npm run dev` — Next.js UI at `http://localhost:3000`, calls the API above
   via `NEXT_PUBLIC_API_URL` (defaults to `http://127.0.0.1:8000`). CORS is locked to
   `localhost:3000` / `127.0.0.1:3000` in `src/api.py`.

**Option B — standalone Gradio app:** `python app.py` runs a self-contained Gradio UI on
port 7860 (env `PORT` overrides) that loads the model itself — no separate API process.
Useful for quick manual testing without the Next.js stack.

Both `app.py` and `src/api.py` independently load `artifacts/best_model.pt` and duplicate
the same inference logic (softmax -> pneumonia probability -> compare to
`checkpoint["threshold"]`). If you change inference logic, update both.

## Training / evaluation pipeline

- `src/data.py`: `resolve_data_root()` walks the given path to find the first directory
  that directly contains `train/` and `test/` subfolders — this is how it tolerates the
  dataset's messy/duplicated layout (see Dataset section). `image_paths()` reads
  `NORMAL/` and `PNEUMONIA/` class folders (`CLASS_NAMES = ["NORMAL", "PNEUMONIA"]`,
  so label 0 = normal, label 1 = pneumonia). `verify_images()` drops unreadable files.
- `src/train.py`: stratified train/val split (`train_test_split`, default 18% val) drawn
  from the `train/` folder only — the dataset's own `val/` folder (16 images) is treated
  as too small to use, per `plan.md`. Backbone is `efficientnet_b0` via `timm`
  (`--model` flag can swap it), class-weighted `CrossEntropyLoss` for the ~3:1
  pneumonia:normal imbalance, mixed precision on CUDA, early stopping after 4 stale
  epochs (tracked on validation pneumonia-F1). Per epoch it calls `choose_threshold()`
  on **validation** probabilities (sweeps 0.10–0.90, prefers the threshold with the
  highest recall among those with precision >= 0.90, else best F1) and saves a new
  `best_model.pt` whenever validation F1 improves. `training_report.json` records the
  full per-epoch history.
- `src/evaluate.py`: loads a checkpoint, runs it once on `test/`, uses the threshold
  **stored in the checkpoint** (does not re-tune it), writes `test_report.json` (metrics +
  full sklearn classification report + any invalid test files) and
  `test_confusion_matrix.png`. This script itself never touches the test set for tuning —
  it's a straight report.

## Current model status (artifacts/ contents)

- Checkpoint: `efficientnet_b0`, image size 224, saved after 12 epochs of Kaggle GPU
  training (`training_report.json`, run `2026-08-23`). Best validation pneumonia-F1
  ≈0.994 at epoch 10, with per-epoch validation threshold hovering around 0.10–0.13.
- Locked test results (`test_report.json`, 624 images: 234 normal / 390 pneumonia):
  **accuracy 92.3%, pneumonia precision 90.5%, pneumonia recall 97.9%, F1 0.941,
  ROC-AUC 0.972**, evaluated at **threshold = 0.95**. This clears `plan.md`'s >=90%/>=90%
  bar.

### ⚠️ Important caveat: how the 0.95 threshold was actually chosen

The threshold baked into `artifacts/best_model.pt` (0.95) was **not** the threshold
`train.py` picked from validation data (that was ~0.10–0.13). Looking at
`notebooks/notebook88d896ab16 (1).ipynb` (the notebook that actually produced these
artifacts), cell 5 reloads the checkpoint and re-runs inference **directly on the
`test/` split**, then cells 5–6 sweep thresholds from 0.13 up to 0.99 evaluating
accuracy/precision/recall **on those test predictions**, and cell 7 manually overwrites
`checkpoint["threshold"] = 0.95` based on that sweep before re-running `evaluate.py`.

That means the final reported test metrics were produced *after* selecting the threshold
by looking at test-set performance — which is exactly the test-set leakage `plan.md`
itself warns against ("the operating threshold will be selected on the validation set...
then frozen before test evaluation"; "no train/validation/test leakage... The supplied
test data is reserved for final evaluation"). The reported 92.3%/90.5% numbers are real,
but they are **not** an honest held-out evaluation of a threshold chosen blind to the test
set — they're closer to a best-case number for this specific test set. If this project
needs to make a credible claim about generalization, the threshold should be re-selected
from validation-only probabilities (as `train.py` already does) and evaluated exactly
once at that frozen value.

## Dataset (`chest_xray/`, git-ignored, lives only on disk)

Per `plan.md`, the folder has **duplicate copies** — be careful which one code points at:
- `chest_xray/train`, `chest_xray/val`, `chest_xray/test` — the canonical copy actually
  used by training (this is what `resolve_data_root()` finds first).
- `chest_xray/chest_xray/{train,val,test}` — a duplicate extraction, also contains a
  stray `.DS_Store`. Do not point training at this copy alongside the other one.
- `chest_xray/__MACOSX/...` — macOS archive metadata, not real data. Ignore.

Documented class counts (root copy): train 1,341 normal / 3,875 pneumonia (5,216 total);
val 8/8 (16 total, too small — unused by `train.py`); test 234/390 (624 total, matches
`test_report.json`). No dataset audit report, duplicate-hash check, or patient-overlap
check currently exists in the repo despite `plan.md` calling for one (see Gaps below).

## Frontend — current state (fixed 2026-08-26)

The frontend previously existed in two disagreeing states: a "live" `frontend/app/` using
custom class names with no CSS backing them (Tailwind directives commented out in
`globals.css`), and a `frontend/changed-files-backup-20260826/` folder with a more
finished, Tailwind + Poppins-font version. That backup folder was deleted (by the user,
outside this session) before it could be diffed further, but its contents had already been
read and were restored as the live version:

- `frontend/package.json` now depends on `@tailwindcss/postcss` (Tailwind v4 moved the
  PostCSS plugin out of the main `tailwindcss` package — using `tailwindcss` directly as a
  PostCSS plugin, which is what the repo had, throws `Error evaluating Node.js code:
  It looks like you're trying to use tailwindcss directly as a PostCSS plugin`).
- `frontend/postcss.config.js` now points at `"@tailwindcss/postcss"`.
- `frontend/app/globals.css` now uses the Tailwind v4 entry syntax (`@import "tailwindcss";`)
  instead of the old, commented-out `@tailwind base/components/utilities` v3 directives.
- `frontend/app/layout.js` and `frontend/app/page.js` are the restored Tailwind-based
  "PneumoScan AI" design (lucide-react icons, drag-and-drop upload, Poppins font).
- **Bug fixed while restoring:** the restored `page.js` originally assumed the API
  returned `confidence` as a 0–1 fraction and multiplied it by 100. `src/api.py` actually
  returns `confidence` already scaled 0–100 (see `round(confidence * 100, 1)` in
  `predict_xray`), so that line was corrected to use the value as-is — otherwise the UI
  would have shown values like "9230.0%".
- `page.js` now reads the API base URL from `NEXT_PUBLIC_API_URL` (falls back to
  `http://127.0.0.1:8000`), matching the convention the previous live `page.js` used,
  instead of hardcoding `http://localhost:8000`.

**After this change, `npm install` must be re-run in `frontend/` before `npm run dev`** to
pull in the new `@tailwindcss/postcss` devDependency — it was added to `package.json` but
this session has no way to execute `npm` on the user's machine.

**Follow-up fix:** the installed `lucide-react` is v1.34.0, which dropped all brand/logo
icons (e.g. `Github`) from the package entirely — only generic UI icons ship now, some
under renamed-but-aliased names (`AlertTriangle`/`CheckCircle2`/`AlertCircle` still work
as deprecated aliases for `TriangleAlert`/`CircleCheck`/`CircleAlert`, so those were left
alone). `Github` has no such alias, so both `<Github .../>` usages in `page.js` (header
and footer GitHub links) were swapped for `<ExternalLink .../>` and the import updated
accordingly. If you add more lucide icons later, check
`node_modules/lucide-react/dist/lucide-react.d.ts` for `declare const <Name>:` before
assuming an icon name from older lucide-react docs/examples still exists.

**Design pass (2026-08-26):** `page.js` was restructured so the header, hero, and scanner
workspace fit within one viewport (`minHeight: '100dvh'` on the first `<section>`); "How it
Works" and the footer sit below it, reached by scrolling. The two workspace cards
(Analysis Workspace / Diagnostic Report) use `items-stretch` on their grid parent plus
`h-full flex flex-col flex-1` on both card wrappers so they always match height instead of
sizing independently to content. Entrance/hover animations are implemented as plain CSS
(`@keyframes` + classes `.animate-fade-up`, `.animate-fade-up-delay`, `.animate-float`,
`.result-enter` in `globals.css`, respecting `prefers-reduced-motion`) rather than the
`animate-in`/`fade-in`/`slide-in-from-*` utility classes the original backup code used —
those come from the `tailwindcss-animate` plugin, which was never installed, so they were
silently doing nothing. The header's unlabeled icon-only link button was removed; GitHub
is now a single, clearly labeled link (header "GitHub" pill + footer "GitHub Repository"
button) pointing at `https://github.com/mirxa-hamza`. `app/icon.svg` was added (a blue
rounded-square version of the header's Activity glyph) so Next.js's file-based favicon
convention picks it up automatically — no `metadata.icons` changes were needed.

## Setup / run commands (Windows, from README.md and commands.txt)

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# terminal 1
python -m uvicorn src.api:app --host 127.0.0.1 --port 8000

# terminal 2
cd frontend
npm install
npm run dev
```

Then open `http://localhost:3000`. (`python app.py` is the alternative single-process
Gradio path, port 7860.)

## Kaggle training workflow

1. Upload `pneumonia-project-source.zip` (or the `src/` folder) as a private Kaggle
   Dataset, and attach the chest X-ray dataset too.
2. Run `notebooks/train_on_kaggle.ipynb` with a GPU enabled — it installs `timm`, locates
   both inputs, copies `src/` into `/kaggle/working`, then runs
   `python -m src.train ...` followed by `python -m src.evaluate ...`.
3. Download the resulting `artifacts/` folder (checkpoint + both JSON reports + confusion
   matrix) and drop it into the local `artifacts/` folder.

Note `notebooks/notebook88d896ab16 (1).ipynb` is the messier, already-run exploratory
notebook that actually generated the current `artifacts/` (including the manual threshold
override described above) — `train_on_kaggle.ipynb` is the cleaned-up reusable version
without that override step.

## Gaps between `plan.md` and what's actually implemented

`plan.md` is a fairly detailed spec; the current `src/` only implements part of it. Not
present in the repo despite being planned:
- `src/predict.py` (single-image inference helper — `app.py`/`api.py` inline this instead)
- `src/explain.py` / any Grad-CAM heatmap generation (mentioned throughout `plan.md` and
  in the Gradio UI requirements, not implemented)
- `configs/` (versioned experiment settings) and `tests/` (data/inference smoke tests)
- A dataset audit report, duplicate/hash check, or patient-overlap analysis
- 95% bootstrap confidence intervals, PR-AUC (only ROC-AUC is computed)
- The `plan.md` "Decisions needed from the project owner" (section 11) — academic vs.
  clinical scope, single vs. multi-class pneumonia, local GPU vs. Kaggle, precision vs.
  recall preference — don't appear to have recorded answers anywhere in the repo.

## Conventions / things to preserve when editing

- Label convention is fixed: index 0 = `NORMAL`, index 1 = `PNEUMONIA` (`CLASS_NAMES` in
  `src/data.py`). Pneumonia probability is always `softmax(...)[1]`.
- Checkpoints are self-describing dicts: `state_dict`, `model_name`, `class_names`,
  `image_size`, `threshold`, `validation_metrics`. Both `app.py` and `src/api.py` rely on
  every one of these keys being present — don't save a checkpoint without them.
- `evaluate.py` is meant to be run **exactly once** per candidate model, using whatever
  threshold is already frozen in the checkpoint. Don't add threshold search back into it
  (see the leakage caveat above for why that matters here specifically).
- Real dataset (`chest_xray/`) and trained weights (`artifacts/*.pt`) are git-ignored on
  purpose — don't commit them.
