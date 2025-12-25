import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SettingNumberInputProps {
    label: string;
    description?: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    disabled?: boolean;
}

export function SettingNumberInput({ label, description, value, onChange, min, max, disabled }: SettingNumberInputProps) {
    return (
        <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
                <Label className="text-sm font-medium">{label}</Label>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
            <Input
                type="number"
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value, 10))}
                min={min}
                max={max}
                disabled={disabled}
                className="w-24"
            />
        </div>
    );
}
