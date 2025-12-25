'use client';

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff } from "lucide-react";
import type { VertexCredentials } from "@cognito/shared";

interface VertexSetupProps {
    credentials: VertexCredentials;
    onCredentialsChange: (credentials: VertexCredentials) => void;
    disabled?: boolean;
}

export function VertexSetup({ credentials, onCredentialsChange, disabled = false }: VertexSetupProps) {
    const [showKey, setShowKey] = useState(false);

    const handleChange = (field: keyof VertexCredentials, value: string) => {
        onCredentialsChange({
            ...credentials,
            [field]: value,
        });
    };

    return (
        <div className="space-y-4">
            {/* Project ID and Location in a grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="vertex-project-id">
                        Project ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="vertex-project-id"
                        type="text"
                        value={credentials.projectId}
                        onChange={(e) => handleChange('projectId', e.target.value)}
                        placeholder="my-project-123"
                        disabled={disabled}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="vertex-location">
                        Location <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="vertex-location"
                        type="text"
                        value={credentials.location}
                        onChange={(e) => handleChange('location', e.target.value)}
                        placeholder="us-central1"
                        disabled={disabled}
                    />
                </div>
            </div>

            {/* Client Email */}
            <div className="space-y-2">
                <Label htmlFor="vertex-client-email">
                    Client Email <span className="text-destructive">*</span>
                </Label>
                <Input
                    id="vertex-client-email"
                    type="email"
                    value={credentials.clientEmail}
                    onChange={(e) => handleChange('clientEmail', e.target.value)}
                    placeholder="service-account@project.iam.gserviceaccount.com"
                    disabled={disabled}
                />
            </div>

            {/* Private Key */}
            <div className="space-y-2">
                <Label htmlFor="vertex-private-key">
                    Private Key <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                    <Textarea
                        id="vertex-private-key"
                        value={credentials.privateKey}
                        onChange={(e) => handleChange('privateKey', e.target.value)}
                        placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                        disabled={disabled}
                        rows={showKey ? 6 : 3}
                        className={`font-mono text-xs pr-12 ${!showKey ? 'blur-[4px]' : ''}`}
                    />
                    <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        tabIndex={-1}
                    >
                        {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
            </div>

            {/* Private Key ID (Optional) */}
            <div className="space-y-2">
                <Label htmlFor="vertex-private-key-id">
                    Private Key ID <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                    id="vertex-private-key-id"
                    type="text"
                    value={credentials.privateKeyId || ''}
                    onChange={(e) => handleChange('privateKeyId', e.target.value)}
                    placeholder="abc123def456..."
                    disabled={disabled}
                />
            </div>
        </div>
    );
}
