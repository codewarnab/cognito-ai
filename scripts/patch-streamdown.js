/**
 * Patch streamdown to remove mermaid dependency
 * Mermaid causes build failures due to @mermaid-js/parser resolution issues
 * and we don't need mermaid diagram support in this extension
 */

const fs = require('fs');
const path = require('path');

const chunkFile = path.join(__dirname, '../node_modules/streamdown/dist/chunk-T7OEMACY.js');

if (!fs.existsSync(chunkFile)) {
  console.log('streamdown chunk file not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(chunkFile, 'utf8');

// Check if already patched
if (content.includes('// PATCHED: mermaid removed')) {
  console.log('streamdown already patched');
  process.exit(0);
}

// Replace the dynamic mermaid import with a stub that returns a no-op component
const mermaidImportPattern = /import\('mermaid'\)/g;
const mermaidStub = `Promise.resolve({ default: { initialize: () => {}, render: () => ({ svg: '' }) } })`;

content = content.replace(mermaidImportPattern, mermaidStub);

// Add patch marker
content = '// PATCHED: mermaid removed\n' + content;

fs.writeFileSync(chunkFile, content, 'utf8');
console.log('✅ Patched streamdown to remove mermaid dependency');
