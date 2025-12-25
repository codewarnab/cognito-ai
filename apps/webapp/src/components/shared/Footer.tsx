'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { AtSignIcon } from '@/components/ui/icons/AtSignIcon';
import { GithubIcon } from '@/components/ui/icons/GithubIcon';
import { DiscordIcon } from '@/components/ui/icons/DiscordIcon';

interface SocialLink {
    href: string;
    title: string;
    icon: React.ReactNode;
}

const socialLinks: SocialLink[] = [
    {
        href: 'mailto:contact@cognito-ai.dev',
        title: 'Contact Us',
        icon: <AtSignIcon size={20} />,
    },
    {
        href: 'https://github.com/codewarnab/cognito-ai',
        title: 'GitHub',
        icon: <GithubIcon size={20} />,
    },
    {
        href: 'https://discord.gg/cognito-ai',
        title: 'Discord',
        icon: <DiscordIcon size={20} />,
    },
];

export const Footer: React.FC = () => {
    const pathname = usePathname();

    // Hide footer on onboarding pages
    if (pathname?.startsWith('/onboarding')) {
        return null;
    }

    return (
        <footer className="flex justify-center items-center gap-5 pt-5 pb-4 mt-auto border-t border-border">
            {socialLinks.map((link) => (
                <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.title}
                    className="text-muted-foreground transition-all p-2 rounded-lg no-underline flex items-center justify-center hover:text-foreground hover:-translate-y-0.5 cursor-pointer"
                >
                    {link.icon}
                </a>
            ))}
        </footer>
    );
};
