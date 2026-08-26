from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, UnidentifiedImageError
from torch.utils.data import Dataset
from torchvision import transforms

CLASS_NAMES = ["NORMAL", "PNEUMONIA"]
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
IMAGE_SIZE = 224
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def resolve_data_root(path: str | Path) -> Path:
    """Find the folder that directly contains train, test, and val folders."""
    start = Path(path)
    candidates = [start, *start.glob("**/*")]
    for candidate in candidates:
        if candidate.is_dir() and (candidate / "train").is_dir() and (candidate / "test").is_dir():
            return candidate
    raise FileNotFoundError(
        f"Could not find a dataset root with train/ and test/ below: {start}"
    )


def image_paths(split_dir: str | Path) -> list[tuple[Path, int]]:
    split_path = Path(split_dir)
    samples: list[tuple[Path, int]] = []
    for label, class_name in enumerate(CLASS_NAMES):
        class_dir = split_path / class_name
        if not class_dir.is_dir():
            raise FileNotFoundError(f"Expected class directory is missing: {class_dir}")
        for path in class_dir.rglob("*"):
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
                samples.append((path, label))
    if not samples:
        raise ValueError(f"No supported images found in {split_path}")
    return sorted(samples, key=lambda item: str(item[0]))


def verify_images(samples: Iterable[tuple[Path, int]]) -> tuple[list[tuple[Path, int]], list[str]]:
    valid: list[tuple[Path, int]] = []
    invalid: list[str] = []
    for path, label in samples:
        try:
            with Image.open(path) as image:
                image.verify()
            valid.append((path, label))
        except (UnidentifiedImageError, OSError, ValueError):
            invalid.append(str(path))
    return valid, invalid


def train_transform(image_size: int = IMAGE_SIZE) -> transforms.Compose:
    return transforms.Compose(
        [
            transforms.Lambda(lambda image: image.convert("RGB")),
            transforms.Resize((image_size, image_size)),
            transforms.RandomAffine(degrees=7, translate=(0.04, 0.04), scale=(0.95, 1.05)),
            transforms.ColorJitter(brightness=0.08, contrast=0.12),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )


def eval_transform(image_size: int = IMAGE_SIZE) -> transforms.Compose:
    return transforms.Compose(
        [
            transforms.Lambda(lambda image: image.convert("RGB")),
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )


class XrayDataset(Dataset):
    def __init__(self, samples: list[tuple[Path, int]], transform: transforms.Compose):
        self.samples = samples
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int):
        path, label = self.samples[index]
        with Image.open(path) as image:
            return self.transform(image), label
