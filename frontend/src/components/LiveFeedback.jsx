import { useState, useEffect, useRef } from 'react';
import { ALL_CHECKLIST_ITEMS, CHECKLIST_TOTAL } from '../constants/checklist';
import './LiveFeedback.css';

/**
 * Speak a message using the Web Speech API.
 * Cancels any in-progress speech before starting.
 */
function speak(text) {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    // Prefer a neutral English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) 
        || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
}

/**
 * Real-time feedback overlay rendered on top of the camera viewfinder.
 * Shows:
 *  - Component detected + confidence badge
 *  - Guidance hints (fade after 3s)
 *  - Missed items count ticker
 *  - Duplicate inspection warning
 *  - TTS: speaks guidance and component identification aloud
 */
export function LiveFeedback({ identification, checklistState, isActive }) {
    const [guidanceVisible, setGuidanceVisible] = useState(false);
    const guidanceTimer = useRef(null);
    const prevGuidance = useRef('');
    const prevSpokenComponent = useRef('');

    // Speak guidance aloud when it changes
    useEffect(() => {
        if (!identification?.guidance) return;
        if (identification.guidance === prevGuidance.current) return;

        prevGuidance.current = identification.guidance;
        
        if (guidanceTimer.current) clearTimeout(guidanceTimer.current);
        
        const outerTimer = setTimeout(() => {
            setGuidanceVisible(true);
            guidanceTimer.current = setTimeout(() => setGuidanceVisible(false), 4000);
        }, 0);

        // Speak the guidance (e.g., "Move closer", "Image not clear")
        const confidenceLabel = identification.confidence_label || 'LOW';
        if (confidenceLabel !== 'HIGH') {
            speak(identification.guidance);
        }

        return () => {
            clearTimeout(outerTimer);
            if (guidanceTimer.current) clearTimeout(guidanceTimer.current);
        };
    }, [identification?.guidance]);

    // Speak component identification when a new HIGH-confidence item is detected
    useEffect(() => {
        if (!identification) return;
        const item = identification.checklist_item;
        const conf = identification.confidence_label;
        if (!item || item === 'None' || conf !== 'HIGH') return;
        if (item === prevSpokenComponent.current) return;
        prevSpokenComponent.current = item;

        const label = item.replace(/^\d+\.\d+\s*/, ''); // strip number prefix
        if (identification.already_inspected) {
            speak(`${label} — already inspected, grade ${identification.existing_grade}`);
        } else {
            speak(`Detected: ${label}`);
        }
    }, [identification?.checklist_item, identification?.confidence_label]);

    // Cancel speech when leaving live view
    useEffect(() => {
        if (!isActive && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    }, [isActive]);

    if (!isActive) return null;

    const {
        checklist_item: checklistItem,
        confidence,
        confidence_label: confidenceLabel,
        guidance,
        already_inspected: alreadyInspected,
        existing_grade: existingGrade,
    } = identification || {};

    const isNone = !checklistItem || checklistItem === 'None';

    const inspectedCount = Object.keys(checklistState).length;
    const inspectedItems = Object.keys(checklistState);

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

            {/* Bottom: Inspected items ticker */}
            <div className="lf-bottom-bar">
                <div className="lf-progress-summary">
                    <span className="lf-progress-count">{inspectedCount}/{CHECKLIST_TOTAL}</span>
                    <span className="lf-progress-label">inspected</span>
                </div>
                {inspectedItems.length > 0 && (
                    <div className="lf-missed-ticker">
                        {inspectedItems.slice(-6).map((item, i) => (
                            <span key={i} className="lf-inspected-chip">
                                {checklistState[item] === 'Green' ? '✅' : checklistState[item] === 'Yellow' ? '⚠️' : checklistState[item] === 'Red' ? '🚨' : '✓'}
                                {' '}{item.replace(/^\d+\.\d+\s*/, '')}
                            </span>
                        ))}
                        {inspectedItems.length > 6 && (
                            <span className="lf-missed-more">+{inspectedItems.length - 6} more</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
