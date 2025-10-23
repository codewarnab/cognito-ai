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
          <strong>Local Mode</strong> - Limited functionality.
          <button 
            onClick={onSettingsClick}
            className="local-mode-settings-link"
          >
            Add API key in Settings (⋮)
          </button>
          to unlock all features.
        </div>
      </div>
    </div>
  );
};
