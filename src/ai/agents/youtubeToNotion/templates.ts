/**
 * Video Notes Templates
 * Defines how to structure notes for different types of videos
 */

import type { VideoType, VideoNotesTemplate } from './types';

/**
 * Template definitions for each video type
 */
export const VIDEO_TEMPLATES: Record<VideoType, VideoNotesTemplate> = {
    lecture: {
        type: 'lecture',
        name: 'Academic Lecture',
        description: 'Q&A format for educational lectures and academic content',
        format: 'Q&A',
        sectionGuidelines: {
            minSections: 4,
            maxSections: 10,
            sectionTypes: [
                'Conceptual questions ("What is...?", "How does...?")',
                'Comparison questions ("X vs Y")',
                'Application questions ("When to use...?", "Why...?")',
                'Example scenarios',
                'Practice problems (if mentioned)'
            ]
        },
        exampleTitles: [
            'What is the CAP Theorem?',
            'Consistency vs Availability - Trade-offs',
            'Real-world Examples of CAP Theorem',
            'Practice Problems and Solutions'
        ]
    },

    tutorial: {
        type: 'tutorial',
        name: 'Tutorial/How-To',
        description: 'Step-by-step guide for tutorials and instructional content',
        format: 'Step-by-Step',
        sectionGuidelines: {
            minSections: 4,
            maxSections: 10,
            sectionTypes: [
                'Prerequisites & Setup',
                'Implementation steps (numbered)',
                'Code explanations',
                'Common pitfalls',
                'Best practices',
                'Troubleshooting'
            ]
        },
        exampleTitles: [
            'Prerequisites and Setup',
            'Step 1: Initialize Project',
            'Step 2: Configure Authentication',
            'Common Errors and Solutions',
            'Best Practices and Optimization'
        ]
    },

    podcast: {
        type: 'podcast',
        name: 'Podcast/Interview',
        description: 'Key insights format for conversational content',
        format: 'Insights',
        sectionGuidelines: {
            minSections: 4,
            maxSections: 10,
            sectionTypes: [
                'Guest background',
                'Key topics discussed',
                'Main takeaways',
                'Resources mentioned',
                'Action items',
                'Quotes and insights'
            ]
        },
        exampleTitles: [
            'Guest: John Doe - Background and Expertise',
            'Key Topic 1: Future of AI in Healthcare',
            'Key Topic 2: Challenges in Data Privacy',
            'Resources and Tools Mentioned',
            'Main Takeaways and Action Items'
        ]
    },

    documentary: {
        type: 'documentary',
        name: 'Documentary',
        description: 'Narrative structure for exploratory content',
        format: 'Mixed',
        sectionGuidelines: {
            minSections: 4,
            maxSections: 10,
            sectionTypes: [
                'Introduction and context',
                'Historical background',
                'Key discoveries/findings',
                'Interviews and perspectives',
                'Impact and implications',
                'Conclusion'
            ]
        },
        exampleTitles: [
            'Introduction: The Origins of the Internet',
            'The ARPANET Era - 1960s-1970s',
            'Key Innovations: TCP/IP and DNS',
            'The World Wide Web Revolution',
            'Modern Internet and Its Impact'
        ]
    },

    presentation: {
        type: 'presentation',
        name: 'Conference/Presentation',
        description: 'Structured format for talks and presentations',
        format: 'Mixed',
        sectionGuidelines: {
            minSections: 4,
            maxSections: 10,
            sectionTypes: [
                'Agenda/Overview',
                'Problem statement',
                'Solution/Approach',
                'Results/Findings',
                'Key takeaways',
                'Q&A highlights'
            ]
        },
        exampleTitles: [
            'Presentation Overview and Agenda',
            'The Problem: Scaling Microservices',
            'Our Approach: Event-Driven Architecture',
            'Results: 10x Performance Improvement',
            'Key Takeaways for Your Team'
        ]
    },

    webinar: {
        type: 'webinar',
        name: 'Webinar/Training',
        description: 'Professional development and training format',
        format: 'Mixed',
        sectionGuidelines: {
            minSections: 4,
            maxSections: 10,
            sectionTypes: [
                'Training objectives',
                'Core concepts',
                'Practical demonstrations',
                'Best practices',
                'Common mistakes',
                'Next steps'
            ]
        },
        exampleTitles: [
            'Training Objectives and Learning Outcomes',
            'Core Concept: Understanding Kubernetes',
            'Demo: Deploying Your First Pod',
            'Best Practices for Production',
            'Common Mistakes to Avoid',
            'Next Steps and Resources'
        ]
    },

    course: {
        type: 'course',
        name: 'Online Course',
        description: 'Structured learning format with lessons and exercises',
        format: 'Mixed',
        sectionGuidelines: {
            minSections: 4,
            maxSections: 10,
            sectionTypes: [
                'Lesson overview',
                'Key concepts',
                'Examples and demonstrations',
                'Practice exercises',
                'Additional resources',
                'Summary'
            ]
        },
        exampleTitles: [
            'Lesson Overview: Introduction to React Hooks',
            'Key Concept: useState Hook',
            'Example: Building a Counter Component',
            'Practice Exercise: Todo List',
            'Additional Resources and Reading',
            'Lesson Summary and Next Steps'
        ]
    },

    review: {
        type: 'review',
        name: 'Product/Service Review',
        description: 'Evaluation format for reviews and comparisons',
        format: 'Mixed',
        sectionGuidelines: {
            minSections: 4,
            maxSections: 10,
            sectionTypes: [
                'Product overview',
                'Key features',
                'Pros and advantages',
                'Cons and limitations',
                'Comparison with alternatives',
                'Final verdict'
            ]
        },
        exampleTitles: [
            'Product Overview: iPhone 15 Pro',
            'Key Features and Specifications',
            'What We Loved: Top 5 Pros',
            'Drawbacks and Limitations',
            'iPhone 15 Pro vs Samsung S24 Ultra',
            'Final Verdict: Should You Buy It?'
        ]
    },

    generic: {
        type: 'generic',
        name: 'General Content',
        description: 'Flexible format for other types of content',
        format: 'Mixed',
        sectionGuidelines: {
            minSections: 4,
            maxSections: 10,
            sectionTypes: [
                'Introduction',
                'Main topics',
                'Key points',
                'Examples',
                'Summary'
            ]
        },
        exampleTitles: [
            'Introduction and Overview',
            'Main Topic 1',
            'Main Topic 2',
            'Key Examples and Insights',
            'Summary and Conclusion'
        ]
    }
};

