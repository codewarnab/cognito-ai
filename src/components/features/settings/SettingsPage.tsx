import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { VoiceSettings } from '@/components/features/settings/components/VoiceSettings';
import { AskAiButtonSettings } from '@/components/features/settings/components/AskAiButtonSettings';
import { EnabledToolsSettings } from '@/components/features/settings/components/EnabledToolsSettings';
import { TTSAndDataSettings } from '@/components/features/settings/components/TTSAndDataSuggestionsSettings';
import { MaxToolCallSettings } from '@/components/features/settings/components/MaxToolCallSettings';
import { hasAnyProviderConfigured } from '@/utils/credentials';
import './SettingsPage.css';

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
    <div className="settings-page">
      {/* API Key Setup Link */}
      {needsProviderSetup && onProviderSetupClick && (
        <div className="settings-api-key-hint">
          Looking for configuring API keys?{' '}
          <button
            className="settings-api-key-link"
            onClick={onProviderSetupClick}
          >
            Click here
          </button>
        </div>
      )}

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

