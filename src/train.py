from __future__ import annotations

import argparse
import json
import random
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, roc_auc_score
from sklearn.model_selection import train_test_split
from torch import nn
from torch.amp import GradScaler, autocast
from torch.optim import AdamW
from torch.optim.lr_scheduler import ReduceLROnPlateau
from torch.utils.data import DataLoader

from src.data import CLASS_NAMES, IMAGE_SIZE, XrayDataset, eval_transform, image_paths, resolve_data_root, train_transform, verify_images
from src.model import create_model


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def choose_threshold(labels: np.ndarray, probabilities: np.ndarray, minimum_precision: float = 0.90) -> float:
    # Select the operating point only from validation predictions.  This also
    # permits high-confidence thresholds such as 0.95 without looking at test data.
    candidates = np.arange(0.01, 1.00, 0.01)
    scored = []
    for threshold in candidates:
        predictions = (probabilities >= threshold).astype(int)
        precision, recall, f1, _ = precision_recall_fscore_support(
            labels, predictions, average="binary", zero_division=0
        )
        scored.append((precision, recall, f1, float(threshold)))
    valid = [row for row in scored if row[0] >= minimum_precision]
    if valid:
        return max(valid, key=lambda row: (row[1], row[2]))[3]
    return max(scored, key=lambda row: row[2])[3]


@torch.no_grad()
def predict(model: nn.Module, loader: DataLoader, device: torch.device) -> tuple[np.ndarray, np.ndarray]:
    model.eval()
    labels, probabilities = [], []
    for images, batch_labels in loader:
        images = images.to(device, non_blocking=True)
        logits = model(images)
        pneumonia_probability = torch.softmax(logits, dim=1)[:, 1]
        labels.extend(batch_labels.numpy().tolist())
        probabilities.extend(pneumonia_probability.detach().cpu().numpy().tolist())
    return np.asarray(labels), np.asarray(probabilities)


def metrics(labels: np.ndarray, probabilities: np.ndarray, threshold: float) -> dict[str, float]:
    predictions = (probabilities >= threshold).astype(int)
    precision, recall, f1, _ = precision_recall_fscore_support(
        labels, predictions, average="binary", zero_division=0
    )
    return {
        "accuracy": float(accuracy_score(labels, predictions)),
        "pneumonia_precision": float(precision),
        "pneumonia_recall": float(recall),
        "pneumonia_f1": float(f1),
        "roc_auc": float(roc_auc_score(labels, probabilities)),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a pneumonia X-ray classifier.")
    parser.add_argument("--data-root", required=True, help="Dataset folder or a parent folder containing it.")
    parser.add_argument("--output-dir", default="artifacts", help="Where checkpoints and reports are saved.")
    parser.add_argument("--model", default="efficientnet_b0")
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--learning-rate", type=float, default=3e-4)
    parser.add_argument("--validation-size", type=float, default=0.18)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()

    set_seed(args.seed)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    data_root = resolve_data_root(args.data_root)

    all_train, invalid_files = verify_images(image_paths(data_root / "train"))
    labels = [label for _, label in all_train]
    train_samples, validation_samples = train_test_split(
        all_train,
        test_size=args.validation_size,
        random_state=args.seed,
        stratify=labels,
    )
    train_labels = np.asarray([label for _, label in train_samples])
    class_counts = np.bincount(train_labels, minlength=2)
    class_weights = torch.tensor(
        len(train_labels) / (2 * class_counts), dtype=torch.float32, device=device
    )

    train_loader = DataLoader(
        XrayDataset(train_samples, train_transform()), batch_size=args.batch_size, shuffle=True,
        num_workers=args.workers, pin_memory=device.type == "cuda"
    )
    validation_loader = DataLoader(
        XrayDataset(validation_samples, eval_transform()), batch_size=args.batch_size, shuffle=False,
        num_workers=args.workers, pin_memory=device.type == "cuda"
    )
    model = create_model(args.model, pretrained=True).to(device)
    optimizer = AdamW(model.parameters(), lr=args.learning_rate, weight_decay=1e-4)
    scheduler = ReduceLROnPlateau(optimizer, mode="max", factor=0.3, patience=2)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    scaler = GradScaler(device.type, enabled=device.type == "cuda")
    best_score, stale_epochs, history = -1.0, 0, []

    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = 0.0
        for images, batch_labels in train_loader:
            images, batch_labels = images.to(device, non_blocking=True), batch_labels.to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            with autocast(device_type=device.type, enabled=device.type == "cuda"):
                loss = criterion(model(images), batch_labels)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            running_loss += loss.item() * images.size(0)

        validation_labels, validation_probabilities = predict(model, validation_loader, device)
        threshold = choose_threshold(validation_labels, validation_probabilities)
        validation_metrics = metrics(validation_labels, validation_probabilities, threshold)
        validation_metrics.update({"epoch": epoch, "train_loss": running_loss / len(train_loader.dataset), "threshold": threshold})
        history.append(validation_metrics)
        score = validation_metrics["pneumonia_f1"]
        scheduler.step(score)
        print(json.dumps(validation_metrics))

        if score > best_score:
            best_score, stale_epochs = score, 0
            checkpoint = {
                "state_dict": model.state_dict(),
                "model_name": args.model,
                "class_names": CLASS_NAMES,
                "image_size": IMAGE_SIZE,
                "threshold": threshold,
                "threshold_origin": "validation_split",
                "validation_metrics": validation_metrics,
            }
            torch.save(checkpoint, output_dir / "best_model.pt")
        else:
            stale_epochs += 1
            if stale_epochs >= 4:
                print("Early stopping: validation F1 has not improved for 4 epochs.")
                break

    report = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "data_root": str(data_root),
        "device": str(device),
        "model_name": args.model,
        "seed": args.seed,
        "train_count": len(train_samples),
        "validation_count": len(validation_samples),
        "invalid_training_files": invalid_files,
        "history": history,
    }
    (output_dir / "training_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Saved best model to: {output_dir / 'best_model.pt'}")


if __name__ == "__main__":
    main()
