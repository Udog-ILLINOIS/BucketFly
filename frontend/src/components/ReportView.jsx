import { useState } from 'react';
import './ReportView.css';

const CAT_TA1_CHECKLIST = {
    "MECHANICAL": [
        "1.1 Tire 1 — Front Left",
        "1.2 Tire 2 — Front Right",
        "1.3 Tire 3 — Rear Left",
        "1.4 Tire 4 — Rear Right",
        "1.5 Shock 1 — Front Left",
        "1.6 Shock 2 — Front Right",
        "1.7 Shock 3 — Rear Left",
        "1.8 Shock 4 — Rear Right",
        "1.9 Bumper 1 — Front",
        "1.10 Bumper 2 — Rear",
        "1.11 Undercarriage"
    ],
    "ELECTRONICS & POWER": [
        "2.1 Battery",
        "2.2 Powerboard",
        "2.3 NVIDIA Jetson",
        "2.4 Antenna"
    ],
    "SENSORS": [
        "3.1 LiDAR"
    ]
};

export function ReportView({ result, checklistState, checklistReasoningState = {} }) {
    const [expandedItem, setExpandedItem] = useState(null);

    const gradeColors = {
        'Green': '#22c55e',
        'Yellow': '#f59e0b',
        'Red': '#ef4444',
        'None': '#e5e7eb'
    };

    const gradeLabels = {
        'Green': 'PASS',
        'Yellow': 'MONITOR',
        'Red': 'FAIL',
        'None': 'NORMAL'
    };

    const counts = {
        Red: Object.values(checklistState).filter(v => v === 'Red').length,
        Yellow: Object.values(checklistState).filter(v => v === 'Yellow').length,
        Green: Object.values(checklistState).filter(v => v === 'Green').length,
        None: Object.keys(CAT_TA1_CHECKLIST).reduce((acc, cat) => acc + CAT_TA1_CHECKLIST[cat].length, 0) - Object.keys(checklistState).length
    };

    const handleItemClick = (item) => {
        setExpandedItem(prev => prev === item ? null : item);
    };

    return (
        <div className="pdf-container">
            {/* PDF Header */}
            <div className="pdf-header">
                <div className="pdf-title-block">
                    <h1>F1Tenth: Pre-Run Inspection</h1>
                    <p className="pdf-subtitle">Daily</p>
                </div>
                <div className="pdf-logos">
                    <div className="logo-altorfer">F1TENTH</div>
                    <div className="logo-cat">UIUC</div>
                </div>
                <div className="pdf-summary-dots">
                    <div className="summary-dot"><span className="dot red"></span>{counts.Red}</div>
                    <div className="summary-dot"><span className="dot yellow"></span>{counts.Yellow}</div>
                    <div className="summary-dot"><span className="dot green"></span>{counts.Green}</div>
                    <div className="summary-dot"><span className="dot grey"></span>{counts.None}</div>
                </div>
            </div>

            {/* Inspection Meta Info */}
            <div className="pdf-meta-grid">
                <div className="meta-item"><span className="meta-label">Platform</span> <span className="meta-value">F1Tenth Autonomous Racecar</span></div>
                <div className="meta-item"><span className="meta-label">Team</span> <span className="meta-value">HackAstra</span></div>
                <div className="meta-item"><span className="meta-label">Compute</span> <span className="meta-value">NVIDIA Jetson</span></div>
                <div className="meta-item"><span className="meta-label">Sensor Suite</span> <span className="meta-value">LiDAR</span></div>
                <div className="meta-item"><span className="meta-label">Make</span> <span className="meta-value">F1TENTH</span></div>
                <div className="meta-item"><span className="meta-label">University</span> <span className="meta-value">University of Illinois</span></div>
                <div className="meta-item"><span className="meta-label">Scale</span> <span className="meta-value">1:10</span></div>
                <div className="meta-item"><span className="meta-label">Completed On</span> <span className="meta-value">{new Date().toLocaleString()}</span></div>
                <div className="meta-item"><span className="meta-label">Equipment Family</span> <span className="meta-value">Autonomous Racing</span></div>
                <div className="meta-item"><span className="meta-label">Inspector</span> <span className="meta-value">AI VISION AGENT</span></div>
                <div className="meta-item"><span className="meta-label">Event</span> <span className="meta-value">HackIllinois 2026</span></div>
                <div className="meta-item"><span className="meta-label">Report Generated</span> <span className="meta-value">{new Date().toLocaleDateString()}</span></div>
            </div>

            {/* General Info Section */}
            <div className="pdf-section-header">General Info & Comments</div>
            <div className="pdf-list-item">
                <div className="item-main">
                    <span className="item-dot" style={{ backgroundColor: result ? '#e5e7eb' : '#e5e7eb' }}></span>
                    <span className="item-text">General Info/Comments</span>
                    <span className="item-status">{result ? (result.final_status || 'PENDING') : 'PENDING'}</span>
                </div>
                <div className="item-comment">
                    {result
                        ? `Graded ${result.cross_reference?.graded_items?.length || 0} item(s) this recording. Scene: ${result.visual_analysis?.scene_description || 'See pipeline below.'}`
                        : 'Awaiting inspection. Record a video to begin analysis.'
                    }
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
                        const reasoning = checklistReasoningState[item];
                        const isExpanded = expandedItem === item;
                        const isLatest = result?.cross_reference?.graded_items?.some(g => g.checklist_item === item);

                        return (
                            <div key={item} className={`pdf-list-item ${isLatest ? 'highlight' : ''} clickable-item`}>
                                <div
                                    className="item-main"
                                    onClick={() => handleItemClick(item)}
                                >
                                    <span className="item-chevron">{isExpanded ? '▾' : '▸'}</span>
                                    <span className="item-dot" style={{ backgroundColor: color }}></span>
                                    <span className="item-text">{item}</span>
                                    <span className="item-status">{label}</span>
                                </div>
                                {isExpanded && (
                                    <div className="item-comment ai-reasoning">
                                        {reasoning ? (
                                            <>
                                                <div><strong>REASONING:</strong> {reasoning.reasoning}</div>
                                                {reasoning.audio_evidence && (
                                                    <div><strong>Audio:</strong> {reasoning.audio_evidence}</div>
                                                )}
                                                {reasoning.visual_evidence && (
                                                    <div><strong>Visual:</strong> {reasoning.visual_evidence}</div>
                                                )}
                                                {reasoning.defects_confirmed?.length > 0 && (
                                                    <div><strong>Defects:</strong> {reasoning.defects_confirmed.join(', ')}</div>
                                                )}
                                                {reasoning.recommendation && (
                                                    <div><strong>ACTION:</strong> {reasoning.recommendation}</div>
                                                )}
                                                {reasoning.clarification_question && (
                                                    <div><strong>CLARIFY:</strong> {reasoning.clarification_question}</div>
                                                )}
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

            {/* Pipeline Debug — most recent analysis */}
            {result && (
                <div className="cot-section">
                    <div className="pdf-section-header">AI Pipeline — Last Recording</div>

                    {/* Call 1 output */}
                    {result.audio_transcription?.full_text && (
                        <div className="cot-block">
                            <div className="cot-block-title">Call 1 — Audio Transcript</div>
                            <div className="cot-row">
                                <span className="cot-label">Spoken</span>
                                <span className="cot-text">"{result.audio_transcription.full_text}"</span>
                            </div>
                            {result.audio_transcription.components_mentioned?.map((c, i) => (
                                <div key={i} className="cot-row">
                                    <span className="cot-label">{c.name}</span>
                                    <span className="cot-text">"{c.operator_statement}" at t={c.timestamp}s</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Call 2 output */}
                    {result.visual_analysis && (
                        <div className="cot-block">
                            <div className="cot-block-title">Call 2 — Visual Observation</div>
                            <div className="cot-row">
                                <span className="cot-label">Scene</span>
                                <span className="cot-text">{result.visual_analysis.scene_description}</span>
                            </div>
                            {result.visual_analysis.components_observed?.map((c, i) => (
                                <div key={i} className="cot-row">
                                    <span className="cot-label">[{c.visibility}] {c.name}</span>
                                    <span className="cot-text">
                                        {c.physical_observations?.join(' ')}
                                        {c.defects_noted?.length > 0 && (
                                            <span style={{ color: '#ef4444' }}> | DEFECTS: {c.defects_noted.join(', ')}</span>
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Call 3 output — unmentioned observations */}
                    {result.cross_reference?.unmentioned_observations?.length > 0 && (
                        <div className="cot-block">
                            <div className="cot-block-title">Call 3 — Unmentioned Visual Observations (not graded)</div>
                            {result.cross_reference.unmentioned_observations.map((obs, i) => (
                                <div key={i} className="cot-row">
                                    <span className="cot-label">Noted</span>
                                    <span className="cot-text">{obs}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
