# SOFTWARE PROJECT REPORT

---

## PNEUMOSCAN AI

### CHEST X-RAY CLASSIFICATION: DESIGN, IMPLEMENTATION AND EVALUATION

**Prepared by:**  
Hamza Mustafa

**GitHub:** https://github.com/mirxa-hamza  
**Project Repository:** https://github.com/mirxa-hamza/Pneumonia-Detection

**Department / Client:** [Insert department or client name]  
**Date:** 14 September 2026

This document is prepared for academic project submission. It describes the implementation and recorded experimental results available in the project workspace. The department or client is not specified in the inspected project files and must be completed before submission.

---

## Acknowledgments

This report acknowledges the open-source communities whose tools supported the development of PneumoScan AI. Appreciation is extended to the contributors of PyTorch, torchvision and timm for providing the model development and image transformation foundations. FastAPI, Uvicorn and Pillow support image ingestion and model serving, while Next.js, React, Tailwind CSS and Lucide React support the browser interface.

The project also benefits from scikit-learn, NumPy, Matplotlib and Seaborn for evaluation and numerical analysis, and from Gradio for an alternative local interface. The Kaggle notebook workflow provided a practical route for executing training and collecting model artifacts. These contributions enabled the integration of machine learning and full-stack software development within a single educational project.

---

## Executive Summary

PneumoScan AI is a chest X-ray classification application that accepts an uploaded image and produces one of two model labels: normal or pneumonia positive. Its purpose is to demonstrate a complete machine learning workflow, from dataset preparation and transfer learning to evaluation and interactive inference.

The system uses Python with PyTorch and timm to train an EfficientNet-B0 model. A FastAPI backend exposes prediction and readiness endpoints, while a Next.js and React frontend provides image upload, preview, processing feedback and color-coded results. Local operation is coordinated through a root-level `npm run dev` command. A separate Gradio application provides an alternative interface that loads the model directly.

The saved training report records 12 epochs, with 4,277 training images and 939 validation images. The saved test report records 92.31% accuracy, 90.52% pneumonia precision and 97.95% pneumonia recall across 624 test images. These figures describe the existing experiment, but require qualification: the exploratory notebook selected the final 0.95 threshold after examining test-set performance. Consequently, the figures are exploratory results rather than an independent final estimate of generalization.

The main technical achievement is the integration of a trained image classifier with a usable local web application. The principal next steps are independent evaluation, patient-level dataset auditing, stronger automated verification and deployment validation. The application is intended for education and demonstration; it does not establish a clinical diagnosis.

---

## Table of Contents

