/**
 * YouTube to Notion Agent (Phase 5 - Multi-Phase Orchestrator)
 * Parent sub-agent that orchestrates video-to-notes conversion
 * 
 * This agent implements the complete multi-phase pipeline:
 * 1. Fetch transcript with cache (Phase 1)
 * 2. Detect video type and select template
 * 3. Plan questions (Phase 2)
 * 4. Create main Notion page (Phase 4)
 * 5. Generate answers and create child pages sequentially (Phase 3 + 4)
 * 6. Cleanup cache and return results
 */

import { createLogger } from '../../../logger';
import { withTranscriptCache } from './transcriptCache';
import { fetchTranscriptDirect } from './transcript';
import { detectVideoType } from './videoTypeDetectorAgent';
import { getTemplate } from './templates';
import { planQuestions } from './questionPlannerAgent';
import { writeAnswer } from './answerWriterAgent';
import { createMainPage, createChildPage } from '../notion/notionPageWriterAgent';
import type { YouTubeToNotionInput, YouTubeToNotionOutput, VideoType } from './types';

const log = createLogger('YouTubeToNotionAgent');

/**
 * Minimum content length for answers (roughly 200 words)
 */
const MIN_CONTENT_LENGTH = 1000;

/**
 * Execute YouTube to Notion Agent - Multi-Phase Pipeline
 * 
 * Phase 1: Fetch transcript and cache
 * Phase 2: Detect video type and plan questions
 * Phase 3: Create main Notion page
 * Phase 4: Generate answers and create child pages sequentially
 * Phase 5: Cleanup and return results
 */
