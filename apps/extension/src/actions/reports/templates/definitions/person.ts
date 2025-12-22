/**
 * Person/Biography Template
 * For researching people, developers, entrepreneurs, etc.
 */

import type { ReportTemplate } from '../types';

export const personTemplate: ReportTemplate = {
    name: 'Person/Biography Template',
    description: 'For researching people, developers, entrepreneurs, etc.',
    sections: [
        {
            title: 'Research Summary',
            description: '2-3 sentences introducing who the person is and what they do'
        },
        {
            title: 'Background & Identity',
            bullet: true,
            items: [
                'Full name and online aliases',
                'Location/residence',
                'Professional role and current position',
                'Education and qualifications (if available)'
            ]
        },
        {
            title: 'Professional Experience',
            bullet: true,
            items: [
                'Current and past work positions',
                'Companies/organizations involved with',
                'Duration and roles in each position',
                'Key responsibilities and achievements'
            ]
        },
        {
            title: 'Skills & Expertise',
            bullet: true,
            items: [
                'Technical skills (programming languages, frameworks)',
                'Domain expertise and specializations',
                'Tools and technologies they use',
                'Certifications or notable training'
            ]
        },
        {
            title: 'Notable Projects & Contributions',
            bullet: true,
            items: [
                'Major projects with descriptions',
                'Open source contributions',
                'Publications or technical writing',
                'Awards or recognition received'
            ]
        },
        {
            title: 'Online Presence & Community',
            bullet: true,
            items: [
                'GitHub activity (repositories, contributions, followers)',
                'Social media presence (Twitter, LinkedIn, etc.)',
                'Blog or personal website',
                'Conference talks or presentations',
                'Community involvement and engagement'
            ]
        },
        {
            title: 'Sources Visited',
            description: 'List all URLs visited with credibility assessment and key learnings'
        },
        {
            title: 'Unanticipated Findings & Insights',
            description: 'Capture strictly new, interesting, or critical information found during research that doesn\'t fit into the standard categories above. Be creative and follow the data.'
        },
        {
            title: 'Professional Insights',
            description: '5-7 insights about their work style, impact, or unique approaches'
        }
    ],
    deepDiveSections: [
        {
            title: 'Career Timeline',
            bullet: true,
            items: [
                'Chronological career progression',
                'Key career transitions and pivots',
                'Significant career milestones',
                'Future career trajectory indicators'
            ]
        },
        {
            title: 'Influence & Impact',
            bullet: true,
            items: [
                'Industry influence and thought leadership',
                'Mentorship and community building',
                'Impact on projects/companies they\'ve worked with',
                'Citations and references in industry'
            ]
        },
        {
            title: 'Collaboration & Network',
            bullet: true,
            items: [
                'Key collaborators and partnerships',
                'Professional network analysis',
                'Recurring themes in collaborations',
                'Notable organizations and communities'
            ]
        }
    ]
};
