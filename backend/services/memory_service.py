import os
import json

class MemoryService:
    def __init__(self):
        # We'll store our history in a local JSON file for the demo
        self.history_file = os.path.join(os.path.dirname(__file__), '..', 'history.json')
        print(f"[INFO] Initialized local JSON MemoryService at {self.history_file}")

    def _load_history(self):
        if not os.path.exists(self.history_file):
            return []
        try:
            with open(self.history_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"[ERROR] Failed to load history: {e}")
            return []

    def _save_all_history(self, history_list):
        try:
            with open(self.history_file, 'w') as f:
                json.dump(history_list, f, indent=2)
            return True
        except Exception as e:
            print(f"[ERROR] Failed to write history: {e}")
            return False

    def save_inspection(self, inspection_id: str, component: str, grade: str, notes: str, raw_analysis: dict, audio_transcript: str = "", frames: list = []) -> bool:
        """
        Save the structured inspection result to the local JSON file.
        """
        try:
            history = self._load_history()
            
            # Create a new record
            new_record = {
                "inspection_id": inspection_id,
                "component": component,
                "grade": grade,
                "operator_notes": notes,
                "audio_transcript": audio_transcript,
                "frame_count": len(frames),
                "ai_analysis": raw_analysis,
                "frames": frames
            }
            
            # Add to the beginning of the list (newest first)
            history.insert(0, new_record)
            
            # Save back to disk
            success = self._save_all_history(history)
            
            print(f"[MEMORY] Saved inspection {inspection_id} for {component}. Success: {success}")
            return success
        except Exception as e:
            print(f"[ERROR] Failed to save inspection to memory: {e}")
            return False

    def get_history(self, component_query: str, limit: int = 5) -> list:
        """
        Retrieve past inspection records for a specific component from the JSON file.
        """
        try:
            history = self._load_history()
            
            # Filter matches (simple substring or exact match for now)
            matches = [record for record in history if component_query.lower() in record.get("component", "").lower()]
            
            return matches[:limit]
        except Exception as e:
            print(f"[ERROR] Failed to retrieve history for {component_query}: {e}")
            return []

# Singleton instance
memory = MemoryService()
