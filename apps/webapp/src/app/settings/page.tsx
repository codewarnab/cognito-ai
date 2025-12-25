"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, X, Trash2 } from "lucide-react";
import { MagnifyingGlass, SpeakerHigh, PencilSimple, Brain } from "@phosphor-icons/react";
import { extensionAPI } from "@/lib/extension-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Header } from "@/components/shared/Header";
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
import { AISearchTab } from "@/components/settings/tabs/AISearchTab";
import { VoiceTTSTab } from "@/components/settings/tabs/VoiceTTSTab";
import { WritingToolsTab } from "@/components/settings/tabs/FeaturesTab";
import { AdvancedTab } from "@/components/settings/tabs/AdvancedTab";

// Import Search Components
import { SettingsSearch } from "@/components/settings/shared/SettingsSearch";
import { HighlightedText } from "@/components/shared/HighlightedText";
import { findMatchingAccordions, sectionHasVisibleAccordions } from "@/components/settings/shared/settingsSearchData";

export default function SettingsPage() {
    const router = useRouter();
    const { isInstalled, isLoading: extensionLoading } = useExtension();
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');

    // Compute force-open accordion sections based on search
    const forcedOpenSections = useMemo(() => {
        return findMatchingAccordions(searchQuery);
    }, [searchQuery]);

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
                <div className="container mx-auto max-w-2xl py-8 px-4 space-y-12">
                    {/* Search Bar Skeleton */}
                    <Skeleton className="h-10 w-full mb-6 rounded-md" />

                    {/* AI & Search Section Skeleton */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Skeleton className="h-5 w-5 rounded-full" />
                            <Skeleton className="h-6 w-32" />
                        </div>
                        <div className="space-y-3">
                            <Skeleton className="h-[76px] w-full rounded-xl" />
                            <Skeleton className="h-[76px] w-full rounded-xl" />
                            <Skeleton className="h-[76px] w-full rounded-xl" />
                        </div>
                    </div>

                    {/* Voice & Audio Section Skeleton */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Skeleton className="h-5 w-5 rounded-full" />
                            <Skeleton className="h-6 w-32" />
                        </div>
                        <Skeleton className="h-[76px] w-full rounded-xl" />
                    </div>

                    {/* Writing Tools Section Skeleton */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Skeleton className="h-5 w-5 rounded-full" />
                            <Skeleton className="h-6 w-32" />
                        </div>
                        <Skeleton className="h-[76px] w-full rounded-xl" />
                    </div>

                    {/* Memory Section Skeleton */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Skeleton className="h-5 w-5 rounded-full" />
                            <Skeleton className="h-6 w-32" />
                        </div>
                        <Skeleton className="h-[76px] w-full rounded-xl" />
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

            <div className="container mx-auto max-w-2xl py-8 px-4 space-y-12">
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

                {/* Search Bar */}
                <SettingsSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search settings..."
                    className="mb-6"
                />

                {/* AI & Search Section */}
                {sectionHasVisibleAccordions('ai-search', searchQuery) && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-[var(--text-primary)] mb-2">
                            <MagnifyingGlass size={20} weight="duotone" className="text-[var(--blue-stride)]" />
                            <h2 className="text-lg font-semibold">AI & Search</h2>
                        </div>
                        <AISearchTab
                            aiConfig={aiConfig}
                            setAIConfig={setAIConfig}
                            searchSettings={searchSettings}
                            setSearchSettings={setSearchSettings}
                            researchSettings={researchSettings}
                            setResearchSettings={setResearchSettings}
                            updateSetting={updateSetting}
                            handleDeleteAllChats={handleDeleteAllChats}
                            ttsSettings={ttsSettings}
                            setTTSSettings={setTTSSettings}
                            searchQuery={searchQuery}
                            forcedOpenSections={forcedOpenSections}
                        />
                    </section>
                )}

                {/* Voice & Audio Section */}
                {sectionHasVisibleAccordions('voice', searchQuery) && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-[var(--text-primary)] mb-2">
                            <SpeakerHigh size={20} weight="duotone" className="text-[var(--purple-flow)]" />
                            <h2 className="text-lg font-semibold">Voice & Audio</h2>
                        </div>
                        <VoiceTTSTab
                            ttsSettings={ttsSettings}
                            setTTSSettings={setTTSSettings}
                            voiceSettings={voiceSettings}
                            setVoiceSettings={setVoiceSettings}
                            updateSetting={updateSetting}
                            handlePreviewVoice={handlePreviewVoice}
                            isPreviewingVoice={isPreviewingVoice}
                            searchQuery={searchQuery}
                            forcedOpenSections={forcedOpenSections}
                        />
                    </section>
                )}

                {/* Writing Tools Section */}
                {sectionHasVisibleAccordions('writing', searchQuery) && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-[var(--text-primary)] mb-2">
                            <PencilSimple size={20} weight="duotone" className="text-[var(--green-pulse)]" />
                            <h2 className="text-lg font-semibold">Writing Tools</h2>
                        </div>
                        <WritingToolsTab
                            summarizerSettings={summarizerSettings}
                            setSummarizerSettings={setSummarizerSettings}
                            rewriterSettings={rewriterSettings}
                            setRewriterSettings={setRewriterSettings}
                            writeSettings={writeSettings}
                            setWriteSettings={setWriteSettings}
                            updateSetting={updateSetting}
                            searchQuery={searchQuery}
                            forcedOpenSections={forcedOpenSections}
                        />
                    </section>
                )}

                {/* Memory Section */}
                {sectionHasVisibleAccordions('memory', searchQuery) && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-[var(--text-primary)] mb-2">
                            <Brain size={20} weight="duotone" className="text-[var(--orange-spark)]" />
                            <h2 className="text-lg font-semibold">Memory</h2>
                        </div>
                        <AdvancedTab
                            supermemorySettings={supermemorySettings}
                            setSupermemorySettings={setSupermemorySettings}
                            updateSetting={updateSetting}
                            searchQuery={searchQuery}
                            forcedOpenSections={forcedOpenSections}
                        />
                    </section>
                )}

                {/* Danger Zone */}
                {sectionHasVisibleAccordions('danger', searchQuery) && (
                    <div className="rounded-lg border border-destructive/30 overflow-hidden">
                        <div className="bg-destructive/5 px-5 py-3 border-b border-destructive/20">
                            <h3 className="text-sm font-medium text-destructive flex items-center gap-2">
                                <Trash2 className="h-4 w-4" />
                                <HighlightedText text="Danger Zone" searchQuery={searchQuery} />
                            </h3>
                        </div>
                        <div className="p-5 bg-[var(--bg-secondary)]/50">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h4 className="text-sm font-medium text-[var(--text-primary)]">
                                        <HighlightedText text="Delete All Data" searchQuery={searchQuery} />
                                    </h4>
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
                )}
            </div>
        </div>
    );
}

