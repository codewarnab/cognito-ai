import {
    AIConfigSettings,
    SearchSettingsWithKeys,
    ResearchWorkflowSettings
} from "@cognito/shared";
import { extensionAPI } from "@/lib/extension-api";
import { SettingNumberInput } from "@/components/settings/shared/SettingNumberInput";
import { SettingSwitch } from "@/components/settings/shared/SettingSwitch";
import { SettingsSection } from "@/components/settings/shared/SettingsSection";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface AISearchTabProps {
    aiConfig: AIConfigSettings;
    setAIConfig: (config: AIConfigSettings) => void;
    searchSettings: SearchSettingsWithKeys | null;
    setSearchSettings: (settings: SearchSettingsWithKeys) => void;
    researchSettings: ResearchWorkflowSettings | null;
    setResearchSettings: (settings: ResearchWorkflowSettings) => void;
    updateSetting: <T>(apiCall: () => Promise<{ success: boolean; error?: string }>, onSuccess: () => void) => Promise<boolean>;
    handleDeleteAllChats: () => void;
}

export function AISearchTab({
    aiConfig,
    setAIConfig,
    searchSettings,
    setSearchSettings,
    researchSettings,
    setResearchSettings,
    updateSetting,
    handleDeleteAllChats
}: AISearchTabProps) {
    return (
        <div className="space-y-6">
            {/* AI Configuration */}
            <SettingsSection title="AI Behavior" description="Configure how the AI assistant operates">
                <SettingNumberInput
                    label="Maximum Tool Calls"
                    description="Limit how many actions the AI can take per response (1-50)"
                    value={aiConfig.maxToolCallLimit}
                    onChange={async (value) => {
                        const clamped = Math.max(1, Math.min(50, value));
                        setAIConfig({ ...aiConfig, maxToolCallLimit: clamped });
                        return updateSetting(
                            () => extensionAPI.setAIConfig({ maxToolCallLimit: clamped }),
                            () => { }
                        );
                    }}
                    min={1}
                    max={50}
                />
            </SettingsSection>

            {/* Web Search */}
            {searchSettings && (
                <SettingsSection title="Web Search" description="Configure Tavily search integration">
                    <div className="space-y-4">
                        <div>
                            <Label className="text-sm font-medium">Tavily API Key</Label>
                            <Input
                                type="password"
                                placeholder="Enter your Tavily API key"
                                value={searchSettings.apiKeys?.tavily || ""}
                                onChange={(e) => {
                                    const newApiKeys = { ...searchSettings.apiKeys, tavily: e.target.value };
                                    setSearchSettings({ ...searchSettings, apiKeys: newApiKeys });
                                }}
                                onBlur={() => {
                                    updateSetting(
                                        () => extensionAPI.setSearchSettings({ apiKeys: searchSettings.apiKeys }),
                                        () => { }
                                    );
                                }}
                                className="mt-1.5"
                            />
                        </div>
                        <SettingNumberInput
                            label="Maximum Results"
                            description="Number of search results to return"
                            value={searchSettings.maxResults}
                            onChange={async (value) => {
                                setSearchSettings({ ...searchSettings, maxResults: value });
                                return updateSetting(
                                    () => extensionAPI.setSearchSettings({ maxResults: value }),
                                    () => { }
                                );
                            }}
                            min={1}
                            max={20}
                        />
                        <SettingSwitch
                            label="Include Images"
                            description="Include image results in search"
                            checked={searchSettings.includeImages}
                            onCheckedChange={async (checked) => {
                                setSearchSettings({ ...searchSettings, includeImages: checked });
                                return updateSetting(
                                    () => extensionAPI.setSearchSettings({ includeImages: checked }),
                                    () => { }
                                );
                            }}
                        />
                    </div>
                </SettingsSection>
            )}

            {/* Research Workflow */}
            {researchSettings && (
                <SettingsSection title="Research Workflow" description="Configure automated research behavior">
                    <div className="space-y-4">
                        <SettingNumberInput
                            label="Minimum Sources"
                            description="Minimum sources to visit before completing research"
                            value={researchSettings.minimumSources}
                            onChange={async (value) => {
                                setResearchSettings({ ...researchSettings, minimumSources: value });
                                return updateSetting(
                                    () => extensionAPI.setResearchSettings({ minimumSources: value }),
                                    () => { }
                                );
                            }}
                            min={1}
                            max={20}
                        />
                        <SettingNumberInput
                            label="Maximum Steps"
                            description="Maximum steps allowed for research"
                            value={researchSettings.stepCount}
                            onChange={async (value) => {
                                setResearchSettings({ ...researchSettings, stepCount: value });
                                return updateSetting(
                                    () => extensionAPI.setResearchSettings({ stepCount: value }),
                                    () => { }
                                );
                            }}
                            min={5}
                            max={100}
                        />
                    </div>
                </SettingsSection>
            )}

            {/* Danger Zone */}
            <div className="rounded-lg border border-destructive/30 overflow-hidden">
                <div className="bg-destructive/5 px-5 py-3 border-b border-destructive/20">
                    <h3 className="text-sm font-medium text-destructive flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        Danger Zone
                    </h3>
                </div>
                <div className="p-5 bg-[var(--bg-secondary)]/50">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h4 className="text-sm font-medium text-[var(--text-primary)]">Delete All Data</h4>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                Permanently remove all chat history and local data
                            </p>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteAllChats}
                            className="shrink-0"
                        >
                            Delete All
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
