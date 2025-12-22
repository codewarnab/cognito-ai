/**
 * Technology/Framework Template
 * For researching programming languages, frameworks, libraries, tools
 */

import type { ReportTemplate } from '../types';

export const technologyTemplate: ReportTemplate = {
    name: 'Technology/Framework Template',
    description: 'For researching programming languages, frameworks, libraries, tools',
    sections: [
        {
            title: 'Research Summary',
            description: 'Brief overview of what the technology is and its primary purpose'
        },
        {
            title: 'Overview',
            bullet: true,
            items: [
                'What it is and what problem it solves',
                'Creator/maintainer and release history',
                'Current version and stability',
                'License and pricing model',
                'Target use cases and applications'
            ]
        },
        {
            title: 'Key Features',
            bullet: true,
            items: [
                'Core capabilities and functionalities',
                'Unique selling points vs alternatives',
                'Performance characteristics',
                'Integration capabilities'
            ]
        },
        {
            title: 'Technical Architecture',
            bullet: true,
            items: [
                'Architecture and design patterns',
                'Dependencies and requirements',
                'Supported platforms and environments',
                'Scalability considerations'
            ]
        },
        {
            title: 'Adoption & Community',
            bullet: true,
            items: [
                'Popularity metrics (GitHub stars, downloads, users)',
                'Community size and activity',
                'Documentation quality',
                'Support channels and resources',
                'Companies using it in production'
            ]
        },
        {
            title: 'Getting Started',
            bullet: true,
            items: [
                'Installation and setup process',
                'Prerequisites and system requirements',
                'Basic usage examples',
                'Learning resources and tutorials'
            ]
        },
        {
            title: 'Pros & Cons',
            description: 'Advantages and limitations based on real-world usage'
        },
        {
            title: 'Sources Visited',
            description: 'List all URLs visited with credibility and learnings'
        },
        {
            title: 'Unanticipated Findings & Insights',
            description: 'Capture strictly new, interesting, or critical information found during research that doesn\'t fit into the standard categories above. Be creative and follow the data.'
        },
        {
            title: 'Use Case Recommendations',
            description: 'When to use this technology and when to consider alternatives'
        }
    ],
    deepDiveSections: [
        {
            title: 'Performance Benchmarks',
            bullet: true,
            items: [
                'Benchmark comparisons with alternatives',
                'Memory and CPU usage patterns',
                'Load handling and concurrency',
                'Real-world performance case studies'
            ]
        },
        {
            title: 'Security Considerations',
            bullet: true,
            items: [
                'Known vulnerabilities and CVEs',
                'Security best practices',
                'Audit history and security certifications',
                'Common security pitfalls'
            ]
        },
        {
            title: 'Migration & Integration Guide',
            bullet: true,
            items: [
                'Migration paths from alternatives',
                'Integration patterns with common tools',
                'Breaking changes between versions',
                'Compatibility matrices'
            ]
        },
        {
            title: 'Roadmap & Future',
            bullet: true,
            items: [
                'Upcoming features and releases',
                'Long-term maintenance outlook',
                'Community governance model',
                'Risk factors for adoption'
            ]
        }
    ]
};
