"""
Training Data Catalog — Cat Vision-Inspect

Provides labeled training examples for few-shot prompting to improve
the AI's ability to classify component conditions into:
  - RED:   Component is broken / machine should NOT operate
  - YELLOW: Component needs repair soon but can operate today
  - GREEN:  Component is in acceptable working condition
  - FAIL:   Insufficient image data / cannot determine status

Training images are loaded from the data/ folder:
  data/Red/       → Known RED examples
  data/Yellow/    → Known YELLOW examples
  data/Failed Prompts/ → FALSE POSITIVES (look bad but are actually GREEN)
"""

import os
import base64
from pathlib import Path

# Resolve path to data/ relative to this file (backend/services/ → data/)
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


# ─────────────────────────────────────────────────────
# LABELED TRAINING CATALOG
# ─────────────────────────────────────────────────────

TRAINING_CATALOG = {
    "red": [
        {
            "filename": "FlatWheel.png",
            "component": "Tires and Rims",
            "checklist_item": "1.1 Tires and Rims",
            "grade": "Red",
            "reason": "Flat/deflated wheel — complete loss of tire pressure. Structural integrity of rim may be compromised. Machine CANNOT safely operate. Risk of rollover, uneven load bearing, and rim damage to ground surface.",
            "visual_indicators": [
                "Tire is visibly flat or severely under-inflated",
                "Rim may be sitting on ground or tire bead unseated",
                "Sidewall deformation or bulging",
                "Potential rim cracks from operating on flat tire"
            ],
        },
        {
            "filename": "HydraulicFluidLow.png",
            "component": "Hydraulic fluid tank",
            "checklist_item": "1.13 Hydraulic fluid tank, inspect",
            "grade": "Red",
            "reason": "Hydraulic fluid critically low — below minimum operating level on sight glass. Operating with low hydraulic fluid risks pump cavitation, overheating, loss of hydraulic function (steering, brakes, implements). Machine MUST NOT operate.",
            "visual_indicators": [
                "Sight glass shows fluid well below MIN mark",
                "Air visible in sight glass where fluid should be",
                "Possible staining below tank indicating leak source",
                "Fluid color may indicate contamination or overheating"
            ],
        },
        {
            "filename": "SeizedPin.png",
            "component": "Lift arm attachment to frame",
            "checklist_item": "1.5 Lift arm attachment to frame",
            "grade": "Red",
            "reason": "Seized/frozen pivot pin — pin is locked due to corrosion, lack of lubrication, or mechanical failure. Cannot articulate properly. Risk of catastrophic structural failure during lifting operations. Machine MUST NOT operate until pin is freed or replaced.",
            "visual_indicators": [
                "Visible rust, corrosion buildup around pin",
                "Pin appears fused to bushing or bore",
                "Grease zerks clogged or absent",
                "Deformation of surrounding mounting hardware",
                "Evidence of metal-on-metal wear (scoring, galling)"
            ],
        },
    ],

    "yellow": [
        {
            "filename": "BentFinsHeatExchanger.png",
            "component": "Radiator / Heat Exchanger",
            "checklist_item": "2.3 Check Radiator Cores for Debris",
            "grade": "Yellow",
            "reason": "Bent cooling fins on heat exchanger — reduces airflow and cooling efficiency by 10-30%. Machine CAN still operate today as cooling system has margin, but prolonged use in high-ambient temps or heavy load could cause overheating. Schedule fin straightening or core cleaning within the week.",
            "visual_indicators": [
                "Multiple fins visibly bent or flattened",
                "Partial blockage of airflow passages",
                "No active leaks or coolant weeping",
                "Core structure itself is intact",
                "Some debris trapped between fins"
            ],
        },
        {
            "filename": "DentedSteps.png",
            "component": "Steps and Handrails",
            "checklist_item": "3.1 Steps & Handrails",
            "grade": "Yellow",
            "reason": "Dented/deformed access steps — the step tread surface is dented but still provides adequate grip and structural support for operator access. Not an immediate safety hazard but should be repaired to prevent further deformation. Schedule repair within maintenance cycle.",
            "visual_indicators": [
                "Visible dent or deformation in step tread",
                "Step is still attached securely to mounting",
                "Anti-slip surface partially compromised but functional",
                "No sharp edges created by deformation",
                "Handrails still intact and secure"
            ],
        },
    ],

    # These are FALSE POSITIVES — images the AI previously misclassified as
    # problematic, but the components are actually FUNCTIONAL (GREEN).
    # These teach the AI to avoid over-flagging normal wear/cosmetic issues.
    "false_positives_actually_green": [
        {
            "filename": "CoolingSystemHose.jpg",
            "component": "Hoses",
            "checklist_item": "2.4 Inspect Hoses for Cracks or Leaks",
            "correct_grade": "Green",
            "ai_mistake": "AI flagged as damaged/leaking",
            "why_actually_green": "Hose shows normal surface wear and dust accumulation typical of field equipment. No cracks, bulges, weeping, or active leaks. Fittings are secure. Hose is within normal service life. Surface discoloration is dust/dirt, NOT degradation.",
            "lesson": "Distinguish between surface dirt/dust and actual deterioration. A dusty hose is NOT a failing hose.",
        },
        {
            "filename": "DamagedAccessLadder.jpg",
            "component": "Steps and Handrails",
            "checklist_item": "3.1 Steps & Handrails",
            "correct_grade": "Green",
            "ai_mistake": "AI flagged as structurally compromised",
            "why_actually_green": "Access ladder has cosmetic scuffing and paint wear from normal use. All mounting bolts are present and tight. Welds are intact. Anti-slip tread is functional. Structure is sound despite cosmetic wear.",
            "lesson": "Paint wear and scuff marks are NORMAL on heavy equipment access points. Focus on structural integrity, not cosmetics.",
        },
        {
            "filename": "HydraulicFluidFiltration.jpg",
            "component": "Hydraulic fluid filtration system",
            "checklist_item": "1.13 Hydraulic fluid tank, inspect",
            "correct_grade": "Green",
            "ai_mistake": "AI flagged filtration system as failing",
            "why_actually_green": "Filtration system has normal operational dirt/dust on external surfaces. Filter service indicator is in normal range. No bypass warning. Fluid in sight glass is correct color and level. External grime does NOT indicate internal filtration failure.",
            "lesson": "External dirt on filtration housing is normal in field conditions. Check service indicators and sight glass, not external cleanliness.",
        },
        {
            "filename": "RustOnHydraulicComponentBracket.jpg",
            "component": "Hydraulic component mounting bracket",
            "checklist_item": "1.13 Hydraulic fluid tank, inspect",
            "correct_grade": "Green",
            "ai_mistake": "AI flagged bracket as corroded/failing",
            "why_actually_green": "Surface rust on unpainted mounting bracket is cosmetic. Bracket thickness is not compromised. Mounting bolts are tight and not corroded at threads. No structural thinning or pitting. Surface oxidation on bare steel is expected in outdoor environments.",
            "lesson": "Surface rust on unpainted steel is NORMAL outdoors. Only flag rust if there is pitting, thinning, or structural weakening. Check bolt integrity, not surface color.",
        },
        {
            "filename": "StructuralDamage.jpg",
            "component": "Machine frame / structure",
            "checklist_item": "1.6 Underneath of Machine",
            "correct_grade": "Green",
            "ai_mistake": "AI flagged as structural damage requiring shutdown",
            "why_actually_green": "What appears to be damage is actually normal wear patterns, field modifications, or fabrication marks on heavy equipment frames. No cracks, no weld failures, no deformation beyond design tolerances. Heavy equipment shows character — scars and marks from operation are expected.",
            "lesson": "Heavy equipment frames show operational wear marks. Look for actual CRACKS, WELD FAILURES, or DEFORMATION — not surface marks, paint loss, or minor dings.",
        },
        {
            "filename": "Tire ShowsSignsUnevenWear.jpg",
            "component": "Tires and Rims",
            "checklist_item": "1.1 Tires and Rims",
            "correct_grade": "Green",
            "ai_mistake": "AI flagged uneven tire wear as critical",
            "why_actually_green": "Tire shows minor uneven wear patterns that are within normal operating tolerances for heavy equipment. Tread depth is still adequate. No cord exposure, no sidewall damage, no chunks missing. Slight unevenness is common and does not indicate immediate failure.",
            "lesson": "Minor uneven tire wear is NORMAL on heavy equipment due to loading patterns and terrain. Only flag tires as Yellow if tread is approaching minimum, or Red if cord is exposed or there is sidewall damage.",
        },
        {
            "filename": "InspectionStepsGreen.jpg",
            "component": "Steps and Handrails",
            "checklist_item": "1.9 Steps and Handrails",
            "correct_grade": "Green",
            "ai_mistake": "AI flagged surface rust on bottom step edge as Yellow/MONITOR",
            "why_actually_green": "Real inspection footage of CAT machine access steps. Steps show surface rust on the lower edge of the bottom step — this is cosmetic oxidation from outdoor exposure on bare metal. Anti-slip tread surface is intact and functional. All mounting welds are sound. Structure supports operator weight safely. Inspector confirmed GREEN.",
            "lesson": "Surface rust on the edge of access steps is NORMAL on outdoor heavy equipment. Only flag Yellow if rust has caused structural thinning, sharp edges, or compromised the anti-slip surface. Only flag Red if the step is cracked, bent, or detached.",
        },
        {
            "filename": "HydraulicGaugeLevelGreen.jpg",
            "component": "Hydraulic fluid tank sight gauge",
            "checklist_item": "1.13 Hydraulic fluid tank, inspect",
            "correct_grade": "Green",
            "ai_mistake": "AI flagged the sight gauge reading as ambiguous or low",
            "why_actually_green": "Real inspection footage of a CAT hydraulic fluid sight gauge. The fluid level indicator (float/rod) is visible in the green zone of the gauge — above the minimum mark and within the acceptable operating band. The hydraulic symbol sticker is present and undamaged. No weeping, staining, or leaks around the gauge housing. Inspector confirmed GREEN.",
            "lesson": "A hydraulic sight gauge showing the indicator in the green/acceptable band is a PASS even if the fluid appears slightly below the center. Only flag Red if the indicator is at or below the red MIN mark. Only flag Yellow if the level is in the low-normal range trending toward minimum.",
        },
    ],
}


