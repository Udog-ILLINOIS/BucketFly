import { useState, useRef } from 'react';
import './UploadInspect.css';

export function UploadInspect({ onResult, isLoading: externalLoading }) {
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, etc.)');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target.result);
      // Extract base64 data (strip the data:image/...;base64, prefix for the API)
      setImageBase64(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      // Simulate file input change
      const dt = new DataTransfer();
      dt.items.add(file);
      fileRef.current.files = dt.files;
      handleFileSelect({ target: { files: dt.files } });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleClear = () => {
    setImagePreview(null);
    setImageBase64(null);
    setDescription('');
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!imageBase64) {
      setError('Please select an image first.');
      return;
    }
    if (!description.trim()) {
      setError('Please describe what you see or which component this is.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onResult(imageBase64, description.trim());
      // Clear after successful submission
      handleClear();
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loading = isLoading || externalLoading;

  return (
    <div className="upload-inspect">
      <div className="upload-header">
        <div className="upload-logo">CAT</div>
        <h2 className="upload-title">Upload Inspection</h2>
        <p className="upload-subtitle">Upload a photo and describe the component</p>
      </div>

      {/* Drop Zone / Image Preview */}
      <div
        className={`upload-dropzone ${imagePreview ? 'has-image' : ''}`}
        onClick={() => !imagePreview && fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {imagePreview ? (
          <div className="upload-preview-wrap">
            <img src={imagePreview} alt="Selected" className="upload-preview-img" />
            <button className="upload-clear-btn" onClick={(e) => { e.stopPropagation(); handleClear(); }}>✕</button>
          </div>
        ) : (
          <div className="upload-placeholder">
            <span className="upload-icon">📷</span>
            <span className="upload-cta">Tap to select a photo</span>
            <span className="upload-hint">or drag & drop an image</span>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="upload-file-input"
          onChange={handleFileSelect}
        />
      </div>

      {/* Text Input */}
      <div className="upload-text-section">
        <label className="upload-label" htmlFor="upload-desc">Your Assessment</label>
        <textarea
          id="upload-desc"
          className="upload-textarea"
          placeholder="Describe the component and its condition, e.g. 'Inspecting the bucket teeth — they look worn down on the left side'"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          disabled={loading}
        />
      </div>

      {/* Error */}
      {error && <div className="upload-error">{error}</div>}

      {/* Submit */}
      <button
        className={`upload-submit ${loading ? 'loading' : ''}`}
        onClick={handleSubmit}
        disabled={loading || !imageBase64}
      >
        {loading ? (
          <><span className="upload-spinner"></span>Analyzing...</>
        ) : (
          <>🔍 Run AI Inspection</>
        )}
      </button>
    </div>
  );
}
