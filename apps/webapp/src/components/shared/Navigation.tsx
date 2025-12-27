'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
    href: string;
    label: string;
}

const navItems: NavItem[] = [
    { href: '/settings', label: 'Settings' },
    { href: '/providers', label: 'AI Providers' },
    { href: '/reminders', label: 'Reminders' },
    { href: '/troubleshooting', label: 'Troubleshooting' },
    { href: '/changelog', label: 'Changelog' },
    // Dev-only nav items
    ...(process.env.NODE_ENV === 'development'
        ? [{ href: '/dev/logger', label: 'Logger' }]
        : []),
];

export function Navigation() {
    const pathname = usePathname();

    return (
        <nav className="flex items-center gap-4">
            {navItems.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                        'text-sm transition-colors',
                        pathname === item.href
                            ? 'text-[var(--text-primary)] font-medium'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    )}
                >
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}
