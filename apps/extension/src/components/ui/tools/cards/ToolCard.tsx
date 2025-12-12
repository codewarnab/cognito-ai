/**
 * ToolCard - Shared UI component for rendering tool execution states
 * Provides consistent visual feedback for inProgress, complete, and failed states
 */

import React from 'react';

export interface ToolCardProps {
  title: string;
  subtitle?: string;
  state: 'loading' | 'success' | 'error';
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function ToolCard({ title, subtitle, state, icon, children }: ToolCardProps) {
  const stateClass = state === 'loading' ? 'tool-card-loading' :
    state === 'success' ? 'tool-card-success' : 'tool-card-error';

  return (
    <div className={`rounded-[var(--radius-md)] p-[var(--spacing-md)] my-[var(--spacing-sm)] border border-[var(--color-border)] bg-[var(--color-background)] transition-all duration-200 ease-out 
        ${state === 'loading' ? 'border-l-[3px] border-l-[var(--blue-stride)] bg-[rgba(18,100,255,0.05)]' : ''}
        ${state === 'success' ? 'border-l-[3px] border-l-[var(--color-success)] bg-[rgba(76,175,80,0.05)]' : ''}
        ${state === 'error' ? 'border-l-[3px] border-l-[var(--color-error)] bg-[rgba(244,67,54,0.05)]' : ''}
    `}>
      <div className="flex items-center justify-between mb-[var(--spacing-sm)]">
        <div className="flex items-center gap-[var(--spacing-sm)] flex-1">
          {icon && <div className="flex items-center text-[20px]">{icon}</div>}
          <span className="font-semibold text-[var(--color-text)] text-[14px]">{title}</span>
        </div>
        {state === 'loading' && (
          <div className="w-4 h-4 border-2 border-[rgba(18,100,255,0.3)] border-t-[var(--blue-stride)] rounded-full animate-spin" />
        )}
        {state === 'success' && (
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold text-white bg-[var(--color-success)]">✓</div>
        )}
        {state === 'error' && (
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold text-white bg-[var(--color-error)]">✕</div>
        )}
      </div>
      {subtitle && (
        <div className="text-[var(--color-text)] opacity-70 text-[13px] mt-[var(--spacing-xs)] break-all">{subtitle}</div>
      )}
      {children && (
        <div className="mt-[var(--spacing-md)]">{children}</div>
      )}
    </div>
  );
}

export function CodeBlock({ code, language = 'text' }: { code: string; language?: string }) {
  return (
    <pre className="bg-[var(--color-surface)] rounded-[var(--radius-sm)] p-[var(--spacing-sm)] overflow-x-auto font-mono text-[12px] leading-[1.5] my-[var(--spacing-sm)]">
      <code className={`language-${language}`}>{code}</code>
    </pre>
  );
}

export function Badge({ label, variant = 'default' }: { label: string; variant?: 'default' | 'success' | 'warning' | 'error' }) {
  return (
    <span className={`inline-block px-2 py-[2px] rounded-[var(--radius-sm)] text-[11px] font-semibold m-[2px]
        ${variant === 'default' ? 'bg-[var(--color-surface)] text-[var(--color-text)]' : ''}
        ${variant === 'success' ? 'bg-[rgba(76,175,80,0.2)] text-[var(--color-success)]' : ''}
        ${variant === 'warning' ? 'bg-[rgba(255,152,0,0.2)] text-[var(--color-warning)]' : ''}
        ${variant === 'error' ? 'bg-[rgba(244,67,54,0.2)] text-[var(--color-error)]' : ''}
    `}>{label}</span>
  );
}

export function Keycap({ keyName }: { keyName: string }) {
  return (
    <kbd className="inline-block px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] font-mono text-[12px] font-semibold shadow-[0_2px_0_rgba(0,0,0,0.1)] mx-[2px]">{keyName}</kbd>
  );
}

export function ResultList({ items }: { items: Array<{ id?: string | number; title?: string; url?: string }> }) {
  return (
    <ul className="list-none p-0 my-[var(--spacing-sm)] max-h-[200px] overflow-y-auto">
      {items.map((item, idx) => (
        <li key={item.id ?? idx} className="p-[var(--spacing-sm)] rounded-[var(--radius-sm)] bg-[var(--color-surface)] mb-[var(--spacing-xs)] flex flex-col gap-[var(--spacing-xs)] hover:bg-[rgba(18,100,255,0.1)]">
          {item.title && <span className="font-medium text-[var(--color-text)] text-[13px]">{item.title}</span>}
          {item.url && <span className="text-[12px] text-[var(--color-text)] opacity-60 font-mono break-all">{item.url}</span>}
        </li>
      ))}
    </ul>
  );
}

