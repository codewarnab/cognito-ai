import {
    TextSummarizerSettings,
    TextRewriterSettings,
    WriteCommandSettings,
    ResearchWorkflowSettings
} from "@cognito/shared";
import { extensionAPI } from "@/lib/extension-api";
import { SettingSwitch } from "@/components/settings/shared/SettingSwitch";
import { SettingNumberInput } from "@/components/settings/shared/SettingNumberInput";
import { SettingsSection } from "@/components/settings/shared/SettingsSection";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FeaturesTabProps {
    summarizerSettings: TextSummarizerSettings | null;
    setSummarizerSettings: (settings: TextSummarizerSettings) => void;
    rewriterSettings: TextRewriterSettings | null;
    setRewriterSettings: (settings: TextRewriterSettings) => void;
    writeSettings: WriteCommandSettings | null;
    setWriteSettings: (settings: WriteCommandSettings) => void;
    researchSettings: ResearchWorkflowSettings | null;
    setResearchSettings: (settings: ResearchWorkflowSettings) => void;
    updateSetting: <T>(apiCall: () => Promise<{ success: boolean; error?: string }>, onSuccess: () => void) => Promise<boolean>;
}

export function FeaturesTab({
    summarizerSettings,
    setSummarizerSettings,
    rewriterSettings,
    setRewriterSettings,
    writeSettings,
    setWriteSettings,
    researchSettings,
    setResearchSettings,
    updateSetting
}: FeaturesTabProps) {
    return (
        <div className="space-y-4">
            {/* Text Summarizer */}
            {summarizerSettings && (
                <SettingsSection title="Text Summarizer" description="Configure text selection summarization">
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
                    />
                    <Separator />
                    <div className="py-3">
                        <Label className="text-sm font-medium">Summary Type</Label>
                        <Select
                            value={summarizerSettings.summaryType}
                            onValueChange={(value) => {
                                const newValue = value as TextSummarizerSettings["summaryType"];
                                setSummarizerSettings({ ...summarizerSettings, summaryType: newValue });
                                updateSetting(
                                    () => extensionAPI.setSummarizerSettings({ summaryType: newValue }),
                                    () => { }
                                );
                            }}
                        >
                            <SelectTrigger className="mt-2">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="key-points">Key Points</SelectItem>
                                <SelectItem value="tl-dr">TL;DR</SelectItem>
                                <SelectItem value="headline">Headline</SelectItem>
                                <SelectItem value="teaser">Teaser</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Separator />
                    <div className="py-3">
                        <Label className="text-sm font-medium">Summary Length</Label>
                        <Select
                            value={summarizerSettings.summaryLength}
                            onValueChange={(value) => {
                                const newValue = value as TextSummarizerSettings["summaryLength"];
                                setSummarizerSettings({ ...summarizerSettings, summaryLength: newValue });
                                updateSetting(
                                    () => extensionAPI.setSummarizerSettings({ summaryLength: newValue }),
                                    () => { }
                                );
                            }}
                        >
                            <SelectTrigger className="mt-2">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="short">Short</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="long">Long</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Separator />
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
                    />
                </SettingsSection>
            )}

            {/* Text Rewriter */}
            {rewriterSettings && (
                <SettingsSection title="Text Rewriter" description="Configure text rewriting options">
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
                    />
                    <Separator />
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
                    />
                    <Separator />
                    <SettingSwitch
                        label="Enable Google Search"
                        description="Allow AI to search Google for context"
                        checked={rewriterSettings.enableGoogleSearch}
                        onCheckedChange={async (checked) => {
                            setRewriterSettings({ ...rewriterSettings, enableGoogleSearch: checked });
                            return updateSetting(
                                () => extensionAPI.setRewriterSettings({ enableGoogleSearch: checked }),
                                () => { }
                            );
                        }}
                    />
                </SettingsSection>
            )}

            {/* Write Command */}
            {writeSettings && (
                <SettingsSection title="Write Command" description="Configure /write command behavior">
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
                    />
                    <Separator />
                    <div className="py-3">
                        <Label className="text-sm font-medium">Default Tone</Label>
                        <Select
                            value={writeSettings.defaultTone}
                            onValueChange={(value) => {
                                const newValue = value as WriteCommandSettings["defaultTone"];
                                setWriteSettings({ ...writeSettings, defaultTone: newValue });
                                updateSetting(
                                    () => extensionAPI.setWriteSettings({ defaultTone: newValue }),
                                    () => { }
                                );
                            }}
                        >
                            <SelectTrigger className="mt-2">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="professional">Professional</SelectItem>
                                <SelectItem value="casual">Casual</SelectItem>
                                <SelectItem value="formal">Formal</SelectItem>
                                <SelectItem value="friendly">Friendly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Separator />
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
                    />
                </SettingsSection>
            )}

            {/* Research Workflow */}
            {researchSettings && (
                <SettingsSection title="Research Workflow" description="Configure research automation settings">
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
                    <Separator />
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
                </SettingsSection>
            )}
        </div>
    );
}