export async function executeYouTubeToNotionAgent(
    input: YouTubeToNotionInput
): Promise<YouTubeToNotionOutput> {
    log.info('🎬 Starting YouTube to Notion workflow', {
        youtubeUrl: input.youtubeUrl,
        videoTitle: input.videoTitle,
        hasParentPageId: !!input.parentPageId
    });

    // PHASE 1: Transcript Fetch & Cache
    return await withTranscriptCache(
        input.youtubeUrl,
        // Fetcher function - always refetch at start of workflow
        async () => {
            log.info('📝 Phase 1: Fetching transcript from API');
            const entry = await fetchTranscriptDirect(input.youtubeUrl);

            if (!entry.transcript || entry.transcript.trim().length === 0) {
                throw new Error('Unable to obtain transcript or analyze video.');
            }

            log.info('✅ Transcript obtained', {
                source: entry.transcript.includes('video analysis') ? 'video-analysis' : 'api',
                length: entry.transcript.length,
                title: entry.title,
                durationSeconds: entry.durationSeconds
            });

            return entry;
        },
        // Workflow function - uses cached transcript throughout
        async (entry) => {
            try {
                const transcript = entry.transcript;
                const videoTitle = entry.title || input.videoTitle;

                // PHASE 2: Detect video type and template
                log.info('🎯 Phase 2: Detecting video type');

                let videoType: VideoType;
                let detectionConfidence = 0;
                let detectionReasoning = '';

                try {
                    // Use agent-based semantic detection
                    const detectionResult = await detectVideoType({
                        videoTitle,
                        transcript,
                        videoUrl: input.youtubeUrl,
                        durationSeconds: entry.durationSeconds
                    });

                    videoType = detectionResult.videoType;
                    detectionConfidence = detectionResult.confidence;
                    detectionReasoning = detectionResult.reasoning;

                    log.info('✅ Agent-based detection completed', {
                        videoType,
                        confidence: detectionResult.confidence.toFixed(2),
                        reasoning: detectionResult.reasoning,
                        alternatives: detectionResult.alternatives?.map(a =>
                            `${a.type}:${a.confidence.toFixed(2)}`
                        ).join(', ') || 'none'
                    });
                } catch (error) {
                    // Fallback to generic type on detection failure
                    log.warn('⚠️ Agent detection failed, using generic type', {
                        error: error instanceof Error ? error.message : String(error)
                    });

                    videoType = 'generic';
                    detectionConfidence = 0.5;
                    detectionReasoning = 'Agent detection failed, using generic fallback';
                }

                const template = getTemplate(videoType);

                log.info('✅ Template selected', {
                    videoType,
                    templateName: template.name,
                    format: template.format,
                    confidence: detectionConfidence.toFixed(2),
                    reasoning: detectionReasoning
                });

                // PHASE 3: Plan questions
                log.info('🧠 Phase 3: Planning questions');
                const questions = await planQuestions({
                    transcript,
                    videoTitle,
                    videoUrl: input.youtubeUrl,
                    template,
                    min: 6,
                    max: 10
                });

                if (questions.length < 4) {
                    log.error('❌ Insufficient questions planned', {
                        count: questions.length
                    });
                    return {
                        success: false,
                        message: `Question planner produced only ${questions.length} questions (minimum 4 required)`,
                        error: 'PLANNING_FAILED'
                    };
                }

                log.info(`✅ ${questions.length} questions planned`, {
                    titles: questions.map(q => q.title)
                });

                // PHASE 4: Create main Notion page
                log.info('📄 Phase 4: Creating main Notion page');
                const mainPageTitle = `${videoTitle} Notes [Cognito AI]`;
                const main = await createMainPage({
                    title: mainPageTitle,
                    videoUrl: input.youtubeUrl,
                    parentPageId: input.parentPageId
                });

                if (!main.success || !main.pageId) {
                    log.error('❌ Failed to create main page', main);
                    return {
                        success: false,
                        message: 'Failed to create main Notion page',
                        error: 'NOTION_MAIN_FAILED'
                    };
                }

                log.info('✅ Main page created', {
                    pageId: main.pageId,
                    pageUrl: main.pageUrl
                });

                // PHASE 5: Generate answers and create child pages sequentially
                log.info(`✍️ Phase 5: Generating ${questions.length} answers and creating child pages`);

                const createdTitles = new Set<string>();
                const childPageUrls: string[] = [];
                let created = 0;

                for (let i = 0; i < questions.length; i++) {
                    const q = questions[i];
                    if (!q) continue; // TypeScript safety check

                    const qNum = i + 1;
                    const qTotal = questions.length;

                    log.info(`📝 Processing question ${qNum}/${qTotal}: "${q.title}"`);

                    // Check for duplicate
                    const titleKey = q.title.toLowerCase().trim();
                    if (createdTitles.has(titleKey)) {
                        log.warn('🔄 Duplicate page title detected, skipping', {
                            title: q.title
                        });
                        continue;
                    }

                    try {
                        // Generate answer
                        log.info(`🤖 Generating answer for: "${q.title}"`);
                        let ans = await writeAnswer({
                            title: q.title,
                            question: q.question,
                            transcript, // Always use FULL transcript
                            template,
                            videoTitle,
                            videoUrl: input.youtubeUrl
                        });

                        // Validate answer length (heuristic: ≥1000 chars ~200 words)
                        if (!ans.content || ans.content.length < MIN_CONTENT_LENGTH) {
                            log.warn('⚠️ Answer too short, retrying once', {
                                title: q.title,
                                length: ans.content?.length || 0,
                                minRequired: MIN_CONTENT_LENGTH
                            });

                            // Retry once
                            try {
                                ans = await writeAnswer({
                                    title: q.title,
                                    question: q.question,
                                    transcript,
                                    template,
                                    videoTitle,
                                    videoUrl: input.youtubeUrl
                                });

                                if (!ans.content || ans.content.length < MIN_CONTENT_LENGTH) {
                                    log.error('❌ Answer still too short after retry, skipping', {
                                        title: q.title,
                                        length: ans.content?.length || 0
                                    });
                                    continue;
                                }
                            } catch (retryError) {
                                log.error('❌ Retry failed, skipping question', {
                                    title: q.title,
                                    error: retryError
                                });
                                continue;
                            }
                        }

                        // Create child page
                        log.info(`📄 Creating child page: "${ans.title}"`);
                        const child = await createChildPage({
                            parentPageId: main.pageId,
                            title: ans.title,
                            content: ans.content
                        });

                        if (child.success) {
                            created++;
                            createdTitles.add(titleKey);
                            if (child.pageUrl) {
                                childPageUrls.push(child.pageUrl);
                            }
                            log.info(`✅ Created page ${created}/${qTotal}: "${ans.title}"`);
                        } else {
                            log.error('❌ Failed to create child page', {
                                title: ans.title,
                                error: child.message
                            });
                        }

                    } catch (error) {
                        log.error('❌ Error processing question', {
                            title: q.title,
                            error
                        });
                        // Continue to next question
                    }
                }

                // PHASE 6: Finalize and return
                const totalPages = created + 1; // +1 for main page
                log.info(`🎉 Workflow complete: ${totalPages} pages created`);

                return {
                    success: true,
                    mainPageUrl: main.pageUrl,
                    pageCount: totalPages,
                    videoType,
                    childPageUrls,
                    message: `Created "${videoTitle}" notes with ${totalPages} pages in Notion`
                };

            } catch (error) {
                log.error('❌ Workflow failed:', error);
                return {
                    success: false,
                    message: 'Failed to convert video to Notion notes',
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }
    );
}
