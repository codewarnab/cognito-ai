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
                className={`mt-1 pl-0 ml-0 overflow-hidden data-[state=open]:animate-in data-[state=open]:slide-in-from-top-1 data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-top-1 data-[state=closed]:fade-out duration-200 ease-out ${className}`}
                {...props}
            >
                {children}
            </Collapsible.Content>
        </Collapsible.Root>
    );
});

ChainOfThoughtContent.displayName = 'ChainOfThoughtContent';
