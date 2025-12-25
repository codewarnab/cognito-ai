import { useState, useRef, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Check } from "lucide-react";

interface SettingSwitchProps {
    label: string;
    description?: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => Promise<boolean> | void;
    disabled?: boolean;
}

export function SettingSwitch({ label, description, checked, onCheckedChange, disabled }: SettingSwitchProps) {
    const [showSaved, setShowSaved] = useState(false);
    const [saveKey, setSaveKey] = useState(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleChange = useCallback(async (newValue: boolean) => {
        const result = onCheckedChange(newValue);

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
    }, [onCheckedChange]);

    return (
        <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
                <Label className="text-sm font-medium">{label}</Label>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
            <div className="flex items-center gap-2">
                {showSaved && (
                    <span key={saveKey} className="flex items-center gap-1 text-xs text-green-500 animate-fade-in">
                        <Check className="h-3 w-3" />
                        Saved
                    </span>
                )}
                <Switch checked={checked} onCheckedChange={handleChange} disabled={disabled} />
            </div>
        </div>
    );
}
