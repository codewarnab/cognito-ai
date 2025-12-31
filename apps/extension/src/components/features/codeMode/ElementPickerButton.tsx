import React from 'react';
import { Crosshair } from 'lucide-react';
import { useCodeModeStore } from '@/stores';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/primitives/tooltip';

interface ElementPickerButtonProps {
    className?: string;
}

export const ElementPickerButton: React.FC<ElementPickerButtonProps> = ({ className }) => {
    const isPicking = useCodeModeStore((state) => state.isPicking);
    const startPicker = useCodeModeStore((state) => state.startPicker);

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'h-8 w-8 flex items-center justify-center rounded-md cursor-pointer',
                        'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
                        'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                        isPicking && 'text-[var(--color-primary)] bg-[var(--bg-hover)]',
                        className
                    )}
                    onClick={startPicker}
                    disabled={isPicking}
                >
                    <Crosshair className="h-4 w-4" />
                </button>
            </TooltipTrigger>
            <TooltipContent>
                Pick an element on the page
            </TooltipContent>
        </Tooltip>
    );
};
