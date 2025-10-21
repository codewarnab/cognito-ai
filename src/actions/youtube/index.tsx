import React, { useEffect } from "react";
import { z } from "zod";
import { createLogger } from "../../logger";
import { registerTool } from "../../ai/toolRegistryUtils";
import { useToolUI } from "../../ai/ToolUIContext";
import { CompactToolRenderer } from "../../ai/CompactToolRenderer";
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
          console.log("[YT Transcript] Starting extraction...");

          // Debug: Check all potential YouTube data sources
          const windowKeys = Object.keys(window).filter(k => k.toLowerCase().includes('yt'));
          console.log("[YT Transcript] Available window.yt* keys:", windowKeys);

          // Check various potential sources
          console.log("[YT Transcript] window.ytInitialPlayerResponse exists:", !!(window as any).ytInitialPlayerResponse);
          console.log("[YT Transcript] window.ytInitialData exists:", !!(window as any).ytInitialData);
          console.log("[YT Transcript] window.yt exists:", !!(window as any).yt);
          console.log("[YT Transcript] window.yt?.config exists:", !!(window as any).yt?.config);

          // Try to find player data in scripts
          const scripts = Array.from(document.querySelectorAll('script'));
          const playerScript = scripts.find(s => s.textContent?.includes('ytInitialPlayerResponse'));
          console.log("[YT Transcript] Found script with ytInitialPlayerResponse:", !!playerScript);

          // Method 1: Try ytInitialPlayerResponse
          let ytData = (window as any).ytInitialPlayerResponse;

          // If not found, try to extract from script tag
          if (!ytData && playerScript?.textContent) {
            console.log("[YT Transcript] Attempting to extract from script tag...");
            try {
              const match = playerScript.textContent.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/);
              if (match) {
                ytData = JSON.parse(match[1]);
                console.log("[YT Transcript] Successfully extracted from script tag");
              }
            } catch (e) {
              console.log("[YT Transcript] Failed to parse from script:", e);
            }
          }

          console.log("[YT Transcript] ytData exists:", !!ytData);
          console.log("[YT Transcript] Has captions object:", !!ytData?.captions);
          console.log("[YT Transcript] Has playerCaptionsTracklistRenderer:", !!ytData?.captions?.playerCaptionsTracklistRenderer);
          console.log("[YT Transcript] Has captionTracks:", !!ytData?.captions?.playerCaptionsTracklistRenderer?.captionTracks);

          // Log video metadata
          const videoLength = ytData?.videoDetails?.lengthSeconds;
          const videoTitle = ytData?.videoDetails?.title;
          const videoId = ytData?.videoDetails?.videoId;
          console.log("[YT Transcript] Video metadata:", {
            title: videoTitle,
            videoId: videoId,
            lengthSeconds: videoLength,
            lengthFormatted: videoLength ? `${Math.floor(videoLength / 60)}:${(videoLength % 60).toString().padStart(2, '0')}` : 'N/A'
          });

          if (ytData?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
            const tracks = ytData.captions.playerCaptionsTracklistRenderer.captionTracks;
            console.log("[YT Transcript] Found tracks:", tracks.length, "tracks");
            console.log("[YT Transcript] Available languages:", tracks.map((t: any) => t.languageCode));

            // Find preferred language or fallback to first available
            let track = preferredLang
              ? tracks.find((t: any) => t.languageCode === preferredLang) || tracks[0]
              : tracks[0];

            console.log("[YT Transcript] Selected track language:", track?.languageCode);
            console.log("[YT Transcript] Track has baseUrl:", !!track?.baseUrl);

            if (track?.baseUrl) {
              // Try multiple URL formats as YouTube has changed their API
              const urlVariants = [
                track.baseUrl + "&fmt=json3",
                track.baseUrl.replace(/&fmt=srv[0-9]+/, "") + "&fmt=json3",
                track.baseUrl,
              ];

              console.log("[YT Transcript] Trying multiple URL variants...");

              let data = null;
              let successUrl = null;

              for (const url of urlVariants) {
                try {
                  console.log("[YT Transcript] Attempting URL:", url.substring(0, 100) + "...");

                  const response = await fetch(url);
                  console.log("[YT Transcript] Fetch response status:", response.status);
                  console.log("[YT Transcript] Content-Type:", response.headers.get('content-type'));

                  const responseText = await response.text();
                  console.log("[YT Transcript] Response length:", responseText.length);

                  if (responseText.length === 0) {
                    console.log("[YT Transcript] Empty response, trying next variant...");
                    continue;
                  }

                  console.log("[YT Transcript] Response preview:", responseText.substring(0, 200));

                  // Try parsing as JSON first
                  try {
                    data = JSON.parse(responseText);
                    console.log("[YT Transcript] ✅ Successfully parsed JSON");
                    successUrl = url;
                    break;
                  } catch (jsonError) {
                    console.log("[YT Transcript] Not valid JSON, trying XML parsing...");

                    // Try parsing as XML (default YouTube format)
                    if (responseText.includes('<?xml') || responseText.includes('<transcript>')) {
                      console.log("[YT Transcript] Detected XML format, parsing...");
                      const parser = new DOMParser();
                      const xmlDoc = parser.parseFromString(responseText, 'text/xml');
                      const textElements = xmlDoc.querySelectorAll('text');

                      if (textElements.length > 0) {
                        // Convert XML to events format
                        data = {
                          events: Array.from(textElements).map((el: any) => ({
                            tStartMs: parseFloat(el.getAttribute('start') || '0') * 1000,
                            segs: [{ utf8: el.textContent || '' }]
                          }))
                        };
                        console.log("[YT Transcript] ✅ Successfully parsed XML, converted to", data.events.length, "events");
                        successUrl = url;
                        break;
                      }
                    }

                    console.log("[YT Transcript] Not valid XML either, trying next variant...");
                    continue;
                  }
                } catch (fetchError) {
                  console.log("[YT Transcript] Fetch failed:", fetchError);
                  continue;
                }
              }

              if (!data) {
                console.log("[YT Transcript] ⚠️ All URL variants failed");
                throw new Error("Failed to fetch transcript from any URL variant");
              }

              console.log("[YT Transcript] Response has events:", !!data.events);
              console.log("[YT Transcript] Events count:", data.events?.length);

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
                console.log("[YT Transcript] ✅ Method 1 SUCCESS - Extracted", segments.length, "segments");
                return {
                  success: true,
                  transcript: segments,
                  videoTitle: document.title.replace(" - YouTube", ""),
                  videoUrl: location.href,
                  language: track.languageCode,
                };
              } else {
                console.log("[YT Transcript] ⚠️ Method 1 FAILED - No segments extracted from events");
              }
            } else {
              console.log("[YT Transcript] ⚠️ Method 1 FAILED - No baseUrl in track");
            }
          } else {
            console.log("[YT Transcript] ⚠️ Method 1 FAILED - No caption tracks found");
          }

          // Method 2: Fallback - try to read from transcript panel DOM
          console.log("[YT Transcript] Trying Method 2: DOM parsing...");
          const transcriptSegments = document.querySelectorAll(
            "ytd-transcript-segment-renderer"
          );
          console.log("[YT Transcript] Found DOM segments:", transcriptSegments.length);

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
              console.log("[YT Transcript] ✅ Method 2 SUCCESS - Extracted", segments.length, "segments");
              return {
                success: true,
                transcript: segments,
                videoTitle: document.title.replace(" - YouTube", ""),
                videoUrl: location.href,
                language: "unknown",
              };
            } else {
              console.log("[YT Transcript] ⚠️ Method 2 FAILED - No segments parsed from DOM");
            }
          } else {
            console.log("[YT Transcript] ⚠️ Method 2 FAILED - No ytd-transcript-segment-renderer elements found");
          }

          // No transcript found
          console.log("[YT Transcript] ❌ Both methods failed - returning no_captions error");
          return {
            success: false,
            error: "no_captions",
            errorCode: "no_captions",
          };
        } catch (error) {
          console.error("[YT Transcript] ❌ Exception caught:", error);
          return {
            success: false,
            error: "fetch_failed",
            errorCode: "fetch_failed",
            details: error instanceof Error ? error.message : String(error),
          };
        }
      },
    });

    console.log("[YT Transcript] Script execution completed");
    const result = results[0]?.result;
    console.log("[YT Transcript] Final result:", result);

    if (!result) {
      log.error("[YT Transcript] No result returned from script execution");
      return {
        success: false,
        error: ERROR_MESSAGES.fetch_failed,
        errorCode: "fetch_failed",
      };
    }

    if (!result.success && result.errorCode) {
      log.warn("[YT Transcript] Extraction failed with error code:", result.errorCode);
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

    // Register the UI renderer - uses CompactToolRenderer
    registerToolUI("getYoutubeTranscript", (state: ToolUIState) => {
      return <CompactToolRenderer state={state} />;
    });

    log.info('✅ getYoutubeTranscript tool registration complete');

    return () => {
      log.info('🧹 Cleaning up getYoutubeTranscript tool');
      unregisterToolUI("getYoutubeTranscript");
    };
  }, [registerToolUI, unregisterToolUI]);
}

