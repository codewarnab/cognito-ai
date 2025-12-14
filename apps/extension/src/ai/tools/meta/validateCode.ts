/**
 * AST-based Code Validation for Adaptive Mode
 * Validates JavaScript code before execution to prevent dangerous operations
 * 
 *  validation approach
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
 * 
 * Security layers:
 * 1. Block FORBIDDEN_IDENTIFIERS (explicit blocklist)
 * 2. Only allow ALLOWED_GLOBALS (explicit allowlist)
 * 3. Block dangerous patterns (constructor chains, infinite loops)
 */
export function validateCode(code: string): ValidationResult {
    const errors: string[] = [];
    // Track locally declared variables (these are allowed to be accessed)
    const declaredVariables = new Set<string>();

    try {
        // Wrap code in async function context for parsing
        // This allows us to parse await expressions properly
        const wrappedCode = `(async () => {\n${code}\n})()`;

        // Parse the code into an AST
        const ast = acorn.parse(wrappedCode, {
            ecmaVersion: 'latest',
            sourceType: 'script',
        });

        // First pass: collect all declared variables
        function collectDeclarations(node: any) {
            if (!node || typeof node !== 'object') return;

            // Variable declarations: const x, let y, var z
            if (node.type === 'VariableDeclaration') {
                for (const decl of node.declarations) {
                    if (decl.id.type === 'Identifier') {
                        declaredVariables.add(decl.id.name);
                    } else if (decl.id.type === 'ObjectPattern') {
                        // Destructuring: const { a, b } = obj
                        collectPatternNames(decl.id, declaredVariables);
                    } else if (decl.id.type === 'ArrayPattern') {
                        // Array destructuring: const [a, b] = arr
                        collectPatternNames(decl.id, declaredVariables);
                    }
                }
            }

            // Function declarations: function foo() {}
            if (node.type === 'FunctionDeclaration' && node.id) {
                declaredVariables.add(node.id.name);
            }

            // Function parameters
            if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
                for (const param of node.params || []) {
                    if (param.type === 'Identifier') {
                        declaredVariables.add(param.name);
                    } else {
                        collectPatternNames(param, declaredVariables);
                    }
                }
            }

            // Catch clause parameter: catch (e) {}
            if (node.type === 'CatchClause' && node.param) {
                if (node.param.type === 'Identifier') {
                    declaredVariables.add(node.param.name);
                }
            }

            // Recursively collect from child nodes
            for (const key in node) {
                if (key === 'parent') continue;
                const child = node[key];
                if (Array.isArray(child)) {
                    child.forEach(c => collectDeclarations(c));
                } else if (child && typeof child === 'object') {
                    collectDeclarations(child);
                }
            }
        }

        // Helper to collect names from destructuring patterns
        function collectPatternNames(pattern: any, names: Set<string>) {
            if (!pattern) return;
            if (pattern.type === 'Identifier') {
                names.add(pattern.name);
            } else if (pattern.type === 'ObjectPattern') {
                for (const prop of pattern.properties) {
                    if (prop.type === 'Property') {
                        collectPatternNames(prop.value, names);
                    } else if (prop.type === 'RestElement') {
                        collectPatternNames(prop.argument, names);
                    }
                }
            } else if (pattern.type === 'ArrayPattern') {
                for (const element of pattern.elements) {
                    if (element) collectPatternNames(element, names);
                }
            } else if (pattern.type === 'RestElement') {
                collectPatternNames(pattern.argument, names);
            } else if (pattern.type === 'AssignmentPattern') {
                collectPatternNames(pattern.left, names);
            }
        }

        // Collect all declarations first
        collectDeclarations(ast);

        // Second pass: validate the code
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

            // Check that global identifier access is in ALLOWED_GLOBALS or is locally declared
            // Only check identifiers that are being "read" (not declarations or property names)
            if (node.type === 'Identifier') {
                const parent = node.parent;
                const name = node.name;

                // Skip if this is a declaration target
                if (parent?.type === 'VariableDeclarator' && parent.id === node) {
                    // This is the left side of a declaration, skip
                }
                // Skip if this is a property key in an object
                else if (parent?.type === 'Property' && parent.key === node && !parent.computed) {
                    // This is a property key, skip
                }
                // Skip if this is a member expression property (not computed)
                else if (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) {
                    // This is like obj.foo - foo is a property, not a global
                }
                // Skip function declaration names
                else if (parent?.type === 'FunctionDeclaration' && parent.id === node) {
                    // This is a function name declaration
                }
                // Skip function parameter definitions
                else if ((parent?.type === 'FunctionDeclaration' || parent?.type === 'FunctionExpression' || parent?.type === 'ArrowFunctionExpression') && parent.params?.includes(node)) {
                    // This is a parameter definition
                }
                // Skip catch clause parameter
                else if (parent?.type === 'CatchClause' && parent.param === node) {
                    // This is a catch parameter
                }
                // Otherwise, this is an identifier access - validate it
                else if (!declaredVariables.has(name) && !ALLOWED_GLOBALS.has(name)) {
                    errors.push(`Access to unauthorized global: '${name}'. Only allowed globals: ${Array.from(ALLOWED_GLOBALS).join(', ')}`);
                }
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
