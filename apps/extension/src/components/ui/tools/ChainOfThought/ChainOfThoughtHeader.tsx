/**
 * ChainOfThoughtHeader Component
 * 
 * Collapsible header trigger with chevron indicator
 */

import { memo, type ComponentProps } from 'react';
import { useChainOfThought } from './ChainOfThought';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import { YouTubeNotionIcon } from '@assets/icons/ui/youtubeplusnotion';

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
                className={`flex w-full items-center gap-2 py-[6px] border-none bg-transparent text-[var(--text-secondary)] text-[14px] cursor-pointer transition-colors duration-200 ease-out select-none hover:text-[var(--text-primary)] ${className}`}
                {...props}
            >
                <span className="shrink-0 flex items-center justify-center"><YouTubeNotionIcon style={{ width: '24px', height: '24px' }} /></span>
                <span className="flex-1 text-left font-normal">
                    {children ?? 'Chain of Thought'}
                </span>
                <ChevronDown className={`shrink-0 transition-transform duration-200 ease-out text-[var(--text-tertiary)] ${isOpen ? 'rotate-180' : ''}`} size={16} />
            </Collapsible.Trigger>
        </Collapsible.Root>
    );
});

ChainOfThoughtHeader.displayName = 'ChainOfThoughtHeader';
