# Phase 2: Input Parsing — Research

## Gemini 2.0 Flash

- **SDK:** `google-genai` (Python)
- **Model:** `gemini-2.0-flash` — fast, multimodal (text + image + audio + video)
- **Install:** `pip install google-genai`
- **Structured output:** Use `response_mime_type='application/json'` + `response_schema` to enforce JSON shape

### Visual Analysis (Frames → JSON)

```python
from google import genai
from google.genai import types

client = genai.Client(api_key="...")

# Send frames as inline images
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=[
        types.Part.from_image(types.Image.from_bytes(frame_bytes)),
        "Analyze this equipment component..."
    ],
    config=types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema={...}  # enforce structure
    )
)
```

### Audio Transcription (Audio → Text + Timestamps)

```python
# Audio transcription with timestamps
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=[
        types.Part.from_bytes(audio_bytes, mime_type="audio/webm"),
        "Transcribe this audio with word-level timestamps..."
    ],
    config=types.GenerateContentConfig(
        audio_timestamp=True,
        response_mime_type="application/json"
    )
)
```

**Key finding:** `audio_timestamp=True` in `GenerateContentConfig` enables word-level timestamps. May exhibit drift on longer audio — our clips are short (5-30s) so this should be fine.

## Caterpillar Inspection Context

- TA1 Daily Walkaround checklist is the standard
- Components: hydraulic cylinders, bucket teeth, air filter, undercarriage, etc.
- Conditions: leaks, cracks, wear, proper fluid levels, structural damage
- Standard terminology: PASS/MONITOR/FAIL

## Dependencies

- `google-genai` — Google GenAI Python SDK
- `python-dotenv` — already installed (loads API key from .env)
