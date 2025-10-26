import React from 'react';
import { AlertCircle } from 'lucide-react';

interface LocalBannerProps {
  onApiKeySetupClick?: () => void;
}

export const LocalBanner: React.FC<LocalBannerProps> = ({ onApiKeySetupClick }) => {
  return (
    <div className="local-mode-banner">
      <div className="local-mode-banner-content">
        <AlertCircle size={14} className="local-mode-icon" />
        <div className="local-mode-text">
          Local mode has limited functionality.
          {onApiKeySetupClick && (
            <>
              {' '}
              <button
                onClick={onApiKeySetupClick}
                className="local-mode-settings-button"
              >
                Configure
              </button>
              {' '}for better performance.
            </>
          )}
        </div>
      </div>
    </div>
  );
};
