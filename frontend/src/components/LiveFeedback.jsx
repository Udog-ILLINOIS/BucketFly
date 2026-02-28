import { useState, useEffect, useRef } from 'react';
import './LiveFeedback.css';

/**
 * Real-time feedback overlay rendered on top of the camera viewfinder.
 * Shows:
 *  - Component detected + confidence badge
 *  - Guidance hints (fade after 3s)
 *  - Missed items count ticker
 *  - Duplicate inspection warning
 */
export function LiveFeedback({ identification, checklistState, isActive }) {
    const [guidanceVisible, setGuidanceVisible] = useState(false);
    const guidanceTimer = useRef(null);
    const prevGuidance = useRef('');

    // Show guidance text when it changes, then fade it after 4s
    useEffect(() => {
        if (!identification?.guidance) return;
        if (identification.guidance === prevGuidance.current) return;

        prevGuidance.current = identification.guidance;
        
        if (guidanceTimer.current) clearTimeout(guidanceTimer.current);
        
        setTimeout(() => {
            setGuidanceVisible(true);
            guidanceTimer.current = setTimeout(() => setGuidanceVisible(false), 4000);
        }, 0);

        return () => {
            if (guidanceTimer.current) clearTimeout(guidanceTimer.current);
        };
    }, [identification?.guidance]);

    if (!isActive || !identification) return null;

    const {
        checklist_item: checklistItem,
        confidence,
        confidence_label: confidenceLabel,
        guidance,
        already_inspected: alreadyInspected,
        existing_grade: existingGrade,
        items_inspected: itemsInspected,
    } = identification;

    const isNone = !checklistItem || checklistItem === 'None';

    // Compute missed items list (items not yet in checklistState)
    const allItems = [
        "1.1 Tires and Rims", "1.2 Bucket Cutting Edge, Tips, or Moldboard",
        "1.3 Bucket Tilt Cylinders and Hoses", "1.4 Bucket, Lift Cylinders and Hoses",
        "1.5 Lift arm attachment to frame", "1.6 Underneath of Machine",
        "1.7 Transmission and Transfer Gears", "1.8 Differential and Final Drive Oil",
        "1.9 Steps and Handrails", "1.10 Brake Air Tank; inspect",
        "1.11 Fuel Tank", "1.12 Axles- Final Drives, Differentials, Brakes, Duo-cone Seals",
        "1.13 Hydraulic fluid tank, inspect", "1.14 Transmission Oil",
        "1.15 Work Lights", "1.16 Battery & Cables",
        "2.1 Engine Oil Level", "2.2 Engine Coolant Level",
        "2.3 Check Radiator Cores for Debris", "2.4 Inspect Hoses for Cracks or Leaks",
        "2.5 Primary/secondary fuel filters", "2.6 All Belts",
        "2.7 Air Cleaner and Air Filter Service Indicator", "2.8 Overall Engine Compartment",
        "3.1 Steps & Handrails", "3.2 ROPS/FOPS", "3.3 Fire Extinguisher",
        "3.4 Windshield wipers and washers", "3.5 Side Doors",
        "4.1 Seat", "4.2 Seat belt and mounting", "4.3 Horn", "4.4 Backup Alarm",
        "4.5 Windows and Mirrors", "4.6 Cab Air Filter", "4.7 Indicators & Gauges",
        "4.8 Switch functionality", "4.9 Overall Cab Interior"
    ];
    const missedItems = allItems.filter(item => !checklistState[item]);

    const confidenceClass = (confidenceLabel || 'LOW').toLowerCase();

    const gradeEmoji = {
        'Green': '✅',
        'Yellow': '⚠️',
        'Red': '🚨',
    };

    return (
        <div className="live-feedback">
            {/* Top bar: Component ID + confidence */}
            <div className="lf-top-bar">
                {isNone ? (
                    <div className="lf-component-tag lf-none">
                        <span className="lf-icon">🔍</span>
                        <span className="lf-component-name">Point at a component</span>
                    </div>
                ) : (
                    <div className={`lf-component-tag lf-${confidenceClass}`}>
                        <span className="lf-icon">🎯</span>
                        <span className="lf-component-name">{checklistItem}</span>
                        <span className={`lf-confidence-badge lf-badge-${confidenceClass}`}>
                            {confidenceLabel} {Math.round((confidence || 0) * 100)}%
                        </span>
                    </div>
                )}

                {/* Already inspected warning */}
                {alreadyInspected && (
                    <div className="lf-already-badge">
                        {gradeEmoji[existingGrade] || '✓'} Already: {existingGrade}
                    </div>
                )}
            </div>

            {/* Center: Guidance hint (fades in/out) */}
            {guidance && confidenceLabel !== 'HIGH' && (
                <div className={`lf-guidance ${guidanceVisible ? 'visible' : 'hidden'}`}>
                    <span className="lf-guidance-icon">💡</span>
                    <span className="lf-guidance-text">{guidance}</span>
                </div>
            )}

            {/* Bottom: Missed items ticker */}
            <div className="lf-bottom-bar">
                <div className="lf-progress-summary">
                    <span className="lf-progress-count">{itemsInspected || 0}/{allItems.length}</span>
                    <span className="lf-progress-label">inspected</span>
                </div>
                <div className="lf-missed-ticker">
                    {missedItems.slice(0, 6).map((item, i) => (
                        <span key={i} className="lf-missed-chip">{item.split(' ').slice(1).join(' ')}</span>
                    ))}
                    {missedItems.length > 6 && (
                        <span className="lf-missed-more">+{missedItems.length - 6} more</span>
                    )}
                </div>
            </div>
        </div>
    );
}
