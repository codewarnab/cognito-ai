/**
 * Concept/Topic Template
 * For researching abstract concepts, methodologies, best practices
 */

import type { ReportTemplate } from '../types';

export const conceptTemplate: ReportTemplate = {
    name: 'Concept/Topic Template',
    description: 'For researching abstract concepts, methodologies, best practices',
    sections: [
        {
            title: 'Research Summary',
            description: 'Clear definition and overview of the concept'
        },
        {
            title: 'Definition & Origins',
            bullet: true,
            items: [
                'What it is and how it\'s defined',
                'Historical background and evolution',
                'Key thought leaders and contributors',
                'Related concepts and terminology'
            ]
        },
        {
            title: 'Core Principles',
            bullet: true,
            items: [
                'Fundamental concepts and ideas',
                'Underlying theory or philosophy',
                'Key components or elements',
                'Variations and approaches'
            ]
        },
        {
            title: 'Practical Applications',
            bullet: true,
            items: [
                'Real-world use cases',
                'Industries and domains where applied',
                'Success stories and case studies',
                'Common implementation patterns'
            ]
        },
        {
            title: 'Benefits & Challenges',
            bullet: true,
            items: [
                'Advantages and benefits',
                'Common challenges and pitfalls',
                'When to apply and when to avoid',
                'Prerequisites for success'
            ]
        },
        {
            title: 'Current Trends',
            bullet: true,
            items: [
                'Latest developments and innovations',
                'Emerging trends and future directions',
                'Debates and controversies',
                'Research and academic perspectives'
            ]
        },
        {
            title: 'Sources Visited',
            description: 'List all URLs with credibility assessment'
        },
        {
            title: 'Unanticipated Findings & Insights',
            description: 'Capture strictly new, interesting, or critical information found during research that doesn\'t fit into the standard categories above. Be creative and follow the data.'
        },
        {
            title: 'Implementation Guidance',
            description: 'How to get started and best practices'
        }
    ],
    deepDiveSections: [
        {
            title: 'Theoretical Foundations',
            bullet: true,
            items: [
                'Academic research and papers',
                'Foundational theories and models',
                'Intellectual history and evolution',
                'Cross-disciplinary connections'
            ]
        },
        {
            title: 'Case Study Analysis',
            bullet: true,
            items: [
                'Detailed case studies of implementation',
                'Success factors and failure analysis',
                'Lessons learned and best practices',
                'Quantitative impact measurements'
            ]
        },
        {
            title: 'Comparative Analysis',
            bullet: true,
            items: [
                'Comparison with alternative approaches',
                'Trade-offs and decision frameworks',
                'Situational applicability matrix',
                'Evolution vs competing concepts'
            ]
        },
        {
            title: 'Expert Perspectives',
            bullet: true,
            items: [
                'Views from industry thought leaders',
                'Contrarian opinions and debates',
                'Emerging consensus and disagreements',
                'Predictions for future developments'
            ]
        }
    ]
};
