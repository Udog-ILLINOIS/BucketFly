import { useState, useEffect } from 'react';
import { fetchHistoryDates, fetchHistoryByDate } from '../services/api';
import '../components/ReportView.css';
import './HistoryView.css';

const CAT_TA1_CHECKLIST = {
    "FROM THE GROUND": [
        "1.1 Tires and Rims",
        "1.2 Bucket Cutting Edge, Tips, or Moldboard",
        "1.3 Bucket Tilt Cylinders and Hoses",
        "1.4 Bucket, Lift Cylinders and Hoses",
        "1.5 Lift arm attachment to frame",
        "1.6 Underneath of Machine",
        "1.7 Transmission and Transfer Gears",
        "1.8 Differential and Final Drive Oil",
        "1.9 Steps and Handrails",
        "1.10 Brake Air Tank; inspect",
        "1.11 Fuel Tank",
        "1.12 Axles- Final Drives, Differentials, Brakes, Duo-cone Seals",
        "1.13 Hydraulic fluid tank, inspect",
        "1.14 Transmission Oil",
        "1.15 Work Lights",
        "1.16 Battery & Cables"
    ],
    "ENGINE COMPARTMENT": [
        "2.1 Engine Oil Level",
        "2.2 Engine Coolant Level",
        "2.3 Check Radiator Cores for Debris",
        "2.4 Inspect Hoses for Cracks or Leaks",
        "2.5 Primary/secondary fuel filters",
        "2.6 All Belts",
        "2.7 Air Cleaner and Air Filter Service Indicator",
        "2.8 Overall Engine Compartment"
    ],
    "ON THE MACHINE, OUTSIDE THE CAB": [
        "3.1 Steps & Handrails",
        "3.2 ROPS/FOPS",
        "3.3 Fire Extinguisher",
        "3.4 Windshield wipers and washers",
        "3.5 Side Doors"
    ],
    "INSIDE THE CAB": [
        "4.1 Seat",
        "4.2 Seat belt and mounting",
        "4.3 Horn",
        "4.4 Backup Alarm",
        "4.5 Windows and Mirrors",
        "4.6 Cab Air Filter",
        "4.7 Indicators & Gauges",
        "4.8 Switch functionality",
        "4.9 Overall Cab Interior"
    ]
};

const gradeColors = {
    Green: '#22c55e',
    Yellow: '#f59e0b',
    Red: '#ef4444',
    None: '#e5e7eb',
};

const gradeLabels = {
    Green: 'PASS',
    Yellow: 'MONITOR',
    Red: 'FAIL',
    None: 'NORMAL',
};

function yesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}

function formatTime(inspectionId) {
    if (!inspectionId || inspectionId.startsWith('SEED_')) return '';
    const parts = inspectionId.split('_');
    if (parts.length < 2) return '';
    const t = parts[1];
    if (t.length < 6) return '';
    return `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`;
}

