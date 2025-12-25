'use client';

import { useExtension } from '@/hooks/useExtension';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

export function ExtensionStatus() {
    const { isInstalled, isLoading, error, refresh } = useExtension();

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Extension Status</CardTitle>
                <CardDescription>Checking connection to Cognito AI extension</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        ) : isInstalled ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                            <XCircle className="w-5 h-5 text-destructive" />
                        )}
                        <span className="font-medium">
                            {isLoading
                                ? 'Connecting...'
                                : isInstalled
                                    ? 'Connected'
                                    : 'Not Detected'}
                        </span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={refresh} disabled={isLoading}>
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                {error && (
                    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                        Error: {error.message}
                    </div>
                )}

                {!isInstalled && !isLoading && (
                    <div className="text-sm text-muted-foreground">
                        Make sure the extension is installed and allowed to communicate with this domain.
                        Check <code>NEXT_PUBLIC_EXTENSION_ID</code> in <code>.env.local</code>.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
