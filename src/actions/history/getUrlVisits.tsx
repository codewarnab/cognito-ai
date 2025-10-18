import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { ToolCard } from '../../components/ui/ToolCard';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Actions-History-UrlVisits');

export function useGetUrlVisits() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering getUrlVisits tool...');

        registerTool({
            name: 'getUrlVisits',
            description: 'Get detailed visit information for a specific URL including all visit timestamps and how the user navigated to the page.',
            parameters: z.object({
                url: z.string().describe('The URL to get visit details for'),
            }),
            execute: async ({ url }) => {
                try {
                    // Normalize and validate URL input before calling the Chrome API
                    const normalizedUrl = typeof url === 'string' ? url.trim() : String(url ?? '');

                    if (!normalizedUrl) {
                        log.warn('getUrlVisits: missing or empty url', { url });
                        return { success: false, error: 'URL is required', details: 'Provide a non-empty URL string' };
                    }

                    // Validate URL format using the URL constructor; return a clear error if invalid
                    let validatedUrl = normalizedUrl;
                    try {
                        // Throws if not a valid absolute URL
                        // eslint-disable-next-line no-new
                        new URL(validatedUrl);
                    } catch (_) {
                        log.warn('getUrlVisits: invalid URL format', { url: normalizedUrl });
                        return { success: false, error: 'Invalid URL format', details: `Value provided: ${normalizedUrl}` };
                    }

                    log.info('getUrlVisits', { url: validatedUrl });

                    const visits = await chrome.history.getVisits({ url: validatedUrl });

                    const formattedVisits = visits.map(visit => ({
                        visitId: visit.visitId,
                        visitTime: visit.visitTime,
                        referringVisitId: visit.referringVisitId,
                        transition: visit.transition
                    }));

                    return {
                        success: true,
                        url: validatedUrl,
                        visitCount: formattedVisits.length,
                        visits: formattedVisits
                    };
                } catch (error) {
                    log.error('[Tool] Error getting URL visits:', error);
                    return { error: 'Failed to get URL visits', details: String(error) };
                }
            },
        });

        registerToolUI('getUrlVisits', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return <ToolCard title="Getting Visit Details" subtitle={input?.url} state="loading" icon="📊" />;
            }

            if (toolState === 'output-available' && output) {
                if ((output as any).error) {
                    return <ToolCard title="Failed to Get Visits" subtitle={(output as any).error} state="error" icon="📊" />;
                }

                const res: any = output;
                return (
                    <ToolCard
                        title="Visit Details"
                        subtitle={`${res.visitCount} visit(s) to this URL`}
                        state="success"
                        icon="📊"
                    >
                        <div style={{
                            fontSize: '11px',
                            marginTop: '8px',
                            marginBottom: '8px',
                            opacity: 0.7,
                            wordBreak: 'break-all'
                        }}>
                            {res.url}
                        </div>
                        {res.visits && res.visits.length > 0 && (
                            <div style={{ fontSize: '12px' }}>
                                {res.visits.slice(0, 10).map((visit: any) => (
                                    <div key={visit.visitId} style={{
                                        padding: '6px 8px',
                                        marginBottom: '4px',
                                        background: 'rgba(0,0,0,0.03)',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontSize: '11px'
                                    }}>
                                        <span>{new Date(visit.visitTime || 0).toLocaleString()}</span>
                                        <span style={{
                                            opacity: 0.6,
                                            fontSize: '10px',
                                            textTransform: 'lowercase'
                                        }}>
                                            {visit.transition || 'unknown'}
                                        </span>
                                    </div>
                                ))}
                                {res.visits.length > 10 && (
                                    <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '4px' }}>
                                        Showing 10 of {res.visits.length} visits
                                    </div>
                                )}
                            </div>
                        )}
                    </ToolCard>
                );
            }

            if (toolState === 'output-error') {
                return <ToolCard title="Failed to Get Visits" subtitle={state.errorText} state="error" icon="📊" />;
            }

            return null;
        });

        log.info('✅ getUrlVisits tool registration complete');

        return () => {
            log.info('🧹 Cleaning up getUrlVisits tool');
            unregisterToolUI('getUrlVisits');
        };
    }, []);
}
