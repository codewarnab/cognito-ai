import React, { useEffect } from "react";
import { z } from "zod";
import { createLogger } from "../../logger";
import { registerTool } from "../../ai/toolRegistryUtils";
import { useToolUI } from "../../ai/ToolUIContext";
import { ToolCard, CodeBlock, Badge } from "../../components/ui/ToolCard";
import type { ToolUIState } from "../../ai/ToolUIContext";

const log = createLogger("Actions-YouTube");

// User-friendly error messages
const ERROR_MESSAGES: Record<string, string> = {
  "not_youtube": "Please open a YouTube video first to use this feature.",
  "no_captions": "This video doesn't have any captions or transcript available.",
  "fetch_failed": "Unable to get the transcript. Please try again or check if the video has captions.",
  "parse_failed": "Unable to process the transcript. Please try a different video.",
  "no_transcript": "No transcript found. Make sure the video has captions/transcript available.",
};

interface TranscriptSegment {
  timestamp: number;
  text: string;
}

interface TranscriptResult {
  success: boolean;
  transcript?: TranscriptSegment[];
  videoTitle?: string;
  videoUrl?: string;
  language?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Extracts YouTube transcript from the active tab
 */
async function extractYoutubeTranscript(
  lang?: string,
  limitSeconds?: number
): Promise<TranscriptResult> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log("i am executing youtube transcript", tab);
    
    if (!tab.id || !tab.url?.includes("youtube.com/watch")) {
      return {
        success: false,
        error: ERROR_MESSAGES.not_youtube,
        errorCode: "not_youtube",
      };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [lang || null, limitSeconds || null],
      func: async (preferredLang: string | null, maxSeconds: number | null) => {
        try {
          // Method 1: Try ytInitialPlayerResponse
          const ytData = (window as any).ytInitialPlayerResponse;
          if (ytData?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
            const tracks = ytData.captions.playerCaptionsTracklistRenderer.captionTracks;
            
            // Find preferred language or fallback to first available
            let track = preferredLang 
              ? tracks.find((t: any) => t.languageCode === preferredLang) || tracks[0]
              : tracks[0];
            
            if (track?.baseUrl) {
              const url = track.baseUrl + "&fmt=json3";
              const response = await fetch(url);
              const data = await response.json();
              
              const segments: TranscriptSegment[] = [];
              
              if (data.events) {
                for (const event of data.events) {
                  if (event.segs) {
                    const timestamp = (event.tStartMs || 0) / 1000;
                    
                    // Skip if beyond limit
                    if (maxSeconds !== null && timestamp > maxSeconds) break;
                    
                    const text = event.segs
                      .map((seg: any) => seg.utf8 || "")
                      .join("")
                      .trim();
                    
                    if (text) {
                      segments.push({ timestamp, text });
                    }
                  }
                }
              }
              
              if (segments.length > 0) {
                return {
                  success: true,
                  transcript: segments,
                  videoTitle: document.title.replace(" - YouTube", ""),
                  videoUrl: location.href,
                  language: track.languageCode,
                };
              }
            }
          }
          
          // Method 2: Fallback - try to read from transcript panel DOM
          const transcriptSegments = document.querySelectorAll(
            "ytd-transcript-segment-renderer"
          );
          
          if (transcriptSegments.length > 0) {
            const segments: TranscriptSegment[] = [];
            
            transcriptSegments.forEach((segment) => {
              const timeElement = segment.querySelector(
                ".segment-timestamp"
              ) as HTMLElement;
              const textElement = segment.querySelector(
                ".segment-text"
              ) as HTMLElement;
              
              if (timeElement && textElement) {
                const timeText = timeElement.textContent?.trim() || "0:00";
                const text = textElement.textContent?.trim() || "";
                
                // Parse timestamp (format: "MM:SS" or "H:MM:SS")
                const parts = timeText.split(":").map(Number);
                let timestamp = 0;
                if (parts.length === 2) {
                  timestamp = parts[0] * 60 + parts[1];
                } else if (parts.length === 3) {
                  timestamp = parts[0] * 3600 + parts[1] * 60 + parts[2];
                }
                
                // Skip if beyond limit
                if (maxSeconds !== null && timestamp > maxSeconds) return;
                
                if (text) {
                  segments.push({ timestamp, text });
                }
              }
            });
            
            if (segments.length > 0) {
              return {
                success: true,
                transcript: segments,
                videoTitle: document.title.replace(" - YouTube", ""),
                videoUrl: location.href,
                language: "unknown",
              };
            }
          }
          
          // No transcript found
          return {
            success: false,
            error: "no_captions",
            errorCode: "no_captions",
          };
        } catch (error) {
          return {
            success: false,
            error: "fetch_failed",
            errorCode: "fetch_failed",
            details: error instanceof Error ? error.message : String(error),
          };
        }
      },
    });

    const result = results[0]?.result;
    if (!result) {
      return {
        success: false,
        error: ERROR_MESSAGES.fetch_failed,
        errorCode: "fetch_failed",
      };
    }

    if (!result.success && result.errorCode) {
      return {
        success: false,
        error: ERROR_MESSAGES[result.errorCode] || ERROR_MESSAGES.fetch_failed,
        errorCode: result.errorCode,
      };
    }

    return result;
  } catch (error) {
    log.error("Error extracting YouTube transcript:", error);
    return {
      success: false,
      error: ERROR_MESSAGES.fetch_failed,
      errorCode: "fetch_failed",
    };
  }
}

