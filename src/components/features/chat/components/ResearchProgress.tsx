/**
 * Research progress indicator
 * Shows when the research workflow is actively gathering information
 */

import React from 'react';
import { SearchIcon } from '../../../assets/chat/search';

interface ResearchProgressProps {
    message?: string;
}

export function ResearchProgress({ message = 'Researching...' }: ResearchProgressProps) {
    return (
        <div className="research-progress">
            <div className="research-progress-icon">
                <SearchIcon size={16} />
            </div>
            <div className="research-progress-text">{message}</div>
            <div className="research-progress-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    );
}
