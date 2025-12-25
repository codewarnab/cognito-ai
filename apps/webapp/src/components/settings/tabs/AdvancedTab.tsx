import { SupermemorySettings } from "@cognito/shared";
import { extensionAPI } from "@/lib/extension-api";
import { SettingSwitch } from "@/components/settings/shared/SettingSwitch";
import { SettingsSection } from "@/components/settings/shared/SettingsSection";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface AdvancedTabProps {
    supermemorySettings: SupermemorySettings | null;
    setSupermemorySettings: (settings: SupermemorySettings) => void;
    updateSetting: <T>(apiCall: () => Promise<{ success: boolean; error?: string }>, onSuccess: () => void) => Promise<void>;
    handleDeleteAllChats: () => void;
}

export function AdvancedTab({
    supermemorySettings,
    setSupermemorySettings,
    updateSetting,
    handleDeleteAllChats
}: AdvancedTabProps) {
    return (
        <div className="space-y-4">
            {/* Supermemory Integration */}
            {supermemorySettings && (
                <SettingsSection title="Supermemory" description="Configure persistent memory integration" defaultOpen>
                    <SettingSwitch
                        label="Enable Supermemory"
                        description="Enable persistent memory across conversations"
                        checked={supermemorySettings.enabled}
                        onCheckedChange={(checked) => {
                            setSupermemorySettings({ ...supermemorySettings, enabled: checked });
                            updateSetting(
                                () => extensionAPI.setSupermemorySettings({ enabled: checked }),
                                () => {}
                            );
                        }}
                    />
                    <Separator />
                    <div className="py-3">
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
                                    () => {}
                                );
                            }}
                            className="mt-2"
                        />
                    </div>
                    <Separator />
                    <SettingSwitch
                        label="Auto-Extract Insights"
                        description="Automatically learn from your conversations"
                        checked={supermemorySettings.autoExtraction}
                        onCheckedChange={(checked) => {
                            setSupermemorySettings({ ...supermemorySettings, autoExtraction: checked });
                            updateSetting(
                                () => extensionAPI.setSupermemorySettings({ autoExtraction: checked }),
                                () => {}
                            );
                        }}
                    />
                </SettingsSection>
            )}

            {/* Danger Zone */}
            <div className="border border-destructive/20 rounded-lg overflow-hidden">
                <div className="bg-destructive/10 p-4 border-b border-destructive/10">
                    <h3 className="font-semibold text-destructive flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        Danger Zone
                    </h3>
                </div>
                <div className="p-4 bg-[var(--bg-secondary)]">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-[var(--text-primary)]">Delete All Data</h4>
                            <p className="text-sm text-muted-foreground">Permanently remove all chat history and local data</p>
                        </div>
                        <Button variant="destructive" onClick={handleDeleteAllChats}>
                            Delete All Data
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
