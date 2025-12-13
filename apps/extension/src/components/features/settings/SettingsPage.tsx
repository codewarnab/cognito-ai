import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AskAiButtonSettings } from '@/components/features/settings/components/AskAiButtonSettings';
import { TextSummarizerSettings } from '@/components/features/settings/components/TextSummarizerSettings';
import { TextRewriterSettings } from '@/components/features/settings/components/TextRewriterSettings';
import { WriteCommandSettings } from '@/components/features/settings/components/WriteCommandSettings';

// import { EnabledToolsSettings } from '@/components/features/settings/components/EnabledToolsSettings';
import { TTSAndDataSettings } from '@/components/features/settings/components/TTSAndDataSuggestionsSettings';
import { MaxToolCallSettings } from '@/components/features/settings/components/MaxToolCallSettings';
import { SupermemorySettings } from '@/components/features/settings/components/SupermemorySettings';
import { SearchSettingsSection } from '@/components/features/settings/components/SearchSettingsSection';
import { ResearchWorkflowSettings } from '@/components/features/settings/components/ResearchWorkflowSettings';
import { SocialLinks } from '@/components/features/settings/components/SocialLinks';
import { hasAnyProviderConfigured } from '@/utils/credentials';

interface SettingsPageProps {
  onBack: () => void;
  onProviderSetupClick?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack, onProviderSetupClick }) => {
  const [needsProviderSetup, setNeedsProviderSetup] = useState(false);

  useEffect(() => {
    async function checkProviderSetup() {
      const hasProvider = await hasAnyProviderConfigured();
      setNeedsProviderSetup(!hasProvider);
    }
    checkProviderSetup();
  }, []);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
      {/* API Key Setup Link */}
      {needsProviderSetup && onProviderSetupClick && (
        <div className="px-4 py-2 text-[11px] text-[var(--text-tertiary)] text-center bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
          Looking for configuring API keys?{' '}
          <button
            className="bg-transparent border-none text-blue-300/90 cursor-pointer text-[11px] p-0 underline underline-offset-2 hover:text-blue-200"
            onClick={onProviderSetupClick}
          >
            Click here
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center p-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] gap-4">
        <button
          className="bg-transparent border-none text-[var(--text-secondary)] cursor-pointer p-1 rounded-sm flex items-center justify-center transition-colors hover:text-[var(--text-primary)] hover:bg-white/5"
          onClick={onBack}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold m-0 text-[var(--text-primary)]">Settings</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5 m-0">Manage tools, voice, TTS, and data</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/[0.12] [&::-webkit-scrollbar-thumb]:rounded-[3px] hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
        {/* <VoiceSettings /> */}
        <SupermemorySettings />
        <SearchSettingsSection />
        <MaxToolCallSettings />
        <TTSAndDataSettings />
        <ResearchWorkflowSettings />
        <AskAiButtonSettings />
        <TextSummarizerSettings />
        <TextRewriterSettings />
        <WriteCommandSettings />

        {/* <EnabledToolsSettings /> */}

        {/* Social Links */}
        <SocialLinks />
      </div>
    </div>
  );
};

