'use client';

import { ChevronRight } from "lucide-react";
import type { AIProvider } from "@cognito/shared";

interface ProviderInstructionsProps {
    provider: AIProvider;
}

export function ProviderInstructions({ provider }: ProviderInstructionsProps) {
    return (
        <details className="group">
            <summary className="py-3 px-4 bg-muted/50 rounded-lg text-sm border cursor-pointer list-none flex items-center gap-2 text-muted-foreground hover:bg-muted transition-all">
                <ChevronRight
                    size={14}
                    className="transition-transform group-open:rotate-90"
                />
                <span>How to get {provider === 'google' ? 'API key' : 'credentials'}</span>
            </summary>
            <div className="mt-2 p-4 bg-muted/30 rounded-lg text-sm border leading-relaxed">
                {provider === 'google' ? (
                    <>
                        <ol className="list-decimal pl-4 text-muted-foreground space-y-1">
                            <li>
                                Visit{' '}
                                <a
                                    href="https://aistudio.google.com/app/apikey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary underline hover:no-underline"
                                >
                                    Google AI Studio
                                </a>
                            </li>
                            <li>Sign in with your Google account</li>
                            <li>Click &quot;Create API Key&quot; or &quot;Get API Key&quot;</li>
                            <li>Copy and paste the key above</li>
                        </ol>
                        <p className="mt-3 text-muted-foreground text-xs italic">
                            The free tier includes generous quotas for personal use.
                        </p>
                    </>
                ) : (
                    <>
                        <ol className="list-decimal pl-4 text-muted-foreground space-y-1">
                            <li>
                                Go to{' '}
                                <a
                                    href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary underline hover:no-underline"
                                >
                                    Google Cloud Console
                                </a>
                            </li>
                            <li>Navigate to &quot;IAM &amp; Admin&quot; → &quot;Service Accounts&quot;</li>
                            <li>Create a service account with &quot;Vertex AI User&quot; role</li>
                            <li>Create a JSON key and download it</li>
                            <li>Copy values from the JSON file above</li>
                        </ol>
                        <p className="mt-3 text-muted-foreground text-xs italic">
                            Ensure Vertex AI API is enabled in your project.
                        </p>
                    </>
                )}
            </div>
        </details>
    );
}