# ─────────────────────────────────────────────────────
# F1TENTH TRAINING CATALOG — ALL GREEN (passing examples)
# Images from data/F1Tenth/
# ─────────────────────────────────────────────────────

F1TENTH_TRAINING_CATALOG = {
    "green": [
        {
            "filename": "IMG_9912.jpg",
            "component": "Chassis Frame & Body",
            "checklist_item": "1.1 Chassis Frame & Body",
            "grade": "Green",
            "reason": "Chassis frame is structurally intact. No cracks, bends, or loose mounting hardware visible. Body panels are aligned and securely fastened.",
            "visual_indicators": [
                "Frame rails are straight with no visible deformation",
                "Body screws and standoffs are present and tight",
                "No cracked or broken plastic body panels",
            ],
        },
        {
            "filename": "IMG_9913.jpg",
            "component": "Wheels & Tires",
            "checklist_item": "1.2 Wheels & Tires",
            "grade": "Green",
            "reason": "Wheels are securely mounted, tires are properly seated on rims with adequate tread. No wobble, cracks, or missing hardware.",
            "visual_indicators": [
                "Wheel hex is fully engaged on axle",
                "Tire bead is properly seated on rim",
                "No cuts, chunking, or excessive wear on tire surface",
            ],
        },
        {
            "filename": "IMG_9914.jpg",
            "component": "Jetson Xavier NX (Compute)",
            "checklist_item": "2.1 Jetson Xavier NX (Compute)",
            "grade": "Green",
            "reason": "Jetson compute board is properly seated and secured. No loose cables, no thermal damage, cooling fan is present.",
            "visual_indicators": [
                "Board is mounted with all standoff screws",
                "USB and GPIO connectors are firmly seated",
                "No burn marks or bulging capacitors visible",
            ],
        },
        {
            "filename": "IMG_9915.jpg",
            "component": "LiDAR Unit",
            "checklist_item": "2.2 LiDAR Unit",
            "grade": "Green",
            "reason": "LiDAR sensor is properly mounted level on the chassis. Connector is secure. Rotating head is unobstructed.",
            "visual_indicators": [
                "LiDAR mounting bracket is tight with no play",
                "USB or serial cable is connected and strain-relieved",
                "No foreign objects blocking the scan path",
            ],
        },
        {
            "filename": "IMG_9916.jpg",
            "component": "Power Distribution Board",
            "checklist_item": "2.3 Power Distribution Board",
            "grade": "Green",
            "reason": "Power distribution board shows no signs of overheating or damage. All connectors are properly seated. Fuses are intact.",
            "visual_indicators": [
                "Board PCB traces show no burn or discoloration",
                "XT60 and JST connectors are fully engaged",
                "No loose wires or exposed solder joints",
            ],
        },
        {
            "filename": "IMG_9917.jpg",
            "component": "Chassis Frame & Body",
            "checklist_item": "1.1 Chassis Frame & Body",
            "grade": "Green",
            "reason": "Second angle confirms chassis integrity. All structural members and mounting points are undamaged.",
            "visual_indicators": [
                "Rear chassis section intact with no cracks",
                "Motor mount screws are all present",
                "Chassis is level with no visible twist",
            ],
        },
        {
            "filename": "IMG_9918.jpg",
            "component": "Wheels & Tires",
            "checklist_item": "1.2 Wheels & Tires",
            "grade": "Green",
            "reason": "Close-up confirms wheels are true and balanced. Tire compound is in good condition with even contact patch.",
            "visual_indicators": [
                "Rim is round with no dents or cracks",
                "Tire shows even tread wear pattern",
                "Wheel nut/hex is tight with no play",
            ],
        },
        {
            "filename": "IMG_9919.jpg",
            "component": "Power Distribution Board",
            "checklist_item": "2.3 Power Distribution Board",
            "grade": "Green",
            "reason": "Overall vehicle assembly view shows clean wiring harness. All components are mounted securely with no loose cables.",
            "visual_indicators": [
                "Wiring is routed away from moving parts",
                "No exposed wire strands or tape repairs",
                "All connectors appear secure and strain-relieved",
            ],
        },
    ],
}


