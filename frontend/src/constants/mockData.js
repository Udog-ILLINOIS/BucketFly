/**
 * Mock inspection results for dev testing.
 * Each entry simulates a full AI pipeline response.
 */

function mock(label, id, status, component, confidence, observations, concerns, cotVisual, audio, items, cotCrossRef) {
  return {
    label,
    inspection_id: id,
    final_status: status,
    visual_analysis: {
      component,
      preliminary_status: status,
      confidence,
      condition_observations: observations,
      concerns,
      chain_of_thought: cotVisual,
    },
    audio_transcription: {
      full_text: audio.text,
      segments: [],
      components_mentioned: audio.components,
    },
    cross_reference: {
      final_status: status,
      confidence,
      items_evaluated: items,
      chain_of_thought: cotCrossRef,
    },
  };
}

export const MOCK_RESULTS = [
  mock(
    'Tilt Cylinder — MONITOR (Yellow)', 'mock-001', 'MONITOR',
    'Bucket Tilt Cylinder', 0.85,
    ['Minor oil seepage around rod seal', 'Surface scoring on chrome rod'],
    ['Seal degradation likely within next 200 hours'],
    {
      observations: 'The hydraulic cylinder rod shows minor scoring on the chrome surface with a small amount of oil seepage visible around the rod seal area.',
      component_identification: 'Bucket Tilt Cylinder — hydraulic actuator rod and seal assembly on a Caterpillar 982 Medium Wheel Loader.',
      condition_assessment: 'Early-stage seal wear within acceptable monitoring range.',
      conclusion: 'MONITOR — Minor hydraulic seal seepage detected. Component is functional but trending toward service requirement.',
    },
    {
      text: 'Looking at the tilt cylinder, I can see some oil around the seal, looks like it might be starting to seep a little bit.',
      components: [{ name: 'tilt cylinder', timestamp: 1.2 }],
    },
    [{
      checklist_mapped_item: '1.3 Bucket Tilt Cylinders and Hoses',
      checklist_grade: 'Yellow',
      verdict_reasoning: 'Both visual AI and operator audio confirm minor oil seepage at the tilt cylinder rod seal. Not safety-critical but requires monitoring.',
      recommendation: 'Flag for next scheduled PM. Monitor seepage rate. Escalate if seepage increases before next PM.',
    }],
    {
      audio_says: 'Operator confirmed seeing oil around the seal area of the tilt cylinder.',
      visual_shows: 'AI vision detects minor surface scoring on the cylinder rod and small oil seepage around the rod seal.',
      comparison: 'AGREE — Both operator and AI visual analysis are consistent.',
      checklist_mapping_reasoning: 'Maps directly to checklist item 1.3 Bucket Tilt Cylinders and Hoses.',
    },
  ),

  mock(
    'Engine Coolant — FAIL (Red)', 'mock-002', 'FAIL',
    'Engine Coolant Reservoir', 0.94,
    ['Coolant level critically low — below MIN mark', 'White residue deposits', 'Discoloration (brownish tinge)'],
    ['Risk of engine overheating', 'Possible coolant contamination with oil'],
    {
      observations: 'Coolant reservoir is visibly below the minimum fill line. White mineral deposits around the cap.',
      component_identification: 'Engine coolant reservoir / overflow tank on a Caterpillar 982 Medium Wheel Loader.',
      condition_assessment: 'Critical finding. Coolant level is dangerously low with signs of contamination.',
      conclusion: 'FAIL — Critical coolant level deficiency. Machine should not be operated.',
    },
    {
      text: "Coolant looks really low, I can barely see it. And there's some brown stuff in there.",
      components: [{ name: 'coolant reservoir', timestamp: 0.5 }],
    },
    [
      {
        checklist_mapped_item: '2.2 Engine Coolant Level',
        checklist_grade: 'Red',
        verdict_reasoning: 'Both visual analysis and operator report confirm critically low coolant with contamination. Immediate action required.',
        recommendation: 'Do not start machine. Drain and inspect coolant system. Check for head gasket leak. Refill with correct CAT ELC coolant.',
      },
      {
        checklist_mapped_item: '2.4 Inspect Hoses for Cracks or Leaks',
        checklist_grade: 'Green',
        confidence: 0.88,
        verdict_reasoning: 'Hoses appear to be in good condition despite the coolant leak nearby.',
        recommendation: 'No immediate action required for hoses.',
      },
    ],
    {
      audio_says: 'Operator reported coolant is very low and discolored.',
      visual_shows: 'AI vision confirms coolant below MIN line, white deposits at cap, and brownish discoloration.',
      comparison: 'AGREE — Both sources are fully consistent. Critical failure confirmed.',
      checklist_mapping_reasoning: 'Maps directly to checklist item 2.2 Engine Coolant Level and evaluated hoses.',
    },
  ),

  mock(
    'Tires & Rims — PASS (Green)', 'mock-003', 'PASS',
    'Tires and Rims', 0.91,
    ['Tread depth adequate', 'No visible sidewall damage', 'Rims free of cracks'],
    [],
    {
      observations: 'All four tires show adequate tread depth with no cuts, bulges, or sidewall damage. Rims are free of cracks or deformations.',
      component_identification: 'Tires and wheel rims on Caterpillar 982 Medium Wheel Loader.',
      condition_assessment: 'Tires and rims are in good operating condition.',
      conclusion: 'PASS — Tires and rims meet all safety and operational standards.',
    },
    {
      text: 'Tires look good, plenty of tread left. No cuts or bulges. Rims are clean.',
      components: [{ name: 'tires', timestamp: 0.3 }, { name: 'rims', timestamp: 2.1 }],
    },
    [{
      checklist_mapped_item: '1.1 Tires and Rims',
      checklist_grade: 'Green',
      verdict_reasoning: 'Visual inspection and operator both confirm tires have adequate tread and no visible damage. Rims are intact.',
      recommendation: 'No action required. Continue normal operation.',
    }],
    {
      audio_says: 'Operator confirms good tread and no damage on tires or rims.',
      visual_shows: 'AI confirms adequate tread depth, no sidewall damage, and clean rims.',
      comparison: 'AGREE — Visual and audio are consistent. All clear.',
      checklist_mapping_reasoning: 'Maps to checklist item 1.1 Tires and Rims.',
    },
  ),

  mock(
    'Seat Belt — FAIL (Red)', 'mock-004', 'FAIL',
    'Seat Belt Assembly', 0.97,
    ['Seat belt webbing frayed near buckle', 'Buckle mechanism sticking', 'Retractor not retracting fully'],
    ['Operator restraint system compromised', 'Critical safety violation'],
    {
      observations: 'Seat belt webbing is visibly frayed at the buckle attachment point. The buckle mechanism is stiff and requires excessive force. The retractor fails to fully retract.',
      component_identification: 'Operator seat belt and mounting hardware in the cab of a Caterpillar 982 Medium Wheel Loader.',
      condition_assessment: 'Critical safety finding. Seat belt does not meet minimum operational safety standards.',
      conclusion: 'FAIL — Seat belt restraint system is compromised. Machine must not be operated until replaced.',
    },
    {
      text: "Seat belt is pretty worn. It's frayed right here by the buckle and the buckle itself is hard to click in. Retractor is sluggish too.",
      components: [{ name: 'seat belt', timestamp: 0.2 }, { name: 'buckle', timestamp: 1.8 }],
    },
    [{
      checklist_mapped_item: '4.2 Seat belt and mounting',
      checklist_grade: 'Red',
      verdict_reasoning: 'Both visual and operator confirm frayed webbing, sticking buckle, and sluggish retractor. Critical safety violation — machine cannot operate.',
      recommendation: 'Replace seat belt assembly immediately. Do not operate machine. Tag out until replaced and verified.',
    }],
    {
      audio_says: 'Operator reports fraying, sticking buckle, and sluggish retractor.',
      visual_shows: 'AI vision confirms frayed webbing near buckle, mechanism degradation, and incomplete retraction.',
      comparison: 'AGREE — Both sources confirm critical seat belt failure.',
      checklist_mapping_reasoning: 'Maps to checklist item 4.2 Seat belt and mounting.',
    },
  ),

  mock(
    'Engine Oil — MONITOR (Yellow)', 'mock-005', 'MONITOR',
    'Engine Oil Dipstick', 0.80,
    ['Oil level near low mark', 'Oil color darker than expected', 'No metal particles visible'],
    ['Oil may need topping off before next PM', 'Possible extended drain interval'],
    {
      observations: 'Engine oil is near the low mark on the dipstick. Color is dark but not black. No metal particles or milky appearance.',
      component_identification: 'Engine oil level check via dipstick on a Caterpillar 982 Medium Wheel Loader.',
      condition_assessment: 'Oil level is low but still within operational range. Color suggests approaching change interval.',
      conclusion: 'MONITOR — Oil level trending low. Schedule top-off or oil change at next PM.',
    },
    {
      text: "Oil is getting a bit low, close to the bottom mark. Color's pretty dark too. Might want to top it off.",
      components: [{ name: 'engine oil', timestamp: 0.4 }],
    },
    [{
      checklist_mapped_item: '2.1 Engine Oil Level',
      checklist_grade: 'Yellow',
      verdict_reasoning: 'Both visual and operator confirm oil is near the low mark with dark coloration. Not critical but should be addressed.',
      recommendation: 'Top off engine oil. Schedule oil change at next PM. Monitor consumption rate.',
    }],
    {
      audio_says: 'Operator notes low oil level and dark color, suggests topping off.',
      visual_shows: 'AI confirms oil near low mark with darker-than-expected color.',
      comparison: 'AGREE — Both sources consistent on low oil level.',
      checklist_mapping_reasoning: 'Maps to checklist item 2.1 Engine Oil Level.',
    },
  ),

  mock(
    'Fire Extinguisher — FAIL (Red)', 'mock-006', 'FAIL',
    'Fire Extinguisher', 0.96,
    ['Pressure gauge in red zone', 'Inspection tag expired 6 months ago', 'Pin seal broken'],
    ['Fire suppression not available', 'Regulatory non-compliance'],
    {
      observations: 'Fire extinguisher pressure gauge reads in the red (discharged) zone. The inspection tag shows last service over 6 months ago. The safety pin seal is broken.',
      component_identification: 'Cab-mounted fire extinguisher on a Caterpillar 982 Medium Wheel Loader.',
      condition_assessment: 'Fire extinguisher is non-functional. Critical safety and compliance violation.',
      conclusion: 'FAIL — Fire extinguisher is discharged and expired. Must be serviced or replaced before machine operation.',
    },
    {
      text: "Fire extinguisher gauge is in the red. Tag is expired too, looks like it hasn't been serviced in a while. Pin seal is broken.",
      components: [{ name: 'fire extinguisher', timestamp: 0.3 }],
    },
    [{
      checklist_mapped_item: '3.3 Fire Extinguisher',
      checklist_grade: 'Red',
      verdict_reasoning: 'Discharged gauge, expired inspection tag, and broken pin seal. Fire extinguisher is non-functional. Regulatory and safety violation.',
      recommendation: 'Replace or recharge fire extinguisher immediately. Update inspection tag. Do not operate until compliant.',
    }],
    {
      audio_says: 'Operator confirms gauge in red, expired tag, and broken pin seal.',
      visual_shows: 'AI confirms discharged pressure indicator, expired service tag, and broken safety seal.',
      comparison: 'AGREE — Both sources confirm fire extinguisher is non-functional.',
      checklist_mapping_reasoning: 'Maps to checklist item 3.3 Fire Extinguisher.',
    },
  ),

  mock(
    'Multi-Item — Mixed (3 items)', 'mock-007', 'FAIL',
    'General Walk-Around', 0.88,
    ['Fuel tank cap loose', 'Work lights cracked', 'Steps and handrails secure'],
    ['Fuel contamination risk', 'Visibility hazard at night'],
    {
      observations: 'Walk-around reveals loose fuel cap, cracked work light lens, and steps/handrails in good condition.',
      component_identification: 'Multiple components during ground-level walk-around of Caterpillar 982 Medium Wheel Loader.',
      condition_assessment: 'Mixed findings across multiple items.',
      conclusion: 'FAIL — Fuel cap and work lights require attention. Steps and handrails pass.',
    },
    {
      text: 'Fuel cap is loose, need to tighten that down. The work light on the left side has a cracked lens. Steps and handrails look fine though.',
      components: [{ name: 'fuel tank', timestamp: 0.3 }, { name: 'work lights', timestamp: 1.5 }, { name: 'steps', timestamp: 3.0 }],
    },
    [
      {
        checklist_mapped_item: '1.11 Fuel Tank',
        checklist_grade: 'Red',
        verdict_reasoning: 'Fuel tank cap is loose, allowing potential contamination and fuel evaporation. Must be secured before operation.',
        recommendation: 'Tighten or replace fuel cap. Inspect fuel for contamination.',
      },
      {
        checklist_mapped_item: '1.15 Work Lights',
        checklist_grade: 'Yellow',
        verdict_reasoning: 'Left side work light lens is cracked. Still functional but degraded. Should be replaced before night operations.',
        recommendation: 'Replace cracked lens. Avoid night operations until repaired.',
      },
      {
        checklist_mapped_item: '1.9 Steps and Handrails',
        checklist_grade: 'Green',
        verdict_reasoning: 'Steps and handrails are secure, clean, and in good condition.',
        recommendation: 'No action required.',
      },
    ],
    {
      audio_says: 'Operator reports loose fuel cap, cracked work light, and good handrails.',
      visual_shows: 'AI confirms loose cap, cracked lens, and secure handrails.',
      comparison: 'AGREE — All three findings consistent between audio and visual.',
      checklist_mapping_reasoning: 'Maps to 1.11 Fuel Tank, 1.15 Work Lights, and 1.9 Steps and Handrails.',
    },
  ),

  mock(
    'All Clear — PASS (5 items Green)', 'mock-008', 'PASS',
    'Cab Interior Inspection', 0.93,
    ['Seat in good condition', 'Horn functional', 'Windows clean', 'Gauges normal', 'Cab interior clean'],
    [],
    {
      observations: 'Complete cab interior inspection shows all items in good working order.',
      component_identification: 'Inside the cab components of Caterpillar 982 Medium Wheel Loader.',
      condition_assessment: 'All cab interior items pass inspection.',
      conclusion: 'PASS — Full cab interior inspection complete, all items satisfactory.',
    },
    {
      text: 'Seat looks good, horn works, windows are clean, all gauges reading normal, cab is tidy.',
      components: [{ name: 'seat', timestamp: 0.2 }, { name: 'horn', timestamp: 0.8 }, { name: 'windows', timestamp: 1.4 }, { name: 'gauges', timestamp: 2.0 }],
    },
    [
      { checklist_mapped_item: '4.1 Seat', checklist_grade: 'Green', verdict_reasoning: 'Seat is in good condition with proper adjustment and no tears.', recommendation: 'No action required.' },
      { checklist_mapped_item: '4.3 Horn', checklist_grade: 'Green', verdict_reasoning: 'Horn is functional and audible at proper volume.', recommendation: 'No action required.' },
      { checklist_mapped_item: '4.5 Windows and Mirrors', checklist_grade: 'Green', verdict_reasoning: 'Windows are clean and mirrors properly positioned with no cracks.', recommendation: 'No action required.' },
      { checklist_mapped_item: '4.7 Indicators & Gauges', checklist_grade: 'Green', verdict_reasoning: 'All indicators and gauges reading within normal operating range.', recommendation: 'No action required.' },
      { checklist_mapped_item: '4.9 Overall Cab Interior', checklist_grade: 'Green', verdict_reasoning: 'Cab interior is clean, organized, and free of loose objects.', recommendation: 'No action required.' },
    ],
    {
      audio_says: 'Operator confirms all cab items in good condition.',
      visual_shows: 'AI vision confirms satisfactory condition of all cab interior items.',
      comparison: 'AGREE — Full agreement on all cab items passing.',
      checklist_mapping_reasoning: 'Maps to cab interior items: 4.1, 4.3, 4.5, 4.7, 4.9.',
    },
  ),

  mock(
    'Hydraulic Oil Indicator — FAIL (Red)', 'mock-009', 'FAIL',
    'Hydraulic Oil Level Indicator', 0.96,
    ['Hydraulic oil level below the red indicator line', 'Sight glass shows critically low fluid', 'Dark discoloration in remaining oil'],
    ['Risk of hydraulic pump cavitation', 'Potential system damage if operated'],
    {
      observations: 'The hydraulic oil sight glass shows fluid level well below the red minimum indicator line.',
      component_identification: 'Hydraulic oil level sight glass and indicator on a Caterpillar 982 Medium Wheel Loader.',
      condition_assessment: 'Critical finding. Hydraulic oil is below the red service line, indicating severe fluid loss or consumption.',
      conclusion: 'FAIL — Hydraulic oil level is critically below the red indicator line. Machine must not be operated.',
    },
    {
      text: "Hydraulic oil is way below the red line on the sight glass.",
      components: [{ name: 'hydraulic oil indicator', timestamp: 0.8 }],
    },
    [{
      checklist_mapped_item: '1.13 Hydraulic fluid tank, inspect',
      checklist_grade: 'Red',
      verdict_reasoning: 'Both visual analysis and operator confirm hydraulic oil is critically below the red indicator line. Immediate action required before operation.',
      recommendation: 'Do not operate machine. Inspect hydraulic system for leaks. Check all hose connections, cylinder seals, and pump fittings. Top off with CAT HYDO Advanced 10W fluid and investigate root cause of fluid loss.',
    }],
    {
      audio_says: 'Operator reports hydraulic oil is well below the red line on the sight glass.',
      visual_shows: 'AI vision confirms hydraulic fluid level is critically below the red minimum indicator line.',
      comparison: 'AGREE — Both operator and AI confirm critically low hydraulic oil below the red service line.',
      checklist_mapping_reasoning: 'Maps directly to checklist item 1.13 Hydraulic fluid tank, inspect.',
    },
  ),

  mock(
    'Steps & Handrails — PASS (Green)', 'mock-010', 'PASS',
    'Steps and Handrails', 0.95,
    ['Steps are clean and free of debris', 'Handrails securely bolted', 'Anti-slip tread intact', 'No visible corrosion or damage'],
    [],
    {
      observations: 'Steps and handrails are in excellent condition. Anti-slip tread is intact across all steps. Handrail mounting bolts are tight with no play.',
      component_identification: 'Access steps and handrails on a Caterpillar 982 Medium Wheel Loader.',
      condition_assessment: 'All steps and handrails pass inspection. No safety concerns.',
      conclusion: 'PASS — Steps and handrails are secure, clean, and in good condition.',
    },
    {
      text: 'Steps and handrails look good. Everything is solid, no loose bolts, treads are fine.',
      components: [{ name: 'steps and handrails', timestamp: 0.5 }],
    },
    [{
      checklist_mapped_item: '1.9 Steps and Handrails',
      checklist_grade: 'Green',
      verdict_reasoning: 'Visual analysis and operator both confirm steps and handrails are in good condition. Anti-slip tread is intact, mounting hardware is secure, and no corrosion or damage detected.',
      recommendation: 'No action required. Continue routine inspection schedule.',
    }],
    {
      audio_says: 'Operator confirms steps.',
      visual_shows: 'AI vision confirms clean steps with intact anti-slip tread and securely mounted handrails.',
      comparison: 'AGREE — Both operator and AI confirm steps and handrails are in good condition.',
      checklist_mapping_reasoning: 'Maps directly to checklist item 1.9 Steps and Handrails.',
    },
  ),
];
