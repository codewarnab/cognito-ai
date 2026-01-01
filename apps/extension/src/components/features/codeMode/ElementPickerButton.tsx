import React from 'react';
import { Crosshair, X } from 'lucide-react';
import { useCodeModeStore } from '@/stores';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/primitives/tooltip';

interface ElementPickerButtonProps {
    className?: string;
}

export const ElementPickerButton: React.FC<ElementPickerButtonProps> = ({ className }) => {
    const isPicking = useCodeModeStore((state) => state.isPicking);
    const startPicker = useCodeModeStore((state) => state.startPicker);
    const cancelPicker = useCodeModeStore((state) => state.cancelPicker);

    const handleClick = () => {
        if (isPicking) {
            cancelPicker();
        } else {
            startPicker();
        }
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'h-8 w-8 flex items-center justify-center rounded-md cursor-pointer',
                        'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
                        'transition-colors',
                        isPicking && 'text-[var(--color-primary)] bg-[var(--bg-hover)]',
                        className
                    )}
                    onClick={handleClick}
                >
                    {isPicking ? (
                        <X className="h-4 w-4" />
                    ) : (
                        <Crosshair className="h-4 w-4" />
                    )}
                </button>
            </TooltipTrigger>
            <TooltipContent>
                {isPicking ? 'Cancel element selection' : 'Pick an element on the page'}
            </TooltipContent>
        </Tooltip>
    );
};