def build_f1tenth_training_text() -> str:
    """Build a text-only few-shot block for F1Tenth green examples."""
    lines = [
        "\n=== F1TENTH TRAINING EXAMPLES (Labeled GREEN — these all PASS) ===\n",
        "These are real inspection images of a passing F1Tenth RoboRacer. Use them to",
        "understand what a GREEN (acceptable) F1Tenth component looks like.\n",
    ]
    for ex in F1TENTH_TRAINING_CATALOG["green"]:
        lines.append(f"  Image: {ex['filename']}")
        lines.append(f"  Component: {ex['component']} → Checklist: {ex['checklist_item']}")
        lines.append(f"  Grade: GREEN — {ex['reason']}")
        lines.append(f"  Key visual indicators: {'; '.join(ex['visual_indicators'])}")
        lines.append("")
    return "\n".join(lines)


def load_f1tenth_training_images() -> list:
    """
    Load all F1Tenth green training images as base64.
    Returns: [{ entry, image_b64 }, ...]
    """
    result = []
    for entry in F1TENTH_TRAINING_CATALOG["green"]:
        b64 = load_training_image_b64("F1Tenth", entry["filename"])
        if b64:
            result.append({"entry": entry, "image_b64": b64})
    return result


# ─────────────────────────────────────────────────────
# AUDIO KEYWORD → REFERENCE IMAGE MATCHING
# Maps spoken keywords to the F1Tenth reference images for that component
# ─────────────────────────────────────────────────────

