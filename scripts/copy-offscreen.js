const fs = require('fs');
const path = require('path');

// Copy offscreen files to build directories
const buildDirs = [
    'build/chrome-mv3-dev',
    'build/chrome-mv3-prod'
];

const filesToCopy = [
    'public/offscreen.html',
    'public/offscreen.js'
];

let copiedCount = 0;

buildDirs.forEach(buildDir => {
    if (fs.existsSync(buildDir)) {
        filesToCopy.forEach(file => {
            const fileName = path.basename(file);
            const dest = path.join(buildDir, fileName);
            
            if (fs.existsSync(file)) {
                fs.copyFileSync(file, dest);
                console.log(`✓ Copied ${fileName} to ${buildDir}`);
                copiedCount++;
            }
        });
    }
});

if (copiedCount > 0) {
    console.log('✓ Offscreen files copied successfully!');
} else {
    console.log('ℹ No build directories found (this is normal before first build)');
}

