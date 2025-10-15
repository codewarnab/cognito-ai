#!/usr/bin/env node

/**
 * Patch vfile imports to use browser versions
 * This is a workaround for Plasmo/Parcel build issues with subpath imports
 * See: https://github.com/remarkjs/react-markdown/issues/864
 */

const fs = require('fs');
const path = require('path');

const vfilePaths = [
    'node_modules/.pnpm/vfile@6.0.3/node_modules/vfile/lib/index.js',
    'node_modules/.pnpm/vfile@5.3.7/node_modules/vfile/lib/index.js'
];

const patches = [
    {
        // vfile@6.0.3
        search: [
            "import {minpath} from '#minpath'",
            "import {minproc} from '#minproc'",
            "import {urlToPath, isUrl} from '#minurl'"
        ],
        replace: [
            "import {minpath} from './minpath.browser.js'",
            "import {minproc} from './minproc.browser.js'",
            "import {urlToPath, isUrl} from './minurl.browser.js'"
        ]
    },
    {
        // vfile@5.3.7
        search: [
            "import {path} from './minpath.js'",
            "import {proc} from './minproc.js'",
            "import {urlToPath, isUrl} from './minurl.js'"
        ],
        replace: [
            "import {path} from './minpath.browser.js'",
            "import {proc} from './minproc.browser.js'",
            "import {urlToPath, isUrl} from './minurl.browser.js'"
        ]
    }
];

console.log('🔧 Patching vfile imports for browser compatibility...\n');

vfilePaths.forEach((filePath, index) => {
    const fullPath = path.join(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
        console.log(`⏭️  Skipping ${filePath} (not found)`);
        return;
    }

    try {
        let content = fs.readFileSync(fullPath, 'utf8');
        const patch = patches[index];
        let modified = false;

        patch.search.forEach((searchStr, i) => {
            if (content.includes(searchStr)) {
                content = content.replace(searchStr, patch.replace[i]);
                modified = true;
            }
        });

        if (modified) {
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`✅ Patched ${filePath}`);
        } else {
            console.log(`✓  ${filePath} already patched`);
        }
    } catch (error) {
        console.error(`❌ Error patching ${filePath}:`, error.message);
    }
});

console.log('\n✨ vfile patching complete!\n');
