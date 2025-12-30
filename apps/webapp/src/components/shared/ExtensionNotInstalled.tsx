"use client";

import { Download, Home, Puzzle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Header } from "./Header";

interface ExtensionNotInstalledProps {
    /** Title shown in the Header */
    title: string;
    /** Optional description explaining what requires the extension. Defaults to generic message. */
    description?: string;
    /** Max width class for the container. Defaults to "max-w-4xl" */
    maxWidth?: string;
}

/**
 * Full-page component shown when the Cognito AI extension is not installed.
 * Displays a centered visual with icon, message, and actions.
 */
export function ExtensionNotInstalled({
    title,
    description = "The Cognito AI extension must be installed to access this feature.",
    maxWidth = "max-w-4xl",
}: ExtensionNotInstalledProps) {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-[var(--bg-primary)]">
            <Header title={title} />

            <div className={`container mx-auto ${maxWidth} py-16 px-4`}>
                {/* Centered content */}
                <div className="flex flex-col items-center justify-center text-center">
                    {/* Animated icon container */}
                    <div className="relative mb-8">
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-indigo-500/20 rounded-full blur-2xl scale-150 animate-pulse" />

                        {/* Icon background */}
                        <div className="relative flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-400/10 to-indigo-500/10 border border-blue-400/20 backdrop-blur-sm">
                            <Puzzle className="w-12 h-12 text-blue-400" strokeWidth={1.5} />
                        </div>

                        {/* Small badge */}
                        <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-8 h-8 rounded-full bg-[var(--bg-secondary)] border-2 border-blue-400/30 shadow-lg">
                            <Download className="w-4 h-4 text-blue-400" />
                        </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">
                        Extension Required
                    </h2>

                    {/* Description */}
                    <p className="text-[var(--text-secondary)] max-w-md mb-8 leading-relaxed">
                        {description}
                    </p>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <Button
                            onClick={() => router.push("/")}
                            variant="outline"
                            className="gap-2 px-6 border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-all duration-200"
                        >
                            <Home className="w-4 h-4" />
                            Go to Home
                        </Button>

                        <Button
                            onClick={() => window.open("https://chromewebstore.google.com/detail/cognito-ai", "_blank")}
                            className="gap-2 px-6 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white border-0 shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-blue-500/30 hover:scale-[1.02]"
                        >
                            <Download className="w-4 h-4" />
                            Install Extension
                        </Button>
                    </div>

                    {/* Subtle helper text */}
                    <p className="mt-6 text-xs text-[var(--text-tertiary)]">
                        Already installed? Try refreshing the page.
                    </p>
                </div>
            </div>
        </div>
    );
}
