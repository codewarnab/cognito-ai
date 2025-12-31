/**
 * Diff utilities for parsing and formatting unified diffs
 */

export interface DiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: DiffLine[];
}

export interface DiffLine {
    type: 'add' | 'remove' | 'context';
    content: string;
    oldLineNumber?: number;
    newLineNumber?: number;
}

export interface ParsedDiff {
    oldFile: string;
    newFile: string;
    hunks: DiffHunk[];
}

/**
 * Extract file paths from unified diff headers
 */
export function extractFilesFromUnifiedDiff(diff: string): string[] {
    const files = new Set<string>();
    const re = /^diff --git a\/(.+?) b\/(.+)$/gm;
    for (const m of diff.matchAll(re)) {
        if (m[2]) files.add(m[2]); // Use the "b" path (new file)
    }
    return Array.from(files);
}

/**
 * Parse a unified diff into structured data
 */
export function parseUnifiedDiff(diff: string): ParsedDiff[] {
    const results: ParsedDiff[] = [];
    const fileDiffs = diff.split(/^diff --git/m).filter(Boolean);

    for (const fileDiff of fileDiffs) {
        const lines = fileDiff.split('\n');

        // Extract file names
        let oldFile = '';
        let newFile = '';

        for (const line of lines) {
            if (line.startsWith('--- a/')) {
                oldFile = line.slice(6);
            } else if (line.startsWith('+++ b/')) {
                newFile = line.slice(6);
            }
        }

        // If we didn't find the file names in --- format, try to extract from the header
        if (!oldFile && !newFile) {
            const match = lines[0]?.match(/a\/(.+?) b\/(.+)/);
            if (match) {
                oldFile = match[1];
                newFile = match[2];
            }
        }

        // Parse hunks
        const hunks: DiffHunk[] = [];
        let currentHunk: DiffHunk | null = null;
        let oldLineNum = 0;
        let newLineNum = 0;

        for (const line of lines) {
            // Match hunk header: @@ -oldStart,oldLines +newStart,newLines @@
            const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
            if (hunkMatch) {
                currentHunk = {
                    oldStart: parseInt(hunkMatch[1], 10),
                    oldLines: parseInt(hunkMatch[2] || '1', 10),
                    newStart: parseInt(hunkMatch[3], 10),
                    newLines: parseInt(hunkMatch[4] || '1', 10),
                    lines: [],
                };
                oldLineNum = currentHunk.oldStart;
                newLineNum = currentHunk.newStart;
                hunks.push(currentHunk);
                continue;
            }

            if (!currentHunk) continue;

            if (line.startsWith('+') && !line.startsWith('+++')) {
                currentHunk.lines.push({
                    type: 'add',
                    content: line.slice(1),
                    newLineNumber: newLineNum++,
                });
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                currentHunk.lines.push({
                    type: 'remove',
                    content: line.slice(1),
                    oldLineNumber: oldLineNum++,
                });
            } else if (line.startsWith(' ')) {
                currentHunk.lines.push({
                    type: 'context',
                    content: line.slice(1),
                    oldLineNumber: oldLineNum++,
                    newLineNumber: newLineNum++,
                });
            }
        }

        if (newFile || oldFile) {
            results.push({ oldFile, newFile, hunks });
        }
    }

    return results;
}

/**
 * Format a file path for display (truncate long paths)
 */
export function formatFilePath(path: string, maxLength = 50): string {
    if (path.length <= maxLength) return path;

    const parts = path.split('/');
    if (parts.length <= 2) return path;

    // Show first and last parts with ellipsis
    return `${parts[0]}/.../${parts.slice(-2).join('/')}`;
}

/**
 * Get file extension from path
 */
export function getFileExtension(path: string): string {
    const match = path.match(/\.([^./]+)$/);
    return match ? match[1].toLowerCase() : '';
}

/**
 * Get language for syntax highlighting based on file extension
 */
export function getLanguageFromExtension(extension: string): string {
    const map: Record<string, string> = {
        js: 'javascript',
        jsx: 'jsx',
        ts: 'typescript',
        tsx: 'tsx',
        py: 'python',
        rb: 'ruby',
        go: 'go',
        rs: 'rust',
        java: 'java',
        kt: 'kotlin',
        swift: 'swift',
        c: 'c',
        cpp: 'cpp',
        h: 'c',
        hpp: 'cpp',
        css: 'css',
        scss: 'scss',
        less: 'less',
        html: 'html',
        xml: 'xml',
        json: 'json',
        yaml: 'yaml',
        yml: 'yaml',
        md: 'markdown',
        sql: 'sql',
        sh: 'bash',
        bash: 'bash',
        zsh: 'bash',
        fish: 'bash',
    };
    return map[extension] || 'text';
}
