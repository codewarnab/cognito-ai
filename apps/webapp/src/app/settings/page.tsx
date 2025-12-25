"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, AlertCircle, X } from "lucide-react";
import { ChatCircle, MagnifyingGlass, SpeakerHigh, Lightning, GearSix } from "@phosphor-icons/react";
import { extensionAPI } from "@/lib/extension-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Header } from "@/components/shared/Header";
import { AnimatedTabs, type AnimatedTab } from "@/components/ui/animated-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useExtension } from "@/hooks/useExtension";
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
} from "@cognito/shared";

// Import Tab Components
import { AIConversationTab } from "@/components/settings/tabs/AIConversationTab";
import { WebSearchTab } from "@/components/settings/tabs/WebSearchTab";
import { VoiceTTSTab } from "@/components/settings/tabs/VoiceTTSTab";
import { FeaturesTab } from "@/components/settings/tabs/FeaturesTab";
import { AdvancedTab } from "@/components/settings/tabs/AdvancedTab";

export default function SettingsPage() {
    const router = useRouter();
    const { isInstalled, isLoading: extensionLoading } = useExtension();
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

        setSettingsLoading(true);
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
            setSettingsLoading(false);
        }
    }, [isInstalled]);

    // Load settings when extension is ready
    useEffect(() => {
        if (isInstalled) {
            loadSettings();
        }
    }, [isInstalled, loadSettings]);



    // Helper to update a setting - returns true on success for local feedback
    const updateSetting = async <T,>(
        apiCall: () => Promise<{ success: boolean; error?: string }>,
        onSuccess: () => void
    ): Promise<boolean> => {
        try {
            const result = await apiCall();
            if (result.success) {
                onSuccess();
                return true;
            } else {
                setError(result.error || "Failed to save setting");
                return false;
            }
        } catch (err) {
            setError("Failed to save setting");
            console.error(err);
            return false;
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
                alert(`Deleted ${result.data.messagesDeleted} messages and ${result.data.threadsDeleted} threads`);
            } else {
                setError(result.error || "Failed to delete chats");
            }
        } catch (err) {
            setError("Failed to delete chats");
            console.error(err);
        }
    };
    // Show skeleton while checking extension status
    if (extensionLoading) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)]">
                <Header title="Settings" />
                <div className="container mx-auto max-w-4xl py-8 px-4">
                    {/* Skeleton for Notice Banner */}
                    <Card className="mb-8 border-[var(--border-color)] bg-[var(--bg-secondary)]">
                        <CardContent className="flex items-center justify-between p-6">
                            <div className="flex-1">
                                <Skeleton className="h-6 w-48 mb-2" />
                                <Skeleton className="h-4 w-80" />
                            </div>
                            <Skeleton className="h-9 w-32" />
                        </CardContent>
                    </Card>

                    {/* Skeleton for Preferences Header */}
                    <div className="flex items-center justify-between mb-6">
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-9 w-24" />
                    </div>

                    {/* Skeleton for Tabs */}
                    <div className="space-y-6">
                        <Skeleton className="h-12 w-full" />
                        <Card className="border-[var(--border-color)] bg-[var(--bg-secondary)]">
                            <CardContent className="p-6 space-y-4">
                                <Skeleton className="h-5 w-40" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-5 w-48 mt-6" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    // Show extension not installed message only after we've confirmed it's not installed
    if (!isInstalled) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)]">
                <Header title="Settings" />
                <div className="container mx-auto max-w-4xl py-8 px-4">
                    <Card className="border-[var(--border-color)] bg-[var(--bg-secondary)]">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-[var(--text-primary)]">
                                <AlertCircle className="h-5 w-5 text-yellow-500" />
                                Extension Not Installed
                            </CardTitle>
                            <CardDescription className="text-[var(--text-secondary)]">
                                The Cognito AI extension must be installed to configure settings.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => router.push("/")}>Go to Home</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-primary)]">
            <Header title="Settings" />

            <div className="container mx-auto max-w-4xl py-8 px-4">
                {/* Notice Banner - Minimal */}
                <div className="mb-6 flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)]/60 border border-[var(--border-color)] backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-500/10">
                            <GearSix size={16} weight="duotone" className="text-blue-400" />
                        </div>
                        <span className="text-sm text-[var(--text-secondary)]">
                            <span className="font-medium text-[var(--text-primary)]">Configure AI Provider</span>
                            <span className="hidden sm:inline"> — Set up your credentials to enable chat</span>
                        </span>
                    </div>
                    <Link href="/providers">
                        <Button size="sm" variant="outline" className="text-xs h-7 px-3">
                            Manage Providers
                        </Button>
                    </Link>
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



                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)]">Preferences</h2>
                    <Button variant="outline" onClick={loadSettings} disabled={settingsLoading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${settingsLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>

                <SettingsTabs
                    aiConfig={aiConfig}
                    setAIConfig={setAIConfig}
                    searchSettings={searchSettings}
                    setSearchSettings={setSearchSettings}
                    ttsSettings={ttsSettings}
                    setTTSSettings={setTTSSettings}
                    voiceSettings={voiceSettings}
                    setVoiceSettings={setVoiceSettings}
                    summarizerSettings={summarizerSettings}
                    setSummarizerSettings={setSummarizerSettings}
                    rewriterSettings={rewriterSettings}
                    setRewriterSettings={setRewriterSettings}
                    writeSettings={writeSettings}
                    setWriteSettings={setWriteSettings}
                    researchSettings={researchSettings}
                    setResearchSettings={setResearchSettings}
                    supermemorySettings={supermemorySettings}
                    setSupermemorySettings={setSupermemorySettings}
                    updateSetting={updateSetting}
                    handlePreviewVoice={handlePreviewVoice}
                    isPreviewingVoice={isPreviewingVoice}
                    handleDeleteAllChats={handleDeleteAllChats}
                />
            </div>
        </div>
    );
}