COMPONENT_KEYWORD_MAP = {
    # Chassis / frame / body
    'chassis':      ['IMG_9912.jpg', 'IMG_9917.jpg'],
    'frame':        ['IMG_9912.jpg', 'IMG_9917.jpg'],
    'body':         ['IMG_9912.jpg', 'IMG_9917.jpg'],
    'shell':        ['IMG_9912.jpg', 'IMG_9917.jpg'],
    'mount':        ['IMG_9912.jpg', 'IMG_9917.jpg'],
    # Wheels / tires
    'wheel':        ['IMG_9913.jpg', 'IMG_9918.jpg'],
    'tire':         ['IMG_9913.jpg', 'IMG_9918.jpg'],
    'tyre':         ['IMG_9913.jpg', 'IMG_9918.jpg'],
    'rim':          ['IMG_9913.jpg', 'IMG_9918.jpg'],
    'axle':         ['IMG_9913.jpg', 'IMG_9918.jpg'],
    'tread':        ['IMG_9913.jpg', 'IMG_9918.jpg'],
    # Jetson compute
    'jetson':       ['IMG_9914.jpg'],
    'compute':      ['IMG_9914.jpg'],
    'nvidia':       ['IMG_9914.jpg'],
    'xavier':       ['IMG_9914.jpg'],
    'cpu':          ['IMG_9914.jpg'],
    'gpu':          ['IMG_9914.jpg'],
    'sbc':          ['IMG_9914.jpg'],
    # LiDAR
    'lidar':        ['IMG_9915.jpg'],
    'lidar':        ['IMG_9915.jpg'],
    'laser':        ['IMG_9915.jpg'],
    'scan':         ['IMG_9915.jpg'],
    'hokuyo':       ['IMG_9915.jpg'],
    'rplidar':      ['IMG_9915.jpg'],
    'sensor':       ['IMG_9915.jpg'],
    # Power / VESC / distribution board
    'power':        ['IMG_9916.jpg', 'IMG_9919.jpg'],
    'vesc':         ['IMG_9916.jpg', 'IMG_9919.jpg'],
    'battery':      ['IMG_9916.jpg', 'IMG_9919.jpg'],
    'esc':          ['IMG_9916.jpg', 'IMG_9919.jpg'],
    'board':        ['IMG_9916.jpg', 'IMG_9919.jpg'],
    'distribution': ['IMG_9916.jpg', 'IMG_9919.jpg'],
    'connector':    ['IMG_9916.jpg', 'IMG_9919.jpg'],
    'wiring':       ['IMG_9916.jpg', 'IMG_9919.jpg'],
}

