# Pneumonia X-ray Classifier

An educational chest X-ray classifier that labels an uploaded image as **Normal** or **Pneumonia positive**. It is not a clinical diagnostic device and must not be used for medical decisions.

## Project workflow

1. Train the model on a Kaggle GPU with [notebooks/train_on_kaggle.ipynb](notebooks/train_on_kaggle.ipynb).
2. Download the `artifacts` folder from the completed Kaggle run.
3. Copy its contents into this project's local `artifacts` folder.
4. Run the local Next.js web interface and Python model API together.

Nothing in this project publishes or deploys the application.

## Kaggle training

1. In Kaggle, create a private dataset containing this project's `src` folder. It should appear as an input such as `/kaggle/input/pneumonia-project-source`.
2. Create a Kaggle Notebook and upload/open `notebooks/train_on_kaggle.ipynb`.
3. Attach both inputs: your chest X-ray dataset and the private source-code dataset.
4. In Notebook Settings, select **GPU**.
5. Update `DATASET_INPUT` and `SOURCE_INPUT` in the first code cell if the input-folder names differ.
6. Run all cells. The notebook saves `best_model.pt`, `training_report.json`, `test_report.json`, and `test_confusion_matrix.png` in its Output area.
7. Download the complete `artifacts` folder. Do not select a model based on test results; the test evaluation is a final report only.

## Run the local application with one command (Windows)

Open PowerShell in this project folder and run:

```powershell
npm run dev
```

The launcher creates `.venv` and installs Python/frontend packages on its first run, then starts both services and opens `http://127.0.0.1:3000`. Keep that terminal open while using the app; press `Ctrl+C` to stop both services.

`run_project.cmd` is also available if you prefer double-clicking a file.

Prerequisites: Python (with the `py` launcher), Node.js LTS, and `artifacts/best_model.pt` must be present. The first run requires internet access to download packages. The browser interface calls only the local API and uploaded images are not stored.

### Manual troubleshooting commands

Use these only if you need to inspect either service separately:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-api.txt
python -m uvicorn src.api:app --host 127.0.0.1 --port 8000
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser. The Next.js interface displays a green normal card or a red pneumonia-positive card, confidence meter, image preview, and clear safety notice.

If PowerShell does not allow virtual-environment activation, run this once for your current account, then open a new PowerShell window:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Files

- `src/train.py` — reproducible transfer-learning training script.
- `src/evaluate.py` — one-time locked test-set evaluation and confusion-matrix report.
- `app.py` — polished local browser interface with safe image validation.
- `notebooks/train_on_kaggle.ipynb` — Kaggle GPU workflow.
- `artifacts/` — local location for the downloaded trained model and reports; ignored by Git.

## Expected model artifacts

After Kaggle training, the local `artifacts` folder must contain at least:

```text
artifacts/
├── best_model.pt
├── training_report.json
├── test_report.json
└── test_confusion_matrix.png
```

## Important limits

- The supplied data may contain dataset bias, duplicated images, or non-independent patient studies. High test metrics do not establish clinical safety.
- The validation split is created from `train`; the supplied `test` data is reserved for final evaluation.
- The checked-in checkpoint uses a threshold that was previously adjusted after inspecting the supplied test set. Retrain with the updated code before reporting final performance: it now selects the threshold from validation data only, then evaluates the test set once.
- The app accepts only JPG, JPEG, and PNG images under 10 MB and does not store uploads.
