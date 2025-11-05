/**
 * McpIconMapper - Maps MCP server IDs to their corresponding icon components
 * Provides centralized icon mapping for MCP tool visualization
 */

import React from 'react';
import { Ahrefs } from '../../../../../assets/Ahrefs';
import { Asana } from '../../../../../assets/Asana';
import { Astro } from '../../../../../assets/astro-docs';
import { Atlassian } from '../../../../../assets/Atlassian';
import { Canva } from '../../../../../assets/canva';
import { Figma } from '../../../../../assets/figma';
import { GitHub } from '../../../../../assets/github';
import { HuggingFace } from '../../../../../assets/huggingface';
import { Linear } from '../../../../../assets/linear';
import { Netlify } from '../../../../../assets/Netlify';
import { Notion } from '../../../../../assets/notion';
import { PayPal } from '../../../../../assets/paypal';
import { Sentry } from '../../../../../assets/sentry';
import { Stripe } from '../../../../../assets/stripe';
import { Supabase } from '../../../../../assets/supabase';
import { Vercel } from '../../../../../assets/vercel';
import { Webflow } from '../../../../../assets/webflow';
import context7Image from '../../../../../assets/context7.png';
import coingeckoImage from '../../../../../assets/coingecko.webp';
import deepwikiImage from '../../../../../assets/deepwiki.webp';
import wixImage from '../../../../../assets/wix.webp';
import mcpGenericImage from '../../../../../assets/mcp.png';

interface McpIconProps {
    size?: number;
    className?: string;
}

/**
 * Server ID to Icon Component mapping
 * Maps MCP server IDs to their corresponding SVG icon components
 */
const MCP_SERVER_ICONS: Record<string, React.ComponentType<any>> = {
    'ahrefs': Ahrefs,
    'asana': Asana,
    'astro-docs': Astro,
    'atlassian': Atlassian,
    'canva': Canva,
    'figma': Figma,
    'github': GitHub,
    'huggingface': HuggingFace,
    'linear': Linear,
    'netlify': Netlify,
    'notion': Notion,
    'paypal': PayPal,
    'sentry': Sentry,
    'stripe': Stripe,
    'supabase': Supabase,
    'vercel': Vercel,
    'webflow': Webflow,
};

/**
 * Server ID to Image mapping
 * For servers that use image assets instead of SVG components
 */
const MCP_SERVER_IMAGES: Record<string, string> = {
    'context7': context7Image,
    'coingecko': coingeckoImage,
    'deepwiki': deepwikiImage,
    'wix': wixImage,
};

/**
 * Get icon component for a given MCP server ID
 * Returns null if no mapping exists (caller should use fallback)
 */
export function getMcpServerIcon(serverId?: string): React.ComponentType<any> | null {
    if (!serverId) return null;

    const normalizedId = serverId.toLowerCase();

    // Check SVG components first
    if (MCP_SERVER_ICONS[normalizedId]) {
        return MCP_SERVER_ICONS[normalizedId];
    }

    // Check images - return wrapper component
    if (MCP_SERVER_IMAGES[normalizedId]) {
        const imageSrc = MCP_SERVER_IMAGES[normalizedId];
        return ({ size = 24, className }: McpIconProps) => (
            <img
                src={imageSrc}
                alt={serverId}
                width={size}
                height={size}
                className={className}
                style={{ objectFit: 'contain' }}
            />
        );
    }

    return null;
}

/**
 * Generic MCP fallback icon for servers without specific icons
 */
export const GenericMcpIcon = ({ size = 24, className }: McpIconProps) => (
    <img
        src={mcpGenericImage}
        alt="MCP Tool"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain' }}
    />
);

/**
 * Render icon for MCP server with size and className support
 */
export function McpServerIcon({ serverId, size = 24, className }: McpIconProps & { serverId: string }) {
    const IconComponent = getMcpServerIcon(serverId);

    if (!IconComponent) {
        return <GenericMcpIcon size={size} className={className} />;
    }

    return <IconComponent width={size} height={size} className={className} />;
}