# Filename → catalog entry lookup (built at import time)
_F1TENTH_FILENAME_LOOKUP = {
    entry["filename"]: entry for entry in F1TENTH_TRAINING_CATALOG["green"]
}


def get_f1tenth_reference_entries_for_text(text: str) -> list:
    """
    Given any text (audio transcript + component name), return up to 2
    F1Tenth training catalog entries whose reference images best match.

    Keyword matching: first match wins per component group; max 2 images returned.
    Falls back to empty list if nothing matches.
    """
    text_lower = text.lower()
    matched_filenames = []
    seen = set()

    for keyword, filenames in COMPONENT_KEYWORD_MAP.items():
        if keyword in text_lower:
            for fn in filenames:
                if fn not in seen:
                    matched_filenames.append(fn)
                    seen.add(fn)
            if len(matched_filenames) >= 2:
                break

    result = []
    for fn in matched_filenames[:2]:
        entry = _F1TENTH_FILENAME_LOOKUP.get(fn)
        if entry:
            result.append(entry)
    return result


# Pre-build the F1Tenth training text block
F1TENTH_TRAINING_EXAMPLES_TEXT = build_f1tenth_training_text()


# ─────────────────────────────────────────────────────
# CLASSIFICATION CRITERIA
# ─────────────────────────────────────────────────────

