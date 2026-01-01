import React, { useMemo } from "react"
import { Sliders, Check } from "lucide-react"
import { HeartPulseIcon } from "@/components/shared/icons"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"

interface McpServerCardActionsProps {
    serverId: string
    isEnabled: boolean
    isLoading: boolean
    isAuthenticated: boolean
    requiresAuth?: boolean
    isNarrowView: boolean
    healthCheckStatus: string
    onManageTools?: (serverId: string) => void
    onHealthCheck: () => void
    onAuthenticate: () => void
    onLogout: () => void
}

// Button style constants
const btnBase = "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
const btnSecondary = `${btnBase} px-3 py-1.5 text-xs bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20 hover:text-white`
const btnSecondaryIcon = `${btnBase} p-1.5 bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20 hover:text-white`
const btnPrimary = `${btnBase} px-4 py-1.5 text-xs bg-[#2563eb] text-white hover:bg-[#1d4ed8]`

// Animated Connect Button with text morphing and corner progress
interface AnimatedConnectButtonProps {
    status: "idle" | "loading" | "success"
    onClick: () => void
    disabled?: boolean
}

const AnimatedConnectButton: React.FC<AnimatedConnectButtonProps> = ({ status, onClick, disabled }) => {
    const text = useMemo(() => {
        switch (status) {
            case "idle": return "Connect"
            case "loading": return "Connecting"
            case "success": return "Connected"
        }
    }, [status])

    return (
        <div className="relative inline-flex">
            <button
                onClick={onClick}
                className={cn(
                    btnPrimary,
                    "min-w-[90px] relative",
                    status !== "idle" && "bg-white/10 text-white/70 hover:bg-white/10 cursor-not-allowed border border-white/20"
                )}
                disabled={disabled || status !== "idle"}
            >
                <span className="flex items-center justify-center">
                    <AnimatePresence mode="popLayout" initial={false}>
                        {text.split("").map((char, i) => (
                            <motion.span
                                key={`${char}-${i}-${status}`}
                                layout
                                initial={{ opacity: 0, scale: 0, filter: "blur(4px)" }}
                                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                                exit={{ opacity: 0, scale: 0, filter: "blur(4px)" }}
                                transition={{
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 30,
                                    mass: 1,
                                }}
                                className="inline-block"
                            >
                                {char === " " ? "\u00A0" : char}
                            </motion.span>
                        ))}
                    </AnimatePresence>
                </span>
            </button>

            {/* Corner Status Indicator */}
            <div className="absolute -top-1 -right-1 z-10 pointer-events-none">
                <AnimatePresence mode="wait">
                    {status !== "idle" && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0, x: -4, filter: "blur(4px)" }}
                            animate={{ opacity: 1, scale: 1, x: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, scale: 0, x: -4, filter: "blur(4px)" }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className={cn(
                                "flex items-center justify-center size-4 rounded-full ring-2 overflow-visible",
                                status === "success"
                                    ? "bg-emerald-500 text-white ring-[#1a1a2e]"
                                    : "bg-white/20 text-white/80 ring-[#1a1a2e]"
                            )}
                        >
                            <AnimatePresence mode="popLayout">
                                {status === "loading" && (
                                    <motion.div
                                        key="loader"
                                        initial={{ opacity: 1 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="absolute inset-0 flex items-center justify-center"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                fill="currentColor"
                                                d="M12 2A10 10 0 1 0 22 12A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8A8 8 0 0 1 12 20Z"
                                                opacity=".3"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M20 12h2A10 10 0 0 0 12 2V4A8 8 0 0 1 20 12Z"
                                            >
                                                <animateTransform
                                                    attributeName="transform"
                                                    dur="1s"
                                                    from="0 12 12"
                                                    repeatCount="indefinite"
                                                    to="360 12 12"
                                                    type="rotate"
                                                />
                                            </path>
                                        </svg>
                                    </motion.div>
                                )}
                                {status === "success" && (
                                    <motion.div
                                        key="check"
                                        initial={{ scale: 0, opacity: 0, filter: "blur(4px)" }}
                                        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                                        exit={{ scale: 0, opacity: 0, filter: "blur(4px)" }}
                                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                        className="absolute inset-0 flex items-center justify-center"
                                    >
                                        <Check size={10} strokeWidth={3} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

export const McpServerCardActions: React.FC<McpServerCardActionsProps> = ({
    serverId,
    isEnabled,
    isLoading,
    isAuthenticated,
    requiresAuth = true,
    isNarrowView,
    healthCheckStatus,
    onManageTools,
    onHealthCheck,
    onAuthenticate,
    onLogout
}) => {
    return (
        <div className="flex gap-2">
            {requiresAuth ? (
                isAuthenticated ? (
                    <>
                        {isEnabled && onManageTools && (
                            <button
                                className={isNarrowView ? btnSecondaryIcon : btnSecondary}
                                onClick={() => onManageTools(serverId)}
                                disabled={isLoading}
                                title="Manage Tools"
                            >
                                {isNarrowView ? (
                                    <Sliders size={16} />
                                ) : (
                                    'Manage Tools'
                                )}
                            </button>
                        )}
                        {isEnabled && (
                            <button
                                className={isNarrowView ? btnSecondaryIcon : btnSecondary}
                                onClick={onHealthCheck}
                                disabled={isLoading}
                                title="Check server health"
                            >
                                {isNarrowView ? (
                                    <HeartPulseIcon size={16} />
                                ) : (
                                    isLoading && healthCheckStatus.includes('Checking') ? 'Checking...' : 'Health Check'
                                )}
                            </button>
                        )}
                        <button
                            className={btnSecondary}
                            onClick={onLogout}
                            disabled={isLoading}
                        >
                            {isLoading && !healthCheckStatus.includes('Checking') ? 'Loading...' : 'Logout'}
                        </button>
                    </>
                ) : (
                    <AnimatedConnectButton
                        status={isLoading ? "loading" : "idle"}
                        onClick={onAuthenticate}
                        disabled={isLoading}
                    />
                )
            ) : (
                <>
                    {isEnabled && onManageTools && (
                        <button
                            className={isNarrowView ? btnSecondaryIcon : btnSecondary}
                            onClick={() => onManageTools(serverId)}
                            disabled={isLoading}
                            title="Manage Tools"
                        >
                            {isNarrowView ? (
                                <Sliders size={16} />
                            ) : (
                                'Manage Tools'
                            )}
                        </button>
                    )}
                    {isEnabled && (
                        <button
                            className={isNarrowView ? btnSecondaryIcon : btnSecondary}
                            onClick={onHealthCheck}
                            disabled={isLoading}
                            title="Check server health"
                        >
                            {isNarrowView ? (
                                <HeartPulseIcon size={16} />
                            ) : (
                                isLoading && healthCheckStatus.includes('Checking') ? 'Checking...' : 'Health Check'
                            )}
                        </button>
                    )}
                </>
            )}
        </div>
    )
}
