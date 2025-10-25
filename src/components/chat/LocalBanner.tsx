import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { GeminiApiKeyDialog } from '../GeminiApiKeyDialog';

interface LocalBannerProps {
  onApiKeySaved?: () => void;
}

export const LocalBanner: React.FC<LocalBannerProps> = ({ onApiKeySaved }) => {
  const [showGeminiDialog, setShowGeminiDialog] = useState(false);

  const handleSettingsClick = () => {
    setShowGeminiDialog(true);
  };

  return (
    <>
      <div className="local-mode-banner">
        <div className="local-mode-banner-content">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <AlertCircle size={14} className="local-mode-icon" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div className="local-mode-text">
              <strong>Local Mode</strong> - Limited functionality. Add API key in{' '}
              <span
                className="local-mode-settings-link"
                role="link"
                tabIndex={0}
                onClick={handleSettingsClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSettingsClick();
                  }
                }}
                style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Settings
              </span>{' '}
              to unlock all features.
            </div>
          </div>
        </div>
      </div>

      {/* Gemini API Key Dialog */}
      <GeminiApiKeyDialog
        isOpen={showGeminiDialog}
        onClose={() => setShowGeminiDialog(false)}
        onApiKeySaved={onApiKeySaved}
      />
    </>
  );
};
