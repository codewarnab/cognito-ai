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
    <div className={`tool-card ${stateClass}`}>
      <div className="tool-card-header">
        <div className="tool-card-title-row">
          {icon && <div className="tool-card-icon">{icon}</div>}
          <span className="tool-card-title">{title}</span>
        </div>
        {state === 'loading' && (
          <div className="tool-card-spinner" />
        )}
        {state === 'success' && (
          <div className="tool-card-status-icon tool-card-status-success">✓</div>
        )}
        {state === 'error' && (
          <div className="tool-card-status-icon tool-card-status-error">✕</div>
        )}
      </div>
      {subtitle && (
        <div className="tool-card-subtitle">{subtitle}</div>
      )}
      {children && (
        <div className="tool-card-content">{children}</div>
      )}
    </div>
  );
}

export function CodeBlock({ code, language = 'text' }: { code: string; language?: string }) {
  return (
    <pre className="tool-code-block">
      <code className={`language-${language}`}>{code}</code>
    </pre>
  );
}

export function Badge({ label, variant = 'default' }: { label: string; variant?: 'default' | 'success' | 'warning' | 'error' }) {
  return (
    <span className={`tool-badge tool-badge-${variant}`}>{label}</span>
  );
}

export function Keycap({ keyName }: { keyName: string }) {
  return (
    <kbd className="tool-keycap">{keyName}</kbd>
  );
}

export function ResultList({ items }: { items: Array<{ id?: string | number; title?: string; url?: string }> }) {
  return (
    <ul className="tool-result-list">
      {items.map((item, idx) => (
        <li key={item.id ?? idx} className="tool-result-item">
          {item.title && <span className="tool-result-title">{item.title}</span>}
          {item.url && <span className="tool-result-url">{item.url}</span>}
        </li>
      ))}
    </ul>
  );
}

