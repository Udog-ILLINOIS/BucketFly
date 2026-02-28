from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import json
import base64
import time
from datetime import datetime

load_dotenv()

app = Flask(__name__)
CORS(app)

# Allow large uploads — recordings with many base64 frames can be large
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB total request
app.config['MAX_FORM_MEMORY_SIZE'] = 100 * 1024 * 1024  # 100MB per form field (frames JSON)

# Config
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Lazy-initialize Gemini service (avoids import errors if key not set)
_gemini_service = None


def get_gemini():
    global _gemini_service
    if _gemini_service is None:
        from services.gemini_service import GeminiService
        _gemini_service = GeminiService()
    return _gemini_service


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "version": "0.2.0"
    })


@app.route('/api/inspect', methods=['POST'])
def inspect():
    """
    Accept inspection data from frontend — save + analyze.

    Accepts:
    - frames: JSON array of base64-encoded JPEG images
    - audio: audio blob file (optional)

    Returns: saved data + Gemini analysis (visual + audio + correlation)
    """
    try:
        # Parse frames from form data or JSON body
        if request.is_json:
            data = request.get_json()
            frames = data.get('frames', [])
            audio_data = None
        else:
            frames_json = request.form.get('frames', '[]')
            frames = json.loads(frames_json)
            audio_file = request.files.get('audio')
            audio_data = audio_file.read() if audio_file else None

        if not frames:
            return jsonify({"error": "No frames provided"}), 400

        # Create inspection directory
        inspection_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        inspection_dir = os.path.join(UPLOAD_DIR, inspection_id)
        os.makedirs(inspection_dir, exist_ok=True)

        # Save frames to disk
        saved_frames = []
        for i, frame_b64 in enumerate(frames):
            raw_b64 = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            frame_bytes = base64.b64decode(raw_b64)
            frame_path = os.path.join(inspection_dir, f'frame_{i:04d}.jpg')
            with open(frame_path, 'wb') as f:
                f.write(frame_bytes)
            saved_frames.append(f'frame_{i:04d}.jpg')

        # Save audio if present
        has_audio = False
        if audio_data and len(audio_data) > 0:
            audio_path = os.path.join(inspection_dir, 'audio.webm')
            with open(audio_path, 'wb') as f:
                f.write(audio_data)
            has_audio = True

        print(f"[INSPECT] Received inspection {inspection_id}: "
              f"{len(saved_frames)} frames, audio={'yes' if has_audio else 'no'}")

        # Run AI analysis
        gemini = get_gemini()
        result = {
            "status": "analyzed",
            "inspection_id": inspection_id,
            "frame_count": len(saved_frames),
            "has_audio": has_audio,
        }

        # Visual analysis
        try:
            visual = gemini.analyze_frames(frames)
            result["visual_analysis"] = visual
        except Exception as e:
            print(f"[WARN] Visual analysis failed: {e}")
            result["visual_analysis"] = {"error": str(e)}

        # Audio transcription
        if has_audio and audio_data:
            try:
                transcription = gemini.transcribe_audio(audio_data)
                result["audio_transcription"] = transcription

                # Timestamp correlation (frames at 2fps = 0.5s intervals)
                frame_timestamps = [i * 0.5 for i in range(len(frames))]
                correlation = gemini.correlate_timestamps(transcription, frame_timestamps)
                result["timestamp_correlation"] = correlation
            except Exception as e:
                print(f"[WARN] Audio transcription failed: {e}")
                result["audio_transcription"] = {"error": str(e)}

        # Save analysis result
        result_path = os.path.join(inspection_dir, 'analysis.json')
        with open(result_path, 'w') as f:
            json.dump(result, f, indent=2)

        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR] Inspection failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analyze/visual', methods=['POST'])
def analyze_visual():
    """
    Analyze frames visually with Gemini (standalone endpoint for testing).

    Accepts JSON: {"frames": ["base64...", ...]}
    """
    try:
        data = request.get_json()
        frames = data.get('frames', [])

        if not frames:
            return jsonify({"error": "No frames provided"}), 400

        gemini = get_gemini()
        result = gemini.analyze_frames(frames)
        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR] Visual analysis failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analyze/audio', methods=['POST'])
def analyze_audio():
    """
    Transcribe audio with Gemini (standalone endpoint for testing).

    Accepts multipart: audio file
    """
    try:
        audio_file = request.files.get('audio')
        if not audio_file:
            return jsonify({"error": "No audio file provided"}), 400

        audio_data = audio_file.read()
        gemini = get_gemini()
        result = gemini.transcribe_audio(audio_data)
        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR] Audio transcription failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analyze', methods=['POST'])
