import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { VoiceSettings } from '@/components/features/settings/components/VoiceSettings';
import { AskAiButtonSettings } from '@/components/features/settings/components/AskAiButtonSettings';
import { EnabledToolsSettings } from '@/components/features/settings/components/EnabledToolsSettings';
import { TTSAndDataSettings } from '@/components/features/settings/components/TTSAndDataSuggestionsSettings';
import { MaxToolCallSettings } from '@/components/features/settings/components/MaxToolCallSettings';
import './SettingsPage.css';

interface SettingsPageProps {
  onBack: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  return (
    <div className="settings-page">
      {/* Header */}
      <div className="settings-header">
        <button
          className="settings-back-button"
          onClick={onBack}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="settings-title-container">
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">Manage tools, voice, TTS, and data</p>
        </div>
      </div>

      {/* Content */}
      <div className="settings-content">
        <VoiceSettings />
        <TTSAndDataSettings />
        <AskAiButtonSettings />
        <EnabledToolsSettings />
        <MaxToolCallSettings />
      </div>
    </div>
  );
};

