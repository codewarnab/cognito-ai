import { useState, useMemo } from "react";
import {
    TextSummarizerSettings,
    TextRewriterSettings,
    WriteCommandSettings
} from "@cognito/shared";
import { extensionAPI } from "@/lib/extension-api";
import { SettingSwitch } from "@/components/settings/shared/SettingSwitch";
import { SettingNumberInput } from "@/components/settings/shared/SettingNumberInput";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import { AnimatedAccordion } from "@/components/shared/AnimatedAccordion";
import { HighlightedText } from "@/components/shared/HighlightedText";
import { accordionMatchesQuery } from "@/components/settings/shared/settingsSearchData";

interface WritingToolsTabProps {
    summarizerSettings: TextSummarizerSettings | null;
    setSummarizerSettings: (settings: TextSummarizerSettings) => void;
    rewriterSettings: TextRewriterSettings | null;
    setRewriterSettings: (settings: TextRewriterSettings) => void;
    writeSettings: WriteCommandSettings | null;
    setWriteSettings: (settings: WriteCommandSettings) => void;
    updateSetting: <T>(apiCall: () => Promise<{ success: boolean; error?: string }>, onSuccess: () => void) => Promise<boolean>;
    searchQuery?: string;
    forcedOpenSections?: Set<string>;
}