- [Acknowledgments](#acknowledgments)
- [Executive Summary](#executive-summary)
- [Introduction](#introduction)
- [Methodology: Architecture and Tech Stack](#methodology-architecture-and-tech-stack)
- [Analysis: Implementation and Features](#analysis-implementation-and-features)
- [Key Findings: System Results](#key-findings-system-results)
- [Recommendations: Future Roadmap](#recommendations-future-roadmap)
- [References](#references)

Page numbers should be generated after Word or PDF export because pagination depends on the selected font, margins and document renderer.

---

## Introduction

### Background and Problem Statement

A trained machine learning model alone does not provide a complete software application. A usable system must also prepare inputs consistently, expose a reliable prediction interface and communicate results in a form that users can understand. PneumoScan AI addresses this engineering problem by connecting a chest X-ray classification model to a browser-based upload workflow.

The project focuses on binary classification using images organized into `NORMAL` and `PNEUMONIA` classes. The frontend allows a user to select an image, inspect a preview and request a prediction without writing Python commands. The backend applies the model's preprocessing steps, performs inference and returns structured results.

### Core Objectives

- Develop a transfer-learning classifier using the available chest X-ray dataset.
- Separate training, validation and evaluation responsibilities in the software.
- Report accuracy, precision, recall, F1-score and ROC-AUC.
- Provide an understandable interface with green normal and red pneumonia-positive results.
- Support local startup of the frontend and backend through one command.
- Preserve trained weights, preprocessing metadata and the decision threshold for inference.

The original project plan targets at least 90% accuracy and 90% pneumonia precision. These are project objectives, not guaranteed outcomes for new datasets or real-world use.

### Scope of the Application

The application accepts JPEG and PNG images. It implements two-class inference and displays model scores. It does not implement DICOM processing, disease localization, severity grading, patient registration, medical records or multiclass diagnosis. An image passing file validation is not necessarily a chest X-ray; there is no separate model that confirms the anatomical content of an upload.

This report describes the current source files and saved artifacts. Historical notes and plans are treated as supporting context; where they differ from executable code, the current implementation takes precedence.

---

## Methodology: Architecture and Tech Stack

### Technical Approach

The implementation combines an offline training workflow with an online inference workflow. Training is executed through Python scripts, with notebooks supporting Kaggle operation. The resulting checkpoint is copied into the application's `artifacts` directory. During local operation, the API loads that checkpoint and serves predictions to the browser.

The main request sequence is:

1. The user selects or drops an image into the Next.js interface.
2. The browser checks its declared format and size and creates an image preview.
3. The frontend sends a multipart request to `POST /predict`.
4. The API verifies the image and applies the evaluation transform.
5. EfficientNet-B0 produces two output scores, converted to probabilities through softmax.
6. The pneumonia probability is compared with the stored threshold.
7. The API returns JSON, which the frontend renders as a result card.

### Languages, Frameworks and Storage

Python implements data handling, training, evaluation and model serving. JavaScript and JSX implement the Next.js/React frontend. CSS and Tailwind utility classes provide styling and animation. PowerShell coordinates local processes, and npm exposes the startup command.

The ML framework is PyTorch, with torchvision transforms and a timm model factory. The API uses FastAPI and Uvicorn. The alternative interface uses Gradio. TensorFlow and Keras are not part of the inspected implementation. OpenCV is declared as a dependency, but the core data and prediction code uses Pillow and torchvision rather than OpenCV operations.

No database is implemented. Model parameters are stored in a `.pt` checkpoint, evaluation outputs in JSON and PNG files, and frontend state in React component state. The FastAPI prediction handler does not explicitly persist uploaded images. This is distinct from a general claim that every component, including temporary upload handling in Gradio or the web framework, is free of temporary storage.

### Dataset Organization and Preparation

The top-level dataset folders contain the following JPEG counts, confirmed from the workspace:

- `train`: 1,341 normal and 3,875 pneumonia images; 5,216 total.
- `val`: 8 normal and 8 pneumonia images; 16 total.
- `test`: 234 normal and 390 pneumonia images; 624 total.

The training script creates its own stratified validation split from `train`, using a default validation proportion of 18% and seed 42. The saved run contains 4,277 training and 939 validation samples. The supplied 16-image `val` directory is not used by this training path.

`src/data.py` discovers a directory containing `train` and `test`, reads supported image extensions from the class folders, sorts sample paths and verifies images using Pillow. Class index 0 represents normal and index 1 represents pneumonia. Unreadable images are excluded and their paths recorded. The saved training and test reports contain empty invalid-file lists.

These checks establish file readability, not patient independence, label correctness or absence of duplicate images. The splitting method operates on images and does not group samples by patient.

### Image Preprocessing

All model inputs are converted to RGB and resized to 224 by 224 pixels. Training augmentation applies random affine transformations with rotation up to 7 degrees, translation fractions of 0.04 and scaling between 0.95 and 1.05. Brightness and contrast jitter use values of 0.08 and 0.12 respectively.

Images are converted to tensors and normalized using channel means `[0.485, 0.456, 0.406]` and standard deviations `[0.229, 0.224, 0.225]`. Evaluation and serving reuse `eval_transform`, which excludes random augmentation. This shared transform helps keep serving inputs consistent with evaluation inputs.

### Model Training and Selection

`src/model.py` calls `timm.create_model` with a default model name of `efficientnet_b0` and two output classes. Training requests pretrained weights; inference constructs the architecture without downloading pretrained weights and then loads the saved state dictionary.

The default training configuration uses 12 epochs, batch size 32, learning rate 0.0003 and two data-loader workers. AdamW applies weight decay of 0.0001. Class-weighted cross-entropy assigns each class a weight of `N / (2 × class_count)` to account for imbalance. CUDA training enables automatic mixed precision and gradient scaling.

Validation pneumonia F1-score controls checkpoint selection. A ReduceLROnPlateau scheduler multiplies the learning rate by 0.3 when its plateau condition is reached, with patience configured as two scheduler epochs. Early stopping occurs after four consecutive epochs without improvement in the selected validation F1-score.

The current threshold selector examines values from 0.01 to 0.99. It prefers the highest recall among thresholds meeting at least 0.90 validation precision, using F1 to break ties. If no threshold qualifies, it selects the highest F1-score. This fallback means the precision target is not guaranteed. New checkpoints include `threshold_origin: validation_split`; the saved historical results predate this metadata addition.

### Evaluation Method

`src/evaluate.py` loads the checkpoint, predicts the test images and applies the threshold already stored in the checkpoint. It writes aggregate metrics, a per-class classification report, invalid-file information and a confusion-matrix image. It does not search for thresholds itself. Although intended as a final evaluation step, the script does not technically prevent repeated execution or subsequent manual threshold adjustment.

---

## Analysis: Implementation and Features

### Project File Structure

The following is a selected structure of the implementation and its supporting artifacts. Generated dependency folders and caches are omitted for clarity.

```text
Pnenia Model/
|-- package.json
|-- run_project.ps1
|-- run_project.cmd
|-- app.py
|-- requirements.txt
|-- requirements-api.txt
|-- README.md
|-- DEPLOY.md
|-- Dockerfile
|-- plan.md
|-- src/
|   |-- __init__.py
|   |-- data.py
|   |-- model.py
|   |-- train.py
|   |-- evaluate.py
|   `-- api.py
|-- frontend/
|   |-- package.json
|   |-- package-lock.json
|   |-- postcss.config.js
|   |-- vercel.json
|   |-- .env.example
|   `-- app/
|       |-- page.js
|       |-- layout.js
|       |-- globals.css
|       `-- icon.svg
|-- notebooks/
|   |-- train_on_kaggle.ipynb
|   `-- notebook88d896ab16 (1).ipynb
|-- artifacts/
|   |-- best_model.pt
|   |-- training_report.json
|   |-- test_report.json
|   `-- test_confusion_matrix.png
`-- chest_xray/
    |-- train/
    |-- val/
    `-- test/
```

### Frontend Interface

`frontend/app/page.js` contains the main client component, `PneumoniaScanner`. It manages the selected file, preview URL, drag state, scanning state, result and error. The interface includes navigation, a hero section, an upload workspace, a result panel, an explanation of the workflow and a footer identifying Hamza Mustafa.

Users can select a file through the browser or drag and drop it. JPEG/PNG type and the 10 MiB byte limit are checked before analysis. A preview is created with `URL.createObjectURL`, and reset clears the selected image and result. The analyze button is disabled when no file is selected or while processing is active.

The frontend submits a `FormData` object and interprets `prediction === 'pneumonia_positive'` as the positive class. Successful results show a red or green card, a score bar, both class probabilities and the threshold. Failed requests display an error rather than generating a substitute prediction. Error and processing containers include live-region semantics.

`globals.css` defines entrance, floating, scanning and result animations. Reduced-motion settings disable the listed custom entrance and floating classes, though this does not establish that every animation has been disabled. `layout.js` defines document metadata and a body-level hydration-warning suppression. This suppression is a presentation workaround; it does not prevent browser extensions from modifying HTML.

### Backend Routes and Output Contract

`src/api.py` exposes two application routes:

- **GET `/health`:** Returns whether a model is loaded and the selected device. The current implementation returns a JSON readiness flag rather than changing the HTTP status when the model is absent.
- **POST `/predict`:** Accepts a multipart field named `file`, validates the image, performs inference and returns the prediction. A missing checkpoint results in HTTP 503; rejected formats, invalid images and invalid sizes result in HTTP 400.

The prediction response contains `prediction`, `label`, `confidence`, `normal_probability`, `pneumonia_probability` and `threshold`. Probability and confidence fields are scaled to percentages, unlike the fractional values used internally. The threshold is also returned as a percentage.

The displayed confidence is the softmax score of the selected output label. It is not a measured reliability guarantee or a calibrated clinical probability. Because the decision threshold can differ from 0.50, a normal classification does not necessarily mean that the normal class has the larger softmax score.

The API selects CUDA when available and otherwise uses CPU. It loads the model at startup, switches it into evaluation mode and disables gradient recording during inference. Browser cross-origin access defaults to the local frontend origins and can be configured using `ALLOWED_ORIGINS`.

### Local Execution and Configuration

From the project root, the documented command is:

```powershell
npm run dev
```

The root npm script calls `run_project.ps1`. The launcher checks for the model checkpoint, creates a virtual environment and installs API dependencies if the environment does not exist, installs frontend packages if `node_modules` is missing, starts Uvicorn on port 8000 and Next.js development mode on port 3000, then opens the browser. Process output is redirected into `.runtime` logs.

The launcher checks whether ports become reachable; this is not a full model-readiness or prediction test. The root `npm start` currently invokes the same development launcher. It should not be described as a production serving command. In contrast, the frontend's own `start` script runs `next start` after a build.

`MODEL_CHECKPOINT` configures the API checkpoint path. `NEXT_PUBLIC_API_URL` sets the frontend API address, defaulting to `http://127.0.0.1:8000`. `ALLOWED_ORIGINS` configures browser origins. The standalone Gradio application accepts a `PORT` override and defaults to local port 7860.

### Alternative Interface and Deployment Files

`app.py` loads the model directly and presents a Gradio upload interface with a result heading, JSON details and educational notices. It duplicates part of the API's inference logic, which creates a maintenance requirement when preprocessing or output behavior changes.

The repository contains a Docker recipe for the Python API and a Vercel configuration for frontend security headers. `DEPLOY.md` describes a split deployment. These files demonstrate deployment preparation, but do not establish that a live service has been published. The inspected configuration does not implement a complete Vercel-only model deployment.

---

## Key Findings: System Results

### Recorded Training Outcomes

`artifacts/training_report.json` records a CUDA training run dated 23 August 2026 with seed 42. Twelve epochs are present. Training loss decreased from approximately 0.42321 in epoch 1 to 0.00827 in epoch 12.

Epoch 10 has the highest recorded validation pneumonia F1-score, approximately 0.99355. At that epoch, validation accuracy is 99.04%, pneumonia precision is 99.43%, recall is 99.28% and ROC-AUC is approximately 0.99908. Its recorded threshold is 0.13. Later epochs did not improve the selected F1-score.

### Recorded Test Outcomes

The saved test report records these results at threshold 0.95:

- Accuracy: **92.31%**.
- Pneumonia precision: **90.52%**.
- Pneumonia recall: **97.95%**.
- Pneumonia F1-score: **0.94089**.
- ROC-AUC: **0.97212**.
- Test support: **624 images**, comprising 234 normal and 390 pneumonia images.

The per-class recalls and supports imply 194 correctly classified normal images, 40 normal images classified as pneumonia, 382 correctly classified pneumonia images and 8 pneumonia images classified as normal. These are derived counts from the saved report: `(194 + 382) / 624` gives the reported accuracy. Normal-class recall is 82.91%, showing that the error profile differs substantially between the two classes.

### Interpretation and Evaluation Limitations

The exploratory notebook evaluates several thresholds against test predictions, then explicitly writes `checkpoint['threshold'] = 0.95`. Therefore, the reported accuracy and precision exceed the numerical targets on that dataset, but cannot establish that the targets were met on an untouched final evaluation set.

The current training code selects thresholds from validation data and records their origin. This improves future experiment traceability but does not retroactively validate the historical experiment. Since the existing test results have already informed development, stronger confirmation requires new independent data or a clearly defined evaluation partition that has not influenced model decisions.

### Completed Integrations and Remaining Evidence Gaps

The source provides a complete route from image upload to model output, shared evaluation preprocessing, checkpoint loading, formatted frontend results and a combined local startup command. Saved artifacts demonstrate that training and evaluation were performed.

The inspected files do not establish measured request latency, concurrent-user capacity, external clinical validation or a live deployment URL. Automated patient-overlap checks, duplicate detection, probability calibration and Grad-CAM explanations are not implemented in the inspected core modules. No new training run, deployment or performance benchmark was performed for this report.

---

## Recommendations: Future Roadmap

The following recommendations address the implementation and evidence gaps identified in the source and saved experiment.

1. **Establish an independent final evaluation.** Select the operating threshold using validation data, freeze it with the checkpoint and evaluate on previously untouched data. Clearly label the existing test results as exploratory.

2. **Audit the dataset before further training.** Record file hashes, detect duplicate images, investigate patient identifiers and use patient-aware splitting where identifiers are available. Keep duplicate archive extractions out of experiment inputs.

3. **Strengthen experiment records.** Save exact library versions, training arguments, dataset identifiers, split manifests and checkpoint hashes. The current reports provide useful history but do not capture every detail required to reproduce the original environment.

4. **Improve result interpretation.** Assess calibration on appropriate validation data and distinguish a model score from calibrated confidence. Explain how the decision threshold changes the selected label, especially when it differs substantially from 0.50.

5. **Expand evaluation coverage.** Report uncertainty intervals, precision-recall analysis and subgroup outcomes where suitable metadata exists. Validate robustness to image quality and acquisition differences before making broader performance claims.

6. **Centralize inference logic.** Extract the shared preprocessing, checkpoint loading and prediction steps used by FastAPI and Gradio into one maintained module. Verify output consistency across both interfaces.

7. **Add meaningful automated checks.** Cover class ordering, threshold boundaries, corrupt images, missing checkpoints, oversized uploads and API response fields. Add an integration check that confirms the frontend displays the prediction returned by the API.

8. **Harden the upload and request lifecycle.** Bound reads before accepting the full upload, enforce decoded image limits and handle concurrent inference without blocking unrelated requests. Address stale responses when a user resets or replaces an image during analysis.

9. **Improve the launcher and documentation.** Check dependency-install exit codes, verify model readiness rather than only port availability and reliably stop child process trees. Update older instructions that still describe separate startup commands or previous threshold ranges.

10. **Validate deployment as a separate engineering task.** Choose the target runtime, test actual dependency and model packaging, configure the production API address and origins, and measure cold-start and request behavior. The current development launcher should not be used as a production server.

11. **Refine accessibility and terminology.** Complete keyboard and reduced-motion checks, review focus states, and use consistent prediction wording throughout the interface. If image explanations are added later, distinguish model attribution from verified anatomical findings.

---

## References

The references below identify primary project evidence and dependency declarations. Version ranges are copied from manifests and describe allowed installations, not a verified inventory of the original Kaggle environment.

### Project Evidence

1. `src/data.py`: Dataset discovery, class mapping, image verification and transforms.
2. `src/model.py`: EfficientNet-B0 model factory with two output classes.
3. `src/train.py`: Split creation, optimization, threshold selection and checkpoint generation.
4. `src/evaluate.py`: Stored-threshold test evaluation and confusion-matrix output.
5. `src/api.py`: Readiness and prediction routes, response fields and CORS configuration.
6. `frontend/app/page.js`, `layout.js` and `globals.css`: Browser workflow, metadata, styles and animations.
7. `app.py`: Alternative Gradio interface and direct inference.
8. `artifacts/training_report.json` and `artifacts/test_report.json`: Recorded experiment results.
9. `notebooks/notebook88d896ab16 (1).ipynb`: Executed workflow and test-based threshold override.
10. `notebooks/train_on_kaggle.ipynb`: Reusable training and evaluation notebook template.
11. Root `package.json`, `run_project.ps1` and `run_project.cmd`: Local process coordination.
12. `requirements.txt`, `requirements-api.txt`, `frontend/package.json` and `frontend/package-lock.json`: Dependency declarations and frontend lockfile.
13. `DEPLOY.md`, `Dockerfile` and `frontend/vercel.json`: Deployment instructions and configuration.
14. Git remote `origin`: https://github.com/mirxa-hamza/Pneumonia-Detection.
15. *Civics Project Report.pdf*, supplied by the project owner: structural and stylistic reference only. Its institution, course details and education statistics are not used as facts about this software project.

### Python Dependencies

- **PyTorch:** `torch>=2.9,<2.14` - training and inference.
- **torchvision:** `>=0.24,<0.29` - image transforms.
- **timm:** `>=1.0,<2.0` - model architecture and pretrained model support.
- **scikit-learn:** `>=1.5,<2.0` - splitting and evaluation metrics.
- **NumPy:** `>=1.26,<3.0` - arrays and numerical processing.
- **Pillow:** `>=10.4,<12.0` - image decoding and verification.
- **Matplotlib:** `>=3.9,<4.0` - evaluation figure generation.
- **Seaborn:** `>=0.13,<0.14` - confusion-matrix heatmap.
- **Gradio:** `>=5.0,<6.0` - standalone interface.
- **FastAPI:** `>=0.115,<1.0` - HTTP API.
- **Uvicorn:** `uvicorn[standard]>=0.32,<1.0` - ASGI server.
- **python-multipart:** `>=0.0.18,<1.0` - multipart upload parsing.
- **pandas:** `>=2.2,<3.0` - declared dependency; not directly used by the inspected core ML/API modules.
- **opencv-python-headless:** `>=4.10,<5.0` - declared dependency; no OpenCV preprocessing is implemented in the inspected core path.

`requirements-api.txt` retains the serving subset: torch, torchvision, timm, Pillow, FastAPI, Uvicorn and python-multipart.

### Frontend Dependencies

- **Next.js:** `^16.1.0` - application framework and development/build scripts.
- **React:** `^19.2.0` - component rendering and state.
- **React DOM:** `^19.2.0` - browser rendering.
- **Lucide React:** `^1.34.0` - interface icons.
- **Tailwind CSS:** `^4.3.3` - utility styling.
- **@tailwindcss/postcss:** `^4.3.3` - Tailwind PostCSS integration.
- **PostCSS:** `^8.5.26` - CSS processing.
- **Autoprefixer:** `^10.5.4` - declared CSS tooling dependency.

---

*End of Project Report*
