from __future__ import annotations

import io
import os
from pathlib import Path

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

from src.data import eval_transform
from src.model import create_model

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
CHECKPOINT_PATH = Path(os.getenv("MODEL_CHECKPOINT", "artifacts/best_model.pt"))
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL = None
MODEL_INFO = None

app = FastAPI(title="Pneumonia X-ray Classifier API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


def load_model() -> None:
    global MODEL, MODEL_INFO
    if not CHECKPOINT_PATH.is_file():
        return
    checkpoint = torch.load(CHECKPOINT_PATH, map_location=DEVICE, weights_only=False)
    model = create_model(checkpoint["model_name"], pretrained=False).to(DEVICE)
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    MODEL, MODEL_INFO = model, checkpoint


@app.on_event("startup")
def startup() -> None:
    load_model()


@app.get("/health")
def health() -> dict[str, object]:
    return {"ready": MODEL is not None, "device": str(DEVICE)}


@app.post("/predict")
async def predict_xray(file: UploadFile = File(...)) -> dict[str, object]:
    if MODEL is None or MODEL_INFO is None:
        raise HTTPException(status_code=503, detail="Model checkpoint is missing. Add artifacts/best_model.pt and restart the API.")
    if file.content_type not in {"image/jpeg", "image/png"}:
        raise HTTPException(status_code=400, detail="Upload a JPG, JPEG, or PNG image.")
    content = await file.read()
    if not content or len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Upload an image smaller than 10 MB.")
    try:
        with Image.open(io.BytesIO(content)) as source:
            source.verify()
        with Image.open(io.BytesIO(content)) as source:
            image = source.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.")

    tensor = eval_transform(MODEL_INFO["image_size"])(image).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        normal_probability, pneumonia_probability = torch.softmax(MODEL(tensor), dim=1)[0].cpu().tolist()
    threshold = float(MODEL_INFO["threshold"])
    pneumonia_positive = pneumonia_probability >= threshold
    confidence = pneumonia_probability if pneumonia_positive else normal_probability
    return {
        "prediction": "pneumonia_positive" if pneumonia_positive else "normal",
        "label": "Pneumonia positive" if pneumonia_positive else "Normal / pneumonia negative",
        "confidence": round(confidence * 100, 1),
        "normal_probability": round(normal_probability * 100, 1),
        "pneumonia_probability": round(pneumonia_probability * 100, 1),
        "threshold": round(threshold * 100, 0),
    }
