import { useState, useRef } from 'react'
import { CaptureZone } from './components/CaptureZone'
import { ReportView } from './components/ReportView'
import { HistoryView } from './components/HistoryView'
import { AlertDropdown } from './components/AlertDropdown'
import { uploadInspection, sendClarification } from './services/api'
import './App.css'

const MOCK_RESULTS = [
  {
    label: 'Tilt Cylinder — MONITOR (Yellow)',
    inspection_id: 'mock-001',
    final_status: 'MONITOR',
    visual_analysis: {
      component: 'Bucket Tilt Cylinder',
      preliminary_status: 'MONITOR',
      confidence: 0.82,
      condition_observations: ['Minor oil seepage around rod seal', 'Surface scoring on chrome rod'],
      concerns: ['Seal degradation likely within next 200 hours'],
      chain_of_thought: {
        observations: 'The hydraulic cylinder rod shows minor scoring on the chrome surface with a small amount of oil seepage visible around the rod seal area.',
        component_identification: 'Bucket Tilt Cylinder — hydraulic actuator rod and seal assembly on a Caterpillar 982 Medium Wheel Loader.',
        condition_assessment: 'Early-stage seal wear within acceptable monitoring range.',
        conclusion: 'MONITOR — Minor hydraulic seal seepage detected. Component is functional but trending toward service requirement.'
      }
    },
    audio_transcription: {
      full_text: 'Looking at the tilt cylinder, I can see some oil around the seal, looks like it might be starting to seep a little bit.',
      segments: [],
      components_mentioned: [{ name: 'tilt cylinder', timestamp: 1.2 }]
    },
    cross_reference: {
      final_status: 'MONITOR',
      confidence: 0.85,
      items_evaluated: [
        {
          checklist_mapped_item: '1.3 Bucket Tilt Cylinders and Hoses',
          checklist_grade: 'Yellow',
          verdict_reasoning: 'Both visual AI and operator audio confirm minor oil seepage at the tilt cylinder rod seal. Not safety-critical but requires monitoring.',
          recommendation: 'Flag for next scheduled PM. Monitor seepage rate. Escalate if seepage increases before next PM.'
        }
      ],
      chain_of_thought: {
        audio_says: 'Operator confirmed seeing oil around the seal area of the tilt cylinder.',
        visual_shows: 'AI vision detects minor surface scoring on the cylinder rod and small oil seepage around the rod seal.',
        comparison: 'AGREE — Both operator and AI visual analysis are consistent.',
        checklist_mapping_reasoning: 'Maps directly to checklist item 1.3 Bucket Tilt Cylinders and Hoses.'
      }
    }
  },
  {
    label: 'Engine Coolant — FAIL (Red)',
    inspection_id: 'mock-002',
    final_status: 'FAIL',
    visual_analysis: {
      component: 'Engine Coolant Reservoir',
      preliminary_status: 'FAIL',
      confidence: 0.94,
      condition_observations: ['Coolant level critically low — below MIN mark', 'White residue deposits', 'Discoloration (brownish tinge)'],
      concerns: ['Risk of engine overheating', 'Possible coolant contamination with oil'],
      chain_of_thought: {
        observations: 'Coolant reservoir is visibly below the minimum fill line. White mineral deposits around the cap.',
        component_identification: 'Engine coolant reservoir / overflow tank on a Caterpillar 982 Medium Wheel Loader.',
        condition_assessment: 'Critical finding. Coolant level is dangerously low with signs of contamination.',
        conclusion: 'FAIL — Critical coolant level deficiency. Machine should not be operated.'
      }
    },
    audio_transcription: {
      full_text: "Coolant looks really low, I can barely see it. And there's some brown stuff in there.",
      segments: [],
      components_mentioned: [{ name: 'coolant reservoir', timestamp: 0.5 }]
    },
    cross_reference: {
      final_status: 'FAIL',
      confidence: 0.94,
      items_evaluated: [
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
        }
      ],
      chain_of_thought: {
        audio_says: 'Operator reported coolant is very low and discolored.',
        visual_shows: 'AI vision confirms coolant below MIN line, white deposits at cap, and brownish discoloration.',
        comparison: 'AGREE — Both sources are fully consistent. Critical failure confirmed.',
        checklist_mapping_reasoning: 'Maps directly to checklist item 2.2 Engine Coolant Level and evaluated hoses.'
      }
    }
  },
  {
    label: 'Tires & Rims — PASS (Green)',
    inspection_id: 'mock-003',
    final_status: 'PASS',
    visual_analysis: {
      component: 'Tires and Rims',
      preliminary_status: 'PASS',
      confidence: 0.91,
      condition_observations: ['Tread depth adequate', 'No visible sidewall damage', 'Rims free of cracks'],
      concerns: [],
      chain_of_thought: {
        observations: 'All four tires show adequate tread depth with no cuts, bulges, or sidewall damage. Rims are free of cracks or deformations.',
        component_identification: 'Tires and wheel rims on Caterpillar 982 Medium Wheel Loader.',
        condition_assessment: 'Tires and rims are in good operating condition.',
        conclusion: 'PASS — Tires and rims meet all safety and operational standards.'
      }
    },
    audio_transcription: {
      full_text: "Tires look good, plenty of tread left. No cuts or bulges. Rims are clean.",
      segments: [],
      components_mentioned: [{ name: 'tires', timestamp: 0.3 }, { name: 'rims', timestamp: 2.1 }]
    },
    cross_reference: {
      final_status: 'PASS',
      confidence: 0.91,
      items_evaluated: [
        {
          checklist_mapped_item: '1.1 Tires and Rims',
          checklist_grade: 'Green',
          verdict_reasoning: 'Visual inspection and operator both confirm tires have adequate tread and no visible damage. Rims are intact.',
          recommendation: 'No action required. Continue normal operation.',
        }
      ],
      chain_of_thought: {
        audio_says: 'Operator confirms good tread and no damage on tires or rims.',
        visual_shows: 'AI confirms adequate tread depth, no sidewall damage, and clean rims.',
        comparison: 'AGREE — Visual and audio are consistent. All clear.',
        checklist_mapping_reasoning: 'Maps to checklist item 1.1 Tires and Rims.'
      }
    }
  },
  {
    label: 'Seat Belt — FAIL (Red)',
    inspection_id: 'mock-004',
    final_status: 'FAIL',
    visual_analysis: {
      component: 'Seat Belt Assembly',
      preliminary_status: 'FAIL',
      confidence: 0.97,
      condition_observations: ['Seat belt webbing frayed near buckle', 'Buckle mechanism sticking', 'Retractor not retracting fully'],
      concerns: ['Operator restraint system compromised', 'Critical safety violation'],
      chain_of_thought: {
        observations: 'Seat belt webbing is visibly frayed at the buckle attachment point. The buckle mechanism is stiff and requires excessive force. The retractor fails to fully retract.',
        component_identification: 'Operator seat belt and mounting hardware in the cab of a Caterpillar 982 Medium Wheel Loader.',
        condition_assessment: 'Critical safety finding. Seat belt does not meet minimum operational safety standards.',
        conclusion: 'FAIL — Seat belt restraint system is compromised. Machine must not be operated until replaced.'
      }
    },
    audio_transcription: {
      full_text: "Seat belt is pretty worn. It's frayed right here by the buckle and the buckle itself is hard to click in. Retractor is sluggish too.",
      segments: [],
      components_mentioned: [{ name: 'seat belt', timestamp: 0.2 }, { name: 'buckle', timestamp: 1.8 }]
    },
    cross_reference: {
      final_status: 'FAIL',
      confidence: 0.97,
      items_evaluated: [
        {
          checklist_mapped_item: '4.2 Seat belt and mounting',
          checklist_grade: 'Red',
          verdict_reasoning: 'Both visual and operator confirm frayed webbing, sticking buckle, and sluggish retractor. Critical safety violation — machine cannot operate.',
          recommendation: 'Replace seat belt assembly immediately. Do not operate machine. Tag out until replaced and verified.',
        }
      ],
      chain_of_thought: {
        audio_says: 'Operator reports fraying, sticking buckle, and sluggish retractor.',
        visual_shows: 'AI vision confirms frayed webbing near buckle, mechanism degradation, and incomplete retraction.',
        comparison: 'AGREE — Both sources confirm critical seat belt failure.',
        checklist_mapping_reasoning: 'Maps to checklist item 4.2 Seat belt and mounting.'
      }
    }
  },
  {
    label: 'Engine Oil — MONITOR (Yellow)',
    inspection_id: 'mock-005',
    final_status: 'MONITOR',
    visual_analysis: {
      component: 'Engine Oil Dipstick',
      preliminary_status: 'MONITOR',
      confidence: 0.78,
      condition_observations: ['Oil level near low mark', 'Oil color darker than expected', 'No metal particles visible'],
      concerns: ['Oil may need topping off before next PM', 'Possible extended drain interval'],
      chain_of_thought: {
        observations: 'Engine oil is near the low mark on the dipstick. Color is dark but not black. No metal particles or milky appearance.',
        component_identification: 'Engine oil level check via dipstick on a Caterpillar 982 Medium Wheel Loader.',
        condition_assessment: 'Oil level is low but still within operational range. Color suggests approaching change interval.',
        conclusion: 'MONITOR — Oil level trending low. Schedule top-off or oil change at next PM.'
      }
    },
    audio_transcription: {
      full_text: "Oil is getting a bit low, close to the bottom mark. Color's pretty dark too. Might want to top it off.",
      segments: [],
      components_mentioned: [{ name: 'engine oil', timestamp: 0.4 }]
    },
    cross_reference: {
      final_status: 'MONITOR',
      confidence: 0.80,
      items_evaluated: [
        {
          checklist_mapped_item: '2.1 Engine Oil Level',
          checklist_grade: 'Yellow',
          verdict_reasoning: 'Both visual and operator confirm oil is near the low mark with dark coloration. Not critical but should be addressed.',
          recommendation: 'Top off engine oil. Schedule oil change at next PM. Monitor consumption rate.',
        }
      ],
      chain_of_thought: {
        audio_says: 'Operator notes low oil level and dark color, suggests topping off.',
        visual_shows: 'AI confirms oil near low mark with darker-than-expected color.',
        comparison: 'AGREE — Both sources consistent on low oil level.',
        checklist_mapping_reasoning: 'Maps to checklist item 2.1 Engine Oil Level.'
      }
    }
  },
  {
    label: 'Fire Extinguisher — FAIL (Red)',
    inspection_id: 'mock-006',
    final_status: 'FAIL',
    visual_analysis: {
      component: 'Fire Extinguisher',
      preliminary_status: 'FAIL',
      confidence: 0.96,
      condition_observations: ['Pressure gauge in red zone', 'Inspection tag expired 6 months ago', 'Pin seal broken'],
      concerns: ['Fire suppression not available', 'Regulatory non-compliance'],
      chain_of_thought: {
        observations: 'Fire extinguisher pressure gauge reads in the red (discharged) zone. The inspection tag shows last service over 6 months ago. The safety pin seal is broken.',
        component_identification: 'Cab-mounted fire extinguisher on a Caterpillar 982 Medium Wheel Loader.',
        condition_assessment: 'Fire extinguisher is non-functional. Critical safety and compliance violation.',
        conclusion: 'FAIL — Fire extinguisher is discharged and expired. Must be serviced or replaced before machine operation.'
      }
    },
    audio_transcription: {
      full_text: "Fire extinguisher gauge is in the red. Tag is expired too, looks like it hasn't been serviced in a while. Pin seal is broken.",
      segments: [],
      components_mentioned: [{ name: 'fire extinguisher', timestamp: 0.3 }]
    },
    cross_reference: {
      final_status: 'FAIL',
      confidence: 0.96,
      items_evaluated: [
        {
          checklist_mapped_item: '3.3 Fire Extinguisher',
          checklist_grade: 'Red',
          verdict_reasoning: 'Discharged gauge, expired inspection tag, and broken pin seal. Fire extinguisher is non-functional. Regulatory and safety violation.',
          recommendation: 'Replace or recharge fire extinguisher immediately. Update inspection tag. Do not operate until compliant.',
        }
      ],
      chain_of_thought: {
        audio_says: 'Operator confirms gauge in red, expired tag, and broken pin seal.',
        visual_shows: 'AI confirms discharged pressure indicator, expired service tag, and broken safety seal.',
        comparison: 'AGREE — Both sources confirm fire extinguisher is non-functional.',
        checklist_mapping_reasoning: 'Maps to checklist item 3.3 Fire Extinguisher.'
      }
    }
  },
  {
    label: 'Multi-Item — Mixed (3 items)',
    inspection_id: 'mock-007',
    final_status: 'FAIL',
    visual_analysis: {
      component: 'General Walk-Around',
      preliminary_status: 'FAIL',
      confidence: 0.88,
      condition_observations: ['Fuel tank cap loose', 'Work lights cracked', 'Steps and handrails secure'],
      concerns: ['Fuel contamination risk', 'Visibility hazard at night'],
      chain_of_thought: {
        observations: 'Walk-around reveals loose fuel cap, cracked work light lens, and steps/handrails in good condition.',
        component_identification: 'Multiple components during ground-level walk-around of Caterpillar 982 Medium Wheel Loader.',
        condition_assessment: 'Mixed findings across multiple items.',
        conclusion: 'FAIL — Fuel cap and work lights require attention. Steps and handrails pass.'
      }
    },
    audio_transcription: {
      full_text: "Fuel cap is loose, need to tighten that down. The work light on the left side has a cracked lens. Steps and handrails look fine though.",
      segments: [],
      components_mentioned: [{ name: 'fuel tank', timestamp: 0.3 }, { name: 'work lights', timestamp: 1.5 }, { name: 'steps', timestamp: 3.0 }]
    },
    cross_reference: {
      final_status: 'FAIL',
      confidence: 0.88,
      items_evaluated: [
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
        }
      ],
      chain_of_thought: {
        audio_says: 'Operator reports loose fuel cap, cracked work light, and good handrails.',
        visual_shows: 'AI confirms loose cap, cracked lens, and secure handrails.',
        comparison: 'AGREE — All three findings consistent between audio and visual.',
        checklist_mapping_reasoning: 'Maps to 1.11 Fuel Tank, 1.15 Work Lights, and 1.9 Steps and Handrails.'
      }
    }
  },
  {
    label: 'All Clear — PASS (5 items Green)',
    inspection_id: 'mock-008',
    final_status: 'PASS',
    visual_analysis: {
      component: 'Cab Interior Inspection',
      preliminary_status: 'PASS',
      confidence: 0.93,
      condition_observations: ['Seat in good condition', 'Horn functional', 'Windows clean', 'Gauges normal', 'Cab interior clean'],
      concerns: [],
      chain_of_thought: {
        observations: 'Complete cab interior inspection shows all items in good working order.',
        component_identification: 'Inside the cab components of Caterpillar 982 Medium Wheel Loader.',
        condition_assessment: 'All cab interior items pass inspection.',
        conclusion: 'PASS — Full cab interior inspection complete, all items satisfactory.'
      }
    },
    audio_transcription: {
      full_text: "Seat looks good, horn works, windows are clean, all gauges reading normal, cab is tidy.",
      segments: [],
      components_mentioned: [{ name: 'seat', timestamp: 0.2 }, { name: 'horn', timestamp: 0.8 }, { name: 'windows', timestamp: 1.4 }, { name: 'gauges', timestamp: 2.0 }]
    },
    cross_reference: {
      final_status: 'PASS',
      confidence: 0.93,
      items_evaluated: [
        {
          checklist_mapped_item: '4.1 Seat',
          checklist_grade: 'Green',
          verdict_reasoning: 'Seat is in good condition with proper adjustment and no tears.',
          recommendation: 'No action required.',
        },
        {
          checklist_mapped_item: '4.3 Horn',
          checklist_grade: 'Green',
          verdict_reasoning: 'Horn is functional and audible at proper volume.',
          recommendation: 'No action required.',
        },
        {
          checklist_mapped_item: '4.5 Windows and Mirrors',
          checklist_grade: 'Green',
          verdict_reasoning: 'Windows are clean and mirrors properly positioned with no cracks.',
          recommendation: 'No action required.',
        },
        {
          checklist_mapped_item: '4.7 Indicators & Gauges',
          checklist_grade: 'Green',
          verdict_reasoning: 'All indicators and gauges reading within normal operating range.',
          recommendation: 'No action required.',
        },
        {
          checklist_mapped_item: '4.9 Overall Cab Interior',
          checklist_grade: 'Green',
          verdict_reasoning: 'Cab interior is clean, organized, and free of loose objects.',
          recommendation: 'No action required.',
        }
      ],
      chain_of_thought: {
        audio_says: 'Operator confirms all cab items in good condition.',
        visual_shows: 'AI vision confirms satisfactory condition of all cab interior items.',
        comparison: 'AGREE — Full agreement on all cab items passing.',
        checklist_mapping_reasoning: 'Maps to cab interior items: 4.1, 4.3, 4.5, 4.7, 4.9.'
      }
    }
  }
];

