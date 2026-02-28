import os
import sys
import base64
import json
import glob
from datetime import datetime, timedelta

# Ensure the backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.memory_service import memory

def get_base64_image(filepath):
    if not os.path.exists(filepath):
        return None
    with open(filepath, "rb") as f:
        encoded = base64.b64encode(f.read()).decode('utf-8')
        ext = filepath.split('.')[-1].lower()
        mime = f"image/{ext}" if ext != 'jpg' else "image/jpeg"
        return f"data:{mime};base64,{encoded}"

def seed_scenario_1_bucket():
    """SCENARIO 1: Bucket Teeth - Progressive wear over 3 days."""
    component = "1.2 Bucket Cutting Edge, Tips, or Moldboard"
    base_path = "/tmp/HackIL26-CATrack"
    
    # 1. Day -3: Perfect condition (Green)
    day_3_img = glob.glob(os.path.join(base_path, "Pass", "Bucket*.jpg"))
    img_b64 = get_base64_image(day_3_img[0]) if day_3_img else ""
    
    memory.save_inspection(
        inspection_id=(datetime.now() - timedelta(days=3)).strftime('%Y%m%d_%H%M%S'),
        component=component,
        grade="Green",
        notes="Teeth look sharp and intact. Normal wear.",
        raw_analysis={"chain_of_thought": {"conclusion": "PASS - Acceptable wear"}},
        audio_transcript="Inspecting the bucket. Teeth look great today.",
        frames=[img_b64]
    )

    # 2. Day -1: Starting to blunt (Yellow)
    memory.save_inspection(
        inspection_id=(datetime.now() - timedelta(days=1)).strftime('%Y%m%d_%H%M%S'),
        component=component,
        grade="Yellow",
        notes="Wear increased. Tips are blunted. Monitor for replacement.",
        raw_analysis={"chain_of_thought": {"conclusion": "MONITOR - Blunting detected"}},
        audio_transcript="Bucket teeth showing more wear. Still okay for now.",
        frames=[img_b64] # In real life would be a different photo
    )
    print("✅ Seeded Bucket Scenario")

def seed_scenario_2_hydraulic():
    """SCENARIO 2: Hydraulic Leak - From dry seal to wet seal."""
    component = "1.3 Bucket Tilt Cylinders and Hoses"
    base_path = "/tmp/HackIL26-CATrack"
    
    # 1. Day -5: Dry seal (Green)
    day_5_img = glob.glob(os.path.join(base_path, "Pass", "Hydraulic*.jpg"))
    img_b64 = get_base64_image(day_5_img[0]) if day_5_img else ""

    memory.save_inspection(
        inspection_id=(datetime.now() - timedelta(days=5)).strftime('%Y%m%d_%H%M%S'),
        component=component,
        grade="Green",
        notes="Seal is dry. No weeping or leaks.",
        raw_analysis={"chain_of_thought": {"conclusion": "PASS - Dry"}},
        audio_transcript="Tilt cylinders are bone dry. Perfect.",
        frames=[img_b64]
    )

    # 2. Day -2: Minor weeping (Yellow)
    memory.save_inspection(
        inspection_id=(datetime.now() - timedelta(days=2)).strftime('%Y%m%d_%H%M%S'),
        component=component,
        grade="Yellow",
        notes="Minor oil weeping at the rod seal. Clean and monitor.",
        raw_analysis={"chain_of_thought": {"conclusion": "MONITOR - Minor weep"}},
        audio_transcript="Starting to see a tiny bit of oil here. Just a weep.",
        frames=[img_b64]
    )
    print("✅ Seeded Hydraulic Scenario")

def seed_scenario_3_filter():
    """SCENARIO 3: Air Filter - Clean to Dirty."""
    component = "2.7 Air Cleaner and Air Filter Service Indicator"
    base_path = "/tmp/HackIL26-CATrack"
    
    # 1. Day -10: Brand new (Green)
    day_10_img = glob.glob(os.path.join(base_path, "Pass", "Air*.jpg"))
    img_b64 = get_base64_image(day_10_img[0]) if day_10_img else ""

    memory.save_inspection(
        inspection_id=(datetime.now() - timedelta(days=10)).strftime('%Y%m%d_%H%M%S'),
        component=component,
        grade="Green",
        notes="Filter replaced today. Indicators clear.",
        raw_analysis={"chain_of_thought": {"conclusion": "PASS - New"}},
        audio_transcript="Installing fresh filter now.",
        frames=[img_b64]
    )
    print("✅ Seeded Air Filter Scenario")

if __name__ == "__main__":
    if not os.path.exists("/tmp/HackIL26-CATrack"):
        print("Error: /tmp/HackIL26-CATrack not found. Run seed_memory.py first to clone the repo.")
        sys.exit(1)
    
    seed_scenario_1_bucket()
    seed_scenario_2_hydraulic()
    seed_scenario_3_filter()
    print("\n✅ Scenario Seeding Complete")
