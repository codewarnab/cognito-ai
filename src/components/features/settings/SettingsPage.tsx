import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { VoiceSettings } from './components/VoiceSettings';
import { AskAiButtonSettings } from './components/AskAiButtonSettings';
import { EnabledToolsSettings } from './components/EnabledToolsSettings';
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
          <p className="settings-subtitle">Manage tools, voice, and Ask AI button</p>
        </div>
      </div>

      {/* Content */}
      <div className="settings-content">
        <VoiceSettings />
        <AskAiButtonSettings />
        <EnabledToolsSettings />
      </div>
    </div>
  );
};

