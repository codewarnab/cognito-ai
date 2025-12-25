import { useState, useMemo } from "react";
import { TTSSettings, VoiceSettings, VoiceName } from "@cognito/shared";
import { extensionAPI } from "@/lib/extension-api";
import { AnimatedAccordion } from "@/components/shared/AnimatedAccordion";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { HighlightedText } from "@/components/shared/HighlightedText";
import { accordionMatchesQuery } from "@/components/settings/shared/settingsSearchData";

interface VoiceTTSTabProps {
    ttsSettings: TTSSettings | null;
    setTTSSettings: (settings: TTSSettings) => void;
    voiceSettings: VoiceSettings | null;
    setVoiceSettings: (settings: VoiceSettings) => void;
    updateSetting: <T>(apiCall: () => Promise<{ success: boolean; error?: string }>, onSuccess: () => void) => Promise<boolean>;
    handlePreviewVoice: () => void;
    isPreviewingVoice: boolean;
    searchQuery?: string;
    forcedOpenSections?: Set<string>;
}

export function VoiceTTSTab({
    ttsSettings,
    setTTSSettings,
    voiceSettings,
    setVoiceSettings,
    updateSetting,
    handlePreviewVoice,
    isPreviewingVoice,
    searchQuery = '',
    forcedOpenSections = new Set()
}: VoiceTTSTabProps) {
    const [manualOpen, setManualOpen] = useState(false);

    const isVisible = accordionMatchesQuery('tts', searchQuery);

    const isOpen = useMemo(() => {
        if (searchQuery && forcedOpenSections.has('tts')) return true;
        return manualOpen;
    }, [forcedOpenSections, manualOpen, searchQuery]);

    if (!ttsSettings || !voiceSettings) return null;
    if (!isVisible) return null;

    return (
        <div className="space-y-6">
            <AnimatedAccordion
                title="Text-to-Speech"
                description="Configure voice output settings"
                isOpen={isOpen}
                onToggle={() => setManualOpen(!manualOpen)}
            >
                <div className="space-y-4">
                    <div>
                        <Label className="text-sm font-medium">
                            <HighlightedText text="TTS Provider" searchQuery={searchQuery} />
                        </Label>
                        <Select
                            value={ttsSettings.ttsProvider}
                            placeholder="Select provider"
                            setValue={(value) => {
                                const newValue = value as TTSSettings["ttsProvider"];
                                setTTSSettings({ ...ttsSettings, ttsProvider: newValue });
                                updateSetting(
                                    () => extensionAPI.setTTSSettings({ ttsProvider: newValue }),
                                    () => { }
                                );
                            }}
                        >
                            <SelectOption value="gemini">Gemini</SelectOption>
                            <SelectOption value="web-native">Web Native</SelectOption>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-sm font-medium">
                            <HighlightedText text="Gemini Voice" searchQuery={searchQuery} />
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            <HighlightedText text="Voice for Gemini Live conversations" searchQuery={searchQuery} />
                        </p>
                        <div className="flex gap-2 mt-1.5">
                            <Select
                                className="flex-1" // Added className to replace SelectTrigger logic
                                placeholder="Select voice"
                                value={voiceSettings.voiceName}
                                setValue={(value) => {
                                    const newValue = value as VoiceName;
                                    setVoiceSettings({ ...voiceSettings, voiceName: newValue });
                                    updateSetting(
                                        () => extensionAPI.setVoiceSettings({ voiceName: newValue }),
                                        () => { }
                                    );
                                }}
                            >
                                <SelectOption value="Aoede">Aoede</SelectOption>
                                <SelectOption value="Charon">Charon</SelectOption>
                                <SelectOption value="Fenrir">Fenrir</SelectOption>
                                <SelectOption value="Kore">Kore</SelectOption>
                                <SelectOption value="Orion">Orion</SelectOption>
                                <SelectOption value="Orus">Orus</SelectOption>
                                <SelectOption value="Puck">Puck</SelectOption>
                            </Select>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={handlePreviewVoice}
                                disabled={isPreviewingVoice}
                                className="shrink-0"
                            >
                                <Play className={`h-4 w-4 ${isPreviewingVoice ? "animate-pulse" : ""}`} />
                            </Button>
                        </div>
                    </div>
                </div>
            </AnimatedAccordion>
        </div>
    );
}
