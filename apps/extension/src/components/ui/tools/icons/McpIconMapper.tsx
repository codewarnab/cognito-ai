/**
 * McpIconMapper - Maps MCP server IDs to their corresponding icon components
 * Provides centralized icon mapping for MCP tool visualization
 */

import React from 'react';
import { Ahrefs } from '@assets/brands/integrations/Ahrefs';
import { Asana } from '@assets/brands/integrations/Asana';
import { Astro } from '@assets/brands/integrations/Astro';
import { Atlassian } from '@assets/brands/integrations/Atlassian';
import { Canva } from '@assets/brands/integrations/Canva';
import { Figma } from '@assets/brands/integrations/Figma';
import { GitHub } from '@assets/brands/integrations/GitHub';
import { GoogleMaps } from '@assets/brands/integrations/GoogleMaps';
import { HuggingFace } from '@assets/brands/integrations/HuggingFace';
import { Linear } from '@assets/brands/integrations/Linear';
import { Netlify } from '@assets/brands/integrations/Netlify';
import { Notion } from '@assets/brands/integrations/Notion';
import { PayPal } from '@assets/brands/integrations/PayPal';
import { Sentry } from '@assets/brands/integrations/Sentry';
import { Stripe } from '@assets/brands/integrations/Stripe';
import { Supabase } from '@assets/brands/integrations/Supabase';
import { Supermemory } from '@assets/brands/integrations/Supermemory';
import { Tally } from '@assets/brands/integrations/Tally';
import { Vercel } from '@assets/brands/integrations/Vercel';
import { Webflow } from '@assets/brands/integrations/Webflow';
import context7Image from '@assets/brands/integrations/context7.png';
import coingeckoImage from '@assets/brands/integrations/coingecko.webp';
import deepwikiImage from '@assets/brands/integrations/deepwiki.webp';
import wixImage from '@assets/brands/integrations/wix.webp';
import exaImage from '@assets/brands/integrations/exa-color.svg';
import mcpGenericImage from '@assets/brands/integrations/mcp-server-stroke-rounded.svg';
import twentyFirstDevImage from '@assets/brands/integrations/21stdev.png';
// Adding new MCP server? Also add image import here and entry to MCP_SERVER_IMAGES below
import jinaImage from '@assets/brands/integrations/jina.png';
import planeImage from '@assets/brands/integrations/plane.svg';
import serpApiImage from '@assets/brands/integrations/serpapi.png';

interface McpIconProps {
    size?: number;
    width?: number | string;
    height?: number | string;
    className?: string;
}

function resolveIconSize({ size = 24, width, height }: McpIconProps): number {
    const toNumber = (value: unknown): number | undefined => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) return parsed;
        }
        return undefined;
    };

    return toNumber(width) ?? toNumber(height) ?? size;
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
    'google-maps': GoogleMaps,
    'huggingface': HuggingFace,
    'linear': Linear,
    'netlify': Netlify,
    'notion': Notion,
    'paypal': PayPal,
    'sentry': Sentry,
    'stripe': Stripe,
    'supabase': Supabase,
    'supermemory': Supermemory,
    'tally': Tally,
    'vercel': Vercel,
    'webflow': Webflow,
    'exa': ({ size = 24, width, height, className }: McpIconProps) => {
        const finalSize = resolveIconSize({ size, width, height });
        return (
        <div style={{ width: finalSize, height: finalSize, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className={className}>
            <img
                src={exaImage}
                alt="Exa"
                style={{ width: '70%', height: '70%', objectFit: 'contain' }}
            />
        </div>
        );
    },
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
    'magic-mcp': twentyFirstDevImage,
    'jina': jinaImage,
    'plane': planeImage,
    'serpapi': serpApiImage,
};

/**
 * Get icon component for a given MCP server ID
 * Returns null if no mapping exists (caller should use fallback)
 */
export function getMcpServerIcon(serverId?: string): React.ComponentType<any> | null {
    if (!serverId) return null;

    const normalizedId = serverId.toLowerCase();

    // Check SVG components first
    const IconComponent = MCP_SERVER_ICONS[normalizedId];
    if (IconComponent) {
        return IconComponent;
    }

    // Check images - return wrapper component
    if (MCP_SERVER_IMAGES[normalizedId]) {
        const imageSrc = MCP_SERVER_IMAGES[normalizedId];
        return ({ size = 24, width, height, className }: McpIconProps) => {
            const finalSize = resolveIconSize({ size, width, height });
            return (
                <img
                    src={imageSrc}
                    alt={serverId}
                    width={finalSize}
                    height={finalSize}
                    className={className}
                    style={{
                        objectFit: 'contain',
                        maxWidth: finalSize,
                        maxHeight: finalSize,
                        flexShrink: 0,
                    }}
                />
            );
        };
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
