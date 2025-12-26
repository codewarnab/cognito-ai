import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Supermemory } from '@assets/brands/integrations/Supermemory';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/primitives/tooltip/Tooltip';

interface SupermemoryGatedIconProps {
    showTooltip: boolean;
    onToggleTooltip: (show: boolean) => void;
}

export const SupermemoryGatedIcon: React.FC<SupermemoryGatedIconProps> = ({
    showTooltip,
    onToggleTooltip,
}) => (
    <Tooltip open={showTooltip} onOpenChange={onToggleTooltip} delayDuration={0}>
        <TooltipTrigger asChild>
            <div
                style={{ display: 'inline-flex', cursor: 'pointer' }}
                onClick={(e) => {
                    e.stopPropagation();
                    // Keep explicit click behavior to ensure it works as expected for user interaction
                    onToggleTooltip(!showTooltip);
                }}
            >
                <AlertCircle
                    size={12}
                    style={{ color: 'var(--text-warning)' }}
                />
            </div>
        </TooltipTrigger>
        <TooltipContent
            side="top"
            className="w-[180px] text-center bg-[var(--bg-primary)] border-[var(--border-color)]"
            sideOffset={8}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '6px',
                gap: '4px'
            }}>
                <Supermemory style={{ width: 14, height: 14 }} />
                <span style={{ fontWeight: 600, fontSize: '11px' }}>Supermemory</span>
            </div>
            <p style={{
                fontSize: '10px',
                color: 'var(--text-secondary)',
                margin: 0,
                lineHeight: '1.4'
            }}>
                Configure API key in Settings to enable
            </p>
        </TooltipContent>
    </Tooltip>
);
