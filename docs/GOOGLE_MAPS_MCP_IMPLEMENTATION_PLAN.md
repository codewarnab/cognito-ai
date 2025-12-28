# Implementation Plan - Google Maps Platform Code Assist MCP

Add [Google Maps MCP](https://developers.google.com/maps/ai/mcp) - a StdIO server providing Google Maps Platform documentation and code samples.

## Overview

**Key Finding:** This MCP server **does NOT require authentication**. It's a free documentation/RAG server.

| Attribute | Value |
|-----------|-------|
| **Command** | `npx -y @googlemaps/code-assist-mcp@latest` |
| **Transport** | StdIO (recommended) or Streamable HTTP |
| **Authentication** | None required |
| **Tools** | `retrieve-instructions`, `retrieve-google-maps-platform-docs` |

## Tools Provided

1. **retrieve-instructions**: Helper tool for getting system instructions
2. **retrieve-google-maps-platform-docs**: Primary RAG tool for documentation queries

---

## File Changes

### Phase 1: Shared Package

#### [MODIFY] [mcpRegistry.ts](file:///c:/Users/User/code/hackathons/chrome-ai/packages/shared/src/constants/mcpRegistry.ts)

```typescript
'google-maps': {
    id: 'google-maps',
    command: 'npx',
    args: ['-y', '@googlemaps/code-assist-mcp@latest'],
    // No envKeyName - no authentication required
    enabled: true,
},
```

### Phase 2: Extension Frontend

#### [NEW] [GoogleMaps.tsx](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/assets/brands/integrations/GoogleMaps.tsx)

```typescript
import type { SVGProps } from "react";

const GoogleMaps = (props: SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 92.3 132.3">
    <path
      fill="#1a73e8"
      d="M60.2 2.2C55.8.8 51 0 46.1 0 32 0 19.3 6.4 10.8 16.5l21.8 18.3L60.2 2.2z"
    />
    <path
      fill="#ea4335"
      d="M10.8 16.5C4.1 24.5 0 34.9 0 46.1c0 8.7 1.7 15.7 4.6 22l28-33.3-21.8-18.3z"
    />
    <path
      fill="#4285f4"
      d="M46.2 28.5c9.8 0 17.7 7.9 17.7 17.7 0 4.3-1.6 8.3-4.2 11.4 0 0 13.9-16.6 27.5-32.7-5.6-10.8-15.3-19-27-22.7L32.6 34.8c3.3-3.8 8.1-6.3 13.6-6.3"
    />
    <path
      fill="#fbbc04"
      d="M46.2 63.8c-9.8 0-17.7-7.9-17.7-17.7 0-4.3 1.5-8.3 4.1-11.3l-28 33.3c4.8 10.6 12.8 19.2 21 29.9l34.1-40.5c-3.3 3.9-8.1 6.3-13.5 6.3"
    />
    <path
      fill="#34a853"
      d="M59.1 109.2c15.4-24.1 33.3-35 33.3-63 0-7.7-1.9-14.9-5.2-21.3L25.6 98c2.6 3.4 5.3 7.3 7.9 11.3 9.4 14.5 6.8 23.1 12.8 23.1s3.4-8.7 12.8-23.2"
    />
  </svg>
);

export { GoogleMaps };
```

#### [MODIFY] [mcpServers.tsx](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/constants/mcpServers.tsx)

```typescript
{
    id: "google-maps",
    name: "Google Maps Platform",
    icon: <img src={googleMapsImage} alt="Google Maps" style={{ width: 24, height: 24 }} />,
    initialEnabled: false,
    initialAuthenticated: true,  // No auth needed
    url: "stdio://google-maps",
    description: "Access Google Maps Platform documentation, tutorials, and code samples through RAG.",
    requiresAuthentication: false,  // No auth needed!
    isBackendOnly: true,
},
```

---

## Summary

| File | Change |
|------|--------|
| `packages/shared/src/constants/mcpRegistry.ts` | Add `google-maps` entry (no auth) |
| `apps/extension/assets/brands/integrations/` | Add Google Maps icon |
| `apps/extension/src/constants/mcpServers.tsx` | Add server entry with `requiresAuthentication: false` |

---

## Implementation Complexity: **Low**

This is a simple addition - no authentication handling needed. Just add the registry entry, icon, and frontend config.
