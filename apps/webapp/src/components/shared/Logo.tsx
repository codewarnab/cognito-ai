import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
}

export function Logo({ className, size = 'md', showText = false }: LogoProps) {
    const dimensions = {
        sm: { width: 24, height: 24, text: 'text-lg' },
        md: { width: 32, height: 32, text: 'text-xl' },
        lg: { width: 48, height: 48, text: 'text-2xl' },
    };

    const { width, height, text } = dimensions[size];

    return (
        <div className={cn('flex items-center gap-3', className)}>
            <Image
                src="/logo.png"
                alt="Cognito AI Logo"
                width={width}
                height={height}
                className="object-contain"
                priority
            />
            {showText && (
                <span className={cn('font-bold tracking-tight text-[var(--text-primary)]', text)}>
                    Cognito AI
                </span>
            )}
        </div>
    );
}
