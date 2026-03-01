import { useState, useRef } from 'react'
import { CaptureZone } from './components/CaptureZone'
import { ReportView } from './components/ReportView'
import { HistoryView } from './components/HistoryView'
import { AlertDropdown } from './components/AlertDropdown'
import { uploadAudio, uploadFrames, sendClarification } from './services/api'
import './App.css'

// Shared checklist structure (mirrors backend VALID_CHECKLIST_ITEMS)
const ALL_CHECKLIST_ITEMS = [
  "1.1 Tire 1 — Front Left", "1.2 Tire 2 — Front Right",
  "1.3 Tire 3 — Rear Left", "1.4 Tire 4 — Rear Right",
  "1.5 Shock 1 — Front Left", "1.6 Shock 2 — Front Right",
  "1.7 Shock 3 — Rear Left", "1.8 Shock 4 — Rear Right",
  "1.9 Bumper 1 — Front", "1.10 Bumper 2 — Rear",
  "1.11 Undercarriage",
  "2.1 Battery", "2.2 Powerboard", "2.3 NVIDIA Jetson", "2.4 Antenna",
  "3.1 LiDAR",
];

// ─────────────────────────────────────────────────────────────────
// #debug_to_remove — Mock pipeline responses for offline testing.
// These mirror the exact JSON shape the backend returns.
// Remove this entire block before production.
// ─────────────────────────────────────────────────────────────────

