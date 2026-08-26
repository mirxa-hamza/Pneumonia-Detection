"use client";

import { useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Home() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function chooseFile(nextFile) {
    if (!nextFile) return;
    if (!["image/jpeg", "image/png"].includes(nextFile.type)) {
      setError("Please choose a JPG, JPEG, or PNG chest X-ray image.");
      return;
    }
    if (nextFile.size > 10 * 1024 * 1024) {
      setError("The image must be smaller than 10 MB.");
      return;
    }
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
    setResult(null);
    setError("");
  }

  async function analyze() {
    if (!file) {
      setError("Upload an X-ray image before running the analysis.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API_URL}/predict`, { method: "POST", body: formData });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || "Unable to analyze this image.");
      setResult(body);
    } catch (caughtError) {
      setError(caughtError.message || "Unable to contact the local prediction service.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const positive = result?.prediction === "pneumonia_positive";
  const percentage = result ? Math.round(result.pneumonia_probability) : 0;

  return (
    <main>
      <section className="hero">
        <div className="brand"><span className="brand-mark">✦</span> PNEUMOSCAN</div>
        <div className="hero-grid">
          <div>
            <p className="eyebrow">LOCAL AI SCREENING TOOL</p>
            <h1>Clear, fast X-ray insights.</h1>
            <p className="subtitle">Upload a chest X-ray to run your trained pneumonia-classification model entirely on this computer.</p>
          </div>
          <div className="privacy"><span>●</span><div><strong>Private by design</strong><br />Your image stays on this device.</div></div>
        </div>
      </section>

      <section className="workspace">
        <div className="panel upload-panel">
          <div className="panel-heading"><div><p className="eyebrow">STEP 01</p><h2>Upload X-ray</h2></div><span className="file-rule">JPG · JPEG · PNG</span></div>
          <input ref={inputRef} className="hidden-input" type="file" accept="image/jpeg,image/png" onChange={(event) => chooseFile(event.target.files?.[0])} />
          {preview ? (
            <div className="preview-wrap"><img src={preview} alt="Selected chest X-ray" /><button className="remove" onClick={reset} aria-label="Remove image">×</button></div>
          ) : (
            <button className="dropzone" onClick={() => inputRef.current?.click()}><span className="upload-icon">↑</span><strong>Choose an X-ray image</strong><small>or click to browse your files</small></button>
          )}
          {file && <p className="filename">{file.name}</p>}
          <button className="primary-button" onClick={analyze} disabled={loading}>{loading ? <><span className="spinner" />Analyzing image…</> : "Analyze X-ray"}</button>
          {error && <p className="error-message">{error}</p>}
        </div>

        <div className="result-column">
          {!result ? (
            <div className="empty-state"><span>✦</span><h2>Waiting for analysis</h2><p>Your classification result will appear here after you upload an image.</p></div>
          ) : (
            <div className={`result-card ${positive ? "positive" : "negative"}`}>
              <div className="result-top"><span className="result-icon">{positive ? "!" : "✓"}</span><span className="status-pill">{positive ? "PNEUMONIA POSITIVE" : "NORMAL"}</span></div>
              <h2>{result.label}</h2>
              <p>{positive ? "The model score crossed the pneumonia decision threshold." : "The model score is below the pneumonia decision threshold."}</p>
              <div className="confidence"><div><span>Prediction confidence</span><strong>{result.confidence}%</strong></div><div className="meter"><i style={{ width: `${result.confidence}%` }} /></div></div>
              <div className="scores"><div><span>Normal probability</span><strong>{result.normal_probability}%</strong></div><div><span>Pneumonia probability</span><strong>{result.pneumonia_probability}%</strong></div></div>
              <button className="secondary-button" onClick={reset}>Analyze another image</button>
            </div>
          )}
          <aside className="medical-note"><span>i</span><p><strong>Educational use only.</strong> This result is not a diagnosis and must be reviewed by a qualified healthcare professional.</p></aside>
        </div>
      </section>
    </main>
  );
}
