import React, { useEffect } from 'react';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerFooter,
} from '@/components/ui/primitives/drawer';
import { CheckCircle, Loader2, Terminal, WifiOff } from 'lucide-react';
import { cn } from '@/utils/ui';
import { ENV } from '@/utils/env';
import { useCliModeStore } from '@/stores/cliMode/cliModeStore';
import { useUINavigationStore } from '@/stores';
import type { CliModeState } from '@/stores/cliMode/types';
import type { UINavigationState } from '@/stores';

/** Command to start the bridge - differs between dev and production builds */
const BRIDGE_START_COMMAND = ENV.DEV ? 'pnpm dev:bridge' : 'npx @cognito/cli-bridge';

interface BridgeStatusDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Drawer that shows bridge connection status and auto-closes when connected.
 * Pairing codes are no longer required — the extension auto-connects.
 */
export const BridgeStatusDrawer: React.FC<BridgeStatusDrawerProps> = ({ isOpen, onClose }) => {
    const bridgeStatus = useCliModeStore((s: CliModeState) => s.bridgeStatus);
    const bridgeBaseUrl = useCliModeStore((s: CliModeState) => s.bridgeBaseUrl);

    // Voice FAB visibility management - hide when drawer is open
    const setVoiceFabVisibility = useUINavigationStore(
        (state: UINavigationState) => state.setVoiceFabVisibility
    );

    useEffect(() => {
        setVoiceFabVisibility(!isOpen);
    }, [isOpen, setVoiceFabVisibility]);

    // Auto-close when connected
    useEffect(() => {
        if (isOpen && bridgeStatus === 'connected') {
            const t = setTimeout(() => onClose(), 500);
            return () => clearTimeout(t);
        }
        return undefined;
    }, [isOpen, bridgeStatus, onClose]);

    const isConnected = bridgeStatus === 'connected';
    const isConnecting = bridgeStatus === 'connecting';

    const Icon = isConnected ? CheckCircle : isConnecting ? Loader2 : WifiOff;
    const iconClassName = cn(
        'w-6 h-6 relative z-10',
        isConnected && 'text-green-400',
        isConnecting && 'text-blue-400 animate-spin',
        !isConnected && !isConnecting && 'text-amber-400'
    );

    const title = isConnected
        ? 'Connected!'
        : isConnecting
            ? 'Connecting to CLI Bridge...'
            : 'Waiting for CLI Bridge...';

    const description = isConnected
        ? 'You can now use CLI Mode to edit your local files.'
        : isConnecting
            ? `Bridge detected at ${bridgeBaseUrl}. Finishing handshake...`
            : 'Start the local bridge server — we will auto-connect.';

    const handleClose = () => {
        onClose();
    };

    return (
        <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DrawerContent className="max-w-md mx-auto">
                <DrawerHeader>
                    <DrawerTitle>
                        <div className="relative">
                            {/* Animated glow behind icon */}
                            <div
                                className={cn(
                                    'absolute inset-0 blur-xl rounded-full animate-pulse',
                                    isConnected
                                        ? 'bg-green-500/30'
                                        : isConnecting
                                            ? 'bg-blue-500/30'
                                            : 'bg-amber-500/30'
                                )}
                            />
                            <Icon className={iconClassName} />
                        </div>
                        <span
                            className={cn(
                                'bg-clip-text text-transparent',
                                isConnected
                                    ? 'bg-gradient-to-r from-green-300 via-green-100 to-green-300'
                                    : isConnecting
                                        ? 'bg-gradient-to-r from-white via-blue-100 to-white'
                                        : 'bg-gradient-to-r from-amber-200 via-white to-amber-200'
                            )}
                        >
                            {title}
                        </span>
                    </DrawerTitle>
                    <DrawerDescription className="text-center">{description}</DrawerDescription>
                </DrawerHeader>

                {!isConnected && (
                    <div className="flex flex-col items-center gap-4 py-4">
                        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] bg-[var(--bg-tertiary)]/30 px-3 py-1.5 rounded-full">
                            <Terminal className="w-3 h-3" />
                            <span>
                                Start the bridge:{' '}
                                <code className="text-blue-400 font-mono">{BRIDGE_START_COMMAND}</code>
                            </span>
                        </div>
                        <div className="text-xs text-[var(--text-tertiary)] text-center px-6">
                            This runs <code className="text-blue-400 font-mono">@cognito/cli-bridge</code> on{' '}
                            <code className="text-blue-400 font-mono">{bridgeBaseUrl}</code>.
                        </div>
                    </div>
                )}

                <DrawerFooter>
                    <button
                        type="button"
                        onClick={handleClose}
                        className={cn(
                            'w-full py-3 px-4 rounded-xl',
                            'text-sm font-medium cursor-pointer',
                            'transition-all duration-200',
                            'bg-white/5 hover:bg-white/10',
                            'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                            'border border-[var(--border-color)]/30 hover:border-[var(--border-color)]/50',
                            'hover:scale-[1.02] active:scale-[0.98]'
                        )}
                    >
                        {isConnected ? 'Close' : 'Cancel'}
                    </button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
};

