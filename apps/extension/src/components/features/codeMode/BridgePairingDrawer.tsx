import React, { useState, useEffect } from 'react';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerFooter,
} from '@/components/ui/primitives/drawer';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
    InputOTPSeparator,
} from '@/components/ui/primitives/input-otp';
import { Link, Loader2, WifiOff, CheckCircle } from 'lucide-react';
import { cn } from '@/utils/ui';
import { useCodeModeStore } from '@/stores/codeMode/codeModeStore';
import type { CodeModeState } from '@/stores/codeMode/types';

interface BridgePairingDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Animated drawer for entering the pairing code to connect with the local code bridge.
 * Uses 6-digit OTP input with smooth animations.
 */
export const BridgePairingDrawer: React.FC<BridgePairingDrawerProps> = ({
    isOpen,
    onClose,
}) => {
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const [success, setSuccess] = useState(false);

    const pairWithBridge = useCodeModeStore((s: CodeModeState) => s.pairWithBridge);

    // Reset state when drawer opens/closes
    useEffect(() => {
        if (!isOpen) {
            setCode('');
            setError(undefined);
            setSuccess(false);
            setIsLoading(false);
        }
    }, [isOpen]);

    // Auto-submit when 6 digits entered
    useEffect(() => {
        if (code.length === 6) {
            handleSubmit();
        }
    }, [code]);

    const handleSubmit = async () => {
        if (code.length !== 6) {
            setError('Please enter all 6 digits');
            return;
        }

        setIsLoading(true);
        setError(undefined);

        // Format code as XXX-XXX for the bridge
        const formattedCode = `${code.slice(0, 3)}-${code.slice(3, 6)}`;

        const result = await pairWithBridge(formattedCode);

        if (result) {
            setSuccess(true);
            // Auto-close after success animation
            setTimeout(() => {
                onClose();
            }, 1000);
        } else {
            setError('Invalid code. Check the terminal and try again.');
            setCode('');
        }

        setIsLoading(false);
    };

    const handleClose = () => {
        if (!isLoading) {
            onClose();
        }
    };

    return (
        <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DrawerContent className="max-w-md mx-auto">
                <DrawerHeader>
                    <DrawerTitle>
                        <div className="relative">
                            {/* Animated glow behind icon */}
                            <div className={cn(
                                "absolute inset-0 blur-xl rounded-full animate-pulse",
                                success ? "bg-green-500/30" : "bg-blue-500/30"
                            )} />
                            {success ? (
                                <CheckCircle className="w-6 h-6 text-green-400 relative z-10" />
                            ) : (
                                <Link className="w-6 h-6 text-blue-400 relative z-10" />
                            )}
                        </div>
                        <span className={cn(
                            "bg-clip-text text-transparent",
                            success
                                ? "bg-gradient-to-r from-green-300 via-green-100 to-green-300"
                                : "bg-gradient-to-r from-white via-blue-100 to-white"
                        )}>
                            {success ? 'Connected!' : 'Pair with Code Bridge'}
                        </span>
                    </DrawerTitle>
                    <DrawerDescription className="text-center">
                        {success
                            ? 'You can now use Code Mode to edit your local files.'
                            : 'Enter the 6-digit code shown in your terminal.'}
                    </DrawerDescription>
                </DrawerHeader>

                {!success && (
                    <div className="flex flex-col items-center gap-6 py-4">
                        {/* Terminal hint */}
                        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] bg-[var(--bg-tertiary)]/30 px-3 py-1.5 rounded-full">
                            <WifiOff className="w-3 h-3" />
                            <span>Run <code className="text-blue-400 font-mono">pnpm dev</code> in code-bridge</span>
                        </div>

                        {/* OTP Input */}
                        <div
                            className={cn(
                                "transition-transform duration-200",
                                error && "animate-shake"
                            )}
                        >
                            <InputOTP
                                maxLength={6}
                                value={code}
                                onChange={setCode}
                                disabled={isLoading}
                            >
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} />
                                    <InputOTPSlot index={1} />
                                    <InputOTPSlot index={2} />
                                </InputOTPGroup>
                                <InputOTPSeparator />
                                <InputOTPGroup>
                                    <InputOTPSlot index={3} />
                                    <InputOTPSlot index={4} />
                                    <InputOTPSlot index={5} />
                                </InputOTPGroup>
                            </InputOTP>
                        </div>

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="flex items-center gap-2 text-sm text-blue-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Connecting...</span>
                            </div>
                        )}

                        {/* Error message */}
                        {error && (
                            <div
                                className={cn(
                                    'text-sm text-red-400 text-center',
                                    'bg-red-500/10 border border-red-500/30',
                                    'px-4 py-2 rounded-xl',
                                )}
                            >
                                {error}
                            </div>
                        )}
                    </div>
                )}

                <DrawerFooter>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isLoading}
                        className={cn(
                            'w-full py-3 px-4 rounded-xl',
                            'text-sm font-medium cursor-pointer',
                            'transition-all duration-200',
                            'bg-white/5 hover:bg-white/10',
                            'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                            'border border-[var(--border-color)]/30 hover:border-[var(--border-color)]/50',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            'hover:scale-[1.02] active:scale-[0.98]',
                        )}
                    >
                        {success ? 'Close' : 'Cancel'}
                    </button>
                </DrawerFooter>

                {/* Keyframe animations */}
                <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
            20%, 40%, 60%, 80% { transform: translateX(2px); }
          }
          
          .animate-shake {
            animation: shake 0.5s ease-in-out;
          }
        `}</style>
            </DrawerContent>
        </Drawer>
    );
};
