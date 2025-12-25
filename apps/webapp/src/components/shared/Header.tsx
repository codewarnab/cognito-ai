import { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Logo } from './Logo';
import { Navigation } from './Navigation';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '@/lib/utils';

interface HeaderProps {
    className?: string;
    children?: ReactNode;
    title?: string;
    backHref?: string;
    showLogo?: boolean;
    showNav?: boolean;
}

export function Header({
    className,
    children,
    title,
    backHref,
    showLogo = true,
    showNav = true,
}: HeaderProps) {
    return (
        <header
            className={cn(
                'sticky top-0 z-50 w-full border-b border-[var(--border-color)] bg-[var(--bg-primary)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-primary)]/60',
                className
            )}
        >
            <div className="container flex h-16 items-center px-8 md:px-24">
                <div className="flex items-center gap-4">
                    {backHref ? (
                        <Link
                            href={backHref}
                            className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                            <ChevronLeft className="h-5 w-5" />
                            {showLogo && <Logo size="sm" />}
                        </Link>
                    ) : (
                        showLogo && (
                            <Link href="/" className="flex items-center gap-2">
                                <Logo size="sm" showText />
                            </Link>
                        )
                    )}

                    {title && (
                        <>
                            {!backHref && showLogo && (
                                <span className="text-[var(--text-secondary)]">/</span>
                            )}
                            <h1 className="text-lg font-medium text-[var(--text-primary)]">
                                {title}
                            </h1>
                        </>
                    )}
                </div>

                <div className="ml-auto flex items-center gap-6">
                    {showNav && <Navigation />}
                    <ThemeToggle />
                    {children}
                </div>
            </div>
        </header>
    );
}

