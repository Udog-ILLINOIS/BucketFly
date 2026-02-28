import { useState } from 'react';
import './AlertDropdown.css';

/**
 * Slides down from the top of screen when AI returns CLARIFY status.
 * Shows the AI's specific clarification question and a button to record a follow-up.
 *
 * Props:
 *   question {string} - The AI's clarification question (e.g., "Is that staining wet or dry?")
 *   onStartClarification {function} - Called when operator taps "Tap to respond"
 *   onDismiss {function} - Called after close animation completes
 */
export function AlertDropdown({ question, onStartClarification, onDismiss }) {
    const [isClosing, setIsClosing] = useState(false);

    const handleDismiss = () => {
        setIsClosing(true);
        setTimeout(() => {
            if (onDismiss) onDismiss();
        }, 300); // match CSS animation duration
    };

    const handleRespond = () => {
        setIsClosing(true);
        setTimeout(() => {
            if (onStartClarification) onStartClarification();
        }, 300);
    };

    return (
        <div className={`alert-dropdown ${isClosing ? 'closing' : ''}`}>
            <div className="alert-icon">?</div>
            <div className="alert-content">
                <div className="alert-label">AI needs clarification</div>
                <div className="alert-question">{question || 'Please record a follow-up to clarify.'}</div>
            </div>
            <div className="alert-actions">
                <button className="alert-record-btn" onClick={handleRespond}>
                    Tap to respond
                </button>
                <button className="alert-dismiss-btn" onClick={handleDismiss}>
                    Dismiss
                </button>
            </div>
        </div>
    );
}
