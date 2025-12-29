import { useState, useMemo } from "react";
import { SupermemorySettings, HIDE_AUTO_EXTRACT_INSIGHTS } from "@cognito/shared";
import { extensionAPI } from "@/lib/extension-api";
import { SettingSwitch } from "@/components/settings/shared/SettingSwitch";
import { AnimatedAccordion } from "@/components/shared/AnimatedAccordion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { HighlightedText } from "@/components/shared/HighlightedText";
import { accordionMatchesQuery } from "@/components/settings/shared/settingsSearchData";
import { Check } from "lucide-react";

interface AdvancedTabProps {
    supermemorySettings: SupermemorySettings | null;
    setSupermemorySettings: (settings: SupermemorySettings) => void;
    updateSetting: <T>(apiCall: () => Promise<{ success: boolean; error?: string }>, onSuccess: () => void) => Promise<boolean>;
    searchQuery?: string;
    forcedOpenSections?: Set<string>;
}

export function AdvancedTab({
    supermemorySettings,
    setSupermemorySettings,
    updateSetting,
    searchQuery = '',
    forcedOpenSections = new Set()
}: AdvancedTabProps) {
    const [manualOpen, setManualOpen] = useState(false);
    const [apiKeySaved, setApiKeySaved] = useState(false);

    const isVisible = accordionMatchesQuery('supermemory', searchQuery);

    const isOpen = useMemo(() => {
        if (searchQuery && forcedOpenSections.has('supermemory')) return true;
        return manualOpen;
    }, [forcedOpenSections, manualOpen, searchQuery]);

    if (!isVisible) return null;

    return (
        <div className="space-y-6">
            {/* Supermemory Integration */}
            {supermemorySettings && (
                <AnimatedAccordion
                    title="Supermemory"
                    description="Configure persistent memory integration"
                    isOpen={isOpen}
                    onToggle={() => setManualOpen(!manualOpen)}
                >
                    <div className="space-y-4">
                        <SettingSwitch
                            label="Enable Supermemory"
                            description="Enable persistent memory across conversations"
                            checked={supermemorySettings.enabled}
                            disabled={!supermemorySettings.apiKey}
                            onCheckedChange={async (checked) => {
                                setSupermemorySettings({ ...supermemorySettings, enabled: checked });
                                return updateSetting(
                                    () => extensionAPI.setSupermemorySettings({ enabled: checked }),
                                    () => { }
                                );
                            }}
                            searchQuery={searchQuery}
                        />
                        <div>
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">
                                    <HighlightedText text="API Key" searchQuery={searchQuery} />
                                </Label>
                                {apiKeySaved && (
                                    <span className="flex items-center gap-1 text-xs text-lime-500 animate-in fade-in slide-in-from-right-1 duration-200">
                                        <Check size={12} strokeWidth={3} />
                                        Saved
                                    </span>
                                )}
                            </div>
                            <Input
                                type="password"
                                placeholder="Enter your Supermemory API key"
                                value={supermemorySettings.apiKey || ""}
                                onChange={(e) => {
                                    setSupermemorySettings({ ...supermemorySettings, apiKey: e.target.value });
                                }}
                                onBlur={async () => {
                                    const success = await updateSetting(
                                        () => extensionAPI.setSupermemorySettings({ apiKey: supermemorySettings.apiKey }),
                                        () => { }
                                    );
                                    if (success) {
                                        setApiKeySaved(true);
                                        setTimeout(() => setApiKeySaved(false), 2000);
                                    }
                                }}
                                className="mt-1.5"
                            />
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <a
                                    href="https://console.supermemory.ai"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:underline hover:text-primary transition-colors"
                                >
                                    Get your API key
                                </a>
                                <span>•</span>
                                <a
                                    href="https://console.supermemory.ai"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:underline hover:text-primary transition-colors"
                                >
                                    Supermemory Console
                                </a>
                            </div>
                        </div>
                        {!HIDE_AUTO_EXTRACT_INSIGHTS && (
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
                                searchQuery={searchQuery}
                            />
                        )}
                    </div>
                </AnimatedAccordion>
            )}
        </div>
    );
}
