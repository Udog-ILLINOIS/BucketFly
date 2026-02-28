from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import base64
from datetime import datetime
import threading
from dotenv import load_dotenv

# Load environment variables (API keys)
load_dotenv()

from services.ai_service import analyze_inspection

app = Flask(__name__)
CORS(app)

# In-memory store for inspections
# Key: inspection_id
# Value: dict of state and data
INSPECTIONS_DB = {}

# Global settings
GLOBAL_CONFIG = {
    "manual_mode": False
}

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
            inspection_id = data.get('inspection_id', None)
            audio_data = None
        else:
            frames_json = request.form.get('frames', '[]')
            frames = json.loads(frames_json)
            inspection_id = request.form.get('inspection_id', None)
            audio_file = request.files.get('audio')
            audio_data = audio_file.read() if audio_file else None

        if not frames:
            return jsonify({"error": "No frames provided"}), 400

        # Handle existing inspection vs new
        is_existing = False
        if inspection_id and inspection_id in INSPECTIONS_DB:
            is_existing = True
            inspection_dir = os.path.join(UPLOAD_DIR, inspection_id)
            print(f"[INSPECT] Appending to existing inspection {inspection_id}")
        else:
            inspection_id = datetime.now().strftime('%Y%m%d_%H%M%S')
            inspection_dir = os.path.join(UPLOAD_DIR, inspection_id)
            os.makedirs(inspection_dir, exist_ok=True)
            print(f"[INSPECT] Creating new inspection {inspection_id}")

        # Determine starting index for frame names
        existing_frames_count = 0
        if is_existing:
            existing_frames_count = INSPECTIONS_DB[inspection_id]["media"]["frame_count"]

        # Save frames to disk
        saved_frames = []
        for i, frame_b64 in enumerate(frames):
            # Strip data URL prefix if present (data:image/jpeg;base64,...)
            if ',' in frame_b64:
                frame_b64 = frame_b64.split(',')[1]
            
            frame_bytes = base64.b64decode(frame_b64)
            # Use offset to not overwrite existing fames
            frame_idx = existing_frames_count + i
            frame_path = os.path.join(inspection_dir, f'frame_{frame_idx:04d}.jpg')
            with open(frame_path, 'wb') as f:
                f.write(frame_bytes)
            saved_frames.append(f'frame_{frame_idx:04d}.jpg')

        # Save audio if present (rename existing to prevent overwrite, or just overwrite current audio)
        # We will append _<timestamp> to new audio files if existing
        has_audio = False
        audio_path = None
        if audio_data and len(audio_data) > 0:
            audio_suffix = f"_{datetime.now().strftime('%H%M%S')}" if is_existing else ""
            audio_filename = f"audio{audio_suffix}.webm"
            audio_path = os.path.join(inspection_dir, audio_filename)
            with open(audio_path, 'wb') as f:
                f.write(audio_data)
            has_audio = True

        print(f"[INSPECT] Received data for {inspection_id}: "
              f"{len(saved_frames)} new frames, audio={'yes' if has_audio else 'no'}")

        # Construct full paths for the AI service
        
        # Initialize or update state in DB
        if is_existing:
            # Update existing record
            ins = INSPECTIONS_DB[inspection_id]
            ins["status"] = "processing"
            ins["media"]["frame_count"] += len(saved_frames)
            ins["media"]["frames"].extend([f"/api/media/{inspection_id}/{f}" for f in saved_frames])
            if has_audio:
                ins["media"]["audio"] = f"/api/media/{inspection_id}/{audio_filename}"
            ins["ai_draft"] = None # Reset draft
            ins["error_msg"] = None
        else:
            # Create new record
            INSPECTIONS_DB[inspection_id] = {
                "id": inspection_id,
                "status": "processing", # pending -> processing -> waiting_approval -> completed | error
                "created_at": datetime.now().isoformat(),
                "media": {
                    "frame_count": len(saved_frames),
                    "frames": [f"/api/media/{inspection_id}/{f}" for f in saved_frames],
                    "audio": f"/api/media/{inspection_id}/audio.webm" if has_audio else None
                },
                "ai_draft": None,
                "final_result": None,
                "error_msg": None
            }

        # Gather ALL frame paths and the latest audio path for AI analysis
        all_frame_filenames = [f.split('/')[-1] for f in INSPECTIONS_DB[inspection_id]["media"]["frames"]]
        all_frame_paths = [os.path.join(inspection_dir, f) for f in all_frame_filenames]
        latest_audio_path = os.path.join(inspection_dir, INSPECTIONS_DB[inspection_id]["media"]["audio"].split('/')[-1]) if INSPECTIONS_DB[inspection_id]["media"]["audio"] else None

        # Background task for AI analysis
        def run_ai_analysis(ins_id, f_paths, a_path):
            print(f"[ASYNC] Starting AI analysis for {ins_id}...")
            try:
                ai_result_json = analyze_inspection(f_paths, a_path)
                ai_result = json.loads(ai_result_json)
                
                # Update DB - wait for admin approval
                # Only if not already completed
                ins = INSPECTIONS_DB[ins_id]
                if ins["status"] != "completed":
                    ins["status"] = "waiting_approval"
                    ins["ai_draft"] = ai_result
                    print(f"[ASYNC] AI analysis for {ins_id} completed. Waiting for approval.")
                
            except Exception as ai_err:
                print(f"[ASYNC ERROR] AI analysis failed for {ins_id}: {ai_err}")
                ins = INSPECTIONS_DB[ins_id]
                if ins["status"] != "completed":
                    ins["status"] = "error"
                    ins["error_msg"] = str(ai_err)

        if GLOBAL_CONFIG["manual_mode"]:
            # Bypass AI completely
            print(f"[INSPECT] Global manual mode is ON. Bypassing AI thread for {inspection_id}.")
            INSPECTIONS_DB[inspection_id]["status"] = "waiting_approval"
            # It will have a None ai_draft, which the frontend will replace with the template
            return jsonify({
                "status": "processing",
                "inspection_id": inspection_id,
                "message": "Manual mode active. Waiting for admin."
            }), 200
        else:
            # Start thread with ALL accumulated context
            processor = threading.Thread(target=run_ai_analysis, args=(inspection_id, all_frame_paths, latest_audio_path))
            processor.start()

            # Return immediately to frontend
            return jsonify({
                "status": "processing",
                "inspection_id": inspection_id,
                "message": "Files saved. Analyzing..."
            }), 200

    except Exception as e:
        print(f"[ERROR] Inspection upload failed: {e}")
        return jsonify({"error": str(e)}), 500

