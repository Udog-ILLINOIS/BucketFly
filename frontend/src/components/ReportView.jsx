import { useState } from 'react';
import { GRADE_COLORS, GRADE_LABELS, countGrades, worstGrade, getMachineChecklist, getMachineChecklistTotal } from '../constants/checklist';
import './ReportView.css';

/** Build a summary comment from all inspected items. */
function buildGeneralComment(checklistState, checklistReasoningState) {
  const entries = Object.entries(checklistState);
  if (entries.length === 0) return 'Awaiting inspection. Record a video to begin analysis.';

  const reds = entries.filter(([, g]) => g === 'Red').map(([k]) => k);
  const yellows = entries.filter(([, g]) => g === 'Yellow').map(([k]) => k);
  const greens = entries.filter(([, g]) => g === 'Green').map(([k]) => k);

  const parts = [];
  parts.push(`${entries.length} item${entries.length !== 1 ? 's' : ''} inspected.`);
  if (reds.length) parts.push(`FAIL (${reds.length}): ${reds.join(', ')}.`);
  if (yellows.length) parts.push(`MONITOR (${yellows.length}): ${yellows.join(', ')}.`);
  if (greens.length) parts.push(`PASS (${greens.length}): ${greens.join(', ')}.`);
  return parts.join(' ');
}

const HISTORY_SHADOW = {
  Red:    '0 0 0 3px rgba(239, 68, 68, 0.55)',
  Yellow: '0 0 0 3px rgba(245, 158, 11, 0.55)',
};

