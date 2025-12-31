import { spawn } from 'node:child_process';

/**
 * Extract file paths from a unified diff
 */
export function extractPatchedFiles(unifiedDiff: string): string[] {
  const files = new Set<string>();
  const re = /^diff --git a\/(.+?) b\/(.+)$/gm;
  
  for (const match of unifiedDiff.matchAll(re)) {
    if (match[1]) files.add(match[1]);
    if (match[2]) files.add(match[2]);
  }
  
  return Array.from(files);
}

/**
 * Validate diff for safety
 */
export function assertSafeDiff(unifiedDiff: string): void {
  const bytes = Buffer.byteLength(unifiedDiff, 'utf-8');
  
  // Max 2MB diff
  if (bytes > 2_000_000) {
    throw new Error('Diff too large (max 2MB)');
  }
  
  // Check for unsafe paths
  for (const filePath of extractPatchedFiles(unifiedDiff)) {
    if (filePath.startsWith('/')) {
      throw new Error(`Unsafe absolute path in diff: ${filePath}`);
    }
    if (filePath.includes('..')) {
      throw new Error(`Unsafe path traversal in diff: ${filePath}`);
    }
  }
}

/**
 * Run git apply with the given arguments
 */
function runGitApply(
  args: string[],
  cwd: string,
  unifiedDiff: string
): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('git', ['apply', ...args, '-'], {
      cwd,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    
    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString('utf-8');
    });
    
    child.on('close', (code) => {
      resolve({ ok: code === 0, stderr });
    });
    
    child.stdin.write(unifiedDiff, 'utf-8');
    child.stdin.end();
  });
}

export interface ApplyResult {
  applied: boolean;
  filesChanged: string[];
  error?: string;
}

/**
 * Apply a unified diff using git apply
 * First runs --check to validate, then applies
 */
export async function applyWithGit(opts: {
  cwd: string;
  unifiedDiff: string;
}): Promise<ApplyResult> {
  // Validate diff safety
  assertSafeDiff(opts.unifiedDiff);
  
  const filesChanged = extractPatchedFiles(opts.unifiedDiff);
  
  // First, check if the patch can be applied
  const check = await runGitApply(['--check'], opts.cwd, opts.unifiedDiff);
  if (!check.ok) {
    return {
      applied: false,
      filesChanged,
      error: `Patch check failed: ${check.stderr}`,
    };
  }
  
  // Apply the patch
  const apply = await runGitApply([], opts.cwd, opts.unifiedDiff);
  if (!apply.ok) {
    return {
      applied: false,
      filesChanged,
      error: `Patch apply failed: ${apply.stderr}`,
    };
  }
  
  return { applied: true, filesChanged };
}
