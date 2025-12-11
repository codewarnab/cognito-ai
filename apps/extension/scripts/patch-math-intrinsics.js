const fs = require('fs');
const path = require('path');

/**
 * Patch math-intrinsics package.json for browser compatibility
 * 
 * Note: In a pnpm monorepo, packages are hoisted to the root node_modules.
 * This script searches from the monorepo root.
 */

// Find monorepo root (where pnpm-workspace.yaml is)
function findMonorepoRoot(startDir) {
    let dir = startDir;
    while (dir !== path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    return startDir; // Fallback to current directory
}

const monorepoRoot = findMonorepoRoot(process.cwd());

// Find math-intrinsics package.json in root node_modules
const mathIntrinsicsPath = path.join(
    monorepoRoot,
    'node_modules',
    '.pnpm',
    'math-intrinsics@1.1.0',
    'node_modules',
    'math-intrinsics',
    'package.json'
);

console.log('Patching math-intrinsics package.json...');
console.log(`   Monorepo root: ${monorepoRoot}`);
console.log(`   Path: ${mathIntrinsicsPath}`);

try {
    if (fs.existsSync(mathIntrinsicsPath)) {
        const packageJson = JSON.parse(fs.readFileSync(mathIntrinsicsPath, 'utf8'));

        // Change "main": false to "main": "./isNaN.js"
        if (packageJson.main === false) {
            packageJson.main = './isNaN.js'; // Default to one of the exports
            fs.writeFileSync(mathIntrinsicsPath, JSON.stringify(packageJson, null, 2));
            console.log('✅ Successfully patched math-intrinsics package.json');
        } else {
            console.log('ℹ️ math-intrinsics already patched or different version');
        }
    } else {
        console.log('⚠️ math-intrinsics not found at expected path (may be different version)');
    }
} catch (error) {
    console.error('❌ Error patching math-intrinsics:', error.message);
}
