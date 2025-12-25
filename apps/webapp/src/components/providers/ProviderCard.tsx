'use client';

import { cn } from "@/lib/utils";
import type { AIProvider } from "@cognito/shared";

interface ProviderCardProps {
    provider: AIProvider;
    selected: boolean;
    onSelect: () => void;
    title: string;
    description: string;
    disabled?: boolean;
}

export function ProviderCard({
    provider,
    selected,
    onSelect,
    title,
    description,
    disabled = false,
}: ProviderCardProps) {
    return (
        <label
            className={cn(
                "flex-1 flex items-center p-4 border-2 rounded-lg cursor-pointer bg-card transition-all duration-200",
                "hover:bg-accent/50 hover:border-accent",
                selected && "border-primary bg-primary/5",
                !selected && "border-border",
                disabled && "opacity-50 cursor-not-allowed"
            )}
        >
            <input
                type="radio"
                name="provider"
                value={provider}
                checked={selected}
                onChange={onSelect}
                disabled={disabled}
                className="mr-3 cursor-pointer"
            />
            <div>
                <div className="font-medium text-foreground">{title}</div>
                <div className="text-xs text-muted-foreground">{description}</div>
            </div>
        </label>
    );
}
