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
    const [editedData, setEditedData] = useState(null);
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
            // Deep copy to avoid mutating original
            setEditedData(JSON.parse(JSON.stringify(inspection.ai_draft)));
        } else {
            // If there's no draft, provide the template
            setEditedData(JSON.parse(JSON.stringify(MANUAL_TEMPLATE)));
        }
    };

    const handleFormSubmit = async (isComplete) => {
        if (!selectedInspection || !editedData) return;

        try {
            setApproving(true);
            const finalData = { ...editedData, is_complete: isComplete };
            await approveInspection(selectedInspection.id, finalData);
            alert(isComplete ? 'Final Report Approved!' : 'Clarifications Requested from User!');
            setSelectedInspection(null);
            fetchInspections();
        } catch (err) {
            alert('Error approving inspection: ' + err.message);
        } finally {
            setApproving(false);
        }
    };

    // --- FORM HELPERS ---
    const updateEquipment = (field, val) => {
        setEditedData(prev => ({
            ...prev, report: { ...prev.report, equipment_info: { ...prev.report.equipment_info, [field]: val } }
        }));
    };

    const updateChecklist = (category, itemKey, field, val) => {
        setEditedData(prev => ({
            ...prev, report: {
                ...prev.report, [category]: {
                    ...prev.report[category], [itemKey]: {
                        ...prev.report[category][itemKey], [field]: val
                    }
                }
            }
        }));
    };

    const addClarification = () => {
        setEditedData(prev => ({ ...prev, clarifications: [...prev.clarifications, ""] }));
    };

    const updateClarification = (idx, val) => {
        const newClarifications = [...editedData.clarifications];
        newClarifications[idx] = val;
        setEditedData(prev => ({ ...prev, clarifications: newClarifications }));
    };

    const removeClarification = (idx) => {
        const newClarifications = editedData.clarifications.filter((_, i) => i !== idx);
        setEditedData(prev => ({ ...prev, clarifications: newClarifications }));
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
                                <h3>Admin Control Panel</h3>

                                {editedData && (
                                    <div className="visual-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '15px' }}>
                                        <div className="form-group">
                                            <h4>Equipment Info</h4>
                                            {Object.entries(editedData.report.equipment_info || {}).map(([key, val]) => (
                                                <div key={key} style={{ display: 'flex', marginBottom: '8px', alignItems: 'center' }}>
                                                    <label style={{ width: '150px', fontWeight: 'bold' }}>{key.replace('_', ' ').toUpperCase()}:</label>
                                                    <input
                                                        type="text"
                                                        value={val}
                                                        onChange={(e) => updateEquipment(key, e.target.value)}
                                                        style={{ flex: 1, padding: '6px' }}
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="form-group">
                                            <h4>General Comments</h4>
                                            <textarea
                                                style={{ width: '100%', minHeight: '80px', padding: '8px' }}
                                                value={editedData.report.general_info_comments || ""}
                                                onChange={(e) => setEditedData(prev => ({ ...prev, report: { ...prev.report, general_info_comments: e.target.value } }))}
                                            />
                                        </div>

                                        {["from_the_ground", "engine_compartment", "on_machine_outside_cab", "inside_cab"].map((category) => (
                                            <div key={category} className="form-group">
                                                <h4>{category.replace(/_/g, ' ').toUpperCase()}</h4>
                                                {Object.entries(editedData.report[category] || {}).map(([itemKey, itemState]) => (
                                                    <div key={itemKey} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'center' }}>
                                                        <span style={{ width: '200px' }}>{itemKey}</span>
                                                        <select
                                                            value={itemState.status}
                                                            onChange={(e) => updateChecklist(category, itemKey, 'status', e.target.value)}
                                                            style={{ padding: '4px' }}
                                                        >
                                                            <option value="PASS">PASS</option>
                                                            <option value="FAIL">FAIL</option>
                                                            <option value="MONITOR">MONITOR</option>
                                                            <option value="N/A">N/A</option>
                                                        </select>
                                                        <input
                                                            type="text"
                                                            placeholder="Comments"
                                                            value={itemState.comments}
                                                            onChange={(e) => updateChecklist(category, itemKey, 'comments', e.target.value)}
                                                            style={{ flex: 1, padding: '4px' }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        ))}

                                        <div className="form-group">
                                            <h4>Clarifications (Ask User details)</h4>
                                            {editedData.clarifications.map((clar, idx) => (
                                                <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                                                    <input
                                                        type="text"
                                                        value={clar}
                                                        onChange={(e) => updateClarification(idx, e.target.value)}
                                                        style={{ flex: 1, padding: '6px' }}
                                                        placeholder="E.g. Get a better look under the chassis"
                                                    />
                                                    <button onClick={() => removeClarification(idx)} style={{ padding: '6px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Remove</button>
                                                </div>
                                            ))}
                                            <button onClick={addClarification} style={{ marginTop: '5px', padding: '6px 12px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ Add Clarification Request</button>
                                        </div>

                                        <div className="actions" style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                                            <button
                                                style={{ background: '#f39c12', color: 'white', padding: '12px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', flex: 1, fontWeight: 'bold' }}
                                                onClick={() => handleFormSubmit(false)}
                                                disabled={approving || selectedInspection.status === 'completed' || editedData.clarifications.length === 0}
                                            >
                                                {approving ? 'Processing...' : 'Ask User for More Info'}
                                            </button>
                                            <button
                                                className="btn-approve"
                                                onClick={() => handleFormSubmit(true)}
                                                disabled={approving || selectedInspection.status === 'completed'}
                                                style={{ padding: '12px 20px', flex: 1, fontWeight: 'bold' }}
                                            >
                                                {approving ? 'Processing...' : 'Approve Final Report'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