/**
 * Register YouTube-related actions
 */
export function registerYoutubeActions() {
  const { registerToolUI, unregisterToolUI } = useToolUI();

  useEffect(() => {
    log.info('🔧 Registering getYoutubeTranscript tool...');
    
    // Register the tool
    registerTool({
      name: "getYoutubeTranscript",
      description:
        "Fetch the transcript/captions from the currently active YouTube video. Use this when the user asks about video content, wants a summary, or needs to answer questions about a YouTube video. Only works when a YouTube video page is open.",
      parameters: z.object({
        lang: z.string()
          .optional()
          .describe("Preferred language code (e.g., 'en', 'es'). Optional."),
        limitSeconds: z.number()
          .optional()
          .describe("Limit transcript to first N seconds of video. Optional."),
      }),
      execute: async ({ lang, limitSeconds }) => {
        try {
          log.info("TOOL CALL: getYoutubeTranscript", { lang, limitSeconds });
          const result = await extractYoutubeTranscript(lang, limitSeconds);
          
          if (result.success) {
            log.info('✅ YouTube transcript extracted', { 
              videoTitle: result.videoTitle,
              segmentCount: result.transcript?.length 
            });
          } else {
            log.warn('⚠️ YouTube transcript extraction failed', { errorCode: result.errorCode });
          }
          
          return result;
        } catch (error) {
          log.error('[Tool] Error in getYoutubeTranscript:', error);
          return {
            success: false,
            error: ERROR_MESSAGES.fetch_failed,
            errorCode: "fetch_failed",
          };
        }
      },
    });

    // Register the UI renderer
    registerToolUI("getYoutubeTranscript", (state: ToolUIState) => {
      const { state: toolState, input, output } = state;

      if (toolState === "input-streaming" || toolState === "input-available") {
        return (
          <ToolCard
            title="Fetching YouTube Transcript"
            subtitle="Reading video captions..."
            state="loading"
            icon="🎥"
          />
        );
      }

      if (toolState === "output-available" && output) {
        if (output.error) {
          return (
            <ToolCard
              title="Transcript Unavailable"
              subtitle={output.error}
              state="error"
              icon="🎥"
            />
          );
        }

        const segmentCount = output.transcript?.length || 0;
        const duration = output.transcript?.[output.transcript.length - 1]?.timestamp || 0;
        const minutes = Math.floor(duration / 60);

        return (
          <ToolCard
            title="Transcript Retrieved"
            subtitle={`${output.videoTitle || "YouTube Video"}`}
            state="success"
            icon="🎥"
          >
            <Badge label={`${segmentCount} segments`} variant="default" />
            {duration > 0 && <Badge label={`${minutes}m ${Math.floor(duration % 60)}s`} variant="default" />}
            {output.language && <Badge label={output.language} variant="default" />}
            {output.transcript && output.transcript.length > 0 && (
              <details className="tool-details">
                <summary>Preview transcript</summary>
                <CodeBlock
                  code={output.transcript
                    .slice(0, 5)
                    .map((seg) => `[${Math.floor(seg.timestamp)}s] ${seg.text}`)
                    .join("\n")}
                />
              </details>
            )}
          </ToolCard>
        );
      }

      if (toolState === "output-error") {
        return (
          <ToolCard
            title="Failed to Fetch Transcript"
            subtitle={state.errorText || "An error occurred while fetching the transcript"}
            state="error"
            icon="🎥"
          />
        );
      }

      return null;
    });

    log.info('✅ getYoutubeTranscript tool registration complete');

    return () => {
      log.info('🧹 Cleaning up getYoutubeTranscript tool');
      unregisterToolUI("getYoutubeTranscript");
    };
  }, [registerToolUI, unregisterToolUI]);
}

