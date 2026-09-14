from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import torch
from sklearn.metrics import classification_report, confusion_matrix
from torch.utils.data import DataLoader

from src.data import CLASS_NAMES, XrayDataset, eval_transform, image_paths, resolve_data_root, verify_images
from src.model import create_model
from src.train import metrics, predict


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate a saved model once on the held-out test set.")
    parser.add_argument("--data-root", required=True)
    parser.add_argument("--checkpoint", default="artifacts/best_model.pt")
    parser.add_argument("--output-dir", default="artifacts")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    checkpoint = torch.load(args.checkpoint, map_location=device, weights_only=False)
    model = create_model(checkpoint["model_name"], pretrained=False).to(device)
    model.load_state_dict(checkpoint["state_dict"])
    samples, invalid_files = verify_images(image_paths(resolve_data_root(args.data_root) / "test"))
    loader = DataLoader(XrayDataset(samples, eval_transform(checkpoint["image_size"])), batch_size=args.batch_size, shuffle=False, num_workers=args.workers)
    labels, probabilities = predict(model, loader, device)
    threshold = float(checkpoint["threshold"])
    predictions = (probabilities >= threshold).astype(int)
    result = metrics(labels, probabilities, threshold)
    result["threshold"] = threshold
    result["threshold_origin"] = checkpoint.get("threshold_origin", "unknown")
    result["classification_report"] = classification_report(labels, predictions, target_names=CLASS_NAMES, output_dict=True, zero_division=0)
    result["invalid_test_files"] = invalid_files

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "test_report.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    matrix = confusion_matrix(labels, predictions)
    sns.heatmap(matrix, annot=True, fmt="d", cmap="Blues", xticklabels=CLASS_NAMES, yticklabels=CLASS_NAMES)
    plt.xlabel("Predicted label")
    plt.ylabel("Actual label")
    plt.title("Locked test-set confusion matrix")
    plt.tight_layout()
    plt.savefig(output_dir / "test_confusion_matrix.png", dpi=160)
    print(json.dumps({key: value for key, value in result.items() if key not in {"classification_report", "invalid_test_files"}}, indent=2))


if __name__ == "__main__":
    main()
