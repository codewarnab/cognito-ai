import React from 'react';
import { X, Code } from 'lucide-react';
import { useCodeModeStore } from '@/stores';
import { cn } from '@/lib/utils';

interface ElementContextChipProps {
    className?: string;
}

export const ElementContextChip: React.FC<ElementContextChipProps> = ({ className }) => {
    const elementContext = useCodeModeStore((state) => state.elementContext);
    const clearElementContext = useCodeModeStore((state) => state.clearElementContext);

    if (!elementContext) return null;

    return (
        <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] max-w-full',
            className
        )}>
            <div className="flex items-center justify-center p-1 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] shrink-0">
                <Code className="h-3.5 w-3.5" />
            </div>

            <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-semibold text-[var(--color-primary)] font-mono truncate">
                        {elementContext.tagName}
                    </span>
                    {elementContext.selector && (
                        <span className="text-[10px] text-[var(--text-muted)] truncate font-mono opacity-80" title={elementContext.selector}>
                            {elementContext.selector.length > 30
                                ? '...' + elementContext.selector.slice(-30)
                                : elementContext.selector}
                        </span>
                    )}
                </div>

                {elementContext.textPreview && (
                    <span className="text-[10px] text-[var(--text-secondary)] truncate">
                        "{elementContext.textPreview}"
                    </span>
                )}
            </div>

            <button
                type="button"
                onClick={clearElementContext}
                className="shrink-0 p-1 hover:bg-[var(--bg-hover)] rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Remove element context"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );
};
