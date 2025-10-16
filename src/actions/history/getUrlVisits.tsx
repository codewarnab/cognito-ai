import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard } from "../../components/ui/ToolCard";

const log = createLogger("Actions-History-UrlVisits");

export function useGetUrlVisits() {
    useFrontendTool({
        name: "getUrlVisits",
        description: "Get detailed visit information for a specific URL including all visit timestamps and how the user navigated to the page.",
        parameters: [
            {
                name: "url",
                type: "string",
                description: "The URL to get visit details for",
                required: true
            }
        ],
        handler: async ({ url }) => {
            if (!shouldProcess("getUrlVisits", { url })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                // Normalize and validate URL input before calling the Chrome API
                const normalizedUrl = typeof url === "string" ? url.trim() : String(url ?? "");

                if (!normalizedUrl) {
                    log.warn("getUrlVisits: missing or empty url", { url });
                    return { success: false, error: "URL is required", details: "Provide a non-empty URL string" };
                }

                // Validate URL format using the URL constructor; return a clear error if invalid
                let validatedUrl = normalizedUrl;
                try {
                    // Throws if not a valid absolute URL
                    // eslint-disable-next-line no-new
                    new URL(validatedUrl);
                } catch (_) {
                    log.warn("getUrlVisits: invalid URL format", { url: normalizedUrl });
                    return { success: false, error: "Invalid URL format", details: `Value provided: ${normalizedUrl}` };
                }

                log.info("getUrlVisits", { url: validatedUrl });

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
                log.error('[FrontendTool] Error getting URL visits:', error);
                return { error: "Failed to get URL visits", details: String(error) };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return <ToolCard title="Getting Visit Details" subtitle={args.url} state="loading" icon="📊" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Failed to Get Visits" subtitle={result.error} state="error" icon="📊" />;
                }
                return (
                    <ToolCard
                        title="Visit Details"
                        subtitle={`${result.visitCount} visit(s) to this URL`}
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
                            {result.url}
                        </div>
                        {result.visits && result.visits.length > 0 && (
                            <div style={{ fontSize: '12px' }}>
									{result.visits.slice(0, 10).map((visit: any, idx: number) => (
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
                                {result.visits.length > 10 && (
                                    <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '4px' }}>
                                        Showing 10 of {result.visits.length} visits
                                    </div>
                                )}
                            </div>
                        )}
                    </ToolCard>
                );
            }
            return null;
        },
    });
}
