import sys
import os
import json
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', '.env'))

from backend.services.gemini_service import GeminiService

def test_multiple_items():
    gemini = GeminiService()
    
    # Simulate a visual analysis result
    visual = {
        "component": "Tires and Hydraulic Hoses",
        "preliminary_status": "MONITOR",
        "condition_observations": ["Tires look ok but some wear", "Hoses have a slight drip"],
        "concerns": ["Hose drip could worsen"],
        "confidence": 0.8,
        "chain_of_thought": {"conclusion": "Both items need checking."}
    }
    
    # Simulate audio
    audio = {
        "full_text": "The front left tire looks good, tread is okay. But the bucket tilt cylinder hoses are leaking a bit of fluid.",
        "components_mentioned": [
            {"name": "tire", "timestamp": 1.0},
            {"name": "bucket tilt cylinder hoses", "timestamp": 3.0}
        ]
    }
    
    print("Sending to Gemini Cross-Reference with multiple items in context...")
    result = gemini.cross_reference(visual, audio, [], [])
    
    print("\n--- RESULTS ---")
    print(json.dumps(result, indent=2))
    
    if "items_evaluated" in result and len(result["items_evaluated"]) > 1:
        print("\nSUCCESS! Multiple items evaluated.")
    else:
        print("\nFAILED to evaluate multiple items.")

if __name__ == "__main__":
    test_multiple_items()
