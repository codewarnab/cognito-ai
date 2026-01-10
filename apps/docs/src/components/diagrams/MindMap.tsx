import React from 'react';

export interface MindMapNode {
    label: string;
    children?: MindMapNode[];
}

interface MindMapProps {
    root: MindMapNode;
    title?: string;
}

// Layout constants
const NODE_HEIGHT = 24;
const NODE_PADDING_X = 10;
const LEVEL_GAP = 120;
const VERTICAL_GAP = 6;
const ROOT_X = 20;
const START_Y = 20;

interface LayoutNode {
    node: MindMapNode;
    x: number;
    y: number;
    width: number;
    height: number;
    level: number;
    children: LayoutNode[];
}

function measureText(text: string): number {
    const charWidth = 6;
    return text.length * charWidth + NODE_PADDING_X * 2;
}

function layoutTree(node: MindMapNode, level: number, startY: number): { layout: LayoutNode; endY: number } {
    const width = Math.max(measureText(node.label), 60);
    const x = ROOT_X + level * LEVEL_GAP;

    if (!node.children || node.children.length === 0) {
        return {
            layout: {
                node,
                x,
                y: startY,
                width,
                height: NODE_HEIGHT,
                level,
                children: [],
            },
            endY: startY + NODE_HEIGHT,
        };
    }

    const childLayouts: LayoutNode[] = [];
    let currentY = startY;

    for (const child of node.children) {
        const result = layoutTree(child, level + 1, currentY);
        childLayouts.push(result.layout);
        currentY = result.endY + VERTICAL_GAP;
    }

    currentY -= VERTICAL_GAP;

    const firstChildY = childLayouts[0].y + childLayouts[0].height / 2;
    const lastChildY = childLayouts[childLayouts.length - 1].y + childLayouts[childLayouts.length - 1].height / 2;
    const centerY = (firstChildY + lastChildY) / 2 - NODE_HEIGHT / 2;

    return {
        layout: {
            node,
            x,
            y: centerY,
            width,
            height: NODE_HEIGHT,
            level,
            children: childLayouts,
        },
        endY: currentY,
    };
}

function getNodeColors(level: number): { bg: string; stroke: string; text: string } {
    const colors = [
        {
            bg: 'fill-gray-100 dark:fill-gray-800',
            stroke: 'stroke-gray-400 dark:stroke-gray-500',
            text: 'fill-gray-700 dark:fill-gray-300',
        },
        {
            bg: 'fill-slate-50 dark:fill-slate-800/80',
            stroke: 'stroke-slate-300 dark:stroke-slate-600',
            text: 'fill-slate-600 dark:fill-slate-300',
        },
        {
            bg: 'fill-zinc-50 dark:fill-zinc-800/60',
            stroke: 'stroke-zinc-300 dark:stroke-zinc-600',
            text: 'fill-zinc-500 dark:fill-zinc-400',
        },
    ];
    return colors[Math.min(level, colors.length - 1)];
}

function renderNode(layout: LayoutNode, key: string): React.ReactNode[] {
    const elements: React.ReactNode[] = [];
    const colors = getNodeColors(layout.level);
    const isRoot = layout.level === 0;

    // Draw connections to children
    for (let i = 0; i < layout.children.length; i++) {
        const child = layout.children[i];
        const startX = layout.x + layout.width;
        const startY = layout.y + layout.height / 2;
        const endX = child.x;
        const endY = child.y + child.height / 2;
        const midX = startX + (endX - startX) / 2;

        elements.push(
            <path
                key={`${key}-line-${i}`}
                d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                className="stroke-gray-200 dark:stroke-gray-700"
                strokeWidth="1"
                fill="none"
            />
        );
    }

    // Draw the node
    elements.push(
        <g key={`${key}-node`}>
            <rect
                x={layout.x}
                y={layout.y}
                width={layout.width}
                height={layout.height}
                rx={isRoot ? 12 : 6}
                className={`${colors.bg} ${colors.stroke}`}
                strokeWidth={isRoot ? 1.5 : 1}
            />
            <text
                x={layout.x + layout.width / 2}
                y={layout.y + layout.height / 2 + 3}
                textAnchor="middle"
                className={`${colors.text} ${isRoot ? 'text-[10px] font-semibold' : 'text-[9px] font-medium'}`}
            >
                {layout.node.label}
            </text>
        </g>
    );

    // Recursively render children
    for (let i = 0; i < layout.children.length; i++) {
        elements.push(...renderNode(layout.children[i], `${key}-${i}`));
    }

    return elements;
}

export function MindMap({ root, title }: MindMapProps) {
    const { layout, endY } = layoutTree(root, 0, START_Y);

    function getMaxX(node: LayoutNode): number {
        const selfMax = node.x + node.width;
        if (node.children.length === 0) return selfMax;
        return Math.max(selfMax, ...node.children.map(getMaxX));
    }

    const maxX = getMaxX(layout);
    const viewWidth = maxX + 20;
    const viewHeight = endY + 20;

    return (
        <div className="not-prose my-4">
            {title && (
                <div className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {title}
                </div>
            )}
            <svg
                viewBox={`0 0 ${viewWidth} ${viewHeight}`}
                className="w-full max-w-2xl mx-auto"
                style={{ background: 'transparent' }}
            >
                {renderNode(layout, 'root')}
            </svg>
        </div>
    );
}

// Pre-built privacy mind map
export function PrivacyMindMap() {
    const data: MindMapNode = {
        label: 'Privacy First',
        children: [
            {
                label: 'Local-First',
                children: [
                    { label: 'Data stays on device' },
                    { label: 'Browser storage only' },
                    { label: 'No cloud sync by default' },
                ],
            },
            {
                label: 'BYOK',
                children: [
                    { label: 'Your own API keys' },
                    { label: 'Direct API calls' },
                    { label: 'No middleman' },
                ],
            },
            {
                label: 'Minimal Access',
                children: [
                    { label: 'Only what you request' },
                    { label: 'Active tab only' },
                    { label: 'No background scanning' },
                ],
            },
            {
                label: 'No Telemetry',
                children: [
                    { label: 'No analytics' },
                    { label: 'No usage tracking' },
                    { label: 'No error reporting' },
                ],
            },
        ],
    };

    return <MindMap root={data} />;
}
