interface SettingsSectionProps {
    title: string;
    description?: string;
    children: React.ReactNode;
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
    return (
        <div className="rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)]/40">
            <div className="px-4 py-2.5 border-b border-[var(--border-color)]/40">
                <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
                {description && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>
                )}
            </div>
            <div className="px-4 py-2 space-y-0">
                {children}
            </div>
        </div>
    );
}
