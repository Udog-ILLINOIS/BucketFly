import sys
import os
import json
from dotenv import load_dotenv

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

from services.memory_service import memory

def test_integration():
    print("=== Testing Supermemory Integration ===")
    
    # 1. Test adding an inspection
    print("\n1. Saving simulated tire inspection...")
    success = memory.save_inspection(
        inspection_id="TEST_TIRES_001",
        component="1.1 Tires and Rims",
        grade="Yellow",
        notes="Operator noted some shallow cuts on the sidewall, but tread is fine.",
        raw_analysis={
            "final_status": "MONITOR",
            "chain_of_thought": {
                "observations": "Visible shallow cuts on front left tire sidewall.",
                "conclusion": "Cuts do not expose cords. Monitor for growth."
            }
        },
        audio_transcript="I noticed some little cuts on the front left tire."
    )
    print(f"Save success: {success}")

    # 2. Test saving another inspection
    print("\n2. Saving simulated hydraulic inspection...")
    success2 = memory.save_inspection(
        inspection_id="TEST_HYD_002",
        component="2.4 Inspect Hoses for Cracks or Leaks",
        grade="Green",
        notes="No leaks visible on main boom cylinders.",
        raw_analysis={
            "final_status": "PASS",
            "chain_of_thought": {
                "observations": "Cylinders and hoses are dry.",
                "conclusion": "No defects found."
            }
        },
        audio_transcript="Hydraulics look good."
    )
    print(f"Save success: {success2}")

    # 3. Test semantic search
    print("\n3. Testing semantic search for 'tire damage'...")
    # Using a query that doesn't exactly match the component name
    history = memory.get_history("tire damage")
    print(f"Found {len(history)} records.")
    for h in history:
        print(f" - {h['inspection_id']}: {h['component']} (Score: {h.get('score', 0)})")
        print(f"   Notes: {h['operator_notes']}")
        
    # 4. Test getting dates
    print("\n4. Testing available dates...")
    dates = memory.get_available_dates()
    print(f"Dates found: {dates}")
    
    # 5. Test history by date (using the "unknown" date as that's what TEST_TIRES_001 will parse to)
    print("\n5. Testing history by date ('unknown')...")
    date_history = memory.get_history_by_date("unknown")
    print(f"Found {len(date_history)} records for 'unknown' date.")
    
    print("\n=== Integration Test Complete ===")

if __name__ == "__main__":
    test_integration()