export function ReportView({ result, machineType = 'cat_ta1', checklistState, checklistReasoningState = {}, historyAlertState = {}, onInjectMock, mockList = [] }) {
  const [expandedItem, setExpandedItem] = useState(null);
  const [selectedMock, setSelectedMock] = useState(0);

  const checklist = getMachineChecklist(machineType);
  const checklistTotal = getMachineChecklistTotal(machineType);
  const generalGrade = Object.keys(checklistState).length > 0 ? worstGrade(checklistState) : 'None';
  const counts = countGrades(checklistState, checklistTotal);
  const generalComment = buildGeneralComment(checklistState, checklistReasoningState);

  return (
    <div className="pdf-container">
      {/* Dev Test Bar */}
      {onInjectMock && mockList.length > 0 && (
        <div className="test-bar">
          <select
            className="history-date-select"
            value={selectedMock}
            onChange={e => setSelectedMock(Number(e.target.value))}
            style={{ flex: 1, maxWidth: 280 }}
          >
            {mockList.map((mock, i) => (
              <option key={i} value={i}>{mock.label || `Mock ${i + 1}`}</option>
            ))}
          </select>
          <button className="test-btn" onClick={() => onInjectMock(selectedMock)}>Inject</button>
          <span className="test-label">DEV TEST</span>
        </div>
      )}

      {/* Header */}
      <div className="pdf-header">
        <div className="pdf-title-block">
          {machineType === 'f1tenth' ? (
            <>
              <h1>F1Tenth RoboRacer: Pre-Run Inspection</h1>
              <p className="pdf-subtitle">Pre-Run Safety Check</p>
            </>
          ) : (
            <>
              <h1>Wheel Loader: Safety & Maintenance</h1>
              <p className="pdf-subtitle">Daily</p>
            </>
          )}
        </div>
        <div className="pdf-logos">
          {machineType === 'f1tenth'
            ? <div className="logo-f1tenth">F1<span>10</span>TH</div>
            : <div className="logo-cat">CAT</div>}
        </div>
        <div className="pdf-summary-dots">
          <div className="summary-dot"><span className="dot red"></span>{counts.Red}</div>
          <div className="summary-dot"><span className="dot yellow"></span>{counts.Yellow}</div>
          <div className="summary-dot"><span className="dot green"></span>{counts.Green}</div>
          <div className="summary-dot"><span className="dot grey"></span>{counts.None}</div>
        </div>
      </div>

      {/* Meta Info */}
      <MetaGrid machineType={machineType} />

      {/* General Info */}
      <div className="pdf-section-header">General Info & Comments</div>
      <div className="pdf-list-item">
        <div className="item-main">
          <span className="item-dot" style={{ backgroundColor: GRADE_COLORS[generalGrade] }}></span>
          <span className="item-text">General Info/Comments</span>
          <span className="item-status">{result ? (GRADE_LABELS[generalGrade] || result.final_status || 'PENDING') : 'PENDING'}</span>
        </div>
        <div className="item-comment">
          {generalComment}
        </div>
      </div>

      {/* Checklist */}
      {Object.entries(checklist).map(([category, items]) => (
        <div key={category} className="pdf-category-block">
          <div className="pdf-section-header">{category}</div>
          {items.map(item => {
            const grade = checklistState[item] || 'None';
            const reasoning = checklistReasoningState[item];
            const isExpanded = expandedItem === item;
            const isInspected = grade !== 'None';
            const histAlert = !isInspected ? historyAlertState[item] : null;

            return (
              <div key={item} className={`pdf-list-item ${isInspected ? 'highlight' : ''} clickable-item`}>
                <div className="item-main" onClick={() => setExpandedItem(prev => prev === item ? null : item)}>
                  <span className="item-chevron">{isExpanded ? '\u25be' : '\u25b8'}</span>
                  <span className="item-dot" style={{ backgroundColor: GRADE_COLORS[grade], boxShadow: histAlert ? HISTORY_SHADOW[histAlert] : undefined }}></span>
                  <span className="item-text">{item}</span>
                  <span className="item-status">{GRADE_LABELS[grade]}</span>
                </div>
                {isExpanded && (
                  <div className="item-comment ai-reasoning">
                    {reasoning ? (
                      <>
                        <div><strong>AI REASONING:</strong> {reasoning.verdict_reasoning}</div>
                        {reasoning.recommendation && <div><strong>ACTION:</strong> {reasoning.recommendation}</div>}
                        <ChainOfThought cot={reasoning.chain_of_thought} />
                      </>
                    ) : (
                      <span style={{ color: '#999' }}>No inspection data for this item yet.</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Chain of Thought -- most recent full analysis */}
      {result && (result.visual_analysis?.chain_of_thought || result.cross_reference?.chain_of_thought) && (
        <div className="cot-section">
          <div className="pdf-section-header">AI Chain of Thought</div>
          <CotBlock title="Visual Analysis" rows={[
            ['Observations', result.visual_analysis?.chain_of_thought?.observations],
            ['Component ID', result.visual_analysis?.chain_of_thought?.component_identification],
            ['Assessment', result.visual_analysis?.chain_of_thought?.condition_assessment],
            ['Conclusion', result.visual_analysis?.chain_of_thought?.conclusion],
          ]} />
          <CotBlock title="Cross-Reference Reasoning" rows={[
            ['Audio Says', result.cross_reference?.chain_of_thought?.audio_says],
            ['Visual Shows', result.cross_reference?.chain_of_thought?.visual_shows],
            ['Comparison', result.cross_reference?.chain_of_thought?.comparison],
            ['Checklist Mapping', result.cross_reference?.chain_of_thought?.checklist_mapping_reasoning],
          ]} />
        </div>
      )}
    </div>
  );
}

// -- Sub-components --

function MetaGrid({ machineType }) {
  const fields = machineType === 'f1tenth'
    ? [
        ['Vehicle', 'F1Tenth RoboRacer'],     ['Platform', 'Traxxas Slash 4x4'],
        ['Compute', 'Jetson Xavier NX'],       ['Firmware', 'ROS2 Humble'],
        ['LiDAR', 'Hokuyo 10LX'],             ['Motor Controller', 'VESC'],
        ['Battery', '3S LiPo 11.1V'],         ['Inspector', 'AI VISION AGENT'],
        ['Inspection Type', 'Pre-Run Check'], ['Completed On', new Date().toLocaleString()],
        ['Location', 'University of Illinois, Urbana-Champaign'], ['PDF Generated On', new Date().toLocaleDateString()],
      ]
    : [
        ['Inspection Number', '22892110'],  ['Customer No', '2969507567'],
        ['Serial Number', 'W8210127'],      ['Customer Name', 'BORAL RESOURCES P/L'],
        ['Make', 'CATERPILLAR'],            ['Work Order', 'FW12076'],
        ['Model', '982'],                   ['Completed On', new Date().toLocaleString()],
        ['Equipment Family', 'Medium Wheel Loader'], ['Inspector', 'AI VISION AGENT'],
        ['Asset ID', 'FL-3062'],            ['PDF Generated On', new Date().toLocaleDateString()],
        ['SMU', '1027 Hours'],              ['Location', '601 Richland St, East Peoria, IL 61611'],
      ];
  return (
    <div className="pdf-meta-grid">
      {fields.map(([label, value]) => (
        <div key={label} className="meta-item">
          <span className="meta-label">{label}</span>
          <span className="meta-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

function ChainOfThought({ cot }) {
  if (!cot) return null;
  return (
    <div className="cot-inline">
      {cot.audio_says && <div><strong>Audio:</strong> {cot.audio_says}</div>}
      {cot.visual_shows && <div><strong>Visual:</strong> {cot.visual_shows}</div>}
      {cot.comparison && <div><strong>Comparison:</strong> {cot.comparison}</div>}
    </div>
  );
}

function CotBlock({ title, rows }) {
  const hasContent = rows.some(([, text]) => text);
  if (!hasContent) return null;
  return (
    <div className="cot-block">
      <div className="cot-block-title">{title}</div>
      {rows.map(([label, text]) => text && (
        <div key={label} className="cot-row">
          <span className="cot-label">{label}</span>
          <span className="cot-text">{text}</span>
        </div>
      ))}
    </div>
  );
}
