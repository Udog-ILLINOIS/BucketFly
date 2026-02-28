import os
import sys
import base64
import subprocess
import glob
from dotenv import load_dotenv

# Ensure the backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

load_dotenv()
from services.memory_service import memory

REPO_URL = "https://github.com/ginocorrales/HackIL26-CATrack.git"
CLONE_DIR = "/tmp/HackIL26-CATrack"

def get_base64_image(filepath):
    with open(filepath, "rb") as f:
        encoded = base64.b64encode(f.read()).decode('utf-8')
        # Guess mime type from extension
        ext = filepath.split('.')[-1].lower()
        mime = f"image/{ext}" if ext != 'jpg' else "image/jpeg"
        return f"data:{mime};base64,{encoded}"

def parse_filename_to_component(filename):
    """Convert 'Tire ShowsSignsUnevenWear.jpg' to 'Tire' or 'HydraulicFluidTank.jpg' to 'Hydraulic Fluid Tank'"""
    name = os.path.splitext(os.path.basename(filename))[0]
    # Simple heuristic to split CamelCase
    import re
    words = re.sub('([A-Z][a-z]+)', r' \1', re.sub('([A-Z]+)', r' \1', name)).split()
    # Let's just use the humanized form of the file name as the component name for now
    clean_name = " ".join(words).strip().title()
    # Try to map common ones to TA1 standard
    if "Tire" in clean_name: return "1.1 Tires and Rims"
    if "Bucket" in clean_name: return "1.2 Bucket Cutting Edge, Tips, or Moldboard"
    if "Ladder" in clean_name or "Step" in clean_name: return "1.3 Steps and Handholds"
    if "Hydraulic" in clean_name: return "2.3 Hydraulic System"
    if "Cooling" in clean_name or "Coolant" in clean_name: return "2.5 Cooling System"
    return clean_name

def seed_database():
    if not os.path.exists(CLONE_DIR):
        print(f"Cloning {REPO_URL} into {CLONE_DIR}...")
        subprocess.run(["git", "clone", REPO_URL, CLONE_DIR], check=True)
    else:
        print(f"Directory {CLONE_DIR} already exists. Using existing files.")

    # Process PASS images
    pass_files = glob.glob(os.path.join(CLONE_DIR, "Pass", "*.*"))
    for file in pass_files:
        component = parse_filename_to_component(file)
        b64 = get_base64_image(file)
        print(f"[SEED] Processing PASS image: {os.path.basename(file)} -> {component}")
        
        raw_analysis = {
            "preliminary_status": "PASS",
            "chain_of_thought": {
                "observations": "Component appears to be in acceptable condition based on visual inspection.",
                "conclusion": "No defects found."
            }
        }
        
        memory.save_inspection(
            inspection_id=f"SEED_PASS_{os.path.basename(file)}",
            component=component,
            grade="Green",
            notes="Historical baseline (Green). Looks good.",
            raw_analysis=raw_analysis,
            audio_transcript="Everything looks completely fine.",
            frames=[b64],
            machine_id="W8210127"
        )

    # Process FAIL images
    fail_files = glob.glob(os.path.join(CLONE_DIR, "Fail", "*.*"))
    for file in fail_files:
        component = parse_filename_to_component(file)
        b64 = get_base64_image(file)
        print(f"[SEED] Processing FAIL image: {os.path.basename(file)} -> {component}")
        
        raw_analysis = {
            "preliminary_status": "FAIL",
            "chain_of_thought": {
                "observations": "Visible damage, leaks, or severe wear detected.",
                "conclusion": "Component requires immediate attention."
            }
        }
        
        memory.save_inspection(
            inspection_id=f"SEED_FAIL_{os.path.basename(file)}",
            component=component,
            grade="Red",
            notes="Historical baseline (Red). Damage detected.",
            raw_analysis=raw_analysis,
            audio_transcript="I see some significant damage here.",
            frames=[b64],
            machine_id="W8210127"
        )
        
    print("\n✅ Seeding complete.")

if __name__ == "__main__":
    seed_database()
