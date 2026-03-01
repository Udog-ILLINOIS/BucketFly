import { useState, useEffect, useCallback } from 'react';
import { fetchHistoryDates, fetchHistoryByDate, clearHistoryByDate } from '../services/api';
import {
  CAT_TA1_CHECKLIST, GRADE_COLORS, GRADE_LABELS,
  normalizeGrade, countGrades, VALID_ITEMS, CHECKLIST_TOTAL,
} from '../constants/checklist';
import '../components/ReportView.css';
import './HistoryView.css';

const today = () => new Date().toISOString().slice(0, 10);

function formatTime(id) {
  if (!id || id.startsWith('SEED_')) return '';
  const t = id.split('_')[1] || '';
  return t.length >= 6 ? `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}` : '';
}

export function HistoryView({ injectedRecords = [], onClearInjected }) {
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);
  const [isClearing, setIsClearing] = useState(false);

  /* Clear all records for the selected date */
  const handleClearDay = async () => {
    if (!window.confirm(`Delete ALL inspections for ${selectedDate}? This cannot be undone.`)) return;
    setIsClearing(true);
    try {
      await clearHistoryByDate(selectedDate);
      setRecords([]);
      if (onClearInjected) onClearInjected();
      setError(null);
    } catch (err) {
      setError(`Clear failed: ${err.message}`);
    } finally {
      setIsClearing(false);
    }
  };

  /* Fetch available dates once */
  useEffect(() => {
    fetchHistoryDates()
      .then(data => {
        const dates = data.dates || [];
        setAvailableDates(dates);
        if (dates.length > 0 && !dates.includes(today())) setSelectedDate(dates[0]);
      })
      .catch(() => {});
  }, []);

  /* Load records when date changes */
  const loadRecords = useCallback(async (date, signal) => {
    try {
      const data = await fetchHistoryByDate(date);
      if (!signal.aborted) { setRecords(data.records || []); setError(null); }
    } catch (err) {
      if (!signal.aborted) setError(err.message);
    } finally {
      if (!signal.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    const ctrl = new AbortController();
    setIsLoading(true);
    setExpandedItem(null);
    loadRecords(selectedDate, ctrl.signal);
    return () => ctrl.abort();
  }, [selectedDate, loadRecords]);

  /* Merge API + injected records; latest record wins per item */
  const allRecords = [...records, ...injectedRecords];
  const checklistState = {};
  const itemRecords = {};

  allRecords.forEach(rec => {
    const item = rec.ai_analysis?.checklist_mapped_item || rec.component;
    const grade = normalizeGrade(rec.ai_analysis?.checklist_grade || rec.grade);
    if (item && grade !== 'None' && VALID_ITEMS.has(item)) {
      checklistState[item] = grade;
      itemRecords[item] = rec;
    }
  });

  const counts = countGrades(checklistState);
  const allDates = availableDates.includes(selectedDate)
    ? availableDates
    : [selectedDate, ...availableDates];

  return (
    <div className="pdf-container">
      {/* Date Picker */}
      <div className="test-bar">
        <label className="test-label" style={{ marginLeft: 0, color: '#94a3b8' }}>DATE</label>
        <select className="history-date-select" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
          {allDates.map(d => <option key={d} value={d}>{d === today() ? `${d}  (Today)` : d}</option>)}
          {allDates.length === 0 && <option value={selectedDate}>{selectedDate}</option>}
        </select>
        <span className="test-label">{allRecords.length} inspection{allRecords.length !== 1 ? 's' : ''}</span>
        <button
          className="clear-day-btn"
          onClick={handleClearDay}
          disabled={isClearing || allRecords.length === 0}
          title={`Delete all inspections for ${selectedDate}`}
        >
          {isClearing ? 'Clearing...' : 'Clear Day'}
        </button>
      </div>

      {/* Header */}
      <div className="pdf-header">
        <div className="pdf-title-block">
          <h1>Wheel Loader: Safety & Maintenance</h1>
          <p className="pdf-subtitle">Daily \u2014 {selectedDate}</p>
        </div>
        <div className="pdf-logos"><div className="logo-cat">CAT</div></div>
        <div className="pdf-summary-dots">
          <div className="summary-dot"><span className="dot red"></span>{counts.Red}</div>
          <div className="summary-dot"><span className="dot yellow"></span>{counts.Yellow}</div>
          <div className="summary-dot"><span className="dot green"></span>{counts.Green}</div>
          <div className="summary-dot"><span className="dot grey"></span>{counts.None}</div>
        </div>
      </div>

      {/* Meta */}
      <HistoryMeta selectedDate={selectedDate} totalRecords={allRecords.length} />

      {/* States: loading / error / empty */}
      {isLoading && allRecords.length === 0 && <div className="pdf-section-header">Loading...</div>}

      {!isLoading && error && allRecords.length === 0 && (
        <div className="pdf-list-item">
          <div className="item-comment" style={{ color: '#ef4444' }}>Error: {error}</div>
        </div>
      )}

      {!isLoading && !error && allRecords.length === 0 && (
        <>
          <div className="pdf-section-header">General Info & Comments</div>
          <div className="pdf-list-item">
            <div className="item-main">
              <span className="item-dot" style={{ backgroundColor: GRADE_COLORS.None }}></span>
              <span className="item-text">General Info/Comments</span>
              <span className="item-status">PENDING</span>
            </div>
            <div className="item-comment">No inspections recorded for {selectedDate}.</div>
          </div>
        </>
      )}

      {/* Populated state */}
      {allRecords.length > 0 && (
        <>
          <GeneralInfoRow counts={counts} selectedDate={selectedDate} totalRecords={allRecords.length} />

          {Object.entries(CAT_TA1_CHECKLIST).map(([category, items]) => (
            <div key={category} className="pdf-category-block">
              <div className="pdf-section-header">{category}</div>
              {items.map(item => {
                const grade = checklistState[item] || 'None';
                const rec = itemRecords[item];
                const open = expandedItem === item;
                return (
                  <div key={item} className={`pdf-list-item ${rec ? 'highlight' : ''} clickable-item`}>
                    <div className="item-main" onClick={() => setExpandedItem(prev => prev === item ? null : item)}>
                      <span className="item-chevron">{open ? '\u25be' : '\u25b8'}</span>
                      <span className="item-dot" style={{ backgroundColor: GRADE_COLORS[grade] }}></span>
                      <span className="item-text">{item}</span>
                      <span className="item-status">{GRADE_LABELS[grade]}</span>
                    </div>
                    {open && <ItemDetail rec={rec} selectedDate={selectedDate} />}
                  </div>
                );
              })}
            </div>
          ))}

          <CotSummary itemRecords={itemRecords} />
        </>
      )}
    </div>
  );
}

/* ---- Sub-components ---- */

function HistoryMeta({ selectedDate, totalRecords }) {
  const fields = [
    ['Inspection Date', selectedDate], ['Customer No', '2969507567'],
    ['Serial Number', 'W8210127'],     ['Customer Name', 'BORAL RESOURCES P/L'],
    ['Make', 'CATERPILLAR'],           ['Work Order', 'FW12076'],
    ['Model', '982'],                  ['Total Inspections', totalRecords],
    ['Equipment Family', 'Medium Wheel Loader'], ['Inspector', 'AI VISION AGENT'],
    ['Asset ID', 'FL-3062'],           ['Report Generated', new Date().toLocaleDateString()],
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

function GeneralInfoRow({ counts, selectedDate, totalRecords }) {
  const overallGrade = counts.Red > 0 ? 'Red' : counts.Yellow > 0 ? 'Yellow' : 'Green';
  return (
    <>
      <div className="pdf-section-header">General Info & Comments</div>
      <div className="pdf-list-item">
        <div className="item-main">
          <span className="item-dot" style={{ backgroundColor: GRADE_COLORS[overallGrade] }}></span>
          <span className="item-text">General Info/Comments</span>
          <span className="item-status">{GRADE_LABELS[overallGrade]}</span>
        </div>
        <div className="item-comment">
          {totalRecords} inspection{totalRecords !== 1 ? 's' : ''} completed on {selectedDate}.
          {counts.Red > 0 && ` ${counts.Red} item(s) require immediate attention.`}
          {counts.Yellow > 0 && ` ${counts.Yellow} item(s) flagged for monitoring.`}
          {counts.Green > 0 && counts.Red === 0 && counts.Yellow === 0 && ' All inspected items passed.'}
        </div>
      </div>
    </>
  );
}

function ItemDetail({ rec, selectedDate }) {
  if (!rec) return <div className="item-comment ai-reasoning"><span style={{ color: '#999' }}>No inspection data for this item on {selectedDate}.</span></div>;
  const cot = rec.ai_analysis?.chain_of_thought;
  return (
    <div className="item-comment ai-reasoning">
      <div><strong>TIME:</strong> {formatTime(rec.inspection_id)}</div>
      {rec.ai_analysis?.verdict_reasoning && <div><strong>AI REASONING:</strong> {rec.ai_analysis.verdict_reasoning}</div>}
      {rec.ai_analysis?.recommendation && <div><strong>ACTION:</strong> {rec.ai_analysis.recommendation}</div>}
      {rec.audio_transcript && <div><strong>OPERATOR:</strong> "{rec.audio_transcript}"</div>}
      {cot && (
        <div className="cot-inline">
          {cot.audio_says && <div><strong>Audio:</strong> {cot.audio_says}</div>}
          {cot.visual_shows && <div><strong>Visual:</strong> {cot.visual_shows}</div>}
          {cot.comparison && <div><strong>Comparison:</strong> {cot.comparison}</div>}
        </div>
      )}
    </div>
  );
}

function CotSummary({ itemRecords }) {
  const entries = Object.entries(itemRecords).filter(([, rec]) => rec.ai_analysis?.chain_of_thought);
  if (entries.length === 0) return null;
  return (
    <div className="cot-section">
      <div className="pdf-section-header">AI Chain of Thought</div>
      {entries.map(([item, rec]) => {
        const cot = rec.ai_analysis.chain_of_thought;
        return (
          <div key={item} className="cot-block">
            <div className="cot-block-title">{item} \u2014 {formatTime(rec.inspection_id)}</div>
            {[
              ['Audio Says', cot.audio_says],
              ['Visual Shows', cot.visual_shows],
              ['Comparison', cot.comparison],
              ['Checklist Mapping', cot.checklist_mapping_reasoning],
            ].map(([label, text]) => text && (
              <div key={label} className="cot-row">
                <span className="cot-label">{label}</span>
                <span className="cot-text">{text}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