// Separated tabs component to use useMemo for tabs array
interface SettingsTabsProps {
    aiConfig: AIConfigSettings;
    setAIConfig: React.Dispatch<React.SetStateAction<AIConfigSettings>>;
    searchSettings: SearchSettingsWithKeys | null;
    setSearchSettings: React.Dispatch<React.SetStateAction<SearchSettingsWithKeys | null>>;
    ttsSettings: TTSSettings | null;
    setTTSSettings: React.Dispatch<React.SetStateAction<TTSSettings | null>>;
    voiceSettings: VoiceSettings | null;
    setVoiceSettings: React.Dispatch<React.SetStateAction<VoiceSettings | null>>;
    summarizerSettings: TextSummarizerSettings | null;
    setSummarizerSettings: React.Dispatch<React.SetStateAction<TextSummarizerSettings | null>>;
    rewriterSettings: TextRewriterSettings | null;
    setRewriterSettings: React.Dispatch<React.SetStateAction<TextRewriterSettings | null>>;
    writeSettings: WriteCommandSettings | null;
    setWriteSettings: React.Dispatch<React.SetStateAction<WriteCommandSettings | null>>;
    researchSettings: ResearchWorkflowSettings | null;
    setResearchSettings: React.Dispatch<React.SetStateAction<ResearchWorkflowSettings | null>>;
    supermemorySettings: SupermemorySettings | null;
    setSupermemorySettings: React.Dispatch<React.SetStateAction<SupermemorySettings | null>>;
    updateSetting: <T>(apiCall: () => Promise<{ success: boolean; error?: string }>, onSuccess: () => void) => Promise<boolean>;
    handlePreviewVoice: () => Promise<void>;
    isPreviewingVoice: boolean;
    handleDeleteAllChats: () => Promise<void>;
}

function SettingsTabs({
    aiConfig,
    setAIConfig,
    searchSettings,
    setSearchSettings,
    ttsSettings,
    setTTSSettings,
    voiceSettings,
    setVoiceSettings,
    summarizerSettings,
    setSummarizerSettings,
    rewriterSettings,
    setRewriterSettings,
    writeSettings,
    setWriteSettings,
    researchSettings,
    setResearchSettings,
    supermemorySettings,
    setSupermemorySettings,
    updateSetting,
    handlePreviewVoice,
    isPreviewingVoice,
    handleDeleteAllChats,
}: SettingsTabsProps) {
    const tabs: AnimatedTab[] = useMemo(() => [
        {
            name: "AI Conversation",
            icon: <ChatCircle size={18} weight="duotone" />,
            content: (
                <AIConversationTab
                    aiConfig={aiConfig}
                    setAIConfig={setAIConfig}
                    updateSetting={updateSetting}
                />
            ),
        },
        {
            name: "Web Search",
            icon: <MagnifyingGlass size={18} weight="duotone" />,
            content: (
                <WebSearchTab
                    searchSettings={searchSettings}
                    setSearchSettings={setSearchSettings}
                    updateSetting={updateSetting}
                />
            ),
        },
        {
            name: "Voice & Audio",
            icon: <SpeakerHigh size={18} weight="duotone" />,
            content: (
                <VoiceTTSTab
                    ttsSettings={ttsSettings}
                    setTTSSettings={setTTSSettings}
                    voiceSettings={voiceSettings}
                    setVoiceSettings={setVoiceSettings}
                    updateSetting={updateSetting}
                    handlePreviewVoice={handlePreviewVoice}
                    isPreviewingVoice={isPreviewingVoice}
                />
            ),
        },
        {
            name: "Features",
            icon: <Lightning size={18} weight="duotone" />,
            content: (
                <FeaturesTab
                    summarizerSettings={summarizerSettings}
                    setSummarizerSettings={setSummarizerSettings}
                    rewriterSettings={rewriterSettings}
                    setRewriterSettings={setRewriterSettings}
                    writeSettings={writeSettings}
                    setWriteSettings={setWriteSettings}
                    researchSettings={researchSettings}
                    setResearchSettings={setResearchSettings}
                    updateSetting={updateSetting}
                />
            ),
        },
        {
            name: "Advanced",
            icon: <GearSix size={18} weight="duotone" />,
            content: (
                <AdvancedTab
                    supermemorySettings={supermemorySettings}
                    setSupermemorySettings={setSupermemorySettings}
                    updateSetting={updateSetting}
                    handleDeleteAllChats={handleDeleteAllChats}
                />
            ),
        },
    ], [
        aiConfig, setAIConfig, searchSettings, setSearchSettings,
        ttsSettings, setTTSSettings, voiceSettings, setVoiceSettings,
        summarizerSettings, setSummarizerSettings, rewriterSettings, setRewriterSettings,
        writeSettings, setWriteSettings, researchSettings, setResearchSettings,
        supermemorySettings, setSupermemorySettings, updateSetting,
        handlePreviewVoice, isPreviewingVoice, handleDeleteAllChats
    ]);

    return <AnimatedTabs tabs={tabs} />;
}
