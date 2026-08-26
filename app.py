from __future__ import annotations

import os
from pathlib import Path

import gradio as gr
import torch
from PIL import Image, UnidentifiedImageError

from src.data import CLASS_NAMES, eval_transform
from src.model import create_model

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
CHECKPOINT_PATH = Path(os.getenv("MODEL_CHECKPOINT", "artifacts/best_model.pt"))
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL = None
MODEL_INFO = None


def load_model() -> None:
    global MODEL, MODEL_INFO
    if not CHECKPOINT_PATH.is_file():
        return
    checkpoint = torch.load(CHECKPOINT_PATH, map_location=DEVICE, weights_only=False)
    model = create_model(checkpoint["model_name"], pretrained=False).to(DEVICE)
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    MODEL, MODEL_INFO = model, checkpoint


def classify(file_path: str | None):
    if MODEL is None or MODEL_INFO is None:
        return (
            "### Model not found",
            {"Action required": "Place artifacts/best_model.pt in this project, then restart the app."},
            "The interface is ready, but a trained model checkpoint has not been added yet.",
        )
    if not file_path:
        return "### Upload an image to begin", {}, "Choose a chest X-ray in JPG, JPEG, or PNG format."
    path = Path(file_path)
    if path.stat().st_size > MAX_UPLOAD_BYTES:
        return "### Upload rejected", {}, "Please upload an image smaller than 10 MB."
    try:
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            xray = image.copy().convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError):
        return "### Upload rejected", {}, "The selected file is not a valid image."

    tensor = eval_transform(MODEL_INFO["image_size"])(xray).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        probabilities = torch.softmax(MODEL(tensor), dim=1)[0].detach().cpu().tolist()
    pneumonia_probability = float(probabilities[1])
    threshold = float(MODEL_INFO["threshold"])
    is_positive = pneumonia_probability >= threshold
    result = "Pneumonia positive" if is_positive else "Normal / pneumonia negative"
    confidence = pneumonia_probability if is_positive else float(probabilities[0])
    status = "result-positive" if is_positive else "result-negative"
    heading = f'<div class="{status}"><strong>{result}</strong><span>{confidence:.1%} confidence</span></div>'
    details = {
        "Normal probability": round(float(probabilities[0]), 4),
        "Pneumonia probability": round(pneumonia_probability, 4),
        "Decision threshold": round(threshold, 2),
        "Model": MODEL_INFO["model_name"],
    }
    notice = "Educational prediction only. A qualified clinician must interpret chest X-rays and make diagnostic decisions."
    return heading, details, notice


load_model()

CSS = """
body { background: #f4f8fc; }
.gradio-container { max-width: 1050px !important; font-family: Inter, Arial, sans-serif !important; }
#hero { background: linear-gradient(135deg, #103b66, #197a9b); border-radius: 20px; color: white; padding: 28px; margin: 14px 0 22px; }
#hero h1 { margin: 0 0 8px; font-size: 32px; }
#hero p { margin: 0; font-size: 16px; opacity: .92; }
.result-positive, .result-negative { border-radius: 14px; padding: 18px 20px; font-size: 20px; display: flex; justify-content: space-between; gap: 12px; }
.result-positive { color: #8c1d2c; background: #fff0f2; border: 1px solid #f4b8c0; }
.result-negative { color: #15633a; background: #edfff4; border: 1px solid #b6e7c8; }
#notice { border-left: 4px solid #e4a11b; background: #fff9eb; padding: 14px 16px; border-radius: 8px; }
"""

with gr.Blocks(theme=gr.themes.Soft(primary_hue="blue"), css=CSS, title="Pneumonia X-ray Classifier") as demo:
    gr.HTML(
        "<section id='hero'><h1>Pneumonia X-ray Classifier</h1>"
        "<p>Upload a chest X-ray to run the locally saved model.</p></section>"
    )
    with gr.Row(equal_height=False):
        with gr.Column(scale=1):
            upload = gr.Image(label="Chest X-ray image", type="filepath", sources=["upload"], height=390)
            analyze = gr.Button("Analyze X-ray", variant="primary", size="lg")
            gr.Markdown("Accepted formats: JPG, JPEG, PNG · Maximum size: 10 MB")
        with gr.Column(scale=1):
            result = gr.HTML("<h3>Waiting for an image</h3>")
            probabilities = gr.JSON(label="Prediction details")
            notice = gr.Markdown("", elem_id="notice")
    gr.Markdown(
        "### Important safety notice\n"
        "This local project is for education and demonstration. It does not diagnose pneumonia, replace a radiologist, or provide medical advice."
    )
    analyze.click(classify, inputs=upload, outputs=[result, probabilities, notice])


if __name__ == "__main__":
    demo.launch(server_name="127.0.0.1", server_port=int(os.getenv("PORT", "7860")))
