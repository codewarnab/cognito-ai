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
            'What is the CAP Theorem and why does it matter in distributed systems?',
            'Consistency vs Availability - What are the key trade-offs?',
            'How do NoSQL databases handle partition tolerance?',
            'When should you choose consistency over availability?',
            'What are real-world examples of CAP Theorem in action?',
            'How does eventual consistency work in practice?'
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
            'Prerequisites: Required Tools and Knowledge',
            'Step 1: Initialize Next.js Project with TypeScript',
            'Step 2: Configure Authentication with NextAuth',
            'Step 3: Set Up Database Connection with Prisma',
            'Step 4: Create Protected API Routes',
            'Common Errors: Authentication Edge Cases',
            'Best Practices: Security and Performance Optimization'
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
            'Guest Background: John Doe - AI Research and Healthcare Innovation',
            'Key Topic: AI\'s Impact on Early Disease Detection',
            'Key Topic: Balancing Innovation with Patient Data Privacy',
            'Main Takeaway: Why Explainable AI Matters for Medical Adoption',
            'Resources Mentioned: Tools and Research Papers',
            'Action Items: How to Get Started in Healthcare AI'
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
            'Introduction: The Origins of the Internet and ARPANET Vision',
            'The ARPANET Era: Cold War Innovation (1960s-1970s)',
            'Key Innovations: How TCP/IP Revolutionized Networking',
            'The Birth of DNS: Making the Internet User-Friendly',
            'Tim Berners-Lee and the World Wide Web Revolution',
            'Modern Internet: Social Impact and Digital Divide',
            'Future Implications: Internet Governance and Privacy'
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
            'Presentation Overview: Scaling Microservices at 100k Requests/Second',
            'The Problem: Bottlenecks in Synchronous Service Communication',
            'Our Approach: Transitioning to Event-Driven Architecture',
            'Implementation Details: Using Kafka for Message Streaming',
            'Results: 10x Performance Improvement with 50% Cost Reduction',
            'Key Takeaways: When to Choose Event-Driven vs Request-Response',
            'Q&A Highlights: Handling Eventual Consistency'
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
            'Training Objectives: Mastering Kubernetes for Production Deployments',
            'Core Concept: Understanding Pods, Services, and Deployments',
            'Core Concept: How Kubernetes Orchestrates Container Lifecycles',
            'Demo: Deploying Your First Stateless Application',
            'Demo: Setting Up Persistent Storage with PVCs',
            'Best Practices: Resource Limits and Health Checks',
            'Common Mistakes: Avoiding Configuration Pitfalls',
            'Next Steps: Advanced Topics and Certification Paths'
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
            'Lesson Overview: Introduction to React Hooks and State Management',
            'Key Concept: useState Hook - Managing Component State',
            'Key Concept: useEffect Hook - Handling Side Effects',
            'Example: Building a Counter Component with useState',
            'Example: Fetching Data with useEffect',
            'Practice Exercise: Build a Todo List with Local Storage',
            'Additional Resources: Official Docs and Community Tutorials',
            'Lesson Summary: When to Use Each Hook'
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
            'Product Overview: iPhone 15 Pro - Specs and Target Audience',
            'Key Features: A17 Pro Chip and Titanium Design',
            'Key Features: Advanced Camera System with 5x Optical Zoom',
            'What We Loved: Performance and Battery Life',
            'Drawbacks: Price Point and USB-C Limitations',
            'iPhone 15 Pro vs Samsung S24 Ultra - Direct Comparison',
            'Final Verdict: Who Should Buy the iPhone 15 Pro?'
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
            'Introduction: Context and Background of the Topic',
            'Main Topic: Core Concept or Theme 1',
            'Main Topic: Core Concept or Theme 2',
            'Key Examples: Real-World Applications',
            'Key Insights: Important Takeaways',
            'Summary: Conclusion and Final Thoughts'
        ]
    }
};

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
