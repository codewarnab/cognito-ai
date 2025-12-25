import { SearchSettingsWithKeys } from "@cognito/shared";
import { extensionAPI } from "@/lib/extension-api";
import { SettingSwitch } from "@/components/settings/shared/SettingSwitch";
import { SettingNumberInput } from "@/components/settings/shared/SettingNumberInput";
import { SettingsSection } from "@/components/settings/shared/SettingsSection";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface WebSearchTabProps {
    searchSettings: SearchSettingsWithKeys | null;
    setSearchSettings: (settings: SearchSettingsWithKeys) => void;
    updateSetting: <T>(apiCall: () => Promise<{ success: boolean; error?: string }>, onSuccess: () => void) => Promise<boolean>;
}

export function WebSearchTab({ searchSettings, setSearchSettings, updateSetting }: WebSearchTabProps) {
    if (!searchSettings) return null;

    return (
        <SettingsSection title="Web Search" description="Configure Tavily web search integration" defaultOpen>
            <SettingSwitch
                label="Enable Web Search"
                description="Allow AI to search the web for information"
                checked={searchSettings.enabled}
                onCheckedChange={async (checked) => {
                    setSearchSettings({ ...searchSettings, enabled: checked });
                    return updateSetting(
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
            <Separator />
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
        </SettingsSection>
    );
}