GRADE_DEFINITIONS = """
=== COLOR-CODE GRADING DEFINITIONS ===

RED — CRITICAL / MACHINE MUST NOT OPERATE
  The component has a failure that creates an immediate safety hazard or will cause
  catastrophic damage if the machine operates. Examples:
  • Flat tire, rim damage, or missing lug bolts
  • Hydraulic fluid below minimum — risk of pump cavitation, loss of steering/brakes
  • Seized pins or frozen pivot points — risk of structural collapse under load
  • Active fluid leaks creating puddles (not just weeping)
  • Cracked welds on structural members (boom, frame, lift arms)
  • Missing or non-functional safety devices (fire extinguisher, ROPS damage)
  • Exposed electrical wiring near fuel sources
  • Brake system failures or air tank pressure below minimum

YELLOW — MONITOR / NEEDS REPAIR SOON BUT CAN OPERATE TODAY
  The component shows degradation that needs attention in the near-term maintenance
  cycle but does NOT pose an immediate safety risk for today's operations. Examples:
  • Bent cooling fins (reduced efficiency, not failure)
  • Dented steps/handrails (still structurally sound)
  • Fluid levels in low-normal range (not below minimum)
  • Minor hydraulic hose weeping (not spraying/dripping)
  • Belt showing early cracking/glazing (not frayed/split)
  • Air filter indicator approaching service range
  • Minor cosmetic damage to cab components
  • Slow coolant consumption (no active external leak visible)

GREEN — PASS / COMPONENT IS IN ACCEPTABLE WORKING CONDITION
  The component meets Caterpillar maintenance standards for continued operation.
  Important: GREEN does not mean "brand new" — it means ACCEPTABLE. Examples:
  • Tire with adequate tread depth (even if showing normal wear patterns)
  • Hydraulic hose with dust/dirt but no cracks, bulges, or leaks
  • Steps with paint wear and scuff marks but structurally sound
  • Surface rust on unpainted brackets (structural integrity OK)
  • Normal operational dirt/grime on components
  • Fluid levels within acceptable range
  • Filters with service life remaining per indicators
  
  ⚠️ CRITICAL ANTI-PATTERN (avoid false positives):
  • Dusty/dirty does NOT mean failing
  • Paint wear does NOT mean structural damage
  • Surface rust on bare steel is NORMAL outdoors
  • Operational wear marks on frames are EXPECTED
  • Minor uneven tire wear within tolerances is NORMAL

FAIL — INSUFFICIENT DATA / CANNOT DETERMINE
  The image quality, angle, lighting, or framing is insufficient to make a reliable
  assessment. Use this when you genuinely cannot tell, NOT as a hedge. Examples:
  • Image is blurry, out of focus, or too dark
  • Component is too far away to assess detail
  • Only a partial view of the component is visible
  • Glare or reflection obscures the key inspection area
  • Image shows the wrong component or non-equipment scene
  • Multiple components visible but none clearly the subject
"""


# ─────────────────────────────────────────────────────
# FEW-SHOT TRAINING PROMPT BLOCKS
# ─────────────────────────────────────────────────────