export function HistoryView() {
    const [availableDates, setAvailableDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState(yesterday());
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedItem, setExpandedItem] = useState(null);

    const handleItemClick = (item) => {
        setExpandedItem(prev => prev === item ? null : item);
    };

    useEffect(() => {
        fetchHistoryDates()
            .then(data => {
                const dates = data.dates || [];
                setAvailableDates(dates);
                if (dates.length > 0 && !dates.includes(yesterday())) {
                    setSelectedDate(dates[0]);
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!selectedDate) return;
        setIsLoading(true);
        setError(null);
        setRecords([]);
        setExpandedItem(null);
        fetchHistoryByDate(selectedDate)
            .then(data => setRecords(data.records || []))
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [selectedDate]);

    // Build checklist state from the day's records (last grade wins per item)
    const checklistState = {};
    // Also build a map of item -> record for showing detail
    const itemRecords = {};
    [...records].reverse().forEach(record => {
        const item = record.ai_analysis?.checklist_mapped_item || record.component;
        const grade = record.ai_analysis?.checklist_grade || record.grade;
        if (item && grade && grade !== 'None') {
            checklistState[item] = grade;
            itemRecords[item] = record;
        }
    });

    const counts = {
        Red: Object.values(checklistState).filter(v => v === 'Red').length,
        Yellow: Object.values(checklistState).filter(v => v === 'Yellow').length,
        Green: Object.values(checklistState).filter(v => v === 'Green').length,
        None: Object.keys(CAT_TA1_CHECKLIST).reduce((acc, cat) => acc + CAT_TA1_CHECKLIST[cat].length, 0) - Object.keys(checklistState).length,
    };

    const allDates = availableDates.includes(selectedDate)
        ? availableDates
        : [selectedDate, ...availableDates];

    return (
        <div className="pdf-container">
            {/* Date Picker Bar */}
            <div className="test-bar">
                <label className="test-label" style={{ marginLeft: 0, color: '#94a3b8' }}>DATE</label>
                <select
                    className="history-date-select"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                >
                    {allDates.map(d => (
                        <option key={d} value={d}>
                            {d === yesterday() ? `${d}  (Yesterday)` : d}
                        </option>
                    ))}
                    {allDates.length === 0 && (
                        <option value={selectedDate}>{selectedDate}</option>
                    )}
                </select>
                <span className="test-label">{records.length} inspection{records.length !== 1 ? 's' : ''}</span>
            </div>

            {/* PDF Header */}
            <div className="pdf-header">
                <div className="pdf-title-block">
                    <h1>Wheel Loader: Safety & Maintenance</h1>
                    <p className="pdf-subtitle">Daily — {selectedDate}</p>
                </div>
                <div className="pdf-logos">
                    <div className="logo-altorfer">ALTORFER</div>
                    <div className="logo-cat">CAT</div>
                </div>
                <div className="pdf-summary-dots">
                    <div className="summary-dot"><span className="dot red"></span>{counts.Red}</div>
                    <div className="summary-dot"><span className="dot yellow"></span>{counts.Yellow}</div>
                    <div className="summary-dot"><span className="dot green"></span>{counts.Green}</div>
                    <div className="summary-dot"><span className="dot grey"></span>{counts.None}</div>
                </div>
            </div>

            {/* Meta Grid */}
            <div className="pdf-meta-grid">
                <div className="meta-item"><span className="meta-label">Inspection Date</span><span className="meta-value">{selectedDate}</span></div>
                <div className="meta-item"><span className="meta-label">Customer No</span><span className="meta-value">2969507567</span></div>
                <div className="meta-item"><span className="meta-label">Serial Number</span><span className="meta-value">W8210127</span></div>
                <div className="meta-item"><span className="meta-label">Customer Name</span><span className="meta-value">BORAL RESOURCES P/L</span></div>
                <div className="meta-item"><span className="meta-label">Make</span><span className="meta-value">CATERPILLAR</span></div>
                <div className="meta-item"><span className="meta-label">Work Order</span><span className="meta-value">FW12076</span></div>
                <div className="meta-item"><span className="meta-label">Model</span><span className="meta-value">982</span></div>
                <div className="meta-item"><span className="meta-label">Total Inspections</span><span className="meta-value">{records.length}</span></div>
                <div className="meta-item"><span className="meta-label">Equipment Family</span><span className="meta-value">Medium Wheel Loader</span></div>
                <div className="meta-item"><span className="meta-label">Inspector</span><span className="meta-value">AI VISION AGENT</span></div>
                <div className="meta-item"><span className="meta-label">Asset ID</span><span className="meta-value">FL-3062</span></div>
                <div className="meta-item"><span className="meta-label">Report Generated</span><span className="meta-value">{new Date().toLocaleDateString()}</span></div>
            </div>

            {/* Loading / Empty states */}
            {isLoading && (
                <div className="pdf-section-header">Loading...</div>
            )}
            {!isLoading && error && (
                <div className="pdf-list-item">
                    <div className="item-comment" style={{ color: '#ef4444' }}>Error: {error}</div>
                </div>
            )}
            {!isLoading && !error && records.length === 0 && (
                <>
                    <div className="pdf-section-header">General Info & Comments</div>
                    <div className="pdf-list-item">
                        <div className="item-main">
                            <span className="item-dot" style={{ backgroundColor: '#e5e7eb' }}></span>
                            <span className="item-text">General Info/Comments</span>
                            <span className="item-status">PENDING</span>
                        </div>
                        <div className="item-comment">No inspections recorded for {selectedDate}.</div>
                    </div>
                </>
            )}

            {!isLoading && !error && records.length > 0 && (
                <>
                    {/* General Info */}
                    <div className="pdf-section-header">General Info & Comments</div>
                    <div className="pdf-list-item">
                        <div className="item-main">
                            <span className="item-dot" style={{ backgroundColor: counts.Red > 0 ? '#ef4444' : counts.Yellow > 0 ? '#f59e0b' : '#22c55e' }}></span>
                            <span className="item-text">General Info/Comments</span>
                            <span className="item-status">{counts.Red > 0 ? 'FAIL' : counts.Yellow > 0 ? 'MONITOR' : 'PASS'}</span>
                        </div>
                        <div className="item-comment">
                            {records.length} inspection{records.length !== 1 ? 's' : ''} completed on {selectedDate}.
                            {counts.Red > 0 ? ` ${counts.Red} item(s) require immediate attention.` : ''}
                            {counts.Yellow > 0 ? ` ${counts.Yellow} item(s) flagged for monitoring.` : ''}
                            {counts.Green > 0 && counts.Red === 0 && counts.Yellow === 0 ? ' All inspected items passed.' : ''}
                        </div>
                    </div>

                    {/* Checklist Sections */}
                    {Object.entries(CAT_TA1_CHECKLIST).map(([category, items]) => (
                        <div key={category} className="pdf-category-block">
                            <div className="pdf-section-header">{category}</div>
                            {items.map(item => {
                                const grade = checklistState[item] || 'None';
                                const color = gradeColors[grade];
                                const label = gradeLabels[grade];
                                const rec = itemRecords[item];
                                const isExpanded = expandedItem === item;

                                return (
                                    <div key={item} className={`pdf-list-item ${rec ? 'highlight' : ''} clickable-item`}>
                                        <div className="item-main" onClick={() => handleItemClick(item)}>
                                            <span className="item-chevron">{isExpanded ? '▾' : '▸'}</span>
                                            <span className="item-dot" style={{ backgroundColor: color }}></span>
                                            <span className="item-text">{item}</span>
                                            <span className="item-status">{label}</span>
                                        </div>
                                        {isExpanded && (
                                            <div className="item-comment ai-reasoning">
                                                {rec ? (
                                                    <>
                                                        <div><strong>TIME:</strong> {formatTime(rec.inspection_id)}</div>
                                                        {rec.ai_analysis?.verdict_reasoning && (
                                                            <div><strong>AI REASONING:</strong> {rec.ai_analysis.verdict_reasoning}</div>
                                                        )}
                                                        {rec.ai_analysis?.recommendation && (
                                                            <div><strong>ACTION:</strong> {rec.ai_analysis.recommendation}</div>
                                                        )}
                                                        {rec.audio_transcript && (
                                                            <div><strong>OPERATOR:</strong> "{rec.audio_transcript}"</div>
                                                        )}
                                                        {rec.ai_analysis?.chain_of_thought && (
                                                            <div className="cot-inline">
                                                                {rec.ai_analysis.chain_of_thought.audio_says && (
                                                                    <div><strong>Audio:</strong> {rec.ai_analysis.chain_of_thought.audio_says}</div>
                                                                )}
                                                                {rec.ai_analysis.chain_of_thought.visual_shows && (
                                                                    <div><strong>Visual:</strong> {rec.ai_analysis.chain_of_thought.visual_shows}</div>
                                                                )}
                                                                {rec.ai_analysis.chain_of_thought.comparison && (
                                                                    <div><strong>Comparison:</strong> {rec.ai_analysis.chain_of_thought.comparison}</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span style={{ color: '#999' }}>No inspection data for this item on {selectedDate}.</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                    {/* Chain of Thought for each inspected item */}
                    {Object.keys(itemRecords).length > 0 && (
                        <div className="cot-section">
                            <div className="pdf-section-header">AI Chain of Thought</div>
                            {Object.entries(itemRecords).map(([item, rec]) => {
                                // ai_analysis IS the saved cross_reference object
                                const cot = rec.ai_analysis?.chain_of_thought;
                                if (!cot) return null;
                                return (
                                    <div key={item} className="cot-block">
                                        <div className="cot-block-title">{item} — {formatTime(rec.inspection_id)}</div>
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
                    )}
                </>
            )}
        </div>
    );
}
