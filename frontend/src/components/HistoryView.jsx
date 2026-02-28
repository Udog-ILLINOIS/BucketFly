import { useState, useEffect } from 'react';
import { fetchHistory } from '../services/api';
import './HistoryView.css';

const COMMON_COMPONENTS = [
    "1.1 Tires and Rims",
    "1.2 Bucket Cutting Edge, Tips, or Moldboard",
    "1.3 Steps and Handholds",
    "1.13 Hydraulic fluid tank",
    "2.3 Hydraulic System",
    "2.5 Cooling System",
    "4.6 Cab Air Filter",
    "Structural Damage"
];

export function HistoryView() {
    const [selectedComponent, setSelectedComponent] = useState(COMMON_COMPONENTS[0]);
    const [historyLogs, setHistoryLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadHistory = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await fetchHistory(selectedComponent);
                setHistoryLogs(data.history || []);
            } catch (err) {
                setError(err.message);
                setHistoryLogs([]);
            } finally {
                setIsLoading(false);
            }
        };

        if (selectedComponent) {
            loadHistory();
        }
    }, [selectedComponent]);

    const gradeColors = {
        'Green': '#22c55e',
        'Yellow': '#f59e0b',
        'Red': '#ef4444',
        'None': '#94a3b8'
    };

    return (
        <div className="history-view">
            <h2 className="history-header">Component History</h2>

            <div className="history-controls">
                <label className="history-label">Select Component to View Logs:</label>
                <select
                    className="history-select"
                    value={selectedComponent}
                    onChange={(e) => setSelectedComponent(e.target.value)}
                >
                    {COMMON_COMPONENTS.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            </div>

            <div className="history-feed">
                {isLoading && <div className="loading-state">Loading history logs...</div>}

                {!isLoading && error && (
                    <div className="error-state">Error: {error}</div>
                )}

                {!isLoading && !error && historyLogs.length === 0 && (
                    <div className="empty-state">
                        <span className="empty-icon">📭</span>
                        <p>No past inspections found for this component.</p>
                    </div>
                )}

                {!isLoading && !error && historyLogs.length > 0 && (
                    <div className="timeline">
                        {historyLogs.map((log, index) => {
                            const dateStr = log.inspection_id && log.inspection_id.startsWith('SEED_')
                                ? "Past Date (Baseline)"
                                : log.inspection_id
                                    ? new Date(
                                        parseInt(log.inspection_id.slice(0, 4)),
                                        parseInt(log.inspection_id.slice(4, 6)) - 1,
                                        parseInt(log.inspection_id.slice(6, 8)),
                                        parseInt(log.inspection_id.slice(9, 11)),
                                        parseInt(log.inspection_id.slice(11, 13))
                                    ).toLocaleString()
                                    : "Unknown Date";

                            const gradeColor = gradeColors[log.grade] || '#94a3b8';

                            return (
                                <div key={index} className="timeline-item" style={{ borderColor: gradeColor }}>
                                    <div className="timeline-dot" style={{ backgroundColor: gradeColor }}></div>
                                    <div className="timeline-content">
                                        <div className="timeline-header">
                                            <span className="timeline-date">{dateStr}</span>
                                            <span className="timeline-grade" style={{ color: gradeColor }}>
                                                {log.grade.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="timeline-body">
                                            {log.operator_notes && (
                                                <div className="timeline-notes">
                                                    <strong>Supervisor Notes:</strong> {log.operator_notes}
                                                </div>
                                            )}
                                            {log.audio_transcript && (
                                                <div className="timeline-transcript">
                                                    <strong>Operator Spoke:</strong> "{log.audio_transcript}"
                                                </div>
                                            )}
                                            {log.ai_analysis?.chain_of_thought?.conclusion && (
                                                <div className="timeline-ai">
                                                    <strong>AI Conclusion:</strong> {log.ai_analysis.chain_of_thought.conclusion}
                                                </div>
                                            )}
                                        </div>
                                        {log.frames && log.frames.length > 0 && (
                                            <div className="timeline-media">
                                                <img src={log.frames[0]} alt="Historical Inspection Frame" className="history-thumbnail" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
