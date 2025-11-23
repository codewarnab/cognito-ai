const fs = require('fs');
const path = require('path');

// Copy offscreen files to build directories
const buildDirs = [
    'build/chrome-mv3-dev',
    'build/chrome-mv3-prod'
];

const filesToCopy = [
    'public/offscreen.html',
    'public/offscreen.js',
    'public/sweep1.mp3'
];

let copiedCount = 0;

buildDirs.forEach(buildDir => {
    if (fs.existsSync(buildDir)) {
        filesToCopy.forEach(file => {
            const fileName = path.basename(file);
            const dest = path.join(buildDir, fileName);

            if (fs.existsSync(file)) {
                try {
                    fs.copyFileSync(file, dest);
                    console.log(`✓ Copied ${fileName} to ${buildDir}`);
                    copiedCount++;
                } catch (err) {
                    console.error(`✗ Failed to copy ${fileName} to ${buildDir}: ${err.message}`);
                    process.exit(1);
                }
            }
        });
    }
});

if (copiedCount > 0) {
    console.log('✓ Offscreen files copied successfully!');
} else {
    console.log('ℹ No build directories found (this is normal before first build)');
}