/**
 * Keywords for detecting video types from transcript
 */
export const VIDEO_TYPE_KEYWORDS: Record<VideoType, string[]> = {
    tutorial: [
        'step', 'how to', "let's build", "we will create", 'follow along',
        'tutorial', 'guide', 'walkthrough', 'implement', 'code along'
    ],
    lecture: [
        'theory', 'concept', 'definition', 'explain', 'understand',
        'lecture', 'academic', 'study', 'learn about', 'introduction to'
    ],
    podcast: [
        'interview', 'guest', 'conversation', 'discuss with', 'talking about',
        'podcast', 'episode', 'host', 'joining us', 'great to have you'
    ],
    documentary: [
        'explore', 'discover', 'history', 'story of', 'journey through',
        'documentary', 'examine', 'investigate', 'uncovering', 'revealing'
    ],
    presentation: [
        'slide', 'agenda', 'roadmap', 'present', 'conference',
        'presentation', 'talk', 'keynote', 'overview', 'today we will'
    ],
    webinar: [
        'training', 'demonstration', 'attendees', 'participants', 'session',
        'webinar', 'workshop', 'professional development', 'learn how to'
    ],
    course: [
        'lesson', 'module', 'assignment', 'exercise', 'curriculum',
        'course', 'class', 'unit', 'chapter', 'homework'
    ],
    review: [
        'pros', 'cons', 'comparison', 'verdict', 'evaluate',
        'review', 'unboxing', 'vs', 'better than', 'worth it'
    ],
    generic: [] // Fallback - no specific keywords
};

/**
 * Detect video type from transcript
 * Uses keyword matching with weighted scoring
 */
export function detectVideoType(transcript: string, videoTitle?: string): VideoType {
    const lowerTranscript = transcript.toLowerCase();
    const lowerTitle = videoTitle?.toLowerCase() || '';

    // Combined text for analysis (title has more weight)
    const combinedText = `${lowerTitle} ${lowerTitle} ${lowerTitle} ${lowerTranscript}`;

    // Score each video type based on keyword matches
    const scores: Record<VideoType, number> = {
        tutorial: 0,
        lecture: 0,
        podcast: 0,
        documentary: 0,
        presentation: 0,
        webinar: 0,
        course: 0,
        review: 0,
        generic: 0
    };

    // Count keyword occurrences for each type
    for (const [type, keywords] of Object.entries(VIDEO_TYPE_KEYWORDS)) {
        if (type === 'generic') continue;

        for (const keyword of keywords) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            const matches = combinedText.match(regex);
            if (matches) {
                scores[type as VideoType] += matches.length;
            }
        }
    }

    // Find the type with the highest score
    let maxScore = 0;
    let detectedType: VideoType = 'generic';

    for (const [type, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            detectedType = type as VideoType;
        }
    }

    // Require minimum threshold to avoid false positives
    const MINIMUM_THRESHOLD = 3;
    if (maxScore < MINIMUM_THRESHOLD) {
        detectedType = 'generic';
    }

    return detectedType;
}

/**
 * Get template for a specific video type
 */
export function getTemplate(videoType: VideoType): VideoNotesTemplate {
    return VIDEO_TEMPLATES[videoType];
}

/**
 * Generate system prompt section for template guidelines
 */
export function generateTemplateGuidelines(template: VideoNotesTemplate): string {
    return `
## TEMPLATE: ${template.name}
**Format**: ${template.format}
**Description**: ${template.description}

**Section Guidelines**:
- Create ${template.sectionGuidelines.minSections}-${template.sectionGuidelines.maxSections} nested pages
- Section types to consider:
${template.sectionGuidelines.sectionTypes.map(t => `  • ${t}`).join('\n')}

**Example Titles**:
${template.exampleTitles.map(t => `  • "${t}"`).join('\n')}
`;
}
