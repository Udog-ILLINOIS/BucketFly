import { useState } from 'react';
import { CAT_TA1_CHECKLIST, GRADE_COLORS, GRADE_LABELS, countGrades } from '../constants/checklist';
import './ReportView.css';

const STATUS_TO_GRADE = { PASS: 'Green', FAIL: 'Red', MONITOR: 'Yellow' };

/** Derive the overall grade from the latest result for the General Info circle. */
function deriveGeneralGrade(result) {
  if (!result) return 'None';
  if (result.cross_reference?.checklist_grade) return result.cross_reference.checklist_grade;
  const first = result.cross_reference?.items_evaluated?.[0];
  if (first?.checklist_grade) return first.checklist_grade;
  return STATUS_TO_GRADE[result.final_status] || 'None';
}

export function ReportView({ result, checklistState, checklistReasoningState = {}, onInjectMock, mockList = [] }) {
  const [expandedItem, setExpandedItem] = useState(null);
  const [selectedMock, setSelectedMock] = useState(0);

  const generalGrade = deriveGeneralGrade(result);
  const counts = countGrades(checklistState);

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
          <h1>Wheel Loader: Safety & Maintenance</h1>
          <p className="pdf-subtitle">Daily</p>
        </div>
        <div className="pdf-logos"><div className="logo-cat">CAT</div></div>
        <div className="pdf-summary-dots">
          <div className="summary-dot"><span className="dot red"></span>{counts.Red}</div>
          <div className="summary-dot"><span className="dot yellow"></span>{counts.Yellow}</div>
          <div className="summary-dot"><span className="dot green"></span>{counts.Green}</div>
          <div className="summary-dot"><span className="dot grey"></span>{counts.None}</div>
        </div>
      </div>

      {/* Meta Info */}
      <MetaGrid />

      {/* General Info */}
      <div className="pdf-section-header">General Info & Comments</div>
      <div className="pdf-list-item">
        <div className="item-main">
          <span className="item-dot" style={{ backgroundColor: GRADE_COLORS[generalGrade] }}></span>
          <span className="item-text">General Info/Comments</span>
          <span className="item-status">{result ? (GRADE_LABELS[generalGrade] || result.final_status || 'PENDING') : 'PENDING'}</span>
        </div>
        <div className="item-comment">
          {result
            ? `Component: ${result.visual_analysis?.component || 'Unknown'}. ${result.cross_reference?.verdict_reasoning || result.audio_transcription?.full_text || 'Analysis complete.'}`
            : 'Awaiting inspection. Record a video to begin analysis.'}
        </div>
      </div>

      {/* Checklist */}
      {Object.entries(CAT_TA1_CHECKLIST).map(([category, items]) => (
        <div key={category} className="pdf-category-block">
          <div className="pdf-section-header">{category}</div>
          {items.map(item => {
            const grade = checklistState[item] || 'None';
            const reasoning = checklistReasoningState[item];
            const isExpanded = expandedItem === item;
            const isLatest = result?.cross_reference?.items_evaluated?.some(e => e.checklist_mapped_item === item);

            return (
              <div key={item} className={`pdf-list-item ${isLatest ? 'highlight' : ''} clickable-item`}>
                <div className="item-main" onClick={() => setExpandedItem(prev => prev === item ? null : item)}>
                  <span className="item-chevron">{isExpanded ? '\u25be' : '\u25b8'}</span>
                  <span className="item-dot" style={{ backgroundColor: GRADE_COLORS[grade] }}></span>
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

function MetaGrid() {
  const fields = [
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
