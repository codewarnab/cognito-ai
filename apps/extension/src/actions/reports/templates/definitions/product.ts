/**
 * Product/Service Template
 * For researching specific products, SaaS platforms, services
 */

import type { ReportTemplate } from '../types';

export const productTemplate: ReportTemplate = {
    name: 'Product/Service Template',
    description: 'For researching specific products, SaaS platforms, services',
    sections: [
        {
            title: 'Research Summary',
            description: 'What the product is and its primary value proposition'
        },
        {
            title: 'Product Overview',
            bullet: true,
            items: [
                'Product name and category',
                'Developer/company behind it',
                'Launch date and version history',
                'Target audience and use cases'
            ]
        },
        {
            title: 'Features & Capabilities',
            bullet: true,
            items: [
                'Core features and functionalities',
                'Unique capabilities',
                'Integration options',
                'Customization and extensibility'
            ]
        },
        {
            title: 'Pricing & Plans',
            bullet: true,
            items: [
                'Pricing tiers and models',
                'Free trial or freemium options',
                'Enterprise or custom pricing',
                'Value for money assessment'
            ]
        },
        {
            title: 'User Experience',
            bullet: true,
            items: [
                'Ease of use and learning curve',
                'User interface and design',
                'Mobile and cross-platform support',
                'Accessibility features'
            ]
        },
        {
            title: 'Reviews & Feedback',
            bullet: true,
            items: [
                'User reviews and ratings',
                'Common praise and complaints',
                'Expert opinions',
                'Customer support quality'
            ]
        },
        {
            title: 'Alternatives & Comparison',
            bullet: true,
            items: [
                'Main competitors',
                'How it compares feature-wise',
                'Pricing comparison',
                'When to choose this vs alternatives'
            ]
        },
        {
            title: 'Sources Visited',
            description: 'List all URLs with credibility and insights'
        },
        {
            title: 'Unanticipated Findings & Insights',
            description: 'Capture strictly new, interesting, or critical information found during research that doesn\'t fit into the standard categories above. Be creative and follow the data.'
        },
        {
            title: 'Recommendation',
            description: 'Who should use this product and why'
        }
    ],
    deepDiveSections: [
        {
            title: 'Technical Analysis',
            bullet: true,
            items: [
                'Technical architecture and stack',
                'API and developer experience',
                'Performance and reliability metrics',
                'Security and compliance features'
            ]
        },
        {
            title: 'Market Analysis',
            bullet: true,
            items: [
                'Market position and share',
                'Growth trajectory and trends',
                'Competitive moat analysis',
                'Pricing strategy breakdown'
            ]
        },
        {
            title: 'Customer Success Stories',
            bullet: true,
            items: [
                'Notable customer implementations',
                'ROI and impact metrics',
                'Industry-specific use cases',
                'Customer retention data'
            ]
        },
        {
            title: 'Product Roadmap & Vision',
            bullet: true,
            items: [
                'Announced upcoming features',
                'Historical release cadence',
                'Company vision and strategy',
                'Risk factors and sustainability'
            ]
        }
    ]
};