const DEBUG_SCENARIOS = [
  // ── Scenario 1: Front Tires ──────────────────────────────────────
  {
    label: "S1: Front Tires",
    description: 'Operator says "front left tire looks a little worn, front right tire looks fine"',
    call1: { // #debug_to_remove — simulated Call 1 audio transcript
      inspection_id: "debug_20260228_001",
      audio_transcription: {
        full_text: "Front left tire looks a little worn. Front right tire looks fine.",
        segments: [
          { text: "Front left tire looks a little worn.", start_time: 0.5, end_time: 2.8, component_mentioned: "Tire Front Left" },
          { text: "Front right tire looks fine.", start_time: 3.1, end_time: 5.0, component_mentioned: "Tire Front Right" }
        ],
        components_mentioned: [
          { name: "Tire Front Left", timestamp: 1.2, operator_statement: "looks a little worn" },
          { name: "Tire Front Right", timestamp: 3.8, operator_statement: "looks fine" }
        ],
        processing_time_seconds: 0.84
      }
    },
    call2and3: { // #debug_to_remove — simulated Call 2 visual + Call 3 diagnosis
      inspection_id: "debug_20260228_001",
      frame_count: 4,
      audio_transcription: {
        full_text: "Front left tire looks a little worn. Front right tire looks fine.",
        components_mentioned: [
          { name: "Tire Front Left", timestamp: 1.2, operator_statement: "looks a little worn" },
          { name: "Tire Front Right", timestamp: 3.8, operator_statement: "looks fine" }
        ]
      },
      visual_analysis: { // #debug_to_remove — Call 2 output
        scene_description: "Two frames showing front tires of an F1TENTH 1:10 scale car on a concrete surface.",
        components_observed: [
          {
            name: "Front Left Tire",
            visibility: "CLEAR",
            physical_observations: [
              "Black rubber tire with visible tread pattern",
              "Tread depth visibly shallower on the outer edge compared to inner",
              "Minor flat-spotting visible on the contact patch"
            ],
            defects_noted: ["Uneven tread wear — outer edge noticeably more worn", "Slight flat-spot on contact surface"]
          },
          {
            name: "Front Right Tire",
            visibility: "CLEAR",
            physical_observations: [
              "Black rubber tire with full tread depth",
              "Uniform tread pattern across full width",
              "No visible damage or deformation"
            ],
            defects_noted: []
          }
        ],
        unidentified_frame_count: 0,
        processing_time_seconds: 1.43
      },
      cross_reference: { // #debug_to_remove — Call 3 output
        graded_items: [
          {
            checklist_item: "1.1 Tire 1 — Front Left",
            checklist_grade: "Yellow",
            final_status: "MONITOR",
            audio_evidence: "Operator said: \"looks a little worn\"",
            visual_evidence: "CLEAR view. Uneven tread wear on outer edge, minor flat-spot on contact patch confirmed.",
            defects_confirmed: ["Uneven tread wear — outer edge", "Minor flat-spot on contact surface"],
            reasoning: "Operator mentioned wear and camera confirms it: outer tread is visibly more worn with a flat-spot. Minor — not yet at replacement threshold — but warrants monitoring before next run.",
            clarification_question: "",
            recommendation: "Monitor. Rotate or replace if wear accelerates before next competition."
          },
          {
            checklist_item: "1.2 Tire 2 — Front Right",
            checklist_grade: "Green",
            final_status: "PASS",
            audio_evidence: "Operator said: \"looks fine\"",
            visual_evidence: "CLEAR view. Full tread depth, uniform pattern, no visible damage.",
            defects_confirmed: [],
            reasoning: "Component mentioned, clearly visible, zero defects observed. Operator assessment agrees with visual evidence.",
            clarification_question: "",
            recommendation: ""
          }
        ],
        unmentioned_observations: [],
        overall_status: "HAS_ISSUES",
        processing_time_seconds: 0.91
      },
      final_status: "MONITOR",
      frames_b64_sample: []
    }
  },

  // ── Scenario 2: Rear Tires + Undercarriage ───────────────────────
  {
    label: "S2: Rear + Undercarriage",
    description: 'Operator says "rear right tire good, rear left tire... hmm, undercarriage has some debris"',
    call1: { // #debug_to_remove
      inspection_id: "debug_20260228_002",
      audio_transcription: {
        full_text: "Rear right tire looks good. Rear left tire... hmm not sure. Undercarriage has some debris.",
        segments: [
          { text: "Rear right tire looks good.", start_time: 0.3, end_time: 2.1, component_mentioned: "Tire Rear Right" },
          { text: "Rear left tire hmm not sure.", start_time: 2.5, end_time: 4.2, component_mentioned: "Tire Rear Left" },
          { text: "Undercarriage has some debris.", start_time: 5.0, end_time: 7.0, component_mentioned: "Undercarriage" }
        ],
        components_mentioned: [
          { name: "Tire Rear Right", timestamp: 1.0, operator_statement: "looks good" },
          { name: "Tire Rear Left", timestamp: 3.2, operator_statement: "hmm not sure" },
          { name: "Undercarriage", timestamp: 5.8, operator_statement: "has some debris" }
        ],
        processing_time_seconds: 0.77
      }
    },
    call2and3: { // #debug_to_remove
      inspection_id: "debug_20260228_002",
      frame_count: 5,
      audio_transcription: {
        full_text: "Rear right tire looks good. Rear left tire... hmm not sure. Undercarriage has some debris.",
        components_mentioned: [
          { name: "Tire Rear Right", timestamp: 1.0, operator_statement: "looks good" },
          { name: "Tire Rear Left", timestamp: 3.2, operator_statement: "hmm not sure" },
          { name: "Undercarriage", timestamp: 5.8, operator_statement: "has some debris" }
        ]
      },
      visual_analysis: { // #debug_to_remove — Call 2
        scene_description: "Multiple frames showing rear section and underside of F1TENTH car. One frame shows undercarriage from below.",
        components_observed: [
          {
            name: "Rear Right Tire",
            visibility: "CLEAR",
            physical_observations: ["Black rubber tire, full tread visible", "Tread uniform across width, no deformation"],
            defects_noted: []
          },
          {
            name: "Rear Left Tire",
            visibility: "UNCLEAR",
            physical_observations: ["Frame is motion-blurred, tire partially occluded by wheel arch"],
            defects_noted: []
          },
          {
            name: "Undercarriage",
            visibility: "PARTIAL",
            physical_observations: ["Carbon fiber baseplate visible from below", "Small debris fragments (gravel, dirt) adhered to underside", "No structural cracks visible"],
            defects_noted: ["Debris accumulation on underside — gravel and dirt particles present"]
          }
        ],
        unidentified_frame_count: 1,
        processing_time_seconds: 1.61
      },
      cross_reference: { // #debug_to_remove — Call 3
        graded_items: [
          {
            checklist_item: "1.4 Tire 4 — Rear Right",
            checklist_grade: "Green",
            final_status: "PASS",
            audio_evidence: "Operator said: \"looks good\"",
            visual_evidence: "CLEAR view. Full tread, no defects.",
            defects_confirmed: [],
            reasoning: "All three PASS conditions met: named, clearly visible, zero defects.",
            clarification_question: "",
            recommendation: ""
          },
          {
            checklist_item: "1.3 Tire 3 — Rear Left",
            checklist_grade: "None",
            final_status: "CLARIFY",
            audio_evidence: "Operator said: \"hmm not sure\"",
            visual_evidence: "UNCLEAR — frame is motion-blurred, tire occluded by wheel arch. Cannot confirm condition.",
            defects_confirmed: [],
            reasoning: "Operator mentioned this tire but expressed uncertainty. Camera frame for this timestamp is motion-blurred and partially occluded. Cannot assign pass or fail from available evidence.",
            clarification_question: "Can you hold the camera steady on the rear left tire for 2 seconds? Is there any visible damage or unusual wear?",
            recommendation: ""
          },
          {
            checklist_item: "1.11 Undercarriage",
            checklist_grade: "Yellow",
            final_status: "MONITOR",
            audio_evidence: "Operator said: \"has some debris\"",
            visual_evidence: "PARTIAL view. Carbon fiber plate visible. Gravel and dirt debris on underside confirmed.",
            defects_confirmed: ["Debris accumulation — gravel and dirt particles on underside"],
            reasoning: "Operator identified debris and camera confirms it. No structural damage visible. Minor operational concern — debris can affect aerodynamics and heat dissipation.",
            clarification_question: "",
            recommendation: "Clean undercarriage with compressed air before run. Re-inspect after cleaning."
          }
        ],
        unmentioned_observations: [],
        overall_status: "NEEDS_CLARIFICATION",
        processing_time_seconds: 1.02
      },
      final_status: "CLARIFY",
      frames_b64_sample: []
    }
  },

  // ── Scenario 2b: Clarify — Rear Left Tire resolved ───────────────
  {
    label: "S2b: Clarify → Rear Left OK",
    description: "Operator responds: \"Yeah the rear left tire looks fine, just had a weird angle before\"",
    isClarifyResponse: true, // #debug_to_remove — marks this as a clarify scenario
    call1: { // #debug_to_remove — clarify transcription
      inspection_id: "debug_20260228_002",
      audio_transcription: {
        full_text: "Yeah the rear left tire looks fine, just had a weird angle before.",
        segments: [
          { text: "Yeah the rear left tire looks fine, just had a weird angle before.", start_time: 0.2, end_time: 3.5, component_mentioned: "Tire Rear Left" }
        ],
        components_mentioned: [
          { name: "Tire Rear Left", timestamp: 1.5, operator_statement: "looks fine, just had a weird angle before" }
        ],
        processing_time_seconds: 0.61
      }
    },
    call2and3: { // #debug_to_remove — clarify re-diagnosis (no new visual)
      inspection_id: "debug_20260228_002",
      frame_count: 5,
      audio_transcription: {
        full_text: "Yeah the rear left tire looks fine, just had a weird angle before.",
        components_mentioned: [{ name: "Tire Rear Left", timestamp: 1.5, operator_statement: "looks fine, just had a weird angle before" }]
      },
      visual_analysis: { // original visual from scenario 2 (no new call 2)
        scene_description: "Multiple frames showing rear section — same as original inspection.",
        components_observed: [
          { name: "Rear Left Tire", visibility: "UNCLEAR", physical_observations: ["Motion-blurred frame"], defects_noted: [] }
        ],
        unidentified_frame_count: 1,
        processing_time_seconds: 0
      },
      cross_reference: { // #debug_to_remove — Call 3 clarify resolution
        graded_items: [
          {
            checklist_item: "1.3 Tire 3 — Rear Left",
            checklist_grade: "Green",
            final_status: "PASS",
            audio_evidence: "Operator clarified: \"looks fine, just had a weird angle before\"",
            visual_evidence: "Original frame was UNCLEAR (blurred). No defects were visible in the unclear frame.",
            defects_confirmed: [],
            reasoning: "Operator explicitly confirmed good condition in clarification. Original visual was unclear but showed no defects. Resolved to PASS as no evidence of damage from either source.",
            clarification_question: "",
            recommendation: ""
          }
        ],
        unmentioned_observations: [],
        overall_status: "ALL_PASS",
        processing_time_seconds: 0.74
      },
      final_status: "PASS",
      frames_b64_sample: []
    }
  },

  // ── Scenario 3: Electronics ──────────────────────────────────────
  {
    label: "S3: Electronics",
    description: 'Operator says "Jetson is running, battery connector looks loose, antenna is on"',
    call1: { // #debug_to_remove
      inspection_id: "debug_20260228_003",
      audio_transcription: {
        full_text: "Jetson is running fine. Battery connector looks loose. Antenna is on.",
        segments: [
          { text: "Jetson is running fine.", start_time: 0.4, end_time: 2.0, component_mentioned: "NVIDIA Jetson" },
          { text: "Battery connector looks loose.", start_time: 2.5, end_time: 4.5, component_mentioned: "Battery" },
          { text: "Antenna is on.", start_time: 5.0, end_time: 6.2, component_mentioned: "Antenna" }
        ],
        components_mentioned: [
          { name: "NVIDIA Jetson", timestamp: 1.1, operator_statement: "is running fine" },
          { name: "Battery", timestamp: 3.4, operator_statement: "connector looks loose" },
          { name: "Antenna", timestamp: 5.5, operator_statement: "is on" }
        ],
        processing_time_seconds: 0.79
      }
    },
    call2and3: { // #debug_to_remove
      inspection_id: "debug_20260228_003",
      frame_count: 5,
      audio_transcription: {
        full_text: "Jetson is running fine. Battery connector looks loose. Antenna is on.",
        components_mentioned: [
          { name: "NVIDIA Jetson", timestamp: 1.1, operator_statement: "is running fine" },
          { name: "Battery", timestamp: 3.4, operator_statement: "connector looks loose" },
          { name: "Antenna", timestamp: 5.5, operator_statement: "is on" }
        ]
      },
      visual_analysis: { // #debug_to_remove — Call 2
        scene_description: "Electronics bay of F1TENTH car. Heatsink fan, LiPo battery pack with XT60 connector, and antenna mount visible.",
        components_observed: [
          {
            name: "NVIDIA Jetson",
            visibility: "CLEAR",
            physical_observations: ["Heatsink fins visible, no debris between fins", "Fan mounted and seated", "Board appears properly secured in mount"],
            defects_noted: []
          },
          {
            name: "Battery / XT60 Connector",
            visibility: "CLEAR",
            physical_observations: ["LiPo pack visible", "XT60 connector partially inserted — gap visible between connector halves"],
            defects_noted: ["XT60 power connector not fully seated — visible gap between male and female halves"]
          },
          {
            name: "Antenna",
            visibility: "CLEAR",
            physical_observations: ["Antenna rod vertical, mount secured to chassis", "No visible bending or damage"],
            defects_noted: []
          }
        ],
        unidentified_frame_count: 0,
        processing_time_seconds: 1.58
      },
      cross_reference: { // #debug_to_remove — Call 3
        graded_items: [
          {
            checklist_item: "2.3 NVIDIA Jetson",
            checklist_grade: "Green",
            final_status: "PASS",
            audio_evidence: "Operator said: \"is running fine\"",
            visual_evidence: "CLEAR view. Heatsink intact, fan seated, board secured. Zero defects.",
            defects_confirmed: [],
            reasoning: "All three PASS conditions met. Operator confirmed running, camera confirms physical condition is good.",
            clarification_question: "",
            recommendation: ""
          },
          {
            checklist_item: "2.1 Battery",
            checklist_grade: "Red",
            final_status: "FAIL",
            audio_evidence: "Operator said: \"connector looks loose\"",
            visual_evidence: "CLEAR view. XT60 connector visibly not fully seated — gap between connector halves confirmed.",
            defects_confirmed: ["XT60 power connector not fully seated — gap visible between male/female halves"],
            reasoning: "Operator noticed loose connector and camera confirms it clearly. An unseated XT60 under load causes intermittent power loss and arcing risk. This is a critical safety issue. FAIL regardless of operator's casual phrasing.",
            clarification_question: "",
            recommendation: "DO NOT RUN. Fully seat the XT60 connector until it clicks. Inspect for pin damage. Re-inspect before run."
          },
          {
            checklist_item: "2.4 Antenna",
            checklist_grade: "Green",
            final_status: "PASS",
            audio_evidence: "Operator said: \"is on\"",
            visual_evidence: "CLEAR view. Antenna vertical, mount secured, no damage.",
            defects_confirmed: [],
            reasoning: "Named, clearly visible, zero defects. PASS.",
            clarification_question: "",
            recommendation: ""
          }
        ],
        unmentioned_observations: [],
        overall_status: "HAS_ISSUES",
        processing_time_seconds: 0.88
      },
      final_status: "FAIL",
      frames_b64_sample: []
    }
  },

  // ── Scenario 4: LiDAR + Powerboard ──────────────────────────────
  {
    label: "S4: LiDAR + Powerboard",
    description: 'Operator says "LiDAR is mounted and spinning, powerboard has a loose wire"',
    call1: { // #debug_to_remove
      inspection_id: "debug_20260228_004",
      audio_transcription: {
        full_text: "LiDAR is mounted and spinning. Powerboard has a loose wire.",
        segments: [
          { text: "LiDAR is mounted and spinning.", start_time: 0.5, end_time: 2.8, component_mentioned: "LiDAR" },
          { text: "Powerboard has a loose wire.", start_time: 3.2, end_time: 5.1, component_mentioned: "Powerboard" }
        ],
        components_mentioned: [
          { name: "LiDAR", timestamp: 1.5, operator_statement: "is mounted and spinning" },
          { name: "Powerboard", timestamp: 4.0, operator_statement: "has a loose wire" }
        ],
        processing_time_seconds: 0.68
      }
    },
    call2and3: { // #debug_to_remove
      inspection_id: "debug_20260228_004",
      frame_count: 4,
      audio_transcription: {
        full_text: "LiDAR is mounted and spinning. Powerboard has a loose wire.",
        components_mentioned: [
          { name: "LiDAR", timestamp: 1.5, operator_statement: "is mounted and spinning" },
          { name: "Powerboard", timestamp: 4.0, operator_statement: "has a loose wire" }
        ]
      },
      visual_analysis: { // #debug_to_remove — Call 2
        scene_description: "Top and electronics bay view. LiDAR unit and power distribution board visible.",
        components_observed: [
          {
            name: "LiDAR",
            visibility: "CLEAR",
            physical_observations: ["Circular sensor unit mounted on top plate", "Sensor housing appears intact with no visible cracks", "Mounting screws all present"],
            defects_noted: []
          },
          {
            name: "Power Distribution Board",
            visibility: "CLEAR",
            physical_observations: ["Green PCB visible in electronics bay", "Multiple JST connectors present", "One JST connector partially unseated — visible from top"],
            defects_noted: ["JST connector partially unseated on powerboard — connector not fully inserted into socket"]
          }
        ],
        unidentified_frame_count: 0,
        processing_time_seconds: 1.31
      },
      cross_reference: { // #debug_to_remove — Call 3
        graded_items: [
          {
            checklist_item: "3.1 LiDAR",
            checklist_grade: "Green",
            final_status: "PASS",
            audio_evidence: "Operator said: \"is mounted and spinning\"",
            visual_evidence: "CLEAR view. Housing intact, mount screws present, no cracks.",
            defects_confirmed: [],
            reasoning: "Named, clearly visible, zero physical defects. Operator confirms operational. PASS.",
            clarification_question: "",
            recommendation: ""
          },
          {
            checklist_item: "2.2 Powerboard",
            checklist_grade: "Yellow",
            final_status: "MONITOR",
            audio_evidence: "Operator said: \"has a loose wire\"",
            visual_evidence: "CLEAR view. One JST connector partially unseated from powerboard socket.",
            defects_confirmed: ["JST connector partially unseated on powerboard"],
            reasoning: "Operator reported loose wire and camera confirms a partially unseated JST connector. Not fully disconnected — some contact may remain — but this is a reliability risk under vibration. MONITOR; reseat connector before run.",
            clarification_question: "",
            recommendation: "Reseat the loose JST connector fully before starting the run. Inspect for bent pins."
          }
        ],
        unmentioned_observations: [],
        overall_status: "HAS_ISSUES",
        processing_time_seconds: 0.93
      },
      final_status: "MONITOR",
      frames_b64_sample: []
    }
  },

  // ── Scenario 5: Shocks + Bumpers (completes all 16 items) ────────
  {
    label: "S5: Shocks + Bumpers (Final)",
    description: 'Operator says all four shocks are good and both bumpers are secure',
    call1: { // #debug_to_remove
      inspection_id: "debug_20260228_005",
      audio_transcription: {
        full_text: "Front left shock looks good. Front right shock good. Rear left shock good. Rear right shock good. Front bumper secure. Rear bumper secure.",
        segments: [
          { text: "Front left shock looks good.", start_time: 0.5, end_time: 2.0, component_mentioned: "Shock Front Left" },
          { text: "Front right shock good.", start_time: 2.3, end_time: 3.5, component_mentioned: "Shock Front Right" },
          { text: "Rear left shock good.", start_time: 3.8, end_time: 5.0, component_mentioned: "Shock Rear Left" },
          { text: "Rear right shock good.", start_time: 5.3, end_time: 6.5, component_mentioned: "Shock Rear Right" },
          { text: "Front bumper secure.", start_time: 7.0, end_time: 8.2, component_mentioned: "Bumper Front" },
          { text: "Rear bumper secure.", start_time: 8.5, end_time: 9.7, component_mentioned: "Bumper Rear" }
        ],
        components_mentioned: [
          { name: "Shock Front Left", timestamp: 1.2, operator_statement: "looks good" },
          { name: "Shock Front Right", timestamp: 2.8, operator_statement: "good" },
          { name: "Shock Rear Left", timestamp: 4.3, operator_statement: "good" },
          { name: "Shock Rear Right", timestamp: 5.8, operator_statement: "good" },
          { name: "Bumper Front", timestamp: 7.5, operator_statement: "secure" },
          { name: "Bumper Rear", timestamp: 9.0, operator_statement: "secure" }
        ],
        processing_time_seconds: 0.93
      }
    },
    call2and3: { // #debug_to_remove
      inspection_id: "debug_20260228_005",
      frame_count: 8,
      audio_transcription: {
        full_text: "Front left shock looks good. Front right shock good. Rear left shock good. Rear right shock good. Front bumper secure. Rear bumper secure.",
        components_mentioned: [
          { name: "Shock Front Left", timestamp: 1.2, operator_statement: "looks good" },
          { name: "Shock Front Right", timestamp: 2.8, operator_statement: "good" },
          { name: "Shock Rear Left", timestamp: 4.3, operator_statement: "good" },
          { name: "Shock Rear Right", timestamp: 5.8, operator_statement: "good" },
          { name: "Bumper Front", timestamp: 7.5, operator_statement: "secure" },
          { name: "Bumper Rear", timestamp: 9.0, operator_statement: "secure" }
        ]
      },
      visual_analysis: { // #debug_to_remove — Call 2
        scene_description: "Series of frames sweeping around the car showing all four shock absorbers and both bumper mounts.",
        components_observed: [
          { name: "Front Left Shock", visibility: "CLEAR", physical_observations: ["Coilover shock visible, spring intact, no oil leaks on shaft"], defects_noted: [] },
          { name: "Front Right Shock", visibility: "CLEAR", physical_observations: ["Spring coil intact, shaft clean, mount secure"], defects_noted: [] },
          { name: "Rear Left Shock", visibility: "CLEAR", physical_observations: ["Spring intact, no visible leaks or bending"], defects_noted: [] },
          { name: "Rear Right Shock", visibility: "CLEAR", physical_observations: ["Spring intact, shaft clean, mount secure"], defects_noted: [] },
          { name: "Front Bumper", visibility: "CLEAR", physical_observations: ["Front foam/plastic bumper mounted, no cracks, attachment points secure"], defects_noted: [] },
          { name: "Rear Bumper", visibility: "CLEAR", physical_observations: ["Rear bumper intact, no cracks, mount screws present"], defects_noted: [] }
        ],
        unidentified_frame_count: 0,
        processing_time_seconds: 1.74
      },
      cross_reference: { // #debug_to_remove — Call 3
        graded_items: [
          { checklist_item: "1.5 Shock 1 — Front Left", checklist_grade: "Green", final_status: "PASS", audio_evidence: "Operator said: \"looks good\"", visual_evidence: "CLEAR. Spring intact, no leaks, mount secure.", defects_confirmed: [], reasoning: "Named, clearly visible, zero defects. PASS.", clarification_question: "", recommendation: "" },
          { checklist_item: "1.6 Shock 2 — Front Right", checklist_grade: "Green", final_status: "PASS", audio_evidence: "Operator said: \"good\"", visual_evidence: "CLEAR. Spring intact, shaft clean, mount secure.", defects_confirmed: [], reasoning: "Named, clearly visible, zero defects. PASS.", clarification_question: "", recommendation: "" },
          { checklist_item: "1.7 Shock 3 — Rear Left", checklist_grade: "Green", final_status: "PASS", audio_evidence: "Operator said: \"good\"", visual_evidence: "CLEAR. Spring intact, no leaks.", defects_confirmed: [], reasoning: "Named, clearly visible, zero defects. PASS.", clarification_question: "", recommendation: "" },
          { checklist_item: "1.8 Shock 4 — Rear Right", checklist_grade: "Green", final_status: "PASS", audio_evidence: "Operator said: \"good\"", visual_evidence: "CLEAR. Spring intact, shaft clean.", defects_confirmed: [], reasoning: "Named, clearly visible, zero defects. PASS.", clarification_question: "", recommendation: "" },
          { checklist_item: "1.9 Bumper 1 — Front", checklist_grade: "Green", final_status: "PASS", audio_evidence: "Operator said: \"secure\"", visual_evidence: "CLEAR. Bumper attached, no cracks.", defects_confirmed: [], reasoning: "Named, clearly visible, zero defects. PASS.", clarification_question: "", recommendation: "" },
          { checklist_item: "1.10 Bumper 2 — Rear", checklist_grade: "Green", final_status: "PASS", audio_evidence: "Operator said: \"secure\"", visual_evidence: "CLEAR. Bumper intact, screws present.", defects_confirmed: [], reasoning: "Named, clearly visible, zero defects. PASS.", clarification_question: "", recommendation: "" }
        ],
        unmentioned_observations: [],
        overall_status: "ALL_PASS",
        processing_time_seconds: 1.05
      },
      final_status: "PASS",
      frames_b64_sample: []
    }
  }
];

