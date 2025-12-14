/**
 * AST-based Code Validation for Adaptive Mode
 * Validates JavaScript code before execution to prevent dangerous operations
 * 
 * Based on ai-code-tools security validation approach
 */

import * as acorn from 'acorn';

interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

// Safe globals that are allowed
const ALLOWED_GLOBALS = new Set([
    // Standard JavaScript
    'Array',
    'Boolean',
    'Date',
    'Error',
    'JSON',
    'Math',
    'Number',
    'Object',
    'String',
    'RegExp',
    'Map',
    'Set',
    'Promise',
    'parseInt',
    'parseFloat',
    'isNaN',
    'isFinite',
    'undefined',
    'NaN',
    'Infinity',
    'console', // Allow console for debugging
    // Our injected context
    'tools',
]);

// Dangerous patterns to block
const FORBIDDEN_IDENTIFIERS = new Set([
    'require',
    'import',
    'eval',
    'Function',
    'process',
    'global',
    'globalThis',
    '__dirname',
    '__filename',
    'module',
    'exports',
    'setTimeout',
    'setInterval',
    'setImmediate',
    'chrome', // Block direct chrome API access
    'window',
    'document',
    'fetch', // Must use tools instead
    'XMLHttpRequest',
    'WebSocket',
]);

/**
 * Validate JavaScript code using AST analysis
 * Blocks dangerous patterns before execution
 */
export function validateCode(code: string): ValidationResult {
    const errors: string[] = [];

    try {
        // Wrap code in async function context for parsing
        // This allows us to parse await expressions properly
        const wrappedCode = `(async () => {\n${code}\n})()`;

        // Parse the code into an AST
        const ast = acorn.parse(wrappedCode, {
            ecmaVersion: 'latest',
            sourceType: 'script',
        });

        // Walk the AST to check for forbidden patterns
        function walk(node: any) {
            if (!node || typeof node !== 'object') return;

            // Check for import/export statements
            if (
                node.type === 'ImportDeclaration' ||
                node.type === 'ExportNamedDeclaration' ||
                node.type === 'ExportDefaultDeclaration' ||
                node.type === 'ExportAllDeclaration'
            ) {
                errors.push(`Import/export statements are not allowed: ${node.type}`);
            }

            // Check for forbidden identifiers
            if (node.type === 'Identifier' && FORBIDDEN_IDENTIFIERS.has(node.name)) {
                errors.push(`Forbidden identifier: ${node.name}`);
            }

            // Check for member expressions accessing forbidden globals
            if (
                node.type === 'MemberExpression' &&
                node.object.type === 'Identifier'
            ) {
                if (FORBIDDEN_IDENTIFIERS.has(node.object.name)) {
                    errors.push(`Access to forbidden object: ${node.object.name}`);
                }
            }

            // Check for constructor property access chains (e.g., {}.constructor.constructor)
            // This is a common way to get access to the Function constructor
            if (
                node.type === 'MemberExpression' &&
                node.property.type === 'Identifier' &&
                node.property.name === 'constructor'
            ) {
                // Check if this is a nested constructor access (constructor.constructor)
                if (
                    node.object.type === 'MemberExpression' &&
                    node.object.property.type === 'Identifier' &&
                    node.object.property.name === 'constructor'
                ) {
                    errors.push(
                        'Nested constructor property access is not allowed (potential Function constructor escape)'
                    );
                }
            }

            // Block while and do-while loops to prevent infinite loops that block the thread
            // For loops are allowed as they have more structure and termination conditions
            if (node.type === 'WhileStatement') {
                errors.push(
                    'while loops are not allowed (potential infinite loop). Use for loops or array methods instead.'
                );
            }

            if (node.type === 'DoWhileStatement') {
                errors.push(
                    'do-while loops are not allowed (potential infinite loop). Use for loops or array methods instead.'
                );
            }

            // Recursively walk child nodes
            for (const key in node) {
                if (key === 'parent') continue; // Skip parent references
                const child = node[key];
                if (Array.isArray(child)) {
                    child.forEach((c) => {
                        if (c && typeof c === 'object') {
                            (c as any).parent = node;
                            walk(c);
                        }
                    });
                } else if (child && typeof child === 'object') {
                    (child as any).parent = node;
                    walk(child);
                }
            }
        }

        walk(ast);

        return {
            isValid: errors.length === 0,
            errors,
        };
    } catch (error: any) {
        return {
            isValid: false,
            errors: [`Failed to parse code: ${error.message}`],
        };
    }
}
