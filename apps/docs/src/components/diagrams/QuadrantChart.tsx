import React from 'react';

export interface QuadrantPoint {
    label: string;
    x: number; // 0-1
    y: number; // 0-1
}

interface QuadrantChartProps {
    title?: string;
    xAxisLabel?: { low: string; high: string };
    yAxisLabel?: { low: string; high: string };
    quadrantLabels?: {
        topRight?: string;
        topLeft?: string;
        bottomLeft?: string;
        bottomRight?: string;
    };
    points: QuadrantPoint[];
}

// Chart dimensions
const PADDING_LEFT = 24;
const PADDING_RIGHT = 24;
const PADDING_TOP = 32;
const PADDING_BOTTOM = 28;
const CHART_WIDTH = 400;
const CHART_HEIGHT = 260;
const POINT_RADIUS = 6;

export function QuadrantChart({
    title,
    xAxisLabel = { low: 'Low', high: 'High' },
    yAxisLabel = { low: 'Low', high: 'High' },
    quadrantLabels = {},
    points,
}: QuadrantChartProps) {
    const width = CHART_WIDTH + PADDING_LEFT + PADDING_RIGHT;
    const height = CHART_HEIGHT + PADDING_TOP + PADDING_BOTTOM;

    // Convert data coordinates to SVG coordinates
    const toSvgX = (x: number) => PADDING_LEFT + x * CHART_WIDTH;
    const toSvgY = (y: number) => PADDING_TOP + (1 - y) * CHART_HEIGHT;

    return (
        <div className="not-prose my-4">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full max-w-lg mx-auto"
                style={{ background: 'transparent' }}
            >
                {/* Title */}
                {title && (
                    <text
                        x={width / 2}
                        y={16}
                        textAnchor="middle"
                        className="text-[11px] font-semibold fill-gray-700 dark:fill-gray-300"
                    >
                        {title}
                    </text>
                )}

                {/* Quadrant backgrounds */}
                <rect
                    x={toSvgX(0.5)}
                    y={toSvgY(1)}
                    width={CHART_WIDTH / 2}
                    height={CHART_HEIGHT / 2}
                    className="fill-emerald-50/70 dark:fill-emerald-900/15"
                />
                <rect
                    x={toSvgX(0)}
                    y={toSvgY(1)}
                    width={CHART_WIDTH / 2}
                    height={CHART_HEIGHT / 2}
                    className="fill-sky-50/70 dark:fill-sky-900/15"
                />
                <rect
                    x={toSvgX(0)}
                    y={toSvgY(0.5)}
                    width={CHART_WIDTH / 2}
                    height={CHART_HEIGHT / 2}
                    className="fill-gray-100/70 dark:fill-gray-800/30"
                />
                <rect
                    x={toSvgX(0.5)}
                    y={toSvgY(0.5)}
                    width={CHART_WIDTH / 2}
                    height={CHART_HEIGHT / 2}
                    className="fill-amber-50/70 dark:fill-amber-900/15"
                />

                {/* Border */}
                <rect
                    x={toSvgX(0)}
                    y={toSvgY(1)}
                    width={CHART_WIDTH}
                    height={CHART_HEIGHT}
                    fill="none"
                    className="stroke-gray-200 dark:stroke-gray-700"
                    strokeWidth="1"
                />

                {/* Center lines */}
                <line
                    x1={toSvgX(0.5)}
                    y1={toSvgY(0)}
                    x2={toSvgX(0.5)}
                    y2={toSvgY(1)}
                    className="stroke-gray-200 dark:stroke-gray-700"
                    strokeWidth="1"
                />
                <line
                    x1={toSvgX(0)}
                    y1={toSvgY(0.5)}
                    x2={toSvgX(1)}
                    y2={toSvgY(0.5)}
                    className="stroke-gray-200 dark:stroke-gray-700"
                    strokeWidth="1"
                />

                {/* Quadrant labels */}
                {quadrantLabels.topRight && (
                    <text
                        x={toSvgX(0.75)}
                        y={toSvgY(0.92)}
                        textAnchor="middle"
                        className="text-[9px] font-medium fill-emerald-500/80 dark:fill-emerald-400/70"
                    >
                        {quadrantLabels.topRight}
                    </text>
                )}
                {quadrantLabels.topLeft && (
                    <text
                        x={toSvgX(0.25)}
                        y={toSvgY(0.92)}
                        textAnchor="middle"
                        className="text-[9px] font-medium fill-sky-500/80 dark:fill-sky-400/70"
                    >
                        {quadrantLabels.topLeft}
                    </text>
                )}
                {quadrantLabels.bottomLeft && (
                    <text
                        x={toSvgX(0.25)}
                        y={toSvgY(0.08)}
                        textAnchor="middle"
                        className="text-[9px] font-medium fill-gray-400/80 dark:fill-gray-500/70"
                    >
                        {quadrantLabels.bottomLeft}
                    </text>
                )}
                {quadrantLabels.bottomRight && (
                    <text
                        x={toSvgX(0.75)}
                        y={toSvgY(0.08)}
                        textAnchor="middle"
                        className="text-[9px] font-medium fill-amber-500/80 dark:fill-amber-400/70"
                    >
                        {quadrantLabels.bottomRight}
                    </text>
                )}

                {/* X-axis labels */}
                <text
                    x={toSvgX(0)}
                    y={toSvgY(-0.08)}
                    textAnchor="start"
                    className="text-[8px] fill-gray-400 dark:fill-gray-500"
                >
                    {xAxisLabel.low}
                </text>
                <text
                    x={toSvgX(1)}
                    y={toSvgY(-0.08)}
                    textAnchor="end"
                    className="text-[8px] fill-gray-400 dark:fill-gray-500"
                >
                    {xAxisLabel.high}
                </text>

                {/* Y-axis labels */}
                <text
                    x={toSvgX(0) - 4}
                    y={toSvgY(0) + 3}
                    textAnchor="end"
                    className="text-[8px] fill-gray-400 dark:fill-gray-500"
                >
                    {yAxisLabel.low}
                </text>
                <text
                    x={toSvgX(0) - 4}
                    y={toSvgY(1) + 3}
                    textAnchor="end"
                    className="text-[8px] fill-gray-400 dark:fill-gray-500"
                >
                    {yAxisLabel.high}
                </text>

                {/* Data points */}
                {points.map((point, i) => (
                    <g key={i}>
                        <circle
                            cx={toSvgX(point.x)}
                            cy={toSvgY(point.y)}
                            r={POINT_RADIUS}
                            className="fill-gray-600 dark:fill-gray-300"
                        />
                        <text
                            x={toSvgX(point.x)}
                            y={toSvgY(point.y) - 10}
                            textAnchor="middle"
                            className="text-[9px] font-medium fill-gray-700 dark:fill-gray-200"
                        >
                            {point.label}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}

// Pre-built privacy comparison chart
export function PrivacyCapabilityChart() {
    return (
        <QuadrantChart
            title="Privacy vs Capability Trade-offs"
            xAxisLabel={{ low: 'Low Capability', high: 'High Capability' }}
            yAxisLabel={{ low: 'Low', high: 'High' }}
            quadrantLabels={{
                topRight: 'Ideal',
                topLeft: 'Privacy-Focused',
                bottomLeft: 'Avoid',
                bottomRight: 'Convenience',
            }}
            points={[
                { label: 'Local Mode', x: 0.25, y: 0.92 },
                { label: 'BYOK Mode', x: 0.82, y: 0.78 },
                { label: 'Cloud Mode', x: 0.82, y: 0.48 },
            ]}
        />
    );
}