// ─────────────────────────────────────────────────────────────────
// end #debug_to_remove block
// ─────────────────────────────────────────────────────────────────

/**
 * Helper to extract base64 JPEGs from a local Video Blob at specific timestamps.
 */
async function extractFramesFromVideo(videoBlob, timestampsSec, fallbackCount = 3) {
  return new Promise((resolve) => {
    const videoUrl = URL.createObjectURL(videoBlob);
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.crossOrigin = 'anonymous';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const frames = [];

    let targets = [...(timestampsSec || [])].sort((a, b) => a - b);

    // Guard against invalid duration (mobile browsers)
    const getSafeDuration = () =>
      isFinite(video.duration) && video.duration > 0 ? video.duration : 10;

    video.onloadedmetadata = () => {
      if (targets.length === 0) {
        const duration = getSafeDuration();
        const interval = duration / (fallbackCount + 1);
        for (let i = 1; i <= fallbackCount; i++) targets.push(i * interval);
      }

      canvas.width = Math.min(video.videoWidth || 640, 640);
      canvas.height = Math.min(video.videoHeight || 480, 480);

      let targetIdx = 0;

      const captureNext = () => {
        if (targetIdx >= targets.length) {
          URL.revokeObjectURL(videoUrl);
          resolve(frames);
          return;
        }
        // Timeout guard in case onseeked never fires (iOS Safari)
        const seekTimer = setTimeout(() => {
          console.warn(`[FRAMES] Seek timeout at t=${targets[targetIdx]}, using current frame`);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
          targetIdx++;
          captureNext();
        }, 3000);

        video.onseeked = () => {
          clearTimeout(seekTimer);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
          targetIdx++;
          captureNext();
        };

        video.currentTime = targets[targetIdx] + 0.001;
      };

      video.onerror = () => { URL.revokeObjectURL(videoUrl); resolve(frames); };
      captureNext();
    };

    video.onerror = () => { URL.revokeObjectURL(videoUrl); resolve([]); };
  });
}

