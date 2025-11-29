import React from 'react';
import TavilyPng from '@assets/brands/integrations/tavily.png';

export const TavilyIcon = ({ size = 16, className }: { size?: number; className?: string }) => {
    return (
        <img
            src={TavilyPng}
            alt="Tavily"
            width={size}
            height={size}
            className={className}
            style={{ objectFit: 'contain' }}
        />
    );
};
