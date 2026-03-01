# F1Tenth RoboRacer — Inspection Support Plan

## Research Summary

### What is F1Tenth?
The F1Tenth (RoboRacer) is a 1:10 scale autonomous racing platform used in academic competitions
and research. Built on a Traxxas Slash 4x4 chassis, it replaces the RC receiver with a computing
stack (NVIDIA Jetson) and sensors (LiDAR, camera, IMU) to drive autonomously using ROS2.

References:
- https://f1tenth.readthedocs.io/en/stable/
- https://f1tenth.org/ (official RoboRacer site)
- F1Tenth IROS 2024 Rules: https://iros2024-race.f1tenth.org/rules.html

---

## Hardware Architecture (3 Layers)

### Layer 1 — Lower Chassis (Mechanical)
- Traxxas Slash 4x4 chassis
- Brushless DC drive motor (Velineon or equivalent)
- Steering servo + servo horn + tie rod linkage
- Differential (front and rear)
- Drive shafts
- Wheels & foam/rubber tires

### Layer 2 — Autonomy Electronics
- NVIDIA Jetson Xavier NX (primary compute)
- VESC motor controller (replaces standard ESC)
- Powerboard (power distribution)
- USB Hub
- WiFi antenna (6dBi or similar)
- LiPo battery (3S, typically 11.1V)

### Layer 3 — Sensors & Upper Chassis
- LiDAR unit: Hokuyo 10LX (Ethernet) or similar (USB RPLiDAR)
- Camera: optional (Intel RealSense, ZED, or USB webcam)
- IMU (often built into Jetson or on separate breakout)
- Mounting plate & standoffs

---

## Inspection Checklist (18 items)

Competition rules require inspection to verify:
1. Vehicle meets 1:10 scale dimension requirements
2. Only brushless DC motors are used
3. Emergency stop can be triggered remotely
4. Vehicle can drive autonomously without crashing

### Section 1: CHASSIS & DRIVETRAIN
| Item | What to Check |
|------|--------------|
| 1.1 Chassis Frame & Body | Cracks, bent chassis rails, broken mounts, missing body clips |
| 1.2 Wheels & Tires | Tire inflation/condition, wheel nut tightness, rim cracks, hub security |
| 1.3 Steering Servo & Linkage | Servo horn tight, tie rods intact, full lock-to-lock range, servo response |
| 1.4 Drive Motor (Brushless DC) | Motor mount bolts, motor leads, heat, shaft coupling, pinion gear |
| 1.5 Drivetrain & Differential | Spur gear wear, drive shaft condition, differential spin |

### Section 2: COMPUTE & ELECTRONICS
| Item | What to Check |
|------|--------------|
| 2.1 Jetson Xavier NX | Boot status, secure mounting, fan running, thermal paste, no overheating |
| 2.2 VESC Motor Controller | Status LEDs, mounting, wiring connections, no overheating, firmware |
| 2.3 USB Hub & Connections | All devices recognized, cables seated, no loose connectors |
| 2.4 WiFi Antenna & Network | SSH responds, ping latency, antenna mount secure, signal strength |
| 2.5 Power Distribution Board | Secure mounting, fusing intact, no exposed wires, voltage rails correct |

### Section 3: SENSORS
| Item | What to Check |
|------|--------------|
| 3.1 LiDAR Unit | Spinning/scanning, secure mount, connection (USB/Ethernet), scan data valid |
| 3.2 Camera System | Stream active, lens clean/undamaged, mounting secure, focus correct |
| 3.3 IMU / Inertial Sensors | Data streaming, calibration valid, mounting secure |

### Section 4: POWER SYSTEM
| Item | What to Check |
|------|--------------|
| 4.1 LiPo Battery & Charge Level | Voltage per cell ≥3.5V, no puffing/swelling, charge adequate |
| 4.2 Battery Connectors & Wiring | XT90/XT60 connectors tight, no frayed wires, no heat damage |
| 4.3 Power Switch | Switch operates cleanly, accessible, no intermittent contact |

### Section 5: SAFETY & CONNECTIVITY
| Item | What to Check |
|------|--------------|
| 5.1 Emergency Stop (E-Stop) | Remote e-stop command triggers halt, manual stop accessible |
| 5.2 ROS2 System Health | All nodes running, no crashed processes, launch successful |
| 5.3 Firmware & Software Status | VESC firmware current, algorithm loaded, no pending errors |

---

## Grading Criteria (adapted for robotics)

| Grade | Meaning for F1Tenth |
|-------|---------------------|
| RED | Vehicle must NOT operate — safety-critical failure (swollen battery, lost e-stop, severed motor leads) |
| YELLOW | Can operate but needs repair soon — degraded performance (low battery, loose servo, weak WiFi) |
| GREEN | Acceptable condition for competition/testing |
| FAIL | Insufficient image data to assess |

---

## Implementation Plan

### Files to Create
1. `.planning/f1tenth.md` ← this file

### Files to Modify

#### Frontend
1. `frontend/src/constants/checklist.js`
   - Add `F1TENTH_CHECKLIST` export (18 items across 5 sections)
   - Add `MACHINE_CHECKLISTS` map: `{ cat_ta1: CAT_TA1_CHECKLIST, f1tenth: F1TENTH_CHECKLIST }`
   - Export `getMachineChecklist(machineType)` helper

2. `frontend/src/constants/mockData.js`
   - Add `MOCK_RESULTS_F1TENTH` with 3–4 representative F1Tenth inspection scenarios

3. `frontend/src/App.jsx`
   - Add `machineType` state (default: `'cat_ta1'`)
   - Add machine selector dropdown in header area
   - Pass `machineType` to `ReportView`, `CaptureZone`, and API calls
   - Update checklist total badge (currently hardcoded to 38)

4. `frontend/src/components/ReportView.jsx`
   - Accept `machineType` prop
   - Use `getMachineChecklist(machineType)` for checklist rendering
   - Switch header title/logo based on machine type
   - Update MetaGrid to show F1Tenth metadata when appropriate

5. `frontend/src/services/api.js`
   - Pass `machine_type` field in FormData for `uploadInspection` and `uploadImageInspection`

#### Backend
6. `backend/services/claude_service.py`
   - Add `F1TENTH_VISUAL_ANALYSIS_PROMPT` with robotics-specific inspection guidance
   - Add `F1TENTH_CROSSREF_PROMPT` with F1Tenth checklist embedded
   - Update `analyze_frames()` to accept `machine_type` parameter
   - Update `cross_reference()` to accept `machine_type` parameter

7. `backend/app.py`
   - Parse `machine_type` from request in `/api/analyze` and `/api/analyze-upload`
   - Pass `machine_type` to Claude service calls

---

## Key Differences: CAT 982 vs F1Tenth

| Aspect | CAT 982 Wheel Loader | F1Tenth RoboRacer |
|--------|---------------------|-------------------|
| Scale | 20+ ton machine | 1:10 RC car |
| Operator | Human in cab | Autonomous (ROS2) |
| Safety | ROPS, seat belt, fire extinguisher | E-stop, battery safety |
| Sensors | Engine gauges, hydraulics | LiDAR, camera, IMU |
| Compute | None (operator) | Jetson Xavier NX |
| Power | Diesel engine | 3S LiPo battery |
| Failure modes | Hydraulic leaks, tire blowout | Battery swell, lost WiFi |
| Inspection frequency | Daily walkaround | Pre-run check |