function App() {
  const [activeTab, setActiveTab] = useState('record');
  const [lastResult, setLastResult] = useState(null);
  const [checklistState, setChecklistState] = useState({});
  const [checklistReasoningState, setChecklistReasoningState] = useState({});
  const [notification, setNotification] = useState(null);

  // Clarification State
  const [isClarifying, setIsClarifying] = useState(false);
  const [clarifyItem, setClarifyItem] = useState(null);
  const pendingInspectionId = useRef(null);

  // Polling/Loading State
  const [isPolling, setIsPolling] = useState(false);
  const [pollingStatus, setPollingStatus] = useState('Starting pipeline...');

  // Pipeline step states
  const [stepAudioDone, setStepAudioDone] = useState(false);
  const [stepFramesDone, setStepFramesDone] = useState(false);
  const [stepAnalysisDone, setStepAnalysisDone] = useState(false);

  // #debug_to_remove — debug panel visibility toggle
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // ── Real pipeline ────────────────────────────────────────────────

  const handleInspectionComplete = async ({ videoBlob, audioBlob }) => {
    setIsPolling(true);
    setStepAudioDone(false);
    setStepFramesDone(false);
    setStepAnalysisDone(false);

    try {
      // Call 1 — Audio transcription
      setPollingStatus('Call 1: Transcribing audio...');
      const transRes = await uploadAudio(audioBlob);
      setStepAudioDone(true);

      if (!transRes.inspection_id) throw new Error('No inspection ID returned');
      const inspectionId = transRes.inspection_id;
      pendingInspectionId.current = inspectionId;
      const transcription = transRes.audio_transcription || {};

      const mentioned = transcription.components_mentioned || [];
      const componentNames = mentioned.map(c => c.name).join(', ') || 'none identified';
      setPollingStatus(`Call 1 done. Heard: ${componentNames}. Extracting frames...`);

      // Frame extraction with audio timestamp offset
      const AUDIO_OFFSET_SEC = -0.8;
      const timestamps = mentioned.flatMap(c => [
        Math.max(0, c.timestamp + AUDIO_OFFSET_SEC),
        c.timestamp
      ]);
      const framesB64 = await extractFramesFromVideo(videoBlob, timestamps);
      setStepFramesDone(true);

      // Call 2 + Call 3
      setPollingStatus(`Call 2: Observing ${framesB64.length} frame(s)... Call 3: Diagnosing...`);
      const analysisRes = await uploadFrames(inspectionId, framesB64, transcription);
      setStepAnalysisDone(true);

      setIsPolling(false);
      handleUpdateResult(analysisRes);
      setActiveTab('report');

    } catch (err) {
      console.error('Inspection failed:', err);
      setIsPolling(false);
      setNotification({ status: 'FAIL', component: 'System Error', message: `Pipeline failed: ${err.message}` });
    }
  };

  // P3 fix: destructure blob object correctly
  const handleClarificationComplete = async ({ videoBlob, audioBlob }) => {
    const inspectionId = pendingInspectionId.current;
    if (!inspectionId) return;

    try {
      const blobToSend = (audioBlob && audioBlob.size > 0) ? audioBlob : videoBlob;
      const result = await sendClarification(inspectionId, blobToSend);
      setIsClarifying(false);
      setClarifyItem(null);
      handleUpdateResult(result);
      setTimeout(() => setActiveTab('report'), 1500);
      return result;
    } catch (err) {
      console.error('Clarification failed:', err);
      setIsClarifying(false);
      setClarifyItem(null);
      setNotification({ status: 'FAIL', component: 'Clarification Error', message: err.message });
      throw err;
    }
  };

  // ── #debug_to_remove — Debug injection handler ───────────────────
  const handleDebugInject = async (scenario) => {
    setShowDebugPanel(false);
    setIsPolling(true);
    setStepAudioDone(false);
    setStepFramesDone(false);
    setStepAnalysisDone(false);
    setPollingStatus(`[DEBUG] Call 1: Injecting transcript for "${scenario.label}"...`);

    // Simulate Call 1 timing
    await new Promise(r => setTimeout(r, 700));
    setStepAudioDone(true);

    const mentioned = scenario.call1.audio_transcription.components_mentioned || [];
    const names = mentioned.map(c => c.name).join(', ');
    setPollingStatus(`[DEBUG] Call 1 done. Heard: ${names}. Simulating frame extraction...`);
    pendingInspectionId.current = scenario.call1.inspection_id;

    // Simulate frame extraction timing
    await new Promise(r => setTimeout(r, 400));
    setStepFramesDone(true);

    setPollingStatus(`[DEBUG] Call 2: Injecting visual obs... Call 3: Injecting diagnosis...`);

    // Simulate Call 2 + Call 3 timing
    await new Promise(r => setTimeout(r, 1100));
    setStepAnalysisDone(true);

    setIsPolling(false);
    handleUpdateResult(scenario.call2and3);
    setActiveTab('report');
  };
  // ── end #debug_to_remove ─────────────────────────────────────────

  const handleUpdateResult = (result) => {
    setLastResult(result);

    const crossRef = result?.cross_reference;
    const finalStatus = result?.final_status;
    const gradedItems = crossRef?.graded_items || [];

    // Update checklist for every graded item in this inspection
    const newChecklistState = {};
    const newReasoningState = {};
    for (const item of gradedItems) {
      const key = item.checklist_item;
      const grade = item.checklist_grade;
      if (key && grade && grade !== 'None') {
        newChecklistState[key] = grade;
        newReasoningState[key] = item;
      }
    }
    if (Object.keys(newChecklistState).length > 0) {
      setChecklistState(prev => ({ ...prev, ...newChecklistState }));
      setChecklistReasoningState(prev => ({ ...prev, ...newReasoningState }));
    }

    // Track which item needs clarification
    const needsClarify = gradedItems.find(i => i.final_status === 'CLARIFY');
    if (needsClarify) {
      setClarifyItem(needsClarify.checklist_item);
    } else if (finalStatus !== 'CLARIFY') {
      setClarifyItem(null);
    }

    // Notification for worst status
    if (finalStatus === 'FAIL' || finalStatus === 'CLARIFY' || finalStatus === 'MONITOR') {
      const triggerItem = (
        gradedItems.find(i => i.final_status === 'FAIL') ||
        gradedItems.find(i => i.final_status === 'CLARIFY') ||
        gradedItems.find(i => i.final_status === 'MONITOR')
      );
      setNotification({
        status: finalStatus,
        component: triggerItem?.checklist_item || 'Equipment Item',
        message: triggerItem?.final_status === 'CLARIFY'
          ? triggerItem.clarification_question || 'Please show this item again.'
          : triggerItem?.reasoning || 'Issue detected.'
      });
    }

    // Check if all items graded — using functional updater to get latest state
    setChecklistState(prev => {
      const merged = { ...prev, ...newChecklistState };
      const ungraded = ALL_CHECKLIST_ITEMS.filter(item => !merged[item]);
      if (ungraded.length === 0) {
        setNotification({
          status: 'PASS',
          component: 'Rundown Complete',
          message: `All ${ALL_CHECKLIST_ITEMS.length} checklist items have been graded.`
        });
      }
      return merged;
    });
  };

  const handleAlertAction = (notif) => {
    if (notif.status === 'CLARIFY') {
      setIsClarifying(true);
      setActiveTab('record');
    } else {
      setIsClarifying(false);
      setClarifyItem(null);
      setActiveTab('report');
    }
    setNotification(null);
  };

  // #debug_to_remove — reset checklist for re-testing
  const handleDebugReset = () => {
    setChecklistState({});
    setChecklistReasoningState({});
    setLastResult(null);
    setNotification(null);
    setIsClarifying(false);
    setClarifyItem(null);
    pendingInspectionId.current = null;
  };

  return (
    <div className="app">
      <AlertDropdown
        notification={notification}
        onAction={handleAlertAction}
        onDismiss={() => setNotification(null)}
      />

      <div className="tab-content">
        {/* ── Pipeline loading overlay ── */}
        {isPolling && (
          <div className="capture-zone" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" style={{ marginBottom: '20px', width: '50px', height: '50px', border: '5px solid #333', borderTopColor: 'var(--cat-yellow)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <h2 style={{ color: 'white', textAlign: 'center', padding: '0 20px' }}>{pollingStatus}</h2>
            <div style={{ marginTop: '30px', textAlign: 'left', background: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '12px', minWidth: '280px' }}>
              {[
                [stepAudioDone, 'Call 1 — Audio Transcribed (Gemini)'],
                [stepFramesDone, 'Frames Extracted (local browser)'],
                [stepAnalysisDone, 'Call 2 — Visual Observation (Gemini)'],
                [stepAnalysisDone, 'Call 3 — Diagnosis (Gemini, text-only)'],
              ].map(([done, label], i) => (
                <div key={i} style={{ margin: '8px 0', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>{done ? '✅' : '⏳'}</span>
                  <span style={{ opacity: done ? 1 : 0.5 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Record / Capture tab ── */}
        {!isPolling && activeTab === 'record' && (
          <div style={{ position: 'relative', height: '100%' }}>
            <CaptureZone
              onInspectionComplete={isClarifying ? handleClarificationComplete : handleInspectionComplete}
            />

            {/* ── #debug_to_remove — Debug trigger button ── */}
            <button
              onClick={() => setShowDebugPanel(p => !p)}
              style={{
                position: 'absolute', bottom: '80px', right: '16px', zIndex: 100,
                background: '#1a1a2e', color: '#f59e0b', border: '1px solid #f59e0b',
                borderRadius: '8px', padding: '6px 12px', fontSize: '11px',
                fontFamily: 'monospace', cursor: 'pointer', opacity: 0.85
              }}
            >
              {showDebugPanel ? '▲ DEBUG' : '▼ DEBUG'}
            </button>

            {/* ── #debug_to_remove — Debug scenario panel ── */}
            {showDebugPanel && (
              <div style={{
                position: 'absolute', bottom: '120px', right: '16px', left: '16px', zIndex: 99,
                background: '#0f0f1a', border: '1px solid #f59e0b', borderRadius: '12px',
                padding: '16px', fontFamily: 'monospace'
              }}>
                <div style={{ color: '#f59e0b', fontSize: '11px', marginBottom: '10px', fontWeight: 'bold' }}>
                  DEBUG INJECT — #debug_to_remove
                </div>
                <div style={{ color: '#888', fontSize: '10px', marginBottom: '12px' }}>
                  Skips camera. Injects mock transcript + Gemini response.
                </div>

                {DEBUG_SCENARIOS.map((scenario, i) => (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <button
                      onClick={() => handleDebugInject(scenario)}
                      style={{
                        width: '100%', textAlign: 'left', background: '#1a1a2e',
                        border: '1px solid #333', borderRadius: '6px',
                        color: 'white', padding: '8px 10px', cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{scenario.label}</span>
                      {scenario.isClarifyResponse && (
                        <span style={{ color: '#60a5fa', marginLeft: '6px' }}>[CLARIFY RESOLVE]</span>
                      )}
                      <div style={{ color: '#888', fontSize: '10px', marginTop: '2px' }}>
                        {scenario.description}
                      </div>
                    </button>
                  </div>
                ))}

                <div style={{ borderTop: '1px solid #333', marginTop: '10px', paddingTop: '10px' }}>
                  <button
                    onClick={handleDebugReset}
                    style={{
                      width: '100%', background: '#3b0000', border: '1px solid #ef4444',
                      borderRadius: '6px', color: '#ef4444', padding: '8px',
                      cursor: 'pointer', fontSize: '11px', fontFamily: 'monospace'
                    }}
                  >
                    Reset Checklist
                  </button>
                </div>
              </div>
            )}
            {/* ── end #debug_to_remove ── */}
          </div>
        )}

        {activeTab === 'report' && (
          <ReportView
            result={lastResult}
            checklistState={checklistState}
            checklistReasoningState={checklistReasoningState}
          />
        )}
        {activeTab === 'history' && <HistoryView />}
      </div>

      {/* Tab bar */}
      <nav className="tab-bar">
        <button
          className={`tab-item ${activeTab === 'record' ? 'active' : ''}`}
          onClick={() => { setActiveTab('record'); setIsClarifying(false); }}
        >
          <span className="tab-icon">{isClarifying ? '❓' : '📹'}</span>
          <span className="tab-label">
            {isClarifying
              ? (clarifyItem ? clarifyItem.split('—')[1]?.trim() || 'Clarify' : 'Clarify')
              : 'Record'}
          </span>
        </button>
        <button
          className={`tab-item ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          <span className="tab-icon">📋</span>
          <span className="tab-label">Report</span>
          {Object.keys(checklistState).length > 0 && (
            <span className="tab-dot" style={{ backgroundColor: 'var(--cat-yellow)' }} />
          )}
        </button>
        <button
          className={`tab-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="tab-icon">🕒</span>
          <span className="tab-label">History</span>
        </button>
      </nav>
    </div>
  );
}

export default App
