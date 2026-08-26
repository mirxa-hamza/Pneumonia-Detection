# Pneumonia X-ray Classification Project Plan

## 1. Project objective

Build a binary image-classification application that accepts a chest X-ray and returns:

- **Normal / pneumonia-negative**
- **Pneumonia / pneumonia-positive**
- A calibrated confidence score
- A clear notice that this is an educational decision-support model, **not a medical diagnosis**

The target is at least **90% accuracy and 90% pneumonia precision** on a locked, patient-independent test set. This is a target rather than a promise: it must be demonstrated by the final evaluation, not assumed from the training result.

## 2. Dataset audit and data rules

The workspace contains the Chest X-Ray Images (Pneumonia) dataset in several duplicate locations:

- `chest_xray/train`, `chest_xray/val`, `chest_xray/test`
- `chest_xray/chest_xray/...` (duplicate extraction)
- `chest_xray/__MACOSX/...` (macOS archive metadata; do not use)

Observed class counts in the non-metadata root copy:

| Split | Normal | Pneumonia | Total |
| --- | ---: | ---: | ---: |
| Train | 1,341 | 3,875 | 5,216 |
| Validation | 8 | 8 | 16 |
| Test | 234 | 390 | 624 |

Data-handling decisions:

1. Choose **one canonical copy only** after checking which folder contains no archive artifacts. Never combine duplicate folders.
2. Ignore `__MACOSX`, `.DS_Store`, and unreadable/non-image files.
3. Verify image readability, dimensions, labels, duplicate hashes, and potential patient overlap before training.
4. The provided validation set has only 16 images, so it is too small for model selection. Create a new stratified validation subset (about 15–20%) from the training data; use patient-group splitting if patient IDs can be recovered from filenames/metadata.
5. Keep the supplied `test` set locked and never use it for tuning, threshold selection, or early stopping.
6. Write a dataset audit report with counts, corrupt-file list, class balance, and duplicate/overlap findings.

## 3. Success criteria

The final model must be chosen using validation data and reported once on the locked test set.

Primary acceptance criteria:

- Test accuracy: **>= 90%**
- Test pneumonia precision: **>= 90%**
- Test pneumonia recall/sensitivity: establish a minimum with the project owner; recommended **>= 90%**
- ROC-AUC and PR-AUC reported
- Confusion matrix, per-class precision/recall/F1, and 95% bootstrap confidence intervals reported
- No train/validation/test leakage and no use of duplicate images across splits

Because missing pneumonia can be clinically serious, accuracy alone must never decide the winning model. The operating threshold will be selected on the validation set to balance precision and recall, then frozen before test evaluation.

## 4. Selected technology stack

The project will use the following libraries and services:

- **Python 3.10+** — main programming language.
- **PyTorch + torchvision + timm** — model training and pretrained image-classification backbones. PyTorch is well supported on local machines and Kaggle GPUs.
- **Pillow and OpenCV** — safe X-ray image loading, validation, and preprocessing.
- **scikit-learn** — data splitting, class weights, metrics, calibration checks, and threshold selection.
- **pandas, NumPy, Matplotlib, and Seaborn** — data audit, reports, and evaluation charts.
- **Grad-CAM** — visual explanation heatmaps for prediction review.
- **Gradio** — the Python frontend: image upload, prediction display, confidence score, explanation image, and medical disclaimer.
- **FastAPI (optional, phase 2)** — a separate REST API only if the project later needs a React/mobile frontend or integration with another system.
- **Kaggle Notebooks** — selected cloud GPU training and reproducible experiment environment.

The first deliverable will use **PyTorch + timm + Gradio**. This keeps the project focused, deployable, and easy to explain in a university presentation. We will not mix TensorFlow and PyTorch in the same implementation.

### Why Gradio for the frontend

