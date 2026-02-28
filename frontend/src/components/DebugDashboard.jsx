import React, { useState, useEffect } from 'react';
import { getInspections, approveInspection, getDebugConfig, setDebugConfig } from '../services/api';
import './DebugDashboard.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const MANUAL_TEMPLATE = {
    reasoning: "Manual intervention",
    is_complete: true,
    clarifications: [],
    report: {
        equipment_info: {
            customer_no: "",
            serial_number: "",
            customer_name: "",
            make: "",
            model: ""
        },
        general_info_comments: "",
        from_the_ground: {
            "1.1 Tires and Rims": { status: "PASS", comments: "" }
        },
        engine_compartment: {
            "2.1 Engine Oil Level": { status: "PASS", comments: "" }
        },
        on_machine_outside_cab: {
            "3.1 Steps & Handrails": { status: "PASS", comments: "" }
        },
        inside_cab: {
            "4.1 Seat": { status: "PASS", comments: "" }
        }
    }
};

export function DebugDashboard() {
    const [inspections, setInspections] = useState([]);
    const [selectedInspection, setSelectedInspection] = useState(null);
    const [editedData, setEditedData] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [approving, setApproving] = useState(false);
    const [manualMode, setManualMode] = useState(false);

    const fetchConfig = async () => {
        try {
            const config = await getDebugConfig();
            setManualMode(config.manual_mode);
        } catch (err) {
            console.error("Failed to fetch debug config:", err);
        }
    };

    const fetchInspections = async () => {
        try {
            setLoading(true);
            const data = await getInspections();
            // Sort newest first
            const sorted = (data.inspections || []).sort((a, b) =>
                new Date(b.created_at) - new Date(a.created_at)
            );
            setInspections(sorted);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
        fetchInspections();
        // Poll for new inspections every 5 seconds
        const interval = setInterval(fetchInspections, 5000);
        return () => clearInterval(interval);
    }, []);

    const toggleManualMode = async () => {
        try {
            const newStatus = !manualMode;
            setManualMode(newStatus);
            await setDebugConfig(newStatus);
        } catch (err) {
            console.error("Failed to toggle manual mode:", err);
            setManualMode(!manualMode); // Revert on failure
        }
    };

    const handleSelect = (inspection) => {
        setSelectedInspection(inspection);
        if (inspection.ai_draft) {
            setEditedData(JSON.stringify(inspection.ai_draft, null, 2));
        } else {
            // If there's no draft (e.g. manual mode was on, or AI errored out), provide the template
            setEditedData(JSON.stringify(MANUAL_TEMPLATE, null, 2));
        }
    };

    const handleApprove = async () => {
        if (!selectedInspection || !editedData) return;

        try {
            setApproving(true);
            const parsedData = JSON.parse(editedData); // Validate JSON
            await approveInspection(selectedInspection.id, parsedData);
            alert('Inspection approved and released to client!');
            setSelectedInspection(null);
            fetchInspections();
        } catch (err) {
            if (err instanceof SyntaxError) {
                alert('Invalid JSON format. Please fix formatting before approving.');
            } else {
                alert('Error approving inspection: ' + err.message);
            }
        } finally {
            setApproving(false);
        }
    };

    // Removed handleManualOverride

    if (loading && inspections.length === 0) {
        return <div className="debug-loading">Loading Debug Dashboard...</div>;
    }

    return (
        <div className="debug-dashboard">
            <header className="debug-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <h1>🔧 Backend Debug Dashboard</h1>
                    <div className="manual-toggle" style={{ color: '#ff9800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <input
                                type="checkbox"
                                checked={manualMode}
                                onChange={toggleManualMode}
                            />
                            Global Manual Mode (Bypass AI)
                        </label>
                    </div>
                </div>
                <a href="#" className="exit-admin">Exit Admin</a>
            </header>

            {error && <div className="debug-error">{error}</div>}

            <div className="debug-content">
                <div className="debug-sidebar">
                    <h3>Inspections</h3>
                    <ul className="inspection-list">
                        {inspections.map(ins => (
                            <li
                                key={ins.id}
                                className={`inspection-item ${selectedInspection?.id === ins.id ? 'active' : ''} status-${ins.status}`}
                                onClick={() => handleSelect(ins)}
                            >
                                <div className="ins-time">{new Date(ins.created_at).toLocaleTimeString()}</div>
                                <div className="ins-id">{ins.id}</div>
                                <div className={`ins-badge badge-${ins.status}`}>{ins.status.replace('_', ' ')}</div>
                            </li>
                        ))}
                        {inspections.length === 0 && <li className="empty-state">No inspections found.</li>}
                    </ul>
                </div>

                <div className="debug-main">
                    {!selectedInspection ? (
                        <div className="empty-state">Select an inspection from the sidebar to view details.</div>
                    ) : (
                        <div className="inspection-details">
                            <h2>Inspection ID: {selectedInspection.id}</h2>
                            <div className="status-banner">Current Status: <strong>{selectedInspection.status.toUpperCase()}</strong></div>

                            {selectedInspection.error_msg && (
                                <div className="error-banner">AI Error: {selectedInspection.error_msg}</div>
                            )}

                            <div className="media-section">
                                <h3>Captured Media ({selectedInspection.media.frame_count} frames)</h3>
                                <div className="frame-gallery">
                                    {selectedInspection.media.frames.map((framePath, idx) => (
                                        <img key={idx} src={`${API_BASE}${framePath}`} alt={`Frame ${idx}`} loading="lazy" />
                                    ))}
                                </div>
                                {selectedInspection.media.audio && (
                                    <div className="audio-player">
                                        <h4>Audio Recording:</h4>
                                        <audio controls src={`${API_BASE}${selectedInspection.media.audio}`} />
                                    </div>
                                )}
                            </div>

                            <div className="ai-section">
                                <h3>AI Reasoning / Thoughts</h3>
                                <div className="reasoning-box">
                                    {selectedInspection.ai_draft?.reasoning || "No reasoning provided by AI."}
                                </div>
                            </div>

                            <div className="editor-section">
                                <h3>Draft Report / Clarifications</h3>
                                <p className="editor-hint">Modify the JSON below to intervene manually. Once satisfied, click Approve to release to the client.</p>

                                <textarea
                                    className="json-editor"
                                    value={editedData}
                                    onChange={(e) => setEditedData(e.target.value)}
                                    disabled={selectedInspection.status === 'processing'}
                                />

                                <div className="actions">
                                    <button
                                        className="btn-approve"
                                        onClick={handleApprove}
                                        disabled={approving || selectedInspection.status === 'processing' || selectedInspection.status === 'completed'}
                                    >
                                        {approving ? 'Approving...' : 'Approve & Release to Client'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
