import React from 'react';
import { RobotIcon } from './icons/RobotIcon';

export const EmptyState: React.FC = () => {
    return (
        <div className="copilot-empty-state">
            <div className="copilot-empty-icon">
                <RobotIcon size={48} />
            </div>
            <p>👋 Hi! I'm your autonomous AI assistant.</p>
            <p className="copilot-empty-subtitle">
                I can browse, click, fill forms, manage tabs, and execute tasks end-to-end. Just tell me what you need!
            </p>
        </div>
    );
};
