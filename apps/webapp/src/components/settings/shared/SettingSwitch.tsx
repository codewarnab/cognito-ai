import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface SettingSwitchProps {
    label: string;
    description?: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
}

export function SettingSwitch({ label, description, checked, onCheckedChange, disabled }: SettingSwitchProps) {
    return (
        <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
                <Label className="text-sm font-medium">{label}</Label>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
            <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
        </div>
    );
}