def build_training_examples_text() -> str:
    """
    Build a text-based few-shot training block describing labeled examples.
    This is appended to prompts to teach the AI the classification boundaries.
    """
    lines = [
        "\n=== TRAINING EXAMPLES (Learn from these labeled inspections) ===\n",

        "--- RED EXAMPLES (Machine must NOT operate) ---",
    ]
    for ex in TRAINING_CATALOG["red"]:
        lines.append(f"  Image: {ex['filename']}")
        lines.append(f"  Component: {ex['component']} → Checklist: {ex['checklist_item']}")
        lines.append(f"  Grade: RED")
        lines.append(f"  Why: {ex['reason']}")
        lines.append(f"  Key visual indicators: {'; '.join(ex['visual_indicators'])}")
        lines.append("")

    lines.append("--- YELLOW EXAMPLES (Needs repair soon, can operate today) ---")
    for ex in TRAINING_CATALOG["yellow"]:
        lines.append(f"  Image: {ex['filename']}")
        lines.append(f"  Component: {ex['component']} → Checklist: {ex['checklist_item']}")
        lines.append(f"  Grade: YELLOW")
        lines.append(f"  Why: {ex['reason']}")
        lines.append(f"  Key visual indicators: {'; '.join(ex['visual_indicators'])}")
        lines.append("")

    lines.append("--- FALSE POSITIVE WARNINGS (These were wrongly flagged — they are actually GREEN) ---")
    for ex in TRAINING_CATALOG["false_positives_actually_green"]:
        lines.append(f"  Image: {ex['filename']}")
        lines.append(f"  Component: {ex['component']} → Checklist: {ex['checklist_item']}")
        lines.append(f"  AI Mistake: {ex['ai_mistake']}")
        lines.append(f"  Correct Grade: GREEN")
        lines.append(f"  Why Actually Green: {ex['why_actually_green']}")
        lines.append(f"  LESSON: {ex['lesson']}")
        lines.append("")

    return "\n".join(lines)


def load_training_image_b64(subfolder: str, filename: str):
    """
    Load a training image as base64 string.
    subfolder: 'Red', 'Yellow', 'Failed Prompts', or '' for root
    """
    if subfolder:
        path = DATA_DIR / subfolder / filename
    else:
        path = DATA_DIR / filename

    if not path.exists():
        print(f"[TRAINING] Warning: image not found: {path}")
        return None

    with open(path, "rb") as f:
        raw = f.read()

    ext = path.suffix.lower()
    mime = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
    return f"data:{mime};base64,{base64.b64encode(raw).decode('utf-8')}"


def load_all_training_images() -> dict:
    """
    Load all labeled training images as base64.
    Returns: { 'red': [...], 'yellow': [...], 'false_positives': [...] }
    """
    result = {"red": [], "yellow": [], "false_positives": []}

    for entry in TRAINING_CATALOG["red"]:
        b64 = load_training_image_b64("Red", entry["filename"])
        if b64:
            result["red"].append({"entry": entry, "image_b64": b64})

    for entry in TRAINING_CATALOG["yellow"]:
        b64 = load_training_image_b64("Yellow", entry["filename"])
        if b64:
            result["yellow"].append({"entry": entry, "image_b64": b64})

    for entry in TRAINING_CATALOG["false_positives_actually_green"]:
        b64 = load_training_image_b64("Failed Prompts", entry["filename"])
        if b64:
            result["false_positives"].append({"entry": entry, "image_b64": b64})

    return result


def get_test_images() -> list[dict]:
    """
    Load test images from data/ root (not in any subfolder).
    These are the images to evaluate against.
    """
    test_images = []
    if not DATA_DIR.exists():
        return test_images

    for item in sorted(DATA_DIR.iterdir()):
        if item.is_file() and item.suffix.lower() in (".jpg", ".jpeg", ".png"):
            b64 = load_training_image_b64("", item.name)
            if b64:
                test_images.append({
                    "filename": item.name,
                    "image_b64": b64,
                })

    return test_images


# Pre-build the training text block (used in prompts)
TRAINING_EXAMPLES_TEXT = build_training_examples_text()
