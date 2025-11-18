/**
 * ChainOfThoughtContent Component
 * 
 * Collapsible content wrapper with smooth animations
 */

import { memo, type ComponentProps } from 'react';
import { useChainOfThought } from './ChainOfThought';
import * as Collapsible from '@radix-ui/react-collapsible';

export type ChainOfThoughtContentProps = ComponentProps<typeof Collapsible.Content>;

export const ChainOfThoughtContent = memo(({
    className = '',
    children,
    ...props
}: ChainOfThoughtContentProps) => {
    const { isOpen } = useChainOfThought();

    return (
        <Collapsible.Root open={isOpen}>
            <Collapsible.Content
                className={`chain-of-thought-content ${className}`}
                {...props}
            >
                {children}
            </Collapsible.Content>
        </Collapsible.Root>
    );
});

ChainOfThoughtContent.displayName = 'ChainOfThoughtContent';
