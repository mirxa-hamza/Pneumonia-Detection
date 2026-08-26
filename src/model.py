from __future__ import annotations

import timm
import torch


def create_model(model_name: str = "efficientnet_b0", pretrained: bool = True) -> torch.nn.Module:
    return timm.create_model(model_name, pretrained=pretrained, num_classes=2)
