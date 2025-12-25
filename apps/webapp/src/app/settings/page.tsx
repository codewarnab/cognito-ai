"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Settings, RefreshCw, Trash2, Play, AlertCircle, CheckCircle, X } from "lucide-react";
import { extensionAPI } from "@/lib/extension-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type {
    AIConfigSettings,
    SearchSettingsWithKeys,
    AskAIButtonSettings,
    TextSummarizerSettings,
    TextRewriterSettings,
    WriteCommandSettings,
    SupermemorySettings,
    ResearchWorkflowSettings,
    TTSSettings,
    VoiceSettings,
    VoiceName,
} from "@cognito/shared";

// ============================================================================
// Setting Item Components
// ============================================================================

interface SettingSwitchProps {
    label: string;
    description?: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
}

function SettingSwitch({ label, description, checked, onCheckedChange, disabled }: SettingSwitchProps) {
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

interface SettingNumberInputProps {
    label: string;
    description?: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    disabled?: boolean;
}

function SettingNumberInput({ label, description, value, onChange, min, max, disabled }: SettingNumberInputProps) {
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

// ============================================================================
// Settings Section Components
// ============================================================================

interface SettingsSectionProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

function SettingsSection({ title, description, children, defaultOpen = false }: SettingsSectionProps) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <Card>
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base">{title}</CardTitle>
                                {description && <CardDescription>{description}</CardDescription>}
                            </div>
                            <span className="text-muted-foreground text-sm">{open ? "−" : "+"}</span>
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="pt-0">
                        {children}
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}

// ============================================================================
// Main Settings Page
// ============================================================================

export default function SettingsPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isInstalled, setIsInstalled] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Settings state
    const [aiConfig, setAIConfig] = useState<AIConfigSettings>({ maxToolCallLimit: 20 });
    const [searchSettings, setSearchSettings] = useState<SearchSettingsWithKeys | null>(null);
    const [askAISettings, setAskAISettings] = useState<AskAIButtonSettings | null>(null);
    const [summarizerSettings, setSummarizerSettings] = useState<TextSummarizerSettings | null>(null);
    const [rewriterSettings, setRewriterSettings] = useState<TextRewriterSettings | null>(null);
    const [writeSettings, setWriteSettings] = useState<WriteCommandSettings | null>(null);
    const [supermemorySettings, setSupermemorySettings] = useState<SupermemorySettings | null>(null);
    const [researchSettings, setResearchSettings] = useState<ResearchWorkflowSettings | null>(null);
    const [ttsSettings, setTTSSettings] = useState<TTSSettings | null>(null);
    const [voiceSettings, setVoiceSettings] = useState<VoiceSettings | null>(null);

    // Voice preview state
    const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);

    // Load all settings
    const loadSettings = useCallback(async () => {
        if (!isInstalled) return;

        setIsLoading(true);
        setError(null);

        try {
            const [
                aiConfigRes,
                searchRes,
                askAIRes,
                summarizerRes,
                rewriterRes,
                writeRes,
                supermemoryRes,
                researchRes,
                ttsRes,
                voiceRes,
            ] = await Promise.all([
                extensionAPI.getAIConfig(),
                extensionAPI.getSearchSettings(),
                extensionAPI.getAskAISettings(),
                extensionAPI.getSummarizerSettings(),
                extensionAPI.getRewriterSettings(),
                extensionAPI.getWriteSettings(),
                extensionAPI.getSupermemorySettings(),
                extensionAPI.getResearchSettings(),
                extensionAPI.getTTSSettings(),
                extensionAPI.getVoiceSettings(),
            ]);

            if (aiConfigRes.success && aiConfigRes.data) setAIConfig(aiConfigRes.data);
            if (searchRes.success && searchRes.data) setSearchSettings(searchRes.data);
            if (askAIRes.success && askAIRes.data) setAskAISettings(askAIRes.data);
            if (summarizerRes.success && summarizerRes.data) setSummarizerSettings(summarizerRes.data);
            if (rewriterRes.success && rewriterRes.data) setRewriterSettings(rewriterRes.data);
            if (writeRes.success && writeRes.data) setWriteSettings(writeRes.data);
            if (supermemoryRes.success && supermemoryRes.data) setSupermemorySettings(supermemoryRes.data);
            if (researchRes.success && researchRes.data) setResearchSettings(researchRes.data);
            if (ttsRes.success && ttsRes.data) setTTSSettings(ttsRes.data);
            if (voiceRes.success && voiceRes.data) setVoiceSettings(voiceRes.data);
        } catch (err) {
            setError("Failed to load settings from extension");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [isInstalled]);

    // Check installation and load settings
    useEffect(() => {
        const checkInstallation = async () => {
            const installed = await extensionAPI.isInstalled();
            setIsInstalled(installed);
            if (!installed) {
                setIsLoading(false);
            }
        };
        checkInstallation();
    }, []);

    useEffect(() => {
        if (isInstalled) {
            loadSettings();
        }
    }, [isInstalled, loadSettings]);

    // Auto-hide success message
    useEffect(() => {
        if (successMessage) {
            const timeout = setTimeout(() => setSuccessMessage(null), 3000);
            return () => clearTimeout(timeout);
        }
    }, [successMessage]);

    // Helper to update a setting
    const updateSetting = async <T,>(
        apiCall: () => Promise<{ success: boolean; error?: string }>,
        onSuccess: () => void
    ) => {
        try {
            const result = await apiCall();
            if (result.success) {
                onSuccess();
                setSuccessMessage("Setting saved");
            } else {
                setError(result.error || "Failed to save setting");
            }
        } catch (err) {
            setError("Failed to save setting");
            console.error(err);
        }
    };

    // Preview voice
    const handlePreviewVoice = async () => {
        if (!voiceSettings?.voiceName) return;

        setIsPreviewingVoice(true);
        try {
            const result = await extensionAPI.previewVoice(voiceSettings.voiceName);
            if (result.success && result.data) {
                // Decode base64 and play audio
                const audioData = atob(result.data.audioData);
                const audioArray = new Uint8Array(audioData.length);
                for (let i = 0; i < audioData.length; i++) {
                    audioArray[i] = audioData.charCodeAt(i);
                }
                const audioBlob = new Blob([audioArray], { type: result.data.mimeType });
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                await audio.play();
            } else {
                setError(result.error || "Failed to preview voice");
            }
        } catch (err) {
            setError("Failed to preview voice");
            console.error(err);
        } finally {
            setIsPreviewingVoice(false);
        }
    };

    // Delete all chats
    const handleDeleteAllChats = async () => {
        if (!confirm("Are you sure you want to delete all chat history? This action cannot be undone.")) {
            return;
        }

        try {
            const result = await extensionAPI.deleteAllChats();
            if (result.success && result.data) {
                setSuccessMessage(`Deleted ${result.data.messagesDeleted} messages and ${result.data.threadsDeleted} threads`);
            } else {
                setError(result.error || "Failed to delete chats");
            }
        } catch (err) {
            setError("Failed to delete chats");
            console.error(err);
        }
    };

    if (!isInstalled) {
        return (
            <div className="container mx-auto max-w-4xl py-8 px-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                            Extension Not Installed
                        </CardTitle>
                        <CardDescription>
                            The Cognito AI extension must be installed to configure settings.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => router.push("/")}>Go to Home</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-4xl py-8 px-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Settings className="h-6 w-6" />
                            Settings
                        </h1>
                        <p className="text-muted-foreground">Configure your Cognito AI preferences</p>
                    </div>
                </div>
                <Button variant="outline" onClick={loadSettings} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Alerts */}
            {error && (
                <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setError(null)}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {successMessage && (
                <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    {successMessage}
                </div>
            )}

            {/* Settings Sections */}
            <div className="space-y-4">
                {/* AI Configuration */}
                <SettingsSection title="AI Configuration" description="Configure AI behavior and limits" defaultOpen>
                    <SettingNumberInput
                        label="Maximum Tool Calls"
                        description="Limit how many tool calls (steps) the AI can make per response (1-50)"
                        value={aiConfig.maxToolCallLimit}
                        onChange={(value) => {
                            const clamped = Math.max(1, Math.min(50, value));
                            setAIConfig({ ...aiConfig, maxToolCallLimit: clamped });
                            updateSetting(
                                () => extensionAPI.setAIConfig({ maxToolCallLimit: clamped }),
                                () => { }
                            );
                        }}
                        min={1}
                        max={50}
                    />
                </SettingsSection>

                {/* Search Settings */}
                {searchSettings && (
                    <SettingsSection title="Web Search" description="Configure Tavily web search integration">
                        <SettingSwitch
                            label="Enable Web Search"
                            description="Allow AI to search the web for information"
                            checked={searchSettings.enabled}
                            onCheckedChange={(checked) => {
                                setSearchSettings({ ...searchSettings, enabled: checked });
                                updateSetting(
                                    () => extensionAPI.setSearchSettings({ enabled: checked }),
                                    () => { }
                                );
                            }}
                        />
                        <Separator />
                        <div className="py-3">
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
                                className="mt-2"
                            />
                        </div>
                        <Separator />
                        <SettingNumberInput
                            label="Maximum Results"
                            description="Number of search results to return"
                            value={searchSettings.maxResults}
                            onChange={(value) => {
                                setSearchSettings({ ...searchSettings, maxResults: value });
                                updateSetting(
                                    () => extensionAPI.setSearchSettings({ maxResults: value }),
                                    () => { }
                                );
                            }}
                            min={1}
                            max={20}
                        />
                        <Separator />
                        <SettingSwitch
                            label="Include Images"
                            description="Include image results in search"
                            checked={searchSettings.includeImages}
                            onCheckedChange={(checked) => {
                                setSearchSettings({ ...searchSettings, includeImages: checked });
                                updateSetting(
                                    () => extensionAPI.setSearchSettings({ includeImages: checked }),
                                    () => { }
                                );
                            }}
                        />
                    </SettingsSection>
                )}

                {/* Text Summarizer */}
                {summarizerSettings && (
                    <SettingsSection title="Text Summarizer" description="Configure text selection summarization">
                        <SettingSwitch
                            label="Enable Summarizer"
                            description="Show summarize option when text is selected"
                            checked={summarizerSettings.enabled}
                            onCheckedChange={(checked) => {
                                setSummarizerSettings({ ...summarizerSettings, enabled: checked });
                                updateSetting(
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
                            onChange={(value) => {
                                setSummarizerSettings({ ...summarizerSettings, minTextLength: value });
                                updateSetting(
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
                            onCheckedChange={(checked) => {
                                setRewriterSettings({ ...rewriterSettings, enabled: checked });
                                updateSetting(
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
                            onCheckedChange={(checked) => {
                                setRewriterSettings({ ...rewriterSettings, showPresets: checked });
                                updateSetting(
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
                            onCheckedChange={(checked) => {
                                setRewriterSettings({ ...rewriterSettings, enableGoogleSearch: checked });
                                updateSetting(
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
                            onCheckedChange={(checked) => {
                                setWriteSettings({ ...writeSettings, enabled: checked });
                                updateSetting(
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
                            onCheckedChange={(checked) => {
                                setWriteSettings({ ...writeSettings, includePageContext: checked });
                                updateSetting(
                                    () => extensionAPI.setWriteSettings({ includePageContext: checked }),
                                    () => { }
                                );
                            }}
                        />
                    </SettingsSection>
                )}

                {/* Voice & Audio */}
                {ttsSettings && voiceSettings && (
                    <SettingsSection title="Voice & Audio" description="Configure voice and text-to-speech settings">
                        <SettingSwitch
                            label="Show Suggestions"
                            description="Show AI-suggested actions in chat"
                            checked={ttsSettings.suggestionsEnabled}
                            onCheckedChange={(checked) => {
                                setTTSSettings({ ...ttsSettings, suggestionsEnabled: checked });
                                updateSetting(
                                    () => extensionAPI.setTTSSettings({ suggestionsEnabled: checked }),
                                    () => { }
                                );
                            }}
                        />
                        <Separator />
                        <div className="py-3">
                            <Label className="text-sm font-medium">TTS Provider</Label>
                            <Select
                                value={ttsSettings.ttsProvider}
                                onValueChange={(value) => {
                                    const newValue = value as TTSSettings["ttsProvider"];
                                    setTTSSettings({ ...ttsSettings, ttsProvider: newValue });
                                    updateSetting(
                                        () => extensionAPI.setTTSSettings({ ttsProvider: newValue }),
                                        () => { }
                                    );
                                }}
                            >
                                <SelectTrigger className="mt-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gemini">Gemini</SelectItem>
                                    <SelectItem value="web-native">Web Native</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Separator />
                        <div className="py-3">
                            <Label className="text-sm font-medium">Gemini Voice</Label>
                            <p className="text-xs text-muted-foreground">Voice for Gemini Live conversations</p>
                            <div className="flex gap-2 mt-2">
                                <Select
                                    value={voiceSettings.voiceName}
                                    onValueChange={(value) => {
                                        const newValue = value as VoiceName;
                                        setVoiceSettings({ ...voiceSettings, voiceName: newValue });
                                        updateSetting(
                                            () => extensionAPI.setVoiceSettings({ voiceName: newValue }),
                                            () => { }
                                        );
                                    }}
                                >
                                    <SelectTrigger className="flex-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Aoede">Aoede</SelectItem>
                                        <SelectItem value="Charon">Charon</SelectItem>
                                        <SelectItem value="Fenrir">Fenrir</SelectItem>
                                        <SelectItem value="Kore">Kore</SelectItem>
                                        <SelectItem value="Orion">Orion</SelectItem>
                                        <SelectItem value="Orus">Orus</SelectItem>
                                        <SelectItem value="Puck">Puck</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="outline"
                                    onClick={handlePreviewVoice}
                                    disabled={isPreviewingVoice}
                                >
                                    <Play className={`h-4 w-4 ${isPreviewingVoice ? "animate-pulse" : ""}`} />
                                </Button>
                            </div>
                        </div>
                    </SettingsSection>
                )}

                {/* Research Workflow */}
                {researchSettings && (
                    <SettingsSection title="Research Workflow" description="Configure research automation settings">
                        <SettingNumberInput
                            label="Minimum Sources"
                            description="Minimum sources to visit before completing research"
                            value={researchSettings.minimumSources}
                            onChange={(value) => {
                                setResearchSettings({ ...researchSettings, minimumSources: value });
                                updateSetting(
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
                            onChange={(value) => {
                                setResearchSettings({ ...researchSettings, stepCount: value });
                                updateSetting(
                                    () => extensionAPI.setResearchSettings({ stepCount: value }),
                                    () => { }
                                );
                            }}
                            min={5}
                            max={100}
                        />
                    </SettingsSection>
                )}

                {/* Supermemory Integration */}
                {supermemorySettings && (
                    <SettingsSection title="Supermemory" description="Configure persistent memory integration">
                        <SettingSwitch
                            label="Enable Supermemory"
                            description="Enable persistent memory across conversations"
                            checked={supermemorySettings.enabled}
                            onCheckedChange={(checked) => {
                                setSupermemorySettings({ ...supermemorySettings, enabled: checked });
                                updateSetting(
                                    () => extensionAPI.setSupermemorySettings({ enabled: checked }),
                                    () => { }
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
                                        () => { }
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
                                    () => { }
                                );
                            }}
                            disabled={!supermemorySettings.enabled}
                        />
                        <Separator />
                        <SettingSwitch
                            label="Content Memory"
                            description="Learn from summarizer, writer, and rewriter usage"
                            checked={supermemorySettings.contentMemory}
                            onCheckedChange={(checked) => {
                                setSupermemorySettings({ ...supermemorySettings, contentMemory: checked });
                                updateSetting(
                                    () => extensionAPI.setSupermemorySettings({ contentMemory: checked }),
                                    () => { }
                                );
                            }}
                            disabled={!supermemorySettings.enabled}
                        />
                    </SettingsSection>
                )}

                {/* Ask AI Button */}
                {askAISettings && (
                    <SettingsSection title="Ask AI Button" description="Configure floating AI button visibility">
                        <SettingSwitch
                            label="Enable Globally"
                            description="Show the Ask AI button on all websites"
                            checked={!askAISettings.permanentlyHidden}
                            onCheckedChange={(checked) => {
                                setAskAISettings({ ...askAISettings, permanentlyHidden: !checked });
                                updateSetting(
                                    () => extensionAPI.setAskAISettings({ permanentlyHidden: !checked }),
                                    () => { }
                                );
                            }}
                        />
                        {askAISettings.hiddenDomains.length > 0 && (
                            <>
                                <Separator />
                                <div className="py-3">
                                    <Label className="text-sm font-medium">Hidden Domains</Label>
                                    <p className="text-xs text-muted-foreground mb-2">
                                        Domains where the button is hidden
                                    </p>
                                    <div className="space-y-2">
                                        {askAISettings.hiddenDomains.map((domain) => (
                                            <div key={domain} className="flex items-center justify-between bg-muted/50 p-2 rounded">
                                                <span className="text-sm">{domain}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        const newDomains = askAISettings.hiddenDomains.filter(d => d !== domain);
                                                        setAskAISettings({ ...askAISettings, hiddenDomains: newDomains });
                                                        updateSetting(
                                                            () => extensionAPI.setAskAISettings({ action: "removeDomain", domain }),
                                                            () => { }
                                                        );
                                                    }}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2"
                                        onClick={() => {
                                            setAskAISettings({ ...askAISettings, hiddenDomains: [] });
                                            updateSetting(
                                                () => extensionAPI.setAskAISettings({ action: "clearAllDomains" }),
                                                () => { }
                                            );
                                        }}
                                    >
                                        Clear All Hidden Domains
                                    </Button>
                                </div>
                            </>
                        )}
                    </SettingsSection>
                )}

                {/* Data Management */}
                <SettingsSection title="Data Management" description="Manage your data and chat history">
                    <div className="py-3">
                        <Label className="text-sm font-medium">Delete All Chats</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                            Permanently delete all chat messages and threads
                        </p>
                        <Button variant="destructive" onClick={handleDeleteAllChats}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete All Chats
                        </Button>
                    </div>
                </SettingsSection>
            </div>
        </div>
    );
}
