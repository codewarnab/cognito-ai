/**
 * Test script to check if an MCP server supports OAuth discovery
 * Tests RFC 9728 (Protected Resource Metadata) and RFC 8414 (Authorization Server Metadata)
 */

const DISCOVERY_TIMEOUT = 10000;

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Try to discover Protected Resource Metadata
 */
async function discoverProtectedResourceMetadata(mcpUrl) {
    const url = new URL(mcpUrl);

    console.log(`\n📋 Testing Protected Resource Metadata for: ${mcpUrl}`);
    console.log('─'.repeat(80));

    // Method 1: Try GET request for WWW-Authenticate header
    console.log('\n1️⃣  Method 1: Checking WWW-Authenticate header...');
    try {
        const response = await fetchWithTimeout(mcpUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        console.log(`   Status: ${response.status}`);

        if (response.status === 401) {
            const wwwAuth = response.headers.get('WWW-Authenticate');
            if (wwwAuth) {
                console.log(`   ✅ Found WWW-Authenticate header: ${wwwAuth}`);

                // Parse for resource_metadata URL
                const match = wwwAuth.match(/resource_metadata="([^"]+)"/);
                if (match) {
                    console.log(`   ✅ Found resource_metadata URL: ${match[1]}`);
                    return { method: 'WWW-Authenticate', url: match[1] };
                }
            } else {
                console.log(`   ❌ No WWW-Authenticate header found`);
            }
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    // Method 2: Try /.well-known/oauth-protected-resource/{path}
    if (url.pathname && url.pathname !== '/') {
        const wellKnownUrl = `${url.origin}/.well-known/oauth-protected-resource${url.pathname}`;
        console.log(`\n2️⃣  Method 2: Trying ${wellKnownUrl}`);
        try {
            const response = await fetchWithTimeout(wellKnownUrl, {
                headers: { 'Accept': 'application/json' }
            });

            console.log(`   Status: ${response.status}`);

            if (response.ok) {
                const metadata = await response.json();
                console.log(`   ✅ Found Protected Resource Metadata!`);
                console.log(`   Authorization servers: ${JSON.stringify(metadata.authorization_servers, null, 2)}`);
                return { method: 'well-known-with-path', metadata };
            } else if (response.status !== 404) {
                console.log(`   ⚠️  Non-404 error: ${response.statusText}`);
            } else {
                console.log(`   ❌ Not found (404)`);
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }

    // Method 3: Try /.well-known/oauth-protected-resource (root)
    const rootWellKnownUrl = `${url.origin}/.well-known/oauth-protected-resource`;
    console.log(`\n3️⃣  Method 3: Trying ${rootWellKnownUrl}`);
    try {
        const response = await fetchWithTimeout(rootWellKnownUrl, {
            headers: { 'Accept': 'application/json' }
        });

        console.log(`   Status: ${response.status}`);

        if (response.ok) {
            const metadata = await response.json();
            console.log(`   ✅ Found Protected Resource Metadata!`);
            console.log(`   Authorization servers: ${JSON.stringify(metadata.authorization_servers, null, 2)}`);
            return { method: 'well-known-root', metadata };
        } else if (response.status !== 404) {
            console.log(`   ⚠️  Non-404 error: ${response.statusText}`);
        } else {
            console.log(`   ❌ Not found (404)`);
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    console.log(`\n❌ Protected Resource Metadata not found\n`);
    return null;
}

/**
 * Try to discover Authorization Server Metadata
 */
async function discoverAuthorizationServerMetadata(issuerUrl) {
    console.log(`\n🔐 Testing Authorization Server Metadata for: ${issuerUrl}`);
    console.log('─'.repeat(80));

    const url = new URL(issuerUrl);
    const hasPath = url.pathname && url.pathname !== '/';

    const endpoints = [];

    if (hasPath) {
        const pathComponent = url.pathname;
        endpoints.push(
            { name: 'OAuth 2.0 with path insertion', url: `${url.origin}/.well-known/oauth-authorization-server${pathComponent}` },
            { name: 'OIDC with path insertion', url: `${url.origin}/.well-known/openid-configuration${pathComponent}` },
            { name: 'OIDC path appending', url: `${issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration` }
        );
    } else {
        endpoints.push(
            { name: 'OAuth 2.0', url: `${url.origin}/.well-known/oauth-authorization-server` },
            { name: 'OIDC', url: `${url.origin}/.well-known/openid-configuration` }
        );
    }

    let count = 1;
    for (const endpoint of endpoints) {
        console.log(`\n${count}️⃣  Method ${count}: ${endpoint.name}`);
        console.log(`   URL: ${endpoint.url}`);

        try {
            const response = await fetchWithTimeout(endpoint.url, {
                headers: { 'Accept': 'application/json' }
            });

            console.log(`   Status: ${response.status}`);

            if (response.ok) {
                const metadata = await response.json();
                console.log(`   ✅ Found Authorization Server Metadata!`);
                console.log(`   Issuer: ${metadata.issuer}`);
                console.log(`   Authorization endpoint: ${metadata.authorization_endpoint}`);
                console.log(`   Token endpoint: ${metadata.token_endpoint}`);
                console.log(`   Registration endpoint: ${metadata.registration_endpoint || 'Not provided'}`);
                console.log(`   PKCE methods: ${metadata.code_challenge_methods_supported?.join(', ') || 'None'}`);
                console.log(`   Scopes: ${metadata.scopes_supported?.join(', ') || 'Not specified'}`);

                // Check PKCE support (required by MCP)
                if (!metadata.code_challenge_methods_supported || metadata.code_challenge_methods_supported.length === 0) {
                    console.log(`   ⚠️  WARNING: No PKCE support (required by MCP spec)`);
                }

                return { method: endpoint.name, metadata };
            } else if (response.status !== 404) {
                console.log(`   ⚠️  Non-404 error: ${response.statusText}`);
            } else {
                console.log(`   ❌ Not found (404)`);
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }

        count++;
    }

    console.log(`\n❌ Authorization Server Metadata not found\n`);
    return null;
}

/**
 * Main test function
 */
async function testMCPDiscovery(mcpUrl) {
    console.log('\n🚀 MCP OAuth Discovery Test');
    console.log('═'.repeat(80));
    console.log(`Testing MCP Server: ${mcpUrl}`);
    console.log('═'.repeat(80));

    const results = {
        protectedResource: null,
        authorizationServer: null,
        supportsDCR: false
    };

    // Test Protected Resource Metadata
    const protectedResource = await discoverProtectedResourceMetadata(mcpUrl);
    results.protectedResource = protectedResource;

    // Test Authorization Server Metadata (try origin)
    const mcpOrigin = new URL(mcpUrl).origin;
    const authServer = await discoverAuthorizationServerMetadata(mcpOrigin);
    results.authorizationServer = authServer;

    // If we found auth servers in protected resource metadata, try those too
    if (protectedResource?.metadata?.authorization_servers) {
        console.log(`\n🔍 Found ${protectedResource.metadata.authorization_servers.length} authorization server(s) in Protected Resource Metadata`);
        console.log('Testing each authorization server...\n');

        for (const authServerUrl of protectedResource.metadata.authorization_servers) {
            const authServerResult = await discoverAuthorizationServerMetadata(authServerUrl);
            if (authServerResult) {
                results.authorizationServer = authServerResult;
                break;
            }
        }
    }

    // Final summary
    console.log('\n' + '═'.repeat(80));
    console.log('📊 DISCOVERY RESULTS SUMMARY');
    console.log('═'.repeat(80));

    console.log('\n📋 Protected Resource Metadata:');
    if (results.protectedResource) {
        console.log(`   ✅ FOUND via ${results.protectedResource.method}`);
        if (results.protectedResource.metadata) {
            console.log(`   Authorization servers: ${results.protectedResource.metadata.authorization_servers?.join(', ') || 'None'}`);
            console.log(`   Scopes supported: ${results.protectedResource.metadata.scopes_supported?.join(', ') || 'Not specified'}`);
        }
    } else {
        console.log(`   ❌ NOT FOUND`);
    }

    console.log('\n🔐 Authorization Server Metadata:');
    if (results.authorizationServer) {
        console.log(`   ✅ FOUND via ${results.authorizationServer.method}`);
        const meta = results.authorizationServer.metadata;
        console.log(`   Issuer: ${meta.issuer}`);
        console.log(`   Authorization endpoint: ${meta.authorization_endpoint}`);
        console.log(`   Token endpoint: ${meta.token_endpoint}`);
        console.log(`   Registration endpoint: ${meta.registration_endpoint || '❌ Not provided'}`);

        results.supportsDCR = !!meta.registration_endpoint;
    } else {
        console.log(`   ❌ NOT FOUND`);
    }

    console.log('\n🎯 Dynamic Client Registration (DCR):');
    if (results.supportsDCR) {
        console.log(`   ✅ SUPPORTED - Server provides registration_endpoint`);
        console.log(`   This server supports automatic OAuth client registration!`);
    } else {
        console.log(`   ❌ NOT SUPPORTED - No registration_endpoint found`);
        console.log(`   You'll need to manually register OAuth clients with this server.`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('Test completed!\n');

    return results;
}

// Run the test
const mcpUrl = process.argv[2] || 'https://api.stackone.com/mcp';
testMCPDiscovery(mcpUrl).catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
