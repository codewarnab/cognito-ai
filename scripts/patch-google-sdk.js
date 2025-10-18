/**
 * Post-install script to patch @ai-sdk/google package
 * Fixes: Handle submit-tool-result follow-up requests in AI SDK v5
 * 
 * This patches the convertJSONSchemaToOpenAPISchema function to properly
 * handle additionalProperties field from JSON Schema to OpenAPI conversion.
 * 
 * Related PR: https://github.com/vercel/ai/pull/7531
 */

const fs = require('fs');
const path = require('path');

const GOOGLE_SDK_PATH = path.join(__dirname, '../node_modules/@ai-sdk/google/dist');

/**
 * Patch function to add additionalProperties support
 */
function patchConvertJSONSchemaFunction(filePath) {
  console.log(`[patch-google-sdk] Patching ${path.relative(process.cwd(), filePath)}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if already patched
  if (content.includes('additionalProperties') && content.includes('// PATCHED:')) {
    console.log('[patch-google-sdk] Already patched, skipping');
    return false;
  }
  
  // Pattern to find the destructuring line in convertJSONSchemaToOpenAPISchema
  const destructuringPattern = /const\s+{\s*type,\s*description,\s*required,\s*properties,\s*items,\s*allOf,\s*anyOf,\s*oneOf,\s*format,\s*const:\s*constValue,\s*minLength,\s*enum:\s*enumValues\s*}\s*=\s*jsonSchema;/;
  
  if (destructuringPattern.test(content)) {
    // Add additionalProperties to destructuring
    content = content.replace(
      destructuringPattern,
      `const {
    type,
    description,
    required,
    properties,
    items,
    allOf,
    anyOf,
    oneOf,
    format,
    const: constValue,
    minLength,
    enum: enumValues,
    additionalProperties  // PATCHED: Added for submit-tool-result support
  } = jsonSchema;`
    );
    modified = true;
  }
  
  // Pattern to find where result is returned (before the return statement)
  const returnPattern = /(if\s+\(minLength\)\s+result\.minLength\s*=\s*minLength;)\s*(return\s+result;)/;
  
  if (returnPattern.test(content)) {
    // Add additionalProperties handling before return
    content = content.replace(
      returnPattern,
      `$1
  // PATCHED: Handle additionalProperties for submit-tool-result
  if (additionalProperties !== undefined) {
    if (typeof additionalProperties === 'boolean') {
      result.additionalProperties = additionalProperties;
    } else {
      result.additionalProperties = convertJSONSchemaToOpenAPISchema(additionalProperties);
    }
  }
  $2`
    );
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[patch-google-sdk] ✅ Patched successfully');
    return true;
  } else {
    console.log('[patch-google-sdk] ⚠️ Pattern not found, skipping');
    return false;
  }
}

/**
 * Main patch function
 */
function patchGoogleSDK() {
  console.log('[patch-google-sdk] Starting patch process...');
  
  const filesToPatch = [
    path.join(GOOGLE_SDK_PATH, 'index.mjs'),
    path.join(GOOGLE_SDK_PATH, 'index.js'),
    path.join(GOOGLE_SDK_PATH, 'internal/index.mjs'),
    path.join(GOOGLE_SDK_PATH, 'internal/index.js'),
  ];
  
  let patchedCount = 0;
  
  for (const file of filesToPatch) {
    if (fs.existsSync(file)) {
      if (patchConvertJSONSchemaFunction(file)) {
        patchedCount++;
      }
    } else {
      console.log(`[patch-google-sdk] ⚠️ File not found: ${path.relative(process.cwd(), file)}`);
    }
  }
  
  if (patchedCount > 0) {
    console.log(`[patch-google-sdk] ✅ Successfully patched ${patchedCount} file(s)`);
    console.log('[patch-google-sdk] This fix enables submit-tool-result handling for MCP tools');
  } else {
    console.log('[patch-google-sdk] ℹ️ No files were patched (may already be patched)');
  }
}

// Run patch
try {
  if (fs.existsSync(GOOGLE_SDK_PATH)) {
    patchGoogleSDK();
  } else {
    console.log('[patch-google-sdk] @ai-sdk/google not found, skipping patch');
  }
} catch (error) {
  console.error('[patch-google-sdk] ❌ Error during patching:', error);
  // Don't fail the install if patching fails
  process.exit(0);
}

