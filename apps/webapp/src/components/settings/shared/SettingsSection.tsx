interface SettingsSectionProps {
    title: string;
    description?: string;
    children: React.ReactNode;
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
    return (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-color)]/50">
                <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
                {description && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>
                )}
            </div>
            <div className="px-5 py-4 space-y-4">
                {children}
            </div>
        </div>
    );
}