Gradio provides a polished upload-and-predict interface directly from Python, so we can validate the ML pipeline locally. It opens on a local browser address, needs no JavaScript frontend, and keeps this first version easy to run and demonstrate. [Gradio documentation](https://www.gradio.app/)

Kaggle will be used to train and publish the reproducible notebook; its documentation describes notebooks as a managed compute environment with configurable accelerators, which is ideal for training. The public web demo will be hosted separately (preferably Hugging Face Spaces). [Kaggle Notebooks documentation](https://www.kaggle.com/docs/notebooks)

## 5. Technical approach

### Baseline

Build a reproducible PyTorch baseline with:

- 224 × 224 grayscale-to-RGB input conversion
- ImageNet normalization
- Transfer learning with EfficientNet-B0 as the first backbone
- Binary cross-entropy loss, AdamW optimizer, early stopping, and best-checkpoint saving
- Lightweight augmentation: small rotation/translation/zoom, contrast adjustment; no vertical flips and no aggressive transforms that make a radiograph unrealistic
- Class weighting or balanced sampling to handle the 3:1 pneumonia/normal imbalance

### Candidate improvements

Run controlled experiments, changing one variable at a time:

1. EfficientNet-B0 baseline with frozen backbone, then partial fine-tuning.
2. Compare one or two appropriate pretrained backbones (for example, DenseNet121 and EfficientNet-B2).
3. Tune image size, learning rate, fine-tuning depth, augmentation strength, weight decay, and class weighting.
4. Select the decision threshold from validation probabilities rather than assuming 0.50.
5. If needed, use a small validation-only ensemble of the best two independently trained models.

Do not claim clinical performance from a public benchmark alone. The model may learn site-, age-, acquisition-, or label-related shortcuts. A Grad-CAM review is required to check that the model attends to plausible lung regions rather than borders, text, or devices.

## 6. Reproducible project structure

Create the following implementation structure:

```text
Pnenia Model/
├── chest_xray/                 # Source data; never modified by training
├── configs/                    # Versioned experiment settings
├── src/
│   ├── data.py                 # Validation, split creation, dataloaders
│   ├── train.py                # Training entry point
│   ├── evaluate.py             # Locked-test metrics and plots
│   ├── predict.py              # Single-image inference
│   └── explain.py              # Grad-CAM generation
├── tests/                      # Data and inference smoke tests
├── artifacts/                  # Git-ignored models, plots, reports
├── app.py                      # Gradio upload-and-predict web application
├── requirements.txt
├── README.md
└── plan.md
```

Set a fixed random seed and log library versions, hardware, data-path choice, configuration, metrics, and model checksum for every run.

## 7. Training and evaluation workflow

1. **Audit**: run data validation and generate the audit report before any experiment.
2. **Split**: create and persist training/validation manifests; do not rely on shuffled folder order.
3. **Baseline train**: train EfficientNet-B0 with callbacks for early stopping and checkpointing.
4. **Validate**: inspect loss curves, confusion matrix, class metrics, calibration, and Grad-CAM samples.
5. **Improve**: perform logged, controlled comparisons until the validation criteria are met without overfitting.
6. **Freeze**: lock the selected architecture, weights, preprocessing, and threshold.
7. **Final test**: run exactly one final evaluation on the held-out test set and save a report.
8. **Error analysis**: review false positives and false negatives by image quality, class, and plausible artefacts; document limitations.

## 8. Local web application requirements

Build a Gradio web interface. It must work locally before it is deployed:

1. Upload JPG, JPEG, or PNG chest X-ray.
2. Validate file type, dimensions, and size; reject invalid images safely.
3. Display the uploaded image and its prediction:
   - `Pneumonia positive` or `Normal / pneumonia negative`
   - confidence/probability
   - optional Grad-CAM heatmap labelled as an explanation aid, not proof
4. Show a prominent medical disclaimer and advise clinical review; do not present the result as a diagnosis.
5. Load model, preprocessing configuration, class mapping, and frozen threshold from saved artifacts—not hard-coded values.

### Local run path

1. Create a Python virtual environment and install the version-pinned requirements.
2. Train locally if a supported GPU is available, otherwise use the prepared Kaggle Notebook for training.
3. Download/export the selected checkpoint and its `model_metadata.json` file.
4. Run `python app.py` locally and open the displayed browser address.
5. Test normal, pneumonia, invalid, and corrupted upload cases before deployment.

### Confirmed execution sequence

1. Create the project code and a Kaggle-ready training notebook.
2. Upload the dataset to Kaggle (or attach it as a Kaggle Dataset) and train with a Kaggle GPU.
3. Save and download the selected model checkpoint, class mapping, preprocessing settings, and frozen threshold.
4. Place those artifacts in the local project folder.
5. Run the polished Gradio upload interface locally on the user's PC and verify it with test X-rays.
6. Stop at local operation. **No public deployment or publishing is included at this stage.**

The application must not retain user uploads or expose any training images. A later deployment stage can be planned only when the local version is approved.

## 9. Deliverables

- Reproducible source code and `requirements.txt`
- Dataset audit report and saved split manifests
- Trained model checkpoint plus preprocessing/threshold metadata
- Final locked-test report with all metrics and plots
- Grad-CAM examples and documented error analysis
- Upload-and-predict application
- Kaggle training notebook
- `requirements.txt` and model metadata for local operation
- README with setup, training, evaluation, and run instructions
- A limitations and ethical-use section

## 10. Milestones

| Milestone | Completion evidence |
| --- | --- |
| Data ready | Audit report completed; one canonical dataset selected; no leakage found |
| Baseline | Reproducible training run, plots, and validation metrics saved |
| Model selected | Validation criteria met, threshold frozen, Grad-CAM sanity check completed |
| Final evaluation | Locked-test report meets targets or documents the shortfall honestly |
| Local application ready | Upload flow works on the user's PC with valid/invalid sample images and uses final artifacts |
| Handoff | README and deliverables are complete |

## 11. Decisions needed from the project owner

1. Is this strictly an academic/portfolio project, or is any real clinical use intended? (The latter requires external clinical validation, governance, and regulatory work beyond this plan.)
2. Should the model only predict **normal vs. any pneumonia**, or should it later distinguish bacterial and viral pneumonia too?
3. Do you have access to a GPU locally, or should we train with a Kaggle GPU?
4. For medical safety, should we optimize for fewer missed pneumonia cases (higher recall) even if it creates more false positives?
