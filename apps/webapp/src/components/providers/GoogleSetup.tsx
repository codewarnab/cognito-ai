'use client';

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

interface GoogleSetupProps {
    apiKey: string;
    onApiKeyChange: (value: string) => void;
    disabled?: boolean;
}

export function GoogleSetup({ apiKey, onApiKeyChange, disabled = false }: GoogleSetupProps) {
    const [showKey, setShowKey] = useState(false);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="google-api-key">API Key</Label>
                <div className="relative">
                    <Input
                        id="google-api-key"
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => onApiKeyChange(e.target.value)}
                        placeholder="Enter your Google AI Studio API key"
                        disabled={disabled}
                        className="pr-12"
                    />
                    <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        tabIndex={-1}
                    >
                        {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
