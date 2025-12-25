import * as React from "react";
import { useState, useRef, useCallback } from "react";
import { NumberField } from "@base-ui-components/react/number-field";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { HighlightedText } from "@/components/shared/HighlightedText";

interface SettingNumberInputProps {
    label: string;
    description?: string;
    value: number;
    onChange: (value: number) => Promise<boolean> | void;
    min?: number;
    max?: number;
    disabled?: boolean;
    searchQuery?: string;
}

export function SettingNumberInput({ label, description, value, onChange, min, max, disabled, searchQuery }: SettingNumberInputProps) {
    const [showSaved, setShowSaved] = useState(false);
    const [saveKey, setSaveKey] = useState(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const id = React.useId();

    const handleChange = useCallback(async (newValue: number | null) => {
        if (newValue === null) return;

        const result = onChange(newValue);

        // If it returns a promise, wait for it
        if (result instanceof Promise) {
            const success = await result;
            if (success) {
                // Clear any existing timeout
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }

                // Trigger animation with a new key to reset it
                setSaveKey(k => k + 1);
                setShowSaved(true);

                // Hide after animation (2s)
                timeoutRef.current = setTimeout(() => {
                    setShowSaved(false);
                }, 2000);
            }
        }
    }, [onChange]);

    return (
        <div className="flex items-center justify-between py-2">
            <div className="space-y-0">
                <Label className="text-sm font-medium">
                    <HighlightedText text={label} searchQuery={searchQuery} />
                </Label>
                {description && (
                    <p className="text-xs text-muted-foreground">
                        <HighlightedText text={description} searchQuery={searchQuery} />
                    </p>
                )}
            </div>
            <div className="flex items-center gap-2">
                {showSaved && (
                    <span key={saveKey} className="flex items-center gap-1 text-xs text-green-500 animate-fade-in">
                        <Check className="h-3 w-3" />
                        Saved
                    </span>
                )}
                <NumberField.Root
                    id={id}
                    value={value}
                    onValueChange={(val) => handleChange(val)}
                    min={min}
                    max={max}
                    disabled={disabled}
                    className="flex flex-col items-start gap-1"
                >
                    <NumberField.Group className="flex">
                        <NumberField.Decrement className="flex size-7 items-center justify-center rounded-l-md border border-[var(--std-200)] bg-[var(--std-50)] text-[var(--std-700)] select-none hover:bg-[var(--std-100)] active:bg-[var(--std-200)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                            <MinusIcon />
                        </NumberField.Decrement>
                        <NumberField.Input className="h-7 w-12 border-t border-b border-[var(--std-200)] text-center text-sm text-[var(--std-900)] tabular-nums bg-white focus:z-10 focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-[var(--std-400)] disabled:opacity-50" />
                        <NumberField.Increment className="flex size-7 items-center justify-center rounded-r-md border border-[var(--std-200)] bg-[var(--std-50)] text-[var(--std-700)] select-none hover:bg-[var(--std-100)] active:bg-[var(--std-200)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                            <PlusIcon />
                        </NumberField.Increment>
                    </NumberField.Group>
                </NumberField.Root>
            </div>
        </div>
    );
}

function PlusIcon(props: React.ComponentProps<"svg">) {
    return (
        <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <path d="M0 5H5M10 5H5M5 5V0M5 5V10" />
        </svg>
    );
}

function MinusIcon(props: React.ComponentProps<"svg">) {
    return (
        <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <path d="M0 5H10" />
        </svg>
    );
}
