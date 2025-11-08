const fs = require('fs');
const path = require('path');

// Find and patch math-intrinsics package.json
const mathIntrinsicsPath = path.join(
    __dirname,
    '..',
    'node_modules',
    '.pnpm',
    'math-intrinsics@1.1.0',
    'node_modules',
    'math-intrinsics',
    'package.json'
);

console.log('Patching math-intrinsics package.json...');
console.log('Path:', mathIntrinsicsPath);

try {
    if (fs.existsSync(mathIntrinsicsPath)) {
        const packageJson = JSON.parse(fs.readFileSync(mathIntrinsicsPath, 'utf8'));

        // Change "main": false to "main": "./index.js"
        if (packageJson.main === false) {
            packageJson.main = './isNaN.js'; // Default to one of the exports
            fs.writeFileSync(mathIntrinsicsPath, JSON.stringify(packageJson, null, 2));
            console.log('✅ Successfully patched math-intrinsics package.json');
        } else {
            console.log('ℹ️ math-intrinsics already patched or different version');
        }
    } else {
        console.log('⚠️ math-intrinsics not found at expected path');
    }
} catch (error) {
    console.error('❌ Error patching math-intrinsics:', error.message);
}
