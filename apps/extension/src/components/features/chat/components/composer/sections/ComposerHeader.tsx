import React from 'react';
import { ModelSelectorPopover } from '../ModelSelectorPopover';

/**
 * ComposerHeader
 *
 * Sits above the chat input. This is the new home for the unified "Brain" selector
 * (cloud providers + CLI bridge providers).
 */
export const ComposerHeader: React.FC = () => {
    return (
        <div className="flex items-center justify-start pb-2">
            <ModelSelectorPopover />
        </div>
    );
};

