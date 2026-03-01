/**
 * Machine inspection checklists.
 * Single source of truth — imported by ReportView, HistoryView, LiveFeedback.
 *
 * Supported machines:
 *   'cat_ta1'  — CAT 982 Medium Wheel Loader (daily TA1 walkaround)
 *   'f1tenth'  — F1Tenth RoboRacer autonomous car (pre-run inspection)
 */

// ─────────────────────────────────────────────────────
// CAT 982 WHEEL LOADER — TA1 DAILY INSPECTION
// ─────────────────────────────────────────────────────

export const CAT_TA1_CHECKLIST = {
  'FROM THE GROUND': [
    '1.1 Tires and Rims',
    '1.2 Bucket Cutting Edge, Tips, or Moldboard',
    '1.3 Bucket Tilt Cylinders and Hoses',
    '1.4 Bucket, Lift Cylinders and Hoses',
    '1.5 Lift arm attachment to frame',
    '1.6 Underneath of Machine',
    '1.7 Transmission and Transfer Gears',
    '1.8 Differential and Final Drive Oil',
    '1.9 Steps and Handrails',
    '1.10 Brake Air Tank; inspect',
    '1.11 Fuel Tank',
    '1.12 Axles- Final Drives, Differentials, Brakes, Duo-cone Seals',
    '1.13 Hydraulic fluid tank, inspect',
    '1.14 Transmission Oil',
    '1.15 Work Lights',
    '1.16 Battery & Cables',
  ],
  'ENGINE COMPARTMENT': [
    '2.1 Engine Oil Level',
    '2.2 Engine Coolant Level',
    '2.3 Check Radiator Cores for Debris',
    '2.4 Inspect Hoses for Cracks or Leaks',
    '2.5 Primary/secondary fuel filters',
    '2.6 All Belts',
    '2.7 Air Cleaner and Air Filter Service Indicator',
    '2.8 Overall Engine Compartment',
  ],
  'ON THE MACHINE, OUTSIDE THE CAB': [
    '3.1 Steps & Handrails',
    '3.2 ROPS/FOPS',
    '3.3 Fire Extinguisher',
    '3.4 Windshield wipers and washers',
    '3.5 Side Doors',
  ],
  'INSIDE THE CAB': [
    '4.1 Seat',
    '4.2 Seat belt and mounting',
    '4.3 Horn',
    '4.4 Backup Alarm',
    '4.5 Windows and Mirrors',
    '4.6 Cab Air Filter',
    '4.7 Indicators & Gauges',
    '4.8 Switch functionality',
    '4.9 Overall Cab Interior',
  ],
};

// ─────────────────────────────────────────────────────
// F1TENTH ROBORACER — PRE-RUN INSPECTION
// ─────────────────────────────────────────────────────

export const F1TENTH_CHECKLIST = {
  'CHASSIS': [
    '1.1 Chassis Frame & Body',
    '1.2 Wheels & Tires',
  ],
  'COMPUTE & SENSORS': [
    '2.1 Jetson Xavier NX (Compute)',
    '2.2 LiDAR Unit',
    '2.3 Power Distribution Board',
  ],
};

// ─────────────────────────────────────────────────────
// MACHINE REGISTRY
// ─────────────────────────────────────────────────────

export const MACHINE_CHECKLISTS = {
  cat_ta1: CAT_TA1_CHECKLIST,
  f1tenth: F1TENTH_CHECKLIST,
};

export const MACHINE_LABELS = {
  cat_ta1: 'CAT 982 Wheel Loader',
  f1tenth: 'F1Tenth RoboRacer',
};

export function getMachineChecklist(machineType) {
  return MACHINE_CHECKLISTS[machineType] || CAT_TA1_CHECKLIST;
}

export function getMachineChecklistTotal(machineType) {
  return Object.values(getMachineChecklist(machineType)).flat().length;
}

/** Flat array of all 38 checklist item names. */
export const ALL_CHECKLIST_ITEMS = Object.values(CAT_TA1_CHECKLIST).flat();

/** Set for O(1) membership checks. */
export const VALID_ITEMS = new Set(ALL_CHECKLIST_ITEMS);

/** Return the flat items array for a given machine type. */
export function getAllMachineItems(machineType) {
  return Object.values(getMachineChecklist(machineType)).flat();
}

/** Return a Set of valid item names for a given machine type. */
export function getValidItemsSet(machineType) {
  return new Set(getAllMachineItems(machineType));
}

/** Total number of CAT TA1 checklist items (legacy constant). */
export const CHECKLIST_TOTAL = ALL_CHECKLIST_ITEMS.length;

/** Grade → display color. */
export const GRADE_COLORS = {
  Green: '#22c55e',
  Yellow: '#f59e0b',
  Red: '#ef4444',
  None: '#e5e7eb',
};

/** Grade → display label. */
export const GRADE_LABELS = {
  Green: 'PASS',
  Yellow: 'MONITOR',
  Red: 'FAIL',
  None: 'NOT INSPECTED',
};

/** Normalize any grade string (Fail, Red, PASS, green, …) to a canonical key. */
export function normalizeGrade(grade) {
  if (!grade || grade === 'None' || grade === 'UNKNOWN') return 'None';
  const g = grade.toLowerCase();
  if (g === 'fail' || g === 'red') return 'Red';
  if (g === 'monitor' || g === 'yellow') return 'Yellow';
  if (g === 'pass' || g === 'green') return 'Green';
  return 'None';
}

/** Derive the worst (most severe) grade from a checklistState. Red > Yellow > Green > None. */
export function worstGrade(checklistState) {
  const grades = Object.values(checklistState);
  if (grades.includes('Red')) return 'Red';
  if (grades.includes('Yellow')) return 'Yellow';
  if (grades.includes('Green')) return 'Green';
  return 'None';
}

/** Count grades in a checklistState object → { Red, Yellow, Green, None }.
 *  Pass total (from getMachineChecklistTotal) to get the correct "None" count.
 */
export function countGrades(checklistState, total = CHECKLIST_TOTAL) {
  const values = Object.values(checklistState);
  return {
    Red: values.filter(v => v === 'Red').length,
    Yellow: values.filter(v => v === 'Yellow').length,
    Green: values.filter(v => v === 'Green').length,
    None: total - Object.keys(checklistState).length,
  };
}
