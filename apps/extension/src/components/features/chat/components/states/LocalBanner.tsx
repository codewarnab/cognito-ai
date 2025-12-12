import React from 'react';
import { AlertCircle } from 'lucide-react';

interface LocalBannerProps {
  onApiKeySetupClick?: () => void;
}

export const LocalBanner: React.FC<LocalBannerProps> = ({ onApiKeySetupClick }) => {
  return (
    <div className="mx-4 mb-3 mt-5 flex items-start gap-3 rounded-xl bg-gradient-to-br from-white/5 to-white/2 px-5 py-4 text-sm text-white/90 backdrop-blur-md">
      <div className="flex w-full items-start gap-3">
        <AlertCircle size={14} className="mt-0.5 shrink-0 text-white" />
        <div className="flex flex-1 flex-wrap items-center gap-1 leading-normal">
          Local mode has limited functionality.
          {onApiKeySetupClick && (
            <>
              {' '}
              <button
                onClick={onApiKeySetupClick}
                className="relative mx-1 overflow-hidden rounded-lg border border-[#4A90E2] bg-transparent px-3 py-1.5 text-[13px] font-semibold text-[#4A90E2] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:bg-[#4A90E2]/10 hover:shadow-[0_4px_12px_rgba(74,144,226,0.2)] active:translate-y-0 active:shadow-[0_2px_4px_rgba(74,144,226,0.2)] before:absolute before:-left-full before:top-0 before:h-full before:w-full before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:transition-[left] before:duration-500 before:ease-out hover:before:left-full"
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
