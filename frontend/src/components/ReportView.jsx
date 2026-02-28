import { useState } from 'react';
import './ReportView.css';

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

export function ReportView({ result, checklistState, onUpdateResult }) {
    const [expandedSection, setExpandedSection] = useState('cot');

    const gradeColors = {
        'Green': '#22c55e',
        'Yellow': '#f59e0b',
        'Red': '#ef4444',
        'None': '#e5e7eb' // light gray
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

    return (
        <div className="pdf-container">
            {/* PDF Header */}
            <div className="pdf-header">
                <div className="pdf-title-block">
                    <h1>Wheel Loader: Safety & Maintenance</h1>
                    <p className="pdf-subtitle">Daily</p>
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

            {/* Inspection Meta Info */}
            <div className="pdf-meta-grid">
                <div className="meta-item"><span className="meta-label">Inspection Number</span> <span className="meta-value">22892110</span></div>
                <div className="meta-item"><span className="meta-label">Customer No</span> <span className="meta-value">2969507567</span></div>
                <div className="meta-item"><span className="meta-label">Serial Number</span> <span className="meta-value">W8210127</span></div>
                <div className="meta-item"><span className="meta-label">Customer Name</span> <span className="meta-value">BORAL RESOURCES P/L</span></div>
                <div className="meta-item"><span className="meta-label">Make</span> <span className="meta-value">CATERPILLAR</span></div>
                <div className="meta-item"><span className="meta-label">Work Order</span> <span className="meta-value">FW12076</span></div>
                <div className="meta-item"><span className="meta-label">Model</span> <span className="meta-value">982</span></div>
                <div className="meta-item"><span className="meta-label">Completed On</span> <span className="meta-value">{new Date().toLocaleString()}</span></div>
                <div className="meta-item"><span className="meta-label">Equipment Family</span> <span className="meta-value">Medium Wheel Loader</span></div>
                <div className="meta-item"><span className="meta-label">Inspector</span> <span className="meta-value">AI VISION AGENT</span></div>
                <div className="meta-item"><span className="meta-label">Asset ID</span> <span className="meta-value">FL-3062</span></div>
                <div className="meta-item"><span className="meta-label">PDF Generated On</span> <span className="meta-value">{new Date().toLocaleDateString()}</span></div>
                <div className="meta-item"><span className="meta-label">SMU</span> <span className="meta-value">1027 Hours</span></div>
                <div className="meta-item"><span className="meta-label">Location</span> <span className="meta-value">601 Richland St, East Peoria, IL 61611</span></div>
            </div>

            {/* General Info Section */}
            <div className="pdf-section-header">General Info & Comments</div>
            <div className="pdf-list-item">
                <div className="item-main">
                    <span className="item-dot yellow"></span>
                    <span className="item-text">General Info/Comments</span>
                    <span className="item-status">MONITOR</span>
                </div>
                <div className="item-comment">
                    Comments: AI processing active. Frames and audio synchronized for analysis.
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

                        // Check if this item is currently being analyzed
                        const isLatest = result?.cross_reference?.checklist_mapped_item === item;

                        return (
                            <div key={item} className={`pdf-list-item ${isLatest ? 'highlight' : ''}`}>
                                <div className="item-main">
                                    <span className="item-dot" style={{ backgroundColor: color }}></span>
                                    <span className="item-text">{item}</span>
                                    <span className="item-status">{label}</span>
                                </div>
                                {isLatest && result.cross_reference.verdict_reasoning && (
                                    <div className="item-comment ai-reasoning">
                                        <strong>AI REASONING:</strong> {result.cross_reference.verdict_reasoning}
                                        {result.cross_reference.recommendation && (
                                            <div><strong>ACTION:</strong> {result.cross_reference.recommendation}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}

        </div>
    );
}
