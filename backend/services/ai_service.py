import os
import io
from urllib.parse import urlparse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal
from google import genai
from google.genai import types

class ChecklistItem(BaseModel):
    status: Literal["PASS", "FAIL", "MONITOR", "NORMAL"]
    comments: Optional[str] = Field(description="Any observations or remarks on the item. Essential if status is FAIL or MONITOR.")

class EquipmentInfo(BaseModel):
    customer_no: Optional[str] = None
    serial_number: Optional[str] = None
    customer_name: Optional[str] = None
    make: Optional[str] = None
    work_order: Optional[str] = None
    model: Optional[str] = None
    equipment_family: Optional[str] = None
    asset_id: Optional[str] = None
    smu_hours: Optional[str] = None
    location: Optional[str] = None

class SafetyReport(BaseModel):
    equipment_info: EquipmentInfo
    general_info_comments: Optional[str] = None
    from_the_ground: Dict[str, ChecklistItem] = Field(description="Checklist items inspected from the ground. Use clear keys like '1.1 Tires and Rims'")
    engine_compartment: Dict[str, ChecklistItem] = Field(description="Checklist items for the engine compartment. Keys like '2.1 Engine Oil Level'")
    on_machine_outside_cab: Dict[str, ChecklistItem] = Field(description="Checklist items on the machine but outside the cab. Keys like '3.1 Steps & Handrails'")
    inside_cab: Dict[str, ChecklistItem] = Field(description="Checklist items inside the cab. Keys like '4.1 Seat'")

class AnalysisResponse(BaseModel):
    reasoning: str = Field(description="Your step-by-step reasoning on what you see in the frames, what you hear in the audio, and why you are making your decisions. Be detailed. This must be filled out BEFORE determining is_complete.")
    is_complete: bool = Field(description="True if the visual and audio information was sufficient to complete the safety report. False if critical information is missing or unclear.")
    clarifications: Optional[List[str]] = Field(description="If is_complete is False, a list of specific, actionable requests for the user to show or clarify (e.g., 'Please record a clear view of the front tires and rims.').")
    report: Optional[SafetyReport] = Field(description="The completed safety report, providing information available if is_complete is True.")


SYS_PROMPT = """
You are an expert heavy equipment inspector for brand like Caterpillar.
You are reviewing real-time video frames and audio commentary from a technician performing a walk-around inspection, specifically focusing on Wheel Loaders.

Your task is to analyze the provided images and audio to produce a Daily Safety Checklist Report.

Review the following:
1. Did the technician provide enough clear visual evidence of the key components (Tires, Bucket, Engine, Cab, etc.)?
2. Did the technician's audio provide necessary context (e.g., fluid levels, operational sounds)?

If you CANNOT reasonably assess the equipment's safety and condition based on the provided media (e.g., the video is just of a desk, or crucial parts are completely missing/obscured), set `is_complete` to `false` and provide specific `clarifications` asking the user what to show next (e.g., "Please show the wheel loader's engine compartment", "I cannot see the bucket cutting edge clearly").

If you HAVE enough information to make an assessment (even if some minor parts are missed, or if you can evaluate the parts shown), set `is_complete` to `true` and fill out the `report` based ONLY on what you see and hear. Use status codes PASS, FAIL, MONITOR, or NORMAL. Provide comments, especially for FAIL or MONITOR statuses.

Remember, the user is submitting a stream of frames. Act as an interactive assistant that guides them through the inspection if they miss things, but generate the report if they've provided a reasonable amount of relevant footage.
"""


def analyze_inspection(frame_paths: List[str], audio_path: Optional[str] = None) -> dict:
    """"
    Analyzes an inspection using Gemini.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set.")

    client = genai.Client(api_key=api_key)
    
    contents = [SYS_PROMPT]
    
    # Upload and append media
    # Since these are local files, we upload them using the File API for better performance with multimodal models
    uploaded_files = []
    
    try:
        if audio_path and os.path.exists(audio_path):
            audio_file = client.files.upload(file=audio_path, config={'display_name': 'inspection_audio'})
            uploaded_files.append(audio_file)
            contents.append(audio_file)
            
        # We might have many frames. Gemini can handle many images, but let's be mindful of limits.
        # If there are > 50 frames, we might want to sample them, but for now we'll upload them all.
        max_frames = 30
        step = max(1, len(frame_paths) // max_frames)
        sampled_frames = frame_paths[::step][:max_frames]
        
        for fp in sampled_frames:
            if os.path.exists(fp):
                # Upload files
                img_file = client.files.upload(file=fp)
                uploaded_files.append(img_file)
                contents.append(img_file)

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AnalysisResponse,
                temperature=0.1, # Keep it factual
            ),
        )
        
        return response.text
        
    finally:
        # Clean up uploaded files to avoid hitting quotas
        for f in uploaded_files:
            try:
                 client.files.delete(name=f.name)
            except Exception as e:
                 print(f"Failed to delete file {f.name}: {e}")
