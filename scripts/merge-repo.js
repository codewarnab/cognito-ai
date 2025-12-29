#!/usr/bin/env node

/**
 * Merge Repository Script
 * Combines all source files in the monorepo into a single markdown file
 * for easy context sharing with AI assistants or documentation purposes.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'FULL_CONTEXT.md');

// Directories to exclude
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.wxt',
  'dist',
  '.turbo',
  '.vercel',
  '.cache',
  'coverage',
  '.cursor',
  '.kiro',
  '.trae',
  '.vscode',
  '__pycache__',
  '.DS_Store',
]);

// Files to exclude
const EXCLUDED_FILES = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  '.gitignore',
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  'tsconfig.tsbuildinfo',
  '.eslintcache',
]);

// File extensions to include (source code, config, docs)
const INCLUDED_EXTENSIONS = new Set([
  // Source code
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  // Config
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  // Documentation
  '.md',
  '.mdx',
  // Styles
  '.css',
  // HTML
  '.html',
  // Other
  '.txt',
]);

// Binary extensions to always exclude
const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.webp',
  '.mp3',
  '.mp4',
  '.wav',
  '.ogg',
  '.webm',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
]);

// Map file extensions to markdown language identifiers
const EXTENSION_TO_LANG = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.md': 'markdown',
  '.mdx': 'mdx',
  '.css': 'css',
  '.html': 'html',
  '.txt': 'text',
};

/**
 * Check if a path should be excluded
 */
function shouldExclude(filePath, stats) {
  const basename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // Check if it's an excluded directory
  if (stats.isDirectory() && EXCLUDED_DIRS.has(basename)) {
    return true;
  }

  // Check if it's an excluded file
  if (stats.isFile()) {
    if (EXCLUDED_FILES.has(basename)) {
      return true;
    }
    if (BINARY_EXTENSIONS.has(ext)) {
      return true;
    }
    if (!INCLUDED_EXTENSIONS.has(ext)) {
      return true;
    }
  }

  return false;
}

/**
 * Recursively collect all files
 */
function collectFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const stats = fs.statSync(fullPath);

    if (shouldExclude(fullPath, stats)) {
      continue;
    }

    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Get relative path from root
 */
function getRelativePath(filePath) {
  return path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
}

/**
 * Get language identifier for syntax highlighting
 */
function getLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_TO_LANG[ext] || 'text';
}

/**
 * Format file size
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Count lines in content
 */
function countLines(content) {
  return content.split('\n').length;
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Scanning repository...');
  
  const files = collectFiles(ROOT_DIR);
  files.sort((a, b) => getRelativePath(a).localeCompare(getRelativePath(b)));

  console.log(`📁 Found ${files.length} files to include\n`);

  // Build table of contents and content
  const toc = [];
  const sections = [];
  let totalLines = 0;
  let totalSize = 0;

  for (const filePath of files) {
    const relativePath = getRelativePath(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const language = getLanguage(filePath);
    const stats = fs.statSync(filePath);
    const lines = countLines(content);

    totalLines += lines;
    totalSize += stats.size;

    // Add to TOC
    const anchor = relativePath.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    toc.push(`- [${relativePath}](#file-${anchor}) (${lines} lines)`);

    // Add file section
    sections.push(`## File: ${relativePath}

**Path:** \`${relativePath}\`  
**Lines:** ${lines}  
**Size:** ${formatSize(stats.size)}

\`\`\`${language}
${content}
\`\`\`

---
`);
  }

  // Generate final output
  const timestamp = new Date().toISOString();
  const output = `# Cognito AI - Full Monorepo Context

> **Generated:** ${timestamp}  
> **Total Files:** ${files.length}  
> **Total Lines:** ${totalLines.toLocaleString()}  
> **Total Size:** ${formatSize(totalSize)}

This file contains the complete source code of the Cognito AI monorepo for context sharing.

---

## Table of Contents

${toc.join('\n')}

---

${sections.join('\n')}
`;

  // Write output
  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');

  console.log('✅ Done!\n');
  console.log(`📄 Output: ${OUTPUT_FILE}`);
  console.log(`📊 Stats:`);
  console.log(`   - Files: ${files.length}`);
  console.log(`   - Lines: ${totalLines.toLocaleString()}`);
  console.log(`   - Size: ${formatSize(totalSize)}`);
  console.log(`   - Output size: ${formatSize(fs.statSync(OUTPUT_FILE).size)}`);
}

main();

