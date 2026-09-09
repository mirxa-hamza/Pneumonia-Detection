# Deploys the FastAPI backend (src/api.py) as a Hugging Face Space (Docker SDK).
# Build context = project root. Needs: requirements.txt, src/, artifacts/best_model.pt.
FROM python:3.11-slim

WORKDIR /app

# Pillow/OpenCV need these system libraries at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src
COPY artifacts ./artifacts

ENV MODEL_CHECKPOINT=artifacts/best_model.pt
# Hugging Face Spaces (Docker SDK) expects the app to listen on port 7860.
EXPOSE 7860

CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "7860"]
