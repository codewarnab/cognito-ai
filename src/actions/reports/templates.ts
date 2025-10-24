/**
 * Report Templates
 * Defines template structures for different types of research reports
 */

export interface TemplateSection {
    title: string;
    description?: string;
    bullet?: boolean;
    items?: string[];
}

export interface ReportTemplate {
    name: string;
    description: string;
    sections: TemplateSection[];
}

export type TemplateType = 'person' | 'technology' | 'company' | 'concept' | 'product' | 'generic';

export const REPORT_TEMPLATES: Record<TemplateType, ReportTemplate> = {
    person: {
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
                title: 'Professional Insights',
                description: '5-7 insights about their work style, impact, or unique approaches'
            }
        ]
    },

    technology: {
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
                title: 'Use Case Recommendations',
                description: 'When to use this technology and when to consider alternatives'
            }
        ]
    },

    company: {
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
                title: 'Strategic Analysis',
                description: 'Strengths, opportunities, and potential challenges'
            }
        ]
    },

    concept: {
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
                title: 'Implementation Guidance',
                description: 'How to get started and best practices'
            }
        ]
    },

    product: {
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
                title: 'Recommendation',
                description: 'Who should use this product and why'
            }
        ]
    },

    generic: {
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
                title: 'Implementation Plan',
                description: 'Detailed, actionable steps with phases, prerequisites, challenges, solutions, resources, and best practices'
            }
        ]
    }
};

/**
 * Get a template by type
 */
export function getTemplateByType(type: TemplateType): ReportTemplate {
    return REPORT_TEMPLATES[type] || REPORT_TEMPLATES.generic;
}

/**
 * Get all available template types with descriptions
 */
export function getAvailableTemplateTypes(): Array<{ type: TemplateType; name: string; description: string }> {
    return Object.entries(REPORT_TEMPLATES).map(([type, template]) => ({
        type: type as TemplateType,
        name: template.name,
        description: template.description
    }));
}
