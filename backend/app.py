from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import base64
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Config
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "version": "0.1.0"
    })


@app.route('/api/inspect', methods=['POST'])
def inspect():
    """
    Accept inspection data from frontend.
    
    Accepts:
    - frames: JSON array of base64-encoded JPEG images (form field or JSON body)
    - audio: audio blob file (optional, for Phase 2 transcription)
    
    Phase 1: Acknowledges receipt, saves frames to disk.
    Phase 2: Will forward to Gemini for analysis.
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
            # Strip data URL prefix if present (data:image/jpeg;base64,...)
            if ',' in frame_b64:
                frame_b64 = frame_b64.split(',')[1]
            
            frame_bytes = base64.b64decode(frame_b64)
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

        return jsonify({
            "status": "received",
            "inspection_id": inspection_id,
            "frame_count": len(saved_frames),
            "has_audio": has_audio,
            "message": "Inspection data received. AI analysis will be added in Phase 2."
        }), 200

    except Exception as e:
        print(f"[ERROR] Inspection failed: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    print("=" * 50)
    print("  CAT VISION-INSPECT API")
    print("  Running on http://0.0.0.0:5001")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5001)