# ==========================================
#  CLIENT POLLING ENDPOINT
# ==========================================
@app.route('/api/status/<inspection_id>', methods=['GET'])
def get_status(inspection_id):
    """Client polls this endpoint to check if analysis is complete."""
    inspection = INSPECTIONS_DB.get(inspection_id)
    if not inspection:
        return jsonify({"error": "Inspection not found"}), 404
        
    return jsonify({
        "status": inspection["status"],
        "analysis": inspection.get("final_result"),
        "error": inspection.get("error_msg")
    }), 200


# ==========================================
#  DEBUG / ADMIN ENDPOINTS
# ==========================================

from flask import send_from_directory

@app.route('/api/media/<inspection_id>/<filename>', methods=['GET'])
def get_media(inspection_id, filename):
    """Serve media files for debug dashboard."""
    directory = os.path.join(UPLOAD_DIR, inspection_id)
    return send_from_directory(directory, filename)


@app.route('/api/debug/inspections', methods=['GET'])
def list_inspections():
    """List all inspections for debug dashboard."""
    return jsonify({"inspections": list(INSPECTIONS_DB.values())}), 200


@app.route('/api/debug/inspections/<inspection_id>/approve', methods=['POST'])
def approve_inspection(inspection_id):
    """Admin approves or modifies the draft and releases it to the client."""
    inspection = INSPECTIONS_DB.get(inspection_id)
    if not inspection:
        return jsonify({"error": "Inspection not found"}), 404
        
    if not request.is_json:
        return jsonify({"error": "Requires JSON body"}), 400
        
    modified_data = request.get_json()
    
    # Update DB state
    inspection["final_result"] = modified_data
    inspection["status"] = "completed"
    
    return jsonify({"status": "success", "message": "Inspection approved and released"}), 200

@app.route('/api/debug/config', methods=['GET'])
def get_config():
    """Get global configuration."""
    return jsonify(GLOBAL_CONFIG), 200

@app.route('/api/debug/config', methods=['POST'])
def set_config():
    """Set global configuration."""
    if not request.is_json:
        return jsonify({"error": "Requires JSON body"}), 400
    
    data = request.get_json()
    if "manual_mode" in data:
        GLOBAL_CONFIG["manual_mode"] = bool(data["manual_mode"])
        
    return jsonify({"status": "success", "config": GLOBAL_CONFIG}), 200




if __name__ == '__main__':
    print("=" * 50)
    print("  CAT VISION-INSPECT API")
    print("  Running on http://0.0.0.0:5001")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5001)
