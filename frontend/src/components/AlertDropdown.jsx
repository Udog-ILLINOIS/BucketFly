import { useState, useEffect } from 'react';
import './AlertDropdown.css';

/**
 * Global iOS-style notification for critical AI findings.
 * Slides down from top, persists for 6s or until dismissed.
 */
export function AlertDropdown({ notification, onAction, onDismiss }) {
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (notification) {
            setIsVisible(true);
            setIsClosing(false);
            
            // Auto-dismiss after 8 seconds if not a CLARIFY status
            if (notification.status !== 'CLARIFY') {
                const timer = setTimeout(() => {
                    handleDismiss();
                }, 8000);
                return () => clearTimeout(timer);
            }
        }
    }, [notification]);

    const handleDismiss = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsVisible(false);
            if (onDismiss) onDismiss();
        }, 400);
    };

    const handleAction = () => {
        if (onAction) onAction(notification);
        handleDismiss();
    };

    if (!isVisible || !notification) return null;

    const { status, message, component } = notification;
    
    const statusIcons = {
        'FAIL': '🚨',
        'CLARIFY': '⚠️',
        'MONITOR': '🔍'
    };

    const statusLabels = {
        'FAIL': 'CRITICAL FAILURE',
        'CLARIFY': 'CLARIFICATION NEEDED',
        'MONITOR': 'MONITOR ITEM'
    };

    return (
        <div className={`alert-wrapper ${isClosing ? 'slide-up' : 'slide-down'}`}>
            <div className={`alert-dropdown status-${status.toLowerCase()}`}>
                <div className="alert-main">
                    <div className="alert-icon-ring">
                        <span className="alert-icon-emoji">{statusIcons[status] || '📋'}</span>
                    </div>
                    
                    <div className="alert-body">
                        <div className="alert-top-row">
                            <span className="alert-label">{statusLabels[status]}</span>
                            <span className="alert-component">{component}</span>
                        </div>
                        <div className="alert-message">{message}</div>
                    </div>
                </div>

                <div className="alert-footer">
                    <button className="alert-btn primary" onClick={handleAction}>
                        {status === 'CLARIFY' ? 'HOLD TO ANSWER' : 'VIEW REPORT'}
                    </button>
                    <button className="alert-btn secondary" onClick={handleDismiss}>
                        DISMISS
                    </button>
                </div>
            </div>
        </div>
    );
}
