# Pneumonia X-ray Classifier

An educational chest X-ray classifier that labels an uploaded image as **Normal** or **Pneumonia positive**. It is not a clinical diagnostic device and must not be used for medical decisions.

## Project workflow

1. Train the model on a Kaggle GPU with [notebooks/train_on_kaggle.ipynb](notebooks/train_on_kaggle.ipynb).
2. Download the `artifacts` folder from the completed Kaggle run.
3. Copy its contents into this project's local `artifacts` folder.
4. Run the local Gradio interface with `python app.py`.

Nothing in this project publishes or deploys the application.

## Kaggle training

1. In Kaggle, create a private dataset containing this project's `src` folder. It should appear as an input such as `/kaggle/input/pneumonia-project-source`.
2. Create a Kaggle Notebook and upload/open `notebooks/train_on_kaggle.ipynb`.
3. Attach both inputs: your chest X-ray dataset and the private source-code dataset.
4. In Notebook Settings, select **GPU**.
5. Update `DATASET_INPUT` and `SOURCE_INPUT` in the first code cell if the input-folder names differ.
6. Run all cells. The notebook saves `best_model.pt`, `training_report.json`, `test_report.json`, and `test_confusion_matrix.png` in its Output area.
7. Download the complete `artifacts` folder. Do not select a model based on test results; the test evaluation is a final report only.

## Run the improved local web application on Windows

Open PowerShell in this project folder and run:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Start the local Python model API in that PowerShell window:

```powershell
python -m uvicorn src.api:app --host 127.0.0.1 --port 8000
```

Open a **second** PowerShell window in the project folder and run:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser. The Next.js interface displays a green normal card or a red pneumonia-positive card, confidence meter, image preview, and clear safety notice. The browser interface calls only the local API at `127.0.0.1:8000`; uploaded images are not stored.

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
- The app accepts only JPG, JPEG, and PNG images under 10 MB and does not store uploads.
