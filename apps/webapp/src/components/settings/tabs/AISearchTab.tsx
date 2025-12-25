import { useState, useMemo } from "react";
import {
    AIConfigSettings,
    SearchSettingsWithKeys,
    ResearchWorkflowSettings,
    TTSSettings,
    WEB_SEARCH_SELF_API_KEY_HIDDEN,
} from "@cognito/shared";
import { extensionAPI } from "@/lib/extension-api";
import { SettingNumberInput } from "@/components/settings/shared/SettingNumberInput";
import { SettingSwitch } from "@/components/settings/shared/SettingSwitch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AnimatedAccordion } from "@/components/shared/AnimatedAccordion";
import { HighlightedText } from "@/components/shared/HighlightedText";
import { accordionMatchesQuery } from "@/components/settings/shared/settingsSearchData";

interface AISearchTabProps {
    aiConfig: AIConfigSettings;
    setAIConfig: (config: AIConfigSettings) => void;
    searchSettings: SearchSettingsWithKeys | null;
    setSearchSettings: (settings: SearchSettingsWithKeys) => void;
    researchSettings: ResearchWorkflowSettings | null;
    setResearchSettings: (settings: ResearchWorkflowSettings) => void;
    updateSetting: <T>(apiCall: () => Promise<{ success: boolean; error?: string }>, onSuccess: () => void) => Promise<boolean>;
    handleDeleteAllChats: () => void;
    ttsSettings: TTSSettings | null;
    setTTSSettings: (settings: TTSSettings) => void;
    searchQuery?: string;
    forcedOpenSections?: Set<string>;
}

export function AISearchTab({
    aiConfig,
    setAIConfig,
    searchSettings,
    setSearchSettings,
    researchSettings,
    setResearchSettings,
    updateSetting,
    handleDeleteAllChats,
    ttsSettings,
    setTTSSettings,
    searchQuery = '',
    forcedOpenSections = new Set()
}: AISearchTabProps) {
    const [manualOpenSection, setManualOpenSection] = useState<string | null>(null);

    // Check if accordion should be visible based on search
    const isAccordionVisible = (accordionId: string) => {
        return accordionMatchesQuery(accordionId, searchQuery);
    };

    // Determine if an accordion is open (either manually or forced by search)
    const isAccordionOpen = (accordionId: string) => {
        if (searchQuery && forcedOpenSections.has(accordionId)) return true;
        return manualOpenSection === accordionId;
    };

    const handleToggle = (accordionId: string) => {
        setManualOpenSection(prev => prev === accordionId ? null : accordionId);
    };

    return (
        <div className="space-y-4">
            {/* AI Behavior Accordion */}
            {isAccordionVisible('ai-behavior') && (
                <AnimatedAccordion
                    title="AI Behavior"
                    description="Configure general AI interaction settings"
                    isOpen={isAccordionOpen('ai-behavior')}
                    onToggle={() => handleToggle('ai-behavior')}
                >
                    <div className="space-y-4">
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
                            searchQuery={searchQuery}
                        />
                        {ttsSettings && (
                            <SettingSwitch
                                label="Show Suggestions"
                                description="Show AI-suggested actions in chat"
                                checked={ttsSettings.suggestionsEnabled}
                                onCheckedChange={async (checked) => {
                                    setTTSSettings({ ...ttsSettings, suggestionsEnabled: checked });
                                    return updateSetting(
                                        () => extensionAPI.setTTSSettings({ suggestionsEnabled: checked }),
                                        () => { }
                                    );
                                }}
                                searchQuery={searchQuery}
                            />
                        )}
                    </div>
                </AnimatedAccordion>
            )}

            {/* Web Search Section */}
            {searchSettings && isAccordionVisible('web-search') && (
                <AnimatedAccordion
                    title="Web Search"
                    description="Configure Tavily search integration"
                    isOpen={isAccordionOpen('web-search')}
                    onToggle={() => handleToggle('web-search')}
                >
                    <div className="space-y-3">
                        {!WEB_SEARCH_SELF_API_KEY_HIDDEN && (
                            <div>
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-medium">
                                        <HighlightedText text="Tavily API Key" searchQuery={searchQuery} />
                                    </Label>
                                    <a
                                        href="https://app.tavily.com/home"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Get your API key
                                    </a>
                                </div>
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
                        )}
                        <div className="grid grid-cols-2 gap-4">
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
                                searchQuery={searchQuery}
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
                                searchQuery={searchQuery}
                            />
                        </div>
                    </div>
                </AnimatedAccordion>
            )}

            {/* Research Workflow Section */}
            {researchSettings && isAccordionVisible('research') && (
                <AnimatedAccordion
                    title="Research Workflow"
                    description="Configure automated research behavior"
                    isOpen={isAccordionOpen('research')}
                    onToggle={() => handleToggle('research')}
                >
                    <div className="grid grid-cols-2 gap-4">
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
                            searchQuery={searchQuery}
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
                            searchQuery={searchQuery}
                        />
                    </div>
                </AnimatedAccordion>
            )}
        </div>
    );
}
