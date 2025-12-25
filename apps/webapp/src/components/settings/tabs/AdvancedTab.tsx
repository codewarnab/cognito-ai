import { SupermemorySettings } from "@cognito/shared";
import { extensionAPI } from "@/lib/extension-api";
import { SettingSwitch } from "@/components/settings/shared/SettingSwitch";
import { SettingsSection } from "@/components/settings/shared/SettingsSection";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface AdvancedTabProps {
    supermemorySettings: SupermemorySettings | null;
    setSupermemorySettings: (settings: SupermemorySettings) => void;
    updateSetting: <T>(apiCall: () => Promise<{ success: boolean; error?: string }>, onSuccess: () => void) => Promise<boolean>;
}

export function AdvancedTab({
    supermemorySettings,
    setSupermemorySettings,
    updateSetting
}: AdvancedTabProps) {
    return (
        <div className="space-y-6">
            {/* Supermemory Integration */}
            {supermemorySettings && (
                <SettingsSection title="Supermemory" description="Configure persistent memory integration">
                    <div className="space-y-4">
                        <SettingSwitch
                            label="Enable Supermemory"
                            description="Enable persistent memory across conversations"
                            checked={supermemorySettings.enabled}
                            onCheckedChange={async (checked) => {
                                setSupermemorySettings({ ...supermemorySettings, enabled: checked });
                                return updateSetting(
                                    () => extensionAPI.setSupermemorySettings({ enabled: checked }),
                                    () => { }
                                );
                            }}
                        />
                        <div>
                            <Label className="text-sm font-medium">API Key</Label>
                            <Input
                                type="password"
                                placeholder="Enter your Supermemory API key"
                                value={supermemorySettings.apiKey || ""}
                                onChange={(e) => {
                                    setSupermemorySettings({ ...supermemorySettings, apiKey: e.target.value });
                                }}
                                onBlur={() => {
                                    updateSetting(
                                        () => extensionAPI.setSupermemorySettings({ apiKey: supermemorySettings.apiKey }),
                                        () => { }
                                    );
                                }}
                                className="mt-1.5"
                            />
                        </div>
                        <SettingSwitch
                            label="Auto-Extract Insights"
                            description="Automatically learn from your conversations"
                            checked={supermemorySettings.autoExtraction}
                            onCheckedChange={async (checked) => {
                                setSupermemorySettings({ ...supermemorySettings, autoExtraction: checked });
                                return updateSetting(
                                    () => extensionAPI.setSupermemorySettings({ autoExtraction: checked }),
                                    () => { }
                                );
                            }}
                        />
                    </div>
                </SettingsSection>
            )}
        </div>
    );
}
