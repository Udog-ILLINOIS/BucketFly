import React from 'react';
import './ReportView.css';

export function ReportView({ report }) {
    if (!report) return null;

    const renderSection = (title, items) => {
        if (!items || Object.keys(items).length === 0) return null;
        return (
            <div className="report-section">
                <h3 className="section-title">{title}</h3>
                {Object.entries(items).map(([key, value]) => (
                    <div key={key} className={`report-item status-${value.status.toLowerCase()}`}>
                        <div className="item-header">
                            <span className="item-name">{key}</span>
                            <span className="item-status">{value.status}</span>
                        </div>
                        {value.comments && (
                            <div className="item-comments">
                                <strong>Comments:</strong> {value.comments}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="report-view">
            <div className="report-header">
                <h2>Safety & Maintenance Report</h2>
                <div className="equipment-info">
                    {Object.entries(report.equipment_info || {}).map(([k, v]) => (
                        v && <div key={k} className="info-row">
                            <span className="info-label">{k.replace('_', ' ').toUpperCase()}:</span>
                            <span className="info-value">{v}</span>
                        </div>
                    ))}
                </div>
            </div>

            {report.general_info_comments && (
                <div className="report-section general-comments">
                    <h3>General Info & Comments</h3>
                    <p>{report.general_info_comments}</p>
                </div>
            )}

            {renderSection("From The Ground", report.from_the_ground)}
            {renderSection("Engine Compartment", report.engine_compartment)}
            {renderSection("On The Machine, Outside The Cab", report.on_machine_outside_cab)}
            {renderSection("Inside The Cab", report.inside_cab)}

            <div className="report-footer">
                <button className="btn-done" onClick={() => window.location.reload()}>New Inspection</button>
            </div>
        </div>
    );
}
