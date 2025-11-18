/**
 * ChainOfThoughtHeader Component
 * 
 * Collapsible header trigger with chevron indicator
 */

import { memo, type ComponentProps } from 'react';
import { useChainOfThought } from './ChainOfThought';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';

export type ChainOfThoughtHeaderProps = ComponentProps<typeof Collapsible.Trigger>;

export const ChainOfThoughtHeader = memo(({
    className = '',
    children,
    ...props
}: ChainOfThoughtHeaderProps) => {
    const { isOpen, setIsOpen } = useChainOfThought();

    return (
        <Collapsible.Root onOpenChange={setIsOpen} open={isOpen}>
            <Collapsible.Trigger
                className={`chain-of-thought-header ${className}`}
                {...props}
            >
                <span className="chain-of-thought-header-icon">🎬</span>
                <span className="chain-of-thought-header-content">
                    {children ?? 'Chain of Thought'}
                </span>
                <ChevronDown className={`chain-of-thought-chevron ${isOpen ? 'open' : ''}`} size={16} />
            </Collapsible.Trigger>
        </Collapsible.Root>
    );
});

ChainOfThoughtHeader.displayName = 'ChainOfThoughtHeader';