export function WritingToolsTab({
    summarizerSettings,
    setSummarizerSettings,
    rewriterSettings,
    setRewriterSettings,
    writeSettings,
    setWriteSettings,
    updateSetting,
    searchQuery = '',
    forcedOpenSections = new Set()
}: WritingToolsTabProps) {
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
            {/* Text Summarizer */}
            {summarizerSettings && isAccordionVisible('summarizer') && (
                <AnimatedAccordion
                    title="Text Summarizer"
                    description="Configure text selection summarization"
                    isOpen={isAccordionOpen('summarizer')}
                    onToggle={() => handleToggle('summarizer')}
                >
                    <div className="space-y-4">
                        <SettingSwitch
                            label="Enable Summarizer"
                            description="Show summarize option when text is selected"
                            checked={summarizerSettings.enabled}
                            onCheckedChange={async (checked) => {
                                setSummarizerSettings({ ...summarizerSettings, enabled: checked });
                                return updateSetting(
                                    () => extensionAPI.setSummarizerSettings({ enabled: checked }),
                                    () => { }
                                );
                            }}
                            searchQuery={searchQuery}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-sm font-medium">
                                    <HighlightedText text="Summary Type" searchQuery={searchQuery} />
                                </Label>
                                <Select
                                    value={summarizerSettings.summaryType}
                                    placeholder="Select type"
                                    setValue={(value) => {
                                        const newValue = value as TextSummarizerSettings["summaryType"];
                                        setSummarizerSettings({ ...summarizerSettings, summaryType: newValue });
                                        updateSetting(
                                            () => extensionAPI.setSummarizerSettings({ summaryType: newValue }),
                                            () => { }
                                        );
                                    }}
                                >
                                    <SelectOption value="key-points">Key Points</SelectOption>
                                    <SelectOption value="tl-dr">TL;DR</SelectOption>
                                    <SelectOption value="headline">Headline</SelectOption>
                                    <SelectOption value="teaser">Teaser</SelectOption>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-sm font-medium">
                                    <HighlightedText text="Summary Length" searchQuery={searchQuery} />
                                </Label>
                                <Select
                                    value={summarizerSettings.summaryLength}
                                    placeholder="Select length"
                                    setValue={(value) => {
                                        const newValue = value as TextSummarizerSettings["summaryLength"];
                                        setSummarizerSettings({ ...summarizerSettings, summaryLength: newValue });
                                        updateSetting(
                                            () => extensionAPI.setSummarizerSettings({ summaryLength: newValue }),
                                            () => { }
                                        );
                                    }}
                                >
                                    <SelectOption value="short">Short</SelectOption>
                                    <SelectOption value="medium">Medium</SelectOption>
                                    <SelectOption value="long">Long</SelectOption>
                                </Select>
                            </div>
                        </div>
                        <SettingNumberInput
                            label="Minimum Text Length"
                            description="Minimum characters needed to trigger summarizer"
                            value={summarizerSettings.minTextLength}
                            onChange={async (value) => {
                                setSummarizerSettings({ ...summarizerSettings, minTextLength: value });
                                return updateSetting(
                                    () => extensionAPI.setSummarizerSettings({ minTextLength: value }),
                                    () => { }
                                );
                            }}
                            min={10}
                            max={1000}
                            searchQuery={searchQuery}
                        />
                    </div>
                </AnimatedAccordion>
            )}

            {/* Text Rewriter */}
            {rewriterSettings && isAccordionVisible('rewriter') && (
                <AnimatedAccordion
                    title="Text Rewriter"
                    description="Configure text rewriting options"
                    isOpen={isAccordionOpen('rewriter')}
                    onToggle={() => handleToggle('rewriter')}
                >
                    <div className="space-y-4">
                        <SettingSwitch
                            label="Enable Rewriter"
                            description="Show rewrite option when text is selected"
                            checked={rewriterSettings.enabled}
                            onCheckedChange={async (checked) => {
                                setRewriterSettings({ ...rewriterSettings, enabled: checked });
                                return updateSetting(
                                    () => extensionAPI.setRewriterSettings({ enabled: checked }),
                                    () => { }
                                );
                            }}
                            searchQuery={searchQuery}
                        />
                        <SettingSwitch
                            label="Show Preset Buttons"
                            description="Show quick preset buttons (Shorten, Expand, etc.)"
                            checked={rewriterSettings.showPresets}
                            onCheckedChange={async (checked) => {
                                setRewriterSettings({ ...rewriterSettings, showPresets: checked });
                                return updateSetting(
                                    () => extensionAPI.setRewriterSettings({ showPresets: checked }),
                                    () => { }
                                );
                            }}
                            searchQuery={searchQuery}
                        />
                    </div>
                </AnimatedAccordion>
            )}

            {/* Write Command */}
            {writeSettings && isAccordionVisible('write') && (
                <AnimatedAccordion
                    title="Write Command"
                    description="Configure /write command behavior"
                    isOpen={isAccordionOpen('write')}
                    onToggle={() => handleToggle('write')}
                >
                    <div className="space-y-4">
                        <SettingSwitch
                            label="Enable Write Command"
                            description="Allow using /write command in chat"
                            checked={writeSettings.enabled}
                            onCheckedChange={async (checked) => {
                                setWriteSettings({ ...writeSettings, enabled: checked });
                                return updateSetting(
                                    () => extensionAPI.setWriteSettings({ enabled: checked }),
                                    () => { }
                                );
                            }}
                            searchQuery={searchQuery}
                        />
                        <div>
                            <Label className="text-sm font-medium">
                                <HighlightedText text="Default Tone" searchQuery={searchQuery} />
                            </Label>
                            <Select
                                value={writeSettings.defaultTone}
                                placeholder="Select tone"
                                setValue={(value) => {
                                    const newValue = value as WriteCommandSettings["defaultTone"];
                                    setWriteSettings({ ...writeSettings, defaultTone: newValue });
                                    updateSetting(
                                        () => extensionAPI.setWriteSettings({ defaultTone: newValue }),
                                        () => { }
                                    );
                                }}
                            >
                                <SelectOption value="professional">Professional</SelectOption>
                                <SelectOption value="casual">Casual</SelectOption>
                                <SelectOption value="formal">Formal</SelectOption>
                                <SelectOption value="friendly">Friendly</SelectOption>
                            </Select>
                        </div>
                        <SettingSwitch
                            label="Include Page Context"
                            description="Include current page content for context"
                            checked={writeSettings.includePageContext}
                            onCheckedChange={async (checked) => {
                                setWriteSettings({ ...writeSettings, includePageContext: checked });
                                return updateSetting(
                                    () => extensionAPI.setWriteSettings({ includePageContext: checked }),
                                    () => { }
                                );
                            }}
                            searchQuery={searchQuery}
                        />
                    </div>
                </AnimatedAccordion>
            )}
        </div>
    );
}