def analyze():
    """
    Full analysis pipeline: visual + audio + cross-reference.

    Accepts same multipart payload as /api/inspect:
      - frames: JSON array of base64-encoded JPEG images
      - audio: audio blob file (optional, field name must be 'audio')

    Returns: {inspection_id, frame_count, has_audio, visual_analysis,
              audio_transcription, cross_reference, final_status}
    """
    try:
        frames_json = request.form.get('frames', '[]')
        frames = json.loads(frames_json)
        audio_file = request.files.get('audio')
        audio_data = audio_file.read() if audio_file else None

        if not frames:
            return jsonify({"error": "No frames provided"}), 400

        inspection_id = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        inspection_dir = os.path.join(UPLOAD_DIR, inspection_id)
        os.makedirs(inspection_dir, exist_ok=True)

        # Save frames to disk for clarification reuse
        for i, frame_b64 in enumerate(frames):
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            with open(os.path.join(inspection_dir, f'frame_{i:04d}.jpg'), 'wb') as f:
                f.write(base64.b64decode(raw))

        gemini = get_gemini()
        result = {"inspection_id": inspection_id, "frame_count": len(frames)}

        # Step 1: Visual analysis
        try:
            visual = gemini.analyze_frames(frames)
            result["visual_analysis"] = visual
        except Exception as e:
            print(f"[WARN] Visual analysis failed: {e}")
            result["visual_analysis"] = {"error": str(e), "preliminary_status": "UNCLEAR"}
            visual = result["visual_analysis"]

        # Step 2: Audio transcription (if present)
        audio_transcription = {}
        has_audio = bool(audio_data and len(audio_data) > 0)
        result["has_audio"] = has_audio

        if has_audio:
            audio_path = os.path.join(inspection_dir, 'audio.webm')
            with open(audio_path, 'wb') as f:
                f.write(audio_data)
            try:
                audio_transcription = gemini.transcribe_audio(audio_data, mime_type="audio/webm")
                result["audio_transcription"] = audio_transcription
            except Exception as e:
                print(f"[WARN] Audio transcription failed: {e}")
                result["audio_transcription"] = {"error": str(e), "full_text": ""}

        # Step 3: Cross-reference
        try:
            cross_ref = gemini.cross_reference(visual, audio_transcription, frames)
            result["cross_reference"] = cross_ref
            result["final_status"] = cross_ref.get("final_status",
                visual.get("preliminary_status", "UNCLEAR"))
        except Exception as e:
            print(f"[WARN] Cross-reference failed: {e}")
            result["cross_reference"] = {"error": str(e)}
            result["final_status"] = visual.get("preliminary_status", "UNCLEAR")

        print(f"[ANALYZE] {inspection_id}: {len(frames)} frames, "
              f"audio={'yes' if has_audio else 'no'}, "
              f"status={result.get('final_status')}")

        # Save full result to disk
        with open(os.path.join(inspection_dir, 'analysis.json'), 'w') as f:
            json.dump(result, f, indent=2)

        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR] Analyze failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/clarify', methods=['POST'])
def clarify():
    """
    Re-analyze with clarification context.

    Accepts multipart:
      - inspection_id: string (from prior /api/analyze response)
      - audio: clarification audio blob

    Loads original frames from disk (top 5 only — token limit guard).
    Loads prior analysis.json for context.
    Calls clarify_with_context() with 3-turn multi-turn history.
    Forces MONITOR if Gemini returns CLARIFY again (CLARIFY loop guard).

    Returns: {inspection_id, clarification_result, final_status}
    """
    try:
        inspection_id = request.form.get('inspection_id')
        clarification_audio = request.files.get('audio')

        if not inspection_id:
            return jsonify({"error": "inspection_id is required"}), 400
        if not clarification_audio:
            return jsonify({"error": "audio file is required"}), 400

        inspection_dir = os.path.join(UPLOAD_DIR, inspection_id)
        analysis_path = os.path.join(inspection_dir, 'analysis.json')

        if not os.path.exists(analysis_path):
            return jsonify({"error": f"Inspection '{inspection_id}' not found"}), 404

        with open(analysis_path) as f:
            prior_result = json.load(f)

        # Load top 5 original frames from disk (raw base64, no data: prefix)
        frame_files = sorted([
            fname for fname in os.listdir(inspection_dir)
            if fname.startswith('frame_') and fname.endswith('.jpg')
        ])[:5]

        frames_b64 = []
        for fname in frame_files:
            with open(os.path.join(inspection_dir, fname), 'rb') as f:
                frames_b64.append(base64.b64encode(f.read()).decode())

        if not frames_b64:
            return jsonify({"error": "No frames found for this inspection"}), 404

        # Get prior cross-reference result (or fall back to visual analysis)
        original_analysis = prior_result.get("cross_reference",
            prior_result.get("visual_analysis", {}))

        clarification_audio_bytes = clarification_audio.read()

        gemini = get_gemini()
        clarify_result = gemini.clarify_with_context(
            frames_b64,
            original_analysis,
            clarification_audio_bytes,
        )

        # CLARIFY loop guard — never return CLARIFY from a clarification call
        if clarify_result.get("final_status") == "CLARIFY":
            clarify_result["final_status"] = "MONITOR"
            note = " [Defaulted to MONITOR: clarification audio was ambiguous]"
            clarify_result["verdict_reasoning"] = (
                clarify_result.get("verdict_reasoning", "") + note
            )

        print(f"[CLARIFY] {inspection_id}: final_status={clarify_result.get('final_status')}")

        return jsonify({
            "inspection_id": inspection_id,
            "clarification_result": clarify_result,
            "final_status": clarify_result.get("final_status"),
        }), 200

    except Exception as e:
        print(f"[ERROR] Clarify failed: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    print("=" * 50)
    print("  CAT VISION-INSPECT API v0.2")
    print("  Running on http://0.0.0.0:5001")
    print("  Gemini: gemini-2.5-flash")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5001)
