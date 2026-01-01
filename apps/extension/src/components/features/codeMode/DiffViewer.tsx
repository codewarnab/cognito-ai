/**
 * DiffViewer - Renders a unified diff with syntax highlighting
 * Uses react-diff-viewer-continued for rendering
 */

import React, { useState, useMemo } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { parseUnifiedDiff, formatFilePath } from './diffUtils';
import { getFileIcon } from '@/utils/files';
import { createLogger } from '~logger';

const log = createLogger('DiffViewer', 'CODE_MODE_UI');

interface DiffViewerProps {
    unifiedDiff: string;
    defaultExpanded?: boolean;
}

// Custom styles for the diff viewer to match extension theme
const diffStyles = {
    variables: {
        dark: {
            diffViewerBackground: '#0d1117',
            diffViewerColor: '#c9d1d9',
            addedBackground: 'rgba(46, 160, 67, 0.15)',
            addedColor: '#7ee787',
            removedBackground: 'rgba(248, 81, 73, 0.15)',
            removedColor: '#ffa198',
            wordAddedBackground: 'rgba(46, 160, 67, 0.4)',
            wordRemovedBackground: 'rgba(248, 81, 73, 0.4)',
            addedGutterBackground: 'rgba(46, 160, 67, 0.2)',
            removedGutterBackground: 'rgba(248, 81, 73, 0.2)',
            gutterBackground: '#161b22',
            gutterBackgroundDark: '#0d1117',
            highlightBackground: 'rgba(56, 139, 253, 0.1)',
            highlightGutterBackground: 'rgba(56, 139, 253, 0.2)',
            codeFoldGutterBackground: '#161b22',
            codeFoldBackground: '#161b22',
            emptyLineBackground: '#0d1117',
            codeFoldContentColor: '#8b949e',
        },
    },
    line: {
        padding: '2px 10px',
        fontSize: '12px',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    },
    gutter: {
        minWidth: '40px',
        padding: '0 8px',
        fontSize: '11px',
    },
    contentText: {
        fontSize: '12px',
        lineHeight: '1.5',
    },
};

interface FileDiffProps {
    oldFile: string;
    newFile: string;
    oldCode: string;
    newCode: string;
    defaultExpanded?: boolean;
}

const FileDiff: React.FC<FileDiffProps> = ({
    oldFile,
    newFile,
    oldCode,
    newCode,
    defaultExpanded = false,
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [copied, setCopied] = useState(false);

    const displayPath = newFile || oldFile;
    const isNewFile = !oldFile || oldCode === '';
    const isDeletedFile = !newFile || newCode === '';

    const handleCopy = async () => {
        try {
            // Copy the raw diff for this file
            const diffContent = `--- a/${oldFile}\n+++ b/${newFile}\n${newCode}`;
            await navigator.clipboard.writeText(diffContent);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            log.error('Failed to copy diff', error);
        }
    };

    return (
        <div className="border border-[rgba(100,120,150,0.2)] rounded-lg overflow-hidden bg-[#0d1117]">
            {/* File header */}
            <div
                className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-b border-[rgba(100,120,150,0.2)] cursor-pointer hover:bg-[#1c2128] transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <button className="flex-shrink-0 text-[#8b949e] hover:text-white transition-colors">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                <span className="flex-shrink-0">
                    {getFileIcon(displayPath, 14)}
                </span>

                <span className="text-[13px] text-[#c9d1d9] font-mono truncate flex-1" title={displayPath}>
                    {formatFilePath(displayPath)}
                </span>

                {isNewFile && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">
                        NEW
                    </span>
                )}
                {isDeletedFile && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">
                        DELETED
                    </span>
                )}

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCopy();
                    }}
                    className="flex-shrink-0 p-1 text-[#8b949e] hover:text-white hover:bg-[rgba(255,255,255,0.1)] rounded transition-colors cursor-pointer"
                    title="Copy diff"
                >
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
            </div>

            {/* Diff content */}
            {isExpanded && (
                <div className="overflow-x-auto">
                    <ReactDiffViewer
                        oldValue={oldCode}
                        newValue={newCode}
                        splitView={false}
                        useDarkTheme={true}
                        showDiffOnly={true}
                        extraLinesSurroundingDiff={3}
                        compareMethod={DiffMethod.WORDS}
                        styles={diffStyles}
                        hideLineNumbers={false}
                    />
                </div>
            )}
        </div>
    );
};

export const DiffViewer: React.FC<DiffViewerProps> = ({
    unifiedDiff,
    defaultExpanded = true,
}) => {
    const parsedDiffs = useMemo(() => {
        try {
            return parseUnifiedDiff(unifiedDiff);
        } catch (error) {
            log.error('Failed to parse diff', error);
            return [];
        }
    }, [unifiedDiff]);

    // Convert parsed diffs to old/new code pairs for react-diff-viewer
    const fileDiffs = useMemo(() => {
        return parsedDiffs.map((diff) => {
            // Reconstruct old and new file contents from hunks
            let oldLines: string[] = [];
            let newLines: string[] = [];

            for (const hunk of diff.hunks) {
                for (const line of hunk.lines) {
                    if (line.type === 'context') {
                        oldLines.push(line.content);
                        newLines.push(line.content);
                    } else if (line.type === 'remove') {
                        oldLines.push(line.content);
                    } else if (line.type === 'add') {
                        newLines.push(line.content);
                    }
                }
            }

            return {
                oldFile: diff.oldFile,
                newFile: diff.newFile,
                oldCode: oldLines.join('\n'),
                newCode: newLines.join('\n'),
            };
        });
    }, [parsedDiffs]);

    if (fileDiffs.length === 0) {
        // Fallback: show raw diff if parsing failed
        return (
            <div className="p-3 bg-[#0d1117] rounded-lg border border-[rgba(100,120,150,0.2)]">
                <pre className="text-[12px] text-[#8b949e] font-mono whitespace-pre-wrap overflow-x-auto">
                    {unifiedDiff}
                </pre>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {fileDiffs.map((diff, index) => (
                <FileDiff
                    key={`${diff.newFile || diff.oldFile}-${index}`}
                    {...diff}
                    defaultExpanded={defaultExpanded && index === 0}
                />
            ))}
        </div>
    );
};

export default DiffViewer;
