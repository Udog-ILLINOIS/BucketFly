import { useState, useRef } from 'react';
import './UploadInspect.css';

export function UploadInspect({ onImageResult, onVideoResult, isLoading: externalLoading }) {
  const [preview, setPreview] = useState(null);       // data URL for image, object URL for video
  const [fileData, setFileData] = useState(null);     // { type: 'image'|'video', payload }
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const isVideo = fileData?.type === 'video';

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImg = file.type.startsWith('image/');
    const isVid = file.type.startsWith('video/');

    if (!isImg && !isVid) {
      setError('Please select an image or video file.');
      return;
    }

    setError(null);
    setDescription('');

    if (isImg) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreview(ev.target.result);
        setFileData({ type: 'image', payload: ev.target.result });
      };
      reader.readAsDataURL(file);
    } else {
      const url = URL.createObjectURL(file);
      setPreview(url);
      setFileData({ type: 'video', payload: file });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileRef.current.files = dt.files;
      handleFileSelect({ target: { files: dt.files } });
    }
  };

  const handleClear = () => {
    if (preview && isVideo) URL.revokeObjectURL(preview);
    setPreview(null);
    setFileData(null);
    setDescription('');
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!fileData) {
      setError('Please select a file first.');
      return;
    }
    if (!isVideo && !description.trim()) {
      setError('Please describe what you see or which component this is.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isVideo) {
        await onVideoResult(fileData.payload);
      } else {
        await onImageResult(fileData.payload, description.trim());
      }
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
        <p className="upload-subtitle">
          {isVideo
            ? 'Video detected — audio will be transcribed and frames extracted automatically'
            : 'Upload a photo and describe the component'}
        </p>
      </div>

      {/* Drop Zone */}
      <div
        className={`upload-dropzone ${preview ? 'has-image' : ''}`}
        onClick={() => !preview && fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        {preview ? (
          <div className="upload-preview-wrap">
            {isVideo ? (
              <video
                src={preview}
                className="upload-preview-img"
                controls
                playsInline
                muted
              />
            ) : (
              <img src={preview} alt="Selected" className="upload-preview-img" />
            )}
            <button
              className="upload-clear-btn"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
            >✕</button>
          </div>
        ) : (
          <div className="upload-placeholder">
            <span className="upload-icon">📁</span>
            <span className="upload-cta">Tap to select a photo or video</span>
            <span className="upload-hint">or drag & drop — JPEG, PNG, MP4, MOV, WebM</span>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="upload-file-input"
          onChange={handleFileSelect}
        />
      </div>

      {/* Description (images only) */}
      {!isVideo && (
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
      )}

      {/* Video info banner */}
      {isVideo && (
        <div className="upload-video-info">
          <span>🎙️</span>
          <span>Audio will be transcribed. Key frames are extracted at keyword timestamps — O(1) per frame.</span>
        </div>
      )}

      {/* Error */}
      {error && <div className="upload-error">{error}</div>}

      {/* Submit */}
      <button
        className={`upload-submit ${loading ? 'loading' : ''}`}
        onClick={handleSubmit}
        disabled={loading || !fileData}
      >
        {loading ? (
          <><span className="upload-spinner"></span>{isVideo ? 'Processing video…' : 'Analyzing…'}</>
        ) : (
          <>{isVideo ? '🎬 Analyze Video' : '🔍 Run AI Inspection'}</>
        )}
      </button>
    </div>
  );
}