function App() {
  const [activeTab, setActiveTab] = useState('record');
  const [lastResult, setLastResult] = useState(null);
  const [checklistState, setChecklistState] = useState({});
  const [checklistReasoningState, setChecklistReasoningState] = useState({});
  const [notification, setNotification] = useState(null);
  const [injectedRecords, setInjectedRecords] = useState([]);

  // Phase 3: Clarification State
  const [isClarifying, setIsClarifying] = useState(false);
  const pendingInspectionId = useRef(null);

  const handleInspectionComplete = async (frames, audioBlob) => {
    console.log(`Uploading ${frames.length} frames...`);
    try {
      const result = await uploadInspection(frames, audioBlob);
      console.log('Upload result:', result);

      if (result.inspection_id) {
        pendingInspectionId.current = result.inspection_id;
      }

      handleUpdateResult(result);

      // Auto-switch logic
      if (result.final_status === 'PASS') {
        setTimeout(() => setActiveTab('report'), 2000);
      } else if (result.cross_reference?.error) {
        // Switch to report even on error so user can see the highlighted failed item/context
        setTimeout(() => setActiveTab('report'), 3000);
      }

      return result;
    } catch (err) {
      console.error('Inspection failed:', err);
      setNotification({
        status: 'FAIL',
        component: 'System Error',
        message: `Upload failed: ${err.message}`
      });
      throw err;
    }
  };

  const handleInjectMock = (index) => {
    const mock = MOCK_RESULTS[index];
    if (!mock) return;
    handleUpdateResult(mock);
    setActiveTab('report');
  };

  const handleClarificationComplete = async (frames, audioBlob) => {
    const inspectionId = pendingInspectionId.current;
    if (!inspectionId) return;

    try {
      const result = await sendClarification(inspectionId, audioBlob);
      setIsClarifying(false);
      handleUpdateResult(result);
      setTimeout(() => setActiveTab('report'), 1500);
      return result;
    } catch (err) {
      console.error('Clarification failed:', err);
      setIsClarifying(false);
      setNotification({
        status: 'FAIL',
        component: 'Clarification Error',
        message: err.message
      });
      throw err;
    }
  };

  const handleUpdateResult = (result) => {
    setLastResult(result);

    const crossRef = result?.cross_reference;
    const itemsEvaluated = crossRef?.items_evaluated || [];
    const finalStatus = result?.final_status || 'UNCLEAR';
    const hasError = crossRef?.error;

    // Add to injected records so HistoryView can display them immediately
    if (itemsEvaluated.length > 0) {
      const confidence = crossRef?.confidence || result.visual_analysis?.confidence || 0;
      const newRecords = itemsEvaluated.map(item => ({
        inspection_id: result.inspection_id || `local_${Date.now()}`,
        component: item.checklist_mapped_item || result.visual_analysis?.component || 'Unknown',
        grade: item.checklist_grade || 'None',
        confidence: item.confidence || confidence,
        operator_notes: item.verdict_reasoning || '',
        audio_transcript: result.audio_transcription?.full_text || '',
        frame_count: result.frame_count || 0,
        ai_analysis: {
          final_status: finalStatus,
          checklist_mapped_item: item.checklist_mapped_item,
          checklist_grade: item.checklist_grade,
          confidence: item.confidence || confidence,
          verdict_reasoning: item.verdict_reasoning || '',
          recommendation: item.recommendation || '',
        },
        content: '',
      }));
      setInjectedRecords(prev => [...prev, ...newRecords]);
    }

    // 1. Update the checklist state for multiple items
    if (itemsEvaluated.length > 0) {
      setChecklistState(prev => {
        const nextState = { ...prev };
        itemsEvaluated.forEach(item => {
          if (item.checklist_mapped_item && item.checklist_grade && item.checklist_grade !== "None") {
            nextState[item.checklist_mapped_item] = item.checklist_grade;
          }
        });
        return nextState;
      });

      setChecklistReasoningState(prev => {
        const nextReasoning = { ...prev };
        itemsEvaluated.forEach(item => {
          if (item.checklist_mapped_item && item.checklist_grade && item.checklist_grade !== "None") {
            // Keep full crossRef context, but attach specific item details
            nextReasoning[item.checklist_mapped_item] = {
              ...item,
              chain_of_thought: crossRef.chain_of_thought // share top-level chain_of_thought
            };
          }
        });
        return nextReasoning;
      });
    }

    // 2. Trigger Global Alert using the worst item
    if (finalStatus === 'FAIL' || finalStatus === 'CLARIFY' || finalStatus === 'MONITOR' || finalStatus === 'UNCLEAR' || hasError) {
      // Find the most critical component mentioning the issue
      let criticalComponent = result.visual_analysis?.component || 'Equipment Item';
      let criticalMessage = 'Issue detected.';

      if (itemsEvaluated.length > 0) {
        const worstItem = itemsEvaluated.find(i => i.checklist_grade === 'Red')
          || itemsEvaluated.find(i => i.checklist_grade === 'Yellow')
          || itemsEvaluated[0];

        criticalComponent = worstItem.checklist_mapped_item;
        criticalMessage = worstItem.verdict_reasoning;
      }

      setNotification({
        status: (finalStatus === 'UNCLEAR' || hasError) ? 'FAIL' : finalStatus,
        component: criticalComponent,
        message: finalStatus === 'CLARIFY'
          ? crossRef.clarification_question
          : hasError
            ? `AI Error: ${crossRef.error}`
            : criticalMessage
      });
    }
  };

  const handleAlertAction = (notif) => {
    if (notif.status === 'CLARIFY') {
      setIsClarifying(true);
      setActiveTab('record');
    } else {
      setActiveTab('report');
    }
    setNotification(null);
  };

  return (
    <div className="app">
      {/* Global Alert */}
      <AlertDropdown
        notification={notification}
        onAction={handleAlertAction}
        onDismiss={() => setNotification(null)}
      />

      {/* Tab content */}
      <div className="tab-content">
        {activeTab === 'record' && (
          <CaptureZone
            onInspectionComplete={isClarifying ? handleClarificationComplete : handleInspectionComplete}
            checklistState={checklistState}
            onRecordingStart={() => {
              // Don't clear checklist state — accumulate across recordings
              // so the daily inspection sheet retains all recorded data
            }}
            onItemIdentified={(item) => {
              setChecklistState(prev => ({
                ...prev,
                [item]: prev[item] || 'Green'
              }));
            }}
          />
        )}
        {activeTab === 'report' && (
          <ReportView
            result={lastResult}
            checklistState={checklistState}
            checklistReasoningState={checklistReasoningState}
            onInjectMock={handleInjectMock}
            mockList={MOCK_RESULTS}
          />
        )}
        {activeTab === 'history' && (
          <HistoryView injectedRecords={injectedRecords} />
        )}
      </div>

      {/* Bottom tab bar */}
      <nav className="tab-bar">
        <button
          className={`tab-item ${activeTab === 'record' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('record');
            setIsClarifying(false);
          }}
        >
          <span className="tab-icon">{isClarifying ? '❓' : '📹'}</span>
          <span className="tab-label">{isClarifying ? 'Clarify' : 'Record'}</span>
        </button>
        <button
          className={`tab-item ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          <span className="tab-icon">📋</span>
          <span className="tab-label">Report</span>
          {Object.keys(checklistState).length > 0 && (
            <span className="tab-badge">{Object.keys(checklistState).length}/38</span>
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
  )
}

export default App
