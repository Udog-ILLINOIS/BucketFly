/**
 * Mock inspection results for dev testing.
 * Each entry simulates a full AI pipeline response.
 *
 * MOCK_RESULTS        → CAT 982 Wheel Loader (existing)
 * MOCK_RESULTS_F1TENTH → F1Tenth RoboRacer (new)
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

function mockF1(label, id, status, component, confidence, observations, concerns, cotVisual, audio, items, cotCrossRef) {
  return {
    label,
    inspection_id: id,
    final_status: status,
    machineType: 'f1tenth',
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

export const MOCK_RESULTS_F1TENTH = [
  mockF1(
    'Chassis Frame — PASS (Green)', 'f1-mock-001', 'PASS',
    'Chassis Frame & Body', 0.91,
    ['Frame rails straight with no visible cracks', 'All body clips present and seated', 'Mounting points intact'],
    [],
    {
      observations: 'The Traxxas Slash 4x4 chassis frame rails are straight and free of cracks. Body clips are present on all posts. No bent or broken mounting points.',
      component_identification: 'Chassis frame and body on an F1Tenth RoboRacer autonomous car.',
      condition_assessment: 'Chassis is in good structural condition.',
      conclusion: 'PASS — Chassis frame and body are intact and acceptable for operation.',
    },
    {
      text: 'Frame looks straight, no cracks, all the body clips are there.',
      components: [{ name: 'chassis', timestamp: 0.5 }],
    },
    [{
      checklist_mapped_item: '1.1 Chassis Frame & Body',
      checklist_grade: 'Green',
      verdict_reasoning: 'Frame rails straight, no cracks, body clips present. No issues detected.',
      recommendation: 'No action required.',
    }],
    {
      audio_says: 'Operator confirms frame is straight and body clips are present.',
      visual_shows: 'AI confirms straight frame rails, no cracks, intact mounting points.',
      comparison: 'AGREE — Chassis passes inspection.',
      checklist_mapping_reasoning: 'Maps to checklist item 1.1 Chassis Frame & Body.',
    },
  ),

  mockF1(
    'Wheels — FAIL (Red)', 'f1-mock-002', 'FAIL',
    'Wheels & Tires', 0.95,
    ['Rear-left wheel nut missing — wheel has axial play', 'Tire bead partially unseated on rear-right'],
    ['Wheel detachment risk at speed', 'Loss of vehicle control'],
    {
      observations: 'The rear-left wheel has no locking nut — the wheel wobbles axially when pushed. The rear-right tire bead is partially unseated from the rim on one side.',
      component_identification: 'Wheels and tires on an F1Tenth RoboRacer.',
      condition_assessment: 'Critical finding. Missing wheel nut and unseated tire bead both pose immediate loss-of-control hazards.',
      conclusion: 'FAIL — Wheel nut missing and tire bead unseated. Vehicle must NOT operate.',
    },
    {
      text: 'Rear left wheel is wobbly, I think the nut is gone. And the rear right tire looks like it came off the rim a bit.',
      components: [{ name: 'wheel', timestamp: 0.4 }, { name: 'tire', timestamp: 1.6 }],
    },
    [{
      checklist_mapped_item: '1.2 Wheels & Tires',
      checklist_grade: 'Red',
      verdict_reasoning: 'Missing wheel nut on rear-left and unseated tire bead on rear-right. Both are critical failures — vehicle cannot safely operate.',
      recommendation: 'Install correct wheel nut on rear-left. Re-seat rear-right tire bead and verify all four wheel nuts are torqued. Re-inspect before operation.',
    }],
    {
      audio_says: 'Operator reports missing wheel nut and partially unseated tire bead.',
      visual_shows: 'AI confirms axial wheel play and partially unseated tire bead.',
      comparison: 'AGREE — Critical wheel/tire failure confirmed.',
      checklist_mapping_reasoning: 'Maps to checklist item 1.2 Wheels & Tires.',
    },
  ),

  mockF1(
    'Jetson Xavier NX — PASS (Green)', 'f1-mock-003', 'PASS',
    'Jetson Xavier NX (Compute)', 0.92,
    ['Jetson booted — login prompt visible on serial console', 'Fan spinning at low speed', 'Board temperature 38°C — within normal range', 'Mounting screws tight'],
    [],
    {
      observations: 'The Jetson Xavier NX is fully booted with the login prompt visible. The cooling fan is spinning. Board temperature reads 38°C which is well within the acceptable range. All four mounting screws are tight.',
      component_identification: 'NVIDIA Jetson Xavier NX compute module on an F1Tenth RoboRacer.',
      condition_assessment: 'Jetson is operational, thermally healthy, and securely mounted.',
      conclusion: 'PASS — Jetson Xavier NX is functional and ready for operation.',
    },
    {
      text: 'Jetson is booted up, fan is running, temperature looks fine at 38 degrees.',
      components: [{ name: 'jetson', timestamp: 0.7 }],
    },
    [{
      checklist_mapped_item: '2.1 Jetson Xavier NX (Compute)',
      checklist_grade: 'Green',
      verdict_reasoning: 'Jetson booted, fan running, temperature 38°C, mounting secure. All checks pass.',
      recommendation: 'No action required.',
    }],
    {
      audio_says: 'Operator confirms Jetson is booted and temperature is normal.',
      visual_shows: 'AI confirms boot state, fan operation, and acceptable thermal reading.',
      comparison: 'AGREE — Jetson passes inspection.',
      checklist_mapping_reasoning: 'Maps to checklist item 2.1 Jetson Xavier NX (Compute).',
    },
  ),

  mockF1(
    'LiDAR Unit — MONITOR (Yellow)', 'f1-mock-004', 'MONITOR',
    'LiDAR Unit', 0.83,
    ['LiDAR spinning normally', 'USB cable connector slightly loose at the sensor end — can be wiggled by hand', 'Scan data present but drops occasionally'],
    ['Loose cable could cause scan dropouts mid-run'],
    {
      observations: 'The LiDAR is spinning at normal speed and scan data is streaming. However, the USB cable connector at the sensor end can be wiggled by hand — it is not fully seated. Scan data shows occasional brief dropouts correlated with vibration.',
      component_identification: 'LiDAR sensor (Hokuyo / RPLiDAR) on an F1Tenth RoboRacer.',
      condition_assessment: 'LiDAR functional but USB connection is insecure. Dropouts could cause the autonomous algorithm to lose scan data mid-run.',
      conclusion: 'MONITOR — LiDAR spinning and scanning but USB connector is loose.',
    },
    {
      text: 'LiDAR is spinning and data is coming through but the cable connector feels loose. Seeing a couple of scan dropouts.',
      components: [{ name: 'lidar', timestamp: 0.9 }, { name: 'usb cable', timestamp: 2.1 }],
    },
    [{
      checklist_mapped_item: '2.2 LiDAR Unit',
      checklist_grade: 'Yellow',
      verdict_reasoning: 'Loose USB connector causing intermittent scan dropouts. Functional but unreliable under vibration.',
      recommendation: 'Re-seat USB connector and secure with a small zip tie or cable lock. Re-test scan continuity before full-speed run.',
    }],
    {
      audio_says: 'Operator reports spinning LiDAR with loose cable and occasional dropouts.',
      visual_shows: 'AI confirms LiDAR operation but loose USB connector at sensor end.',
      comparison: 'AGREE — LiDAR operational but needs cable secured.',
      checklist_mapping_reasoning: 'Maps to checklist item 2.2 LiDAR Unit.',
    },
  ),

  mockF1(
    'Power Distribution Board — FAIL (Red)', 'f1-mock-005', 'FAIL',
    'Power Distribution Board', 0.96,
    ['Scorch mark visible on power board near 5V rail regulator', 'One output connector melted/deformed', '5V rail reading 4.1V — below minimum for Jetson'],
    ['Risk of further electrical failure', 'Jetson undervoltage could cause crash mid-run'],
    {
      observations: 'A visible scorch mark is present on the power distribution board near the 5V regulator. One of the JST output connectors is visibly melted and deformed. The 5V rail is measuring 4.1V — below the 4.75V minimum required by the Jetson.',
      component_identification: 'Power distribution board on an F1Tenth RoboRacer.',
      condition_assessment: 'Critical failure. Scorching indicates a previous overcurrent or heat event. The melted connector and low rail voltage mean the board cannot reliably power the compute stack.',
      conclusion: 'FAIL — Power board scorched with degraded 5V output. Vehicle must NOT operate.',
    },
    {
      text: 'There is a burn mark on the power board and one connector looks melted. The 5 volt rail is only showing 4.1.',
      components: [{ name: 'power board', timestamp: 0.6 }, { name: '5V rail', timestamp: 1.9 }],
    },
    [{
      checklist_mapped_item: '2.3 Power Distribution Board',
      checklist_grade: 'Red',
      verdict_reasoning: 'Scorch mark, melted connector, and 5V rail at 4.1V. Board has suffered thermal damage and cannot reliably power the vehicle. Critical failure.',
      recommendation: 'Do NOT operate. Replace power distribution board. Investigate root cause of overcurrent event before installing replacement. Verify all downstream components after replacement.',
    }],
    {
      audio_says: 'Operator confirms burn mark, melted connector, and low 5V rail voltage.',
      visual_shows: 'AI confirms scorch mark on board, deformed connector, and undervoltage on 5V rail.',
      comparison: 'AGREE — Critical power board failure confirmed.',
      checklist_mapping_reasoning: 'Maps to checklist item 2.3 Power Distribution Board.',
    },
  ),
];

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
    'Access Steps (Surface Rust) — PASS (Green)', 'mock-video-steps', 'PASS',
    'Steps and Handrails', 0.90,
    ['Minor surface rust on lower edge of bottom step', 'Anti-slip tread surface intact across all steps', 'Step mounting welds appear sound', 'No structural deformation or sharp edges'],
    [],
    {
      observations: 'The access steps on the side of the CAT machine show two-step ladder with textured anti-slip treads. The bottom step has minor surface rust on its lower edge/rim — cosmetic oxidation on bare metal from outdoor exposure. The tread surface itself is intact. Inspector in hi-vis vest is pointing to the steps.',
      component_identification: 'Access steps / entry ladder on a Caterpillar 982 Medium Wheel Loader — checklist item 1.9 Steps and Handrails.',
      condition_assessment: 'Surface rust on the lower edge of the bottom step is cosmetic and does not affect structural integrity or the anti-slip function. Steps are securely mounted. No sharp edges or deformation.',
      conclusion: 'PASS — Steps are in acceptable working condition. Surface rust is normal outdoor wear on bare metal, not a structural concern.',
    },
    {
      text: 'Steps look good. There is some rust on the bottom edge of the lower step but the treads are solid and the mounting is secure.',
      components: [{ name: 'steps and handrails', timestamp: 1.5 }],
    },
    [{
      checklist_mapped_item: '1.9 Steps and Handrails',
      checklist_grade: 'Green',
      verdict_reasoning: 'Surface rust on the lower edge of the bottom step is cosmetic — bare metal oxidation from outdoor exposure. Anti-slip tread is intact, mounting hardware is secure, no structural compromise. Inspector confirmed acceptable.',
      recommendation: 'No action required. Monitor at next inspection for any progression to structural rust.',
    }],
    {
      audio_says: 'Operator notes surface rust on bottom step edge but confirms treads and mounting are solid.',
      visual_shows: 'AI vision detects minor surface rust on bottom step lower rim. Anti-slip tread fully intact. Mounting secure.',
      comparison: 'AGREE — Both operator and AI confirm cosmetic rust only. Component is structurally sound and GREEN.',
      checklist_mapping_reasoning: 'Maps to checklist item 1.9 Steps and Handrails.',
    },
  ),

  mock(
    'Hydraulic Fluid Sight Gauge — FAIL (Red)', 'mock-video-hydraulic', 'FAIL',
    'Hydraulic fluid tank sight gauge', 0.96,
    ['Hydraulic fluid level below the red minimum indicator line', 'Sight glass shows critically low fluid', 'Fluid loss or severe consumption indicated'],
    ['Risk of hydraulic pump cavitation', 'Potential system damage if operated'],
    {
      observations: 'Close-up of a CAT hydraulic fluid sight gauge mounted on the machine body. The sight gauge indicator rod is positioned below the red minimum line — fluid level is critically low. A hydraulic fluid symbol sticker is mounted to the left of the gauge. Inspector in gloves is pointing at the gauge level.',
      component_identification: 'Hydraulic oil level sight gauge on a Caterpillar 982 Medium Wheel Loader — checklist item 1.13 Hydraulic fluid tank, inspect.',
      condition_assessment: 'Critical finding. Hydraulic fluid is below the red minimum line, indicating severe fluid loss or consumption. Machine must not be operated.',
      conclusion: 'FAIL — Hydraulic fluid level is critically below the red indicator line. Immediate action required before operation.',
    },
    {
      text: 'Hydraulic oil is way below the red line on the sight glass. Level is critically low.',
      components: [{ name: 'hydraulic fluid tank', timestamp: 4.5 }],
    },
    [{
      checklist_mapped_item: '1.13 Hydraulic fluid tank, inspect',
      checklist_grade: 'Red',
      verdict_reasoning: 'Sight gauge indicator is below the red minimum line. Hydraulic fluid level is critically low — severe fluid loss or consumption detected. Machine must not be operated.',
      recommendation: 'Do not operate machine. Inspect hydraulic system for leaks. Check all hose connections, cylinder seals, and pump fittings. Top off with CAT HYDO Advanced 10W fluid and investigate root cause of fluid loss.',
    }],
    {
      audio_says: 'Operator reports hydraulic oil is well below the red line on the sight glass.',
      visual_shows: 'AI vision confirms sight gauge indicator is below the red minimum line — hydraulic fluid level critically low.',
      comparison: 'AGREE — Both operator and AI confirm hydraulic fluid is critically below the red minimum indicator line.',
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
