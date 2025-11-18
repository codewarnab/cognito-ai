/**
 * ChainOfThought Component
 * 
 * Collapsible container for displaying AI reasoning steps
 * Uses Radix UI primitives for accessibility and smooth animations
 */

import { useControllableState } from '@radix-ui/react-use-controllable-state';
import { createContext, useContext, useMemo, memo, type ComponentProps } from 'react';

type ChainOfThoughtContextValue = {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
};

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(null);

const useChainOfThought = () => {
    const context = useContext(ChainOfThoughtContext);
    if (!context) {
        throw new Error('ChainOfThought components must be used within ChainOfThought');
    }
    return context;
};

export type ChainOfThoughtProps = ComponentProps<'div'> & {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
};

export const ChainOfThought = memo(({
    className = '',
    open,
    defaultOpen = true,
    onOpenChange,
    children,
    ...props
}: ChainOfThoughtProps) => {
    const [isOpen, setIsOpen] = useControllableState({
        prop: open,
        defaultProp: defaultOpen,
        onChange: onOpenChange,
    });

    const chainOfThoughtContext = useMemo(
        () => ({ isOpen, setIsOpen }),
        [isOpen, setIsOpen]
    );

    return (
        <ChainOfThoughtContext.Provider value={chainOfThoughtContext}>
            <div className={`chain-of-thought ${className}`} {...props}>
                {children}
            </div>
        </ChainOfThoughtContext.Provider>
    );
});

ChainOfThought.displayName = 'ChainOfThought';

// Export hook for internal use
export { useChainOfThought };
