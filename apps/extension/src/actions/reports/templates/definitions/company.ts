/**
 * Company/Organization Template
 * For researching companies, startups, organizations
 */

import type { ReportTemplate } from '../types';

export const companyTemplate: ReportTemplate = {
    name: 'Company/Organization Template',
    description: 'For researching companies, startups, organizations',
    sections: [
        {
            title: 'Research Summary',
            description: 'Brief overview of the company and what they do'
        },
        {
            title: 'Company Overview',
            bullet: true,
            items: [
                'Company name and industry',
                'Founding year and founders',
                'Headquarters and locations',
                'Company size and employee count',
                'Funding and financial status'
            ]
        },
        {
            title: 'Products & Services',
            bullet: true,
            items: [
                'Main products or services offered',
                'Target market and customers',
                'Pricing and business model',
                'Competitive advantages'
            ]
        },
        {
            title: 'Technology Stack',
            bullet: true,
            items: [
                'Technologies and platforms used',
                'Technical infrastructure',
                'Innovation and R&D focus'
            ]
        },
        {
            title: 'Market Position',
            bullet: true,
            items: [
                'Market share and competitors',
                'Growth trajectory and milestones',
                'Customer base and testimonials',
                'Media coverage and reputation'
            ]
        },
        {
            title: 'Culture & Values',
            bullet: true,
            items: [
                'Company culture and work environment',
                'Core values and mission',
                'Employee reviews and satisfaction',
                'Diversity and inclusion initiatives'
            ]
        },
        {
            title: 'Sources Visited',
            description: 'List all URLs with credibility and key insights'
        },
        {
            title: 'Unanticipated Findings & Insights',
            description: 'Capture strictly new, interesting, or critical information found during research that doesn\'t fit into the standard categories above. Be creative and follow the data.'
        },
        {
            title: 'Strategic Analysis',
            description: 'Strengths, opportunities, and potential challenges'
        }
    ],
    deepDiveSections: [
        {
            title: 'Financial Deep Dive',
            bullet: true,
            items: [
                'Revenue and profitability trends',
                'Funding rounds and investor details',
                'Burn rate and runway (for startups)',
                'Financial health indicators'
            ]
        },
        {
            title: 'Leadership & Governance',
            bullet: true,
            items: [
                'Executive team profiles',
                'Board composition',
                'Leadership changes and stability',
                'Organizational structure'
            ]
        },
        {
            title: 'Competitive Landscape',
            bullet: true,
            items: [
                'Direct and indirect competitors',
                'Competitive advantages and moats',
                'Market positioning analysis',
                'SWOT analysis'
            ]
        },
        {
            title: 'Industry Trends & Outlook',
            bullet: true,
            items: [
                'Industry growth projections',
                'Regulatory environment',
                'Emerging threats and opportunities',
                'Company positioning for future trends'
            ]
        }
    ]
};
