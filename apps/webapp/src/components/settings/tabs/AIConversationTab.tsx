import { AIConfigSettings } from "@cognito/shared";
import { extensionAPI } from "@/lib/extension-api";
import { SettingNumberInput } from "@/components/settings/shared/SettingNumberInput";
import { SettingsSection } from "@/components/settings/shared/SettingsSection";

interface AIConversationTabProps {
    aiConfig: AIConfigSettings;
    setAIConfig: (config: AIConfigSettings) => void;
    updateSetting: <T>(apiCall: () => Promise<{ success: boolean; error?: string }>, onSuccess: () => void) => Promise<void>;
}

export function AIConversationTab({ aiConfig, setAIConfig, updateSetting }: AIConversationTabProps) {
    return (
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
    );
}
