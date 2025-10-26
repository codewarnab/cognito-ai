import React from 'react';
import { AlertCircle } from 'lucide-react';

interface LocalBannerProps {
  onSettingsClick?: () => void;
}

export const LocalBanner: React.FC<LocalBannerProps> = ({ onSettingsClick }) => {
  return (
    <div className="local-mode-banner">
      <div className="local-mode-banner-content">
        <AlertCircle size={16} className="local-mode-icon" />
        <div className="local-mode-text">
          <span className="local-mode-title">Local Mode</span> - Limited functionality.
          <button
            onClick={onSettingsClick}
            className="local-mode-settings-button"
          >
            Add API key in Settings
          </button>
          to unlock all features.
        </div>
      </div>
    </div>
  );
};
