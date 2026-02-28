import React from 'react';
import './ClarificationView.css';

export function ClarificationView({ clarifications, onRecordAgain }) {
    return (
        <div className="clarification-view">
            <div className="clarification-header">
                <h2>I Need More Information</h2>
                <p>To complete the safety report, please provide better views of the following:</p>
            </div>

            <ul className="clarification-list">
                {clarifications.map((item, index) => (
                    <li key={index} className="clarification-item">
                        <span className="bullet">•</span>
                        <span>{item}</span>
                    </li>
                ))}
            </ul>

            <button className="record-again-btn" onClick={onRecordAgain}>
                <span className="cam-icon">📷</span> Record Again
            </button>
        </div>
    );
}
