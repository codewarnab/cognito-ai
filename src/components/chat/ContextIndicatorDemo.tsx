/**
 * Context Indicator Demo
 * 
 * A standalone demo component to preview the ContextIndicator
 * with different usage scenarios.
 */

import { useState } from 'react';
import { ContextIndicator } from './ContextIndicator';
import type { AppUsage } from '../../ai/types/usage';
import '../../styles/context-indicator.css';

export function ContextIndicatorDemo() {
    const [scenario, setScenario] = useState<'low' | 'medium' | 'high' | 'critical'>('low');

    const scenarios: Record<string, AppUsage> = {
        low: {
            inputTokens: 5_000,
            outputTokens: 2_000,
            totalTokens: 7_000,
            cachedInputTokens: 10_000,
            context: {
                totalMax: 2_000_000,
                inputMax: 2_000_000,
                outputMax: 8192
            },
            modelId: 'gemini-2.5-flash'
        },
        medium: {
            inputTokens: 800_000,
            outputTokens: 400_000,
            totalTokens: 1_200_000, // 60%
            cachedInputTokens: 100_000,
            context: {
                totalMax: 2_000_000,
                inputMax: 2_000_000,
                outputMax: 8192
            },
            modelId: 'gemini-2.5-flash'
        },
        high: {
            inputTokens: 1_400_000,
            outputTokens: 200_000,
            totalTokens: 1_600_000, // 80%
            cachedInputTokens: 50_000,
            reasoningTokens: 10_000,
            context: {
                totalMax: 2_000_000,
                inputMax: 2_000_000,
                outputMax: 8192
            },
            modelId: 'gemini-2.5-pro'
        },
        critical: {
            inputTokens: 1_700_000,
            outputTokens: 250_000,
            totalTokens: 1_950_000, // 97.5%
            reasoningTokens: 25_000,
            context: {
                totalMax: 2_000_000,
                inputMax: 2_000_000,
                outputMax: 8192
            },
            modelId: 'gemini-2.5-flash'
        }
    };

    return (
        <div style={{
            padding: '40px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <h1 style={{ marginBottom: '20px' }}>Context Indicator Demo</h1>

            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ fontSize: '16px', marginBottom: '10px' }}>Select Scenario:</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => setScenario('low')}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: scenario === 'low' ? '#10b981' : '#e5e7eb',
                            color: scenario === 'low' ? 'white' : 'black',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        Low Usage (0.35%)
                    </button>
                    <button
                        onClick={() => setScenario('medium')}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: scenario === 'medium' ? '#10b981' : '#e5e7eb',
                            color: scenario === 'medium' ? 'white' : 'black',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        Medium Usage (60%)
                    </button>
                    <button
                        onClick={() => setScenario('high')}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: scenario === 'high' ? '#f59e0b' : '#e5e7eb',
                            color: scenario === 'high' ? 'white' : 'black',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        High Usage (80%)
                    </button>
                    <button
                        onClick={() => setScenario('critical')}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: scenario === 'critical' ? '#ef4444' : '#e5e7eb',
                            color: scenario === 'critical' ? 'white' : 'black',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        Critical (97.5%)
                    </button>
                </div>
            </div>

            <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '40px',
                backgroundColor: '#f9fafb',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '200px'
            }}>
                <div style={{
                    display: 'flex',
                    gap: '20px',
                    alignItems: 'center'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ marginBottom: '10px', fontWeight: '500' }}>
                            Hover over the indicator to see details
                        </p>
                        <ContextIndicator usage={scenarios[scenario]} />
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '30px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Current Scenario Details:</h3>
                <pre style={{
                    backgroundColor: '#1f2937',
                    color: '#f9fafb',
                    padding: '16px',
                    borderRadius: '6px',
                    overflow: 'auto',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                }}>
                    {JSON.stringify(scenarios[scenario], null, 2)}
                </pre>
            </div>

            <div style={{ marginTop: '30px', fontSize: '14px', color: '#6b7280' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '10px', color: '#111827' }}>Color Coding:</h3>
                <ul style={{ lineHeight: '1.8' }}>
                    <li>🟢 <strong>Green</strong>: &lt; 70% usage - Safe zone</li>
                    <li>🟡 <strong>Yellow</strong>: 70-85% usage - Caution</li>
                    <li>🔴 <strong>Red</strong>: &gt; 85% usage - Critical, consider starting new thread</li>
                </ul>
            </div>
        </div>
    );
}
