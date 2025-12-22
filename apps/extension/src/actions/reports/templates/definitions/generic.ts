/**
 * Generic Research Template
 * Flexible template for any research topic
 */

import type { ReportTemplate } from '../types';

export const genericTemplate: ReportTemplate = {
    name: 'Generic Research Template',
    description: 'Flexible template for any research topic',
    sections: [
        {
            title: 'Research Summary',
            description: '2-3 sentences explaining the topic and research scope'
        },
        {
            title: 'Key Findings',
            description: '7-10 bullet points of important discoveries with specific details'
        },
        {
            title: 'Sources Visited',
            description: 'List ALL URLs visited (minimum 3) with what you learned and credibility assessment'
        },
        {
            title: 'Creative Ideas',
            description: '5-7 innovative approaches, angles, or applications'
        },
        {
            title: 'Unanticipated Findings & Insights',
            description: 'Capture strictly new, interesting, or critical information found during research that doesn\'t fit into the standard categories above. Be creative and follow the data.'
        },
        {
            title: 'Implementation Plan',
            description: 'Detailed, actionable steps with phases, prerequisites, challenges, solutions, resources, and best practices'
        }
    ],
    deepDiveSections: [
        {
            title: 'Detailed Analysis',
            bullet: true,
            items: [
                'In-depth examination of key findings',
                'Supporting evidence and data',
                'Connections and patterns identified',
                'Contradictions and nuances discovered'
            ]
        },
        {
            title: 'Expert & Community Perspectives',
            bullet: true,
            items: [
                'Expert opinions and analyses',
                'Community discussions and debates',
                'Emerging consensus and disagreements',
                'Notable quotes and insights'
            ]
        },
        {
            title: 'Risk Assessment',
            bullet: true,
            items: [
                'Potential risks and challenges',
                'Mitigation strategies',
                'Dependencies and assumptions',
                'Contingency considerations'
            ]
        },
        {
            title: 'Extended Resources',
            bullet: true,
            items: [
                'Additional reading and references',
                'Tools and resources for further exploration',
                'Related topics to investigate',
                'Ongoing developments to monitor'
            ]
        }
    ]
};
