import { TTSSettings, VoiceSettings, VoiceName } from "@cognito/shared";
import { extensionAPI } from "@/lib/extension-api";
import { SettingSwitch } from "@/components/settings/shared/SettingSwitch";
import { SettingsSection } from "@/components/settings/shared/SettingsSection";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

interface VoiceTTSTabProps {
    ttsSettings: TTSSettings | null;
    setTTSSettings: (settings: TTSSettings) => void;
    voiceSettings: VoiceSettings | null;
    setVoiceSettings: (settings: VoiceSettings) => void;
    updateSetting: <T>(apiCall: () => Promise<{ success: boolean; error?: string }>, onSuccess: () => void) => Promise<boolean>;
    handlePreviewVoice: () => void;
    isPreviewingVoice: boolean;
}

export function VoiceTTSTab({
    ttsSettings,
    setTTSSettings,
    voiceSettings,
    setVoiceSettings,
    updateSetting,
    handlePreviewVoice,
    isPreviewingVoice
}: VoiceTTSTabProps) {
    if (!ttsSettings || !voiceSettings) return null;

    return (
        <SettingsSection title="Voice & Audio" description="Configure voice and text-to-speech settings" defaultOpen>
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
    );
}
