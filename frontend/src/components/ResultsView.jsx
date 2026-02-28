import { useState } from 'react';
import './ResultsView.css';

/**
 * Displays Gemini AI analysis results with Chain of Thought reasoning.
 */
export function ResultsView({ result }) {
    const [expandedSection, setExpandedSection] = useState('cot');

    if (!result) {
        return (
            <div className="results-view">
                <div className="results-empty">
                    <div className="empty-icon">📋</div>
                    <p>No inspection results yet</p>
                    <p className="empty-sub">Record an inspection to see AI analysis</p>
                </div>
            </div>
        );
    }

    const visual = result.visual_analysis || {};
    const audio = result.audio_transcription || {};
    const correlation = result.timestamp_correlation || {};
    const cot = visual.chain_of_thought || {};

    const statusColors = {
        PASS: '#22c55e',
        MONITOR: '#f59e0b',
        FAIL: '#ef4444',
        UNCLEAR: '#6b7280',
        CLARIFY: '#3b82f6',
    };

    const statusColor = statusColors[visual.preliminary_status] || '#6b7280';

    const toggleSection = (section) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    return (
        <div className="results-view">
            {/* Status Header */}
            <div className="result-header" style={{ borderColor: statusColor }}>
                <div className="status-badge" style={{ backgroundColor: statusColor }}>
                    {visual.preliminary_status || 'N/A'}
                </div>
                <div className="component-name">{visual.component || 'Unknown Component'}</div>
                <div className="confidence-bar">
                    <div className="confidence-label">
                        Confidence: {typeof visual.confidence === 'number'
                            ? (visual.confidence <= 1 ? `${(visual.confidence * 100).toFixed(0)}%` : `${visual.confidence}%`)
                            : 'N/A'}
                    </div>
                    <div className="confidence-track">
                        <div
                            className="confidence-fill"
                            style={{
                                width: `${typeof visual.confidence === 'number'
                                    ? (visual.confidence <= 1 ? visual.confidence * 100 : visual.confidence)
                                    : 0}%`,
                                backgroundColor: statusColor,
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Chain of Thought */}
            <div className={`result-section ${expandedSection === 'cot' ? 'expanded' : ''}`}>
                <div className="section-header" onClick={() => toggleSection('cot')}>
                    <span className="section-icon">🧠</span>
                    <span className="section-title">Chain of Thought</span>
                    <span className="section-arrow">{expandedSection === 'cot' ? '▼' : '▶'}</span>
                </div>
                {expandedSection === 'cot' && (
                    <div className="section-body cot-body">
                        <div className="cot-step">
                            <div className="cot-step-label">OBSERVE</div>
                            <div className="cot-step-text">{cot.observations || '—'}</div>
                        </div>
                        <div className="cot-step">
                            <div className="cot-step-label">IDENTIFY</div>
                            <div className="cot-step-text">{cot.component_identification || '—'}</div>
                        </div>
                        <div className="cot-step">
                            <div className="cot-step-label">ASSESS</div>
                            <div className="cot-step-text">{cot.condition_assessment || '—'}</div>
                        </div>
                        <div className="cot-step">
                            <div className="cot-step-label">CONCLUDE</div>
                            <div className="cot-step-text">{cot.conclusion || '—'}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Concerns */}
            {visual.concerns && visual.concerns.length > 0 && (
                <div className={`result-section ${expandedSection === 'concerns' ? 'expanded' : ''}`}>
                    <div className="section-header" onClick={() => toggleSection('concerns')}>
                        <span className="section-icon">⚠️</span>
                        <span className="section-title">Concerns ({visual.concerns.length})</span>
                        <span className="section-arrow">{expandedSection === 'concerns' ? '▼' : '▶'}</span>
                    </div>
                    {expandedSection === 'concerns' && (
                        <div className="section-body">
                            <ul className="concerns-list">
                                {visual.concerns.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Audio Transcription */}
            {audio.full_text && (
                <div className={`result-section ${expandedSection === 'audio' ? 'expanded' : ''}`}>
                    <div className="section-header" onClick={() => toggleSection('audio')}>
                        <span className="section-icon">🎙️</span>
                        <span className="section-title">Audio Transcription</span>
                        <span className="section-arrow">{expandedSection === 'audio' ? '▼' : '▶'}</span>
                    </div>
                    {expandedSection === 'audio' && (
                        <div className="section-body">
                            <blockquote className="transcription-text">"{audio.full_text}"</blockquote>
                            {audio.components_mentioned && audio.components_mentioned.length > 0 && (
                                <div className="components-mentioned">
                                    <div className="mentioned-label">Components mentioned:</div>
                                    {audio.components_mentioned.map((c, i) => (
                                        <span key={i} className="component-tag">
                                            {c.name} <small>@{c.timestamp}s</small>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Timestamp Correlation */}
            {correlation.correlations && correlation.correlations.length > 0 && (
                <div className={`result-section ${expandedSection === 'corr' ? 'expanded' : ''}`}>
                    <div className="section-header" onClick={() => toggleSection('corr')}>
                        <span className="section-icon">🔗</span>
                        <span className="section-title">Frame Correlation</span>
                        <span className="section-arrow">{expandedSection === 'corr' ? '▼' : '▶'}</span>
                    </div>
                    {expandedSection === 'corr' && (
                        <div className="section-body">
                            {correlation.correlations.map((c, i) => (
                                <div key={i} className="correlation-item">
                                    <span className="corr-component">{c.component}</span>
                                    <span className="corr-arrow">→</span>
                                    <span className="corr-frame">Frame {c.nearest_frame_index}</span>
                                    <span className={`corr-confidence ${c.confidence}`}>{c.confidence}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Processing Times */}
            <div className="processing-times">
                {visual.processing_time_seconds && (
                    <span>Visual: {visual.processing_time_seconds}s</span>
                )}
                {audio.processing_time_seconds && (
                    <span>Audio: {audio.processing_time_seconds}s</span>
                )}
                <span>Frames: {result.frame_count}</span>
            </div>
        </div>
    );
}
