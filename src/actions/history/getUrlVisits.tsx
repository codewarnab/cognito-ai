import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '../../logger';
import { CompactToolCard } from '../../components/ui/tools/cards';
import type { ToolUIState } from '../../ai/tools/components';

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
            const { state: toolState, input, output, errorText } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return (
                    <CompactToolCard
                        toolName="getUrlVisits"
                        state="loading"
                        input={input}
                    />
                );
            }

            if (toolState === 'output-available' && output) {
                const cardState = (output as any).error ? 'error' : 'success';
                return (
                    <CompactToolCard
                        toolName="getUrlVisits"
                        state={cardState}
                        input={input}
                        output={output}
                        errorText={(output as any).error}
                    />
                );
            }

            if (toolState === 'output-error') {
                return (
                    <CompactToolCard
                        toolName="getUrlVisits"
                        state="error"
                        input={input}
                        errorText={errorText}
                    />
                );
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

