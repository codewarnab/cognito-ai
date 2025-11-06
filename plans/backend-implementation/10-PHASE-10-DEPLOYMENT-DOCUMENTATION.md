# Phase 10: Deployment & Documentation

**Goal**: Deploy backend to Vercel, configure production environment, and create comprehensive documentation for users and developers.

**Duration**: 2-3 hours

**Prerequisites**: 
- All phases 1-9 completed
- Production hardening done
- All tests passing
- Backend ready for deployment

---

## 📋 Overview

Final phase to:
1. Deploy backend to Vercel
2. Configure production environment
3. Update extension with production URL
4. Test production deployment
5. Create migration guide for users
6. Update documentation
7. Create troubleshooting guide

---

## 🛠️ Step-by-Step Implementation

### Step 1: Prepare Vercel Configuration

**File**: `backend/vercel.json`

Update for production:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/main.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/health",
      "dest": "dist/main.js",
      "methods": ["GET"]
    },
    {
      "src": "/api/chat",
      "dest": "dist/main.js",
      "methods": ["POST", "OPTIONS"]
    },
    {
      "src": "/(.*)",
      "dest": "dist/main.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "regions": ["iad1"],
  "build": {
    "env": {
      "NODE_ENV": "production"
    }
  }
}
```

---

### Step 2: Update Backend Package.json

**File**: `backend/package.json`

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "vercel-build": "nest build",
    "deploy": "vercel --prod"
  }
}
```

---

### Step 3: Create Vercel Project

```bash
cd backend

# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Initialize project (follow prompts)
vercel

# Set environment variables
vercel env add GEMINI_API_KEY
# Paste your API key when prompted

# Deploy to production
vercel --prod
```

Take note of the production URL: `https://your-project.vercel.app`

---

### Step 4: Create Environment Configuration

**Create file**: `src/config/environment.ts`

```typescript
export const ENVIRONMENT = {
  development: {
    backendUrl: 'http://localhost:3000',
  },
  production: {
    backendUrl: 'https://your-project.vercel.app', // Replace with actual URL
  },
};

export function getBackendUrl(): string {
  const isDev = process.env.NODE_ENV === 'development' || 
                chrome.runtime.getManifest().update_url === undefined;
  
  return isDev 
    ? ENVIRONMENT.development.backendUrl 
    : ENVIRONMENT.production.backendUrl;
}
```

---

### Step 5: Update Extension to Use Production Backend

**File**: `src/ai/core/aiLogic.ts`

```typescript
import { getBackendUrl } from '../../config/environment';

async function handleBackendMode(
  messages: UIMessage[],
  options: any,
  depth: number = 0,
  workflowId?: string
) {
  // ... existing code ...
  
  const backendUrl = getBackendUrl();
  log.info(`🔄 Backend mode: ${backendUrl}`);
  
  const transport = new DefaultChatTransport({
    api: `${backendUrl}/api/chat`,
    headers: {
      'X-Extension-ID': chrome.runtime.id,
      'X-Extension-Version': chrome.runtime.getManifest().version,
    },
  });
  
  // ... rest of implementation ...
}
```

---

### Step 6: Add Backend Status Check

**Create file**: `src/utils/backendStatus.ts`

```typescript
import { createLogger } from '../logger';
import { getBackendUrl } from '../config/environment';

const log = createLogger('BackendStatus');

export async function checkBackendHealth(): Promise<{
  available: boolean;
  latency?: number;
  status?: string;
  error?: string;
}> {
  const backendUrl = getBackendUrl();
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const latency = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        available: false,
        latency,
        error: `HTTP ${response.status}`,
      };
    }
    
    const data = await response.json();
    
    return {
      available: true,
      latency,
      status: data.status,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    log.error('Backend health check failed:', error);
    
    return {
      available: false,
      latency,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

---

### Step 7: Add Backend Status Indicator to UI

**Create file**: `src/components/shared/backend-status/BackendStatusIndicator.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { checkBackendHealth } from '../../../utils/backendStatus';
import './BackendStatusIndicator.css';

export const BackendStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<{
    available: boolean;
    latency?: number;
    status?: string;
    error?: string;
  } | null>(null);
  
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    checkStatus();
    
    // Check every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    setChecking(true);
    const result = await checkBackendHealth();
    setStatus(result);
    setChecking(false);
  };

  if (!status) {
    return null;
  }

  return (
    <div className={`backend-status ${status.available ? 'online' : 'offline'}`}>
      <div className="backend-status-indicator">
        {status.available ? '🟢' : '🔴'}
      </div>
      
      <div className="backend-status-details">
        <div className="backend-status-text">
          {status.available ? 'Backend Online' : 'Backend Offline'}
        </div>
        
        {status.latency && (
          <div className="backend-status-latency">
            {status.latency}ms
          </div>
        )}
        
        {status.error && (
          <div className="backend-status-error">
            {status.error}
          </div>
        )}
      </div>
    </div>
  );
};
```

---

### Step 8: Create Deployment Documentation

**Create file**: `BACKEND_DEPLOYMENT.md`

```markdown
# Backend Deployment Guide

## Prerequisites

- Vercel account (free tier works)
- Google AI Studio API key
- Node.js 20+

## Step 1: Clone Repository

\`\`\`bash
git clone https://github.com/your-username/chrome-ai.git
cd chrome-ai/backend
\`\`\`

## Step 2: Install Dependencies

\`\`\`bash
pnpm install
\`\`\`

## Step 3: Configure Environment

Create `.env` file:

\`\`\`bash
GEMINI_API_KEY=your_api_key_here
NODE_ENV=production
\`\`\`

## Step 4: Test Locally

\`\`\`bash
pnpm run build
pnpm run start:prod
\`\`\`

Visit: http://localhost:3000/health

## Step 5: Deploy to Vercel

\`\`\`bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
\`\`\`

## Step 6: Set Environment Variables

In Vercel dashboard or CLI:

\`\`\`bash
vercel env add GEMINI_API_KEY
\`\`\`

Paste your API key when prompted.

## Step 7: Update Extension

Update `src/config/environment.ts` with your production URL:

\`\`\`typescript
production: {
  backendUrl: 'https://your-project.vercel.app',
},
\`\`\`

## Step 8: Test Production

1. Build extension
2. Load in Chrome
3. Select "Backend" mode
4. Send test message
5. Verify response

## Troubleshooting

### Backend Not Responding

- Check Vercel logs: `vercel logs`
- Verify environment variables are set
- Check health endpoint: `https://your-project.vercel.app/health`

### CORS Errors

- Verify CORS is enabled in `main.ts`
- Check extension ID is correct

### Tool Execution Fails

- Check extension console for errors
- Verify tool schemas are sent correctly
- Check backend logs for tool execution errors

## Monitoring

- Vercel Dashboard: https://vercel.com/dashboard
- Health Endpoint: `https://your-project.vercel.app/health`
- Detailed Health: `https://your-project.vercel.app/health/detailed`

## Costs

Vercel free tier includes:
- 100GB bandwidth/month
- Unlimited requests
- Automatic SSL

Gemini API costs:
- Flash: ~$0.00001-0.00003 per 1K tokens
- Pro: ~$0.00005-0.00015 per 1K tokens
\`\`\`

---

### Step 9: Create Migration Guide

**Create file**: `MIGRATION_GUIDE.md`

```markdown
# Migration Guide: BYOK to Backend Mode

This guide helps existing users migrate from BYOK mode to the new Backend mode.

## What's New?

**Backend Mode** (Recommended):
- No API key setup required
- Server-side AI processing
- Managed API keys
- Better performance
- Cost-effective

**BYOK Mode** (Still Available):
- Bring Your Own Key
- Full control over API usage
- Use your own quota
- Works exactly as before

## Migration Steps

### Option 1: Automatic (Recommended)

1. Update extension to latest version
2. Extension automatically switches to Backend mode
3. Start chatting - no setup needed!

### Option 2: Manual

1. Open extension
2. Click menu (three dots)
3. Select "Backend Mode"
4. Done!

## What Happens to Your Data?

- **Chat History**: Preserved locally
- **API Key**: Kept securely (for BYOK mode)
- **Settings**: Maintained
- **Workflows**: Work with both modes

## Switching Between Modes

You can switch anytime:

1. Click menu
2. Choose:
   - "Backend Mode" (server-side, no setup)
   - "BYOK Setup" (your own API key)

## Troubleshooting

### Backend Mode Not Working

1. Check internet connection
2. Verify backend status (green indicator)
3. Try refreshing extension
4. Check browser console for errors

### Want to Use Your Own API Key?

Switch to BYOK mode:
1. Menu → "BYOK Setup"
2. Enter your Google AI Studio API key
3. Save

## FAQ

**Q: Is Backend mode free?**
A: Yes, within reasonable usage limits.

**Q: Can I still use my API key?**
A: Yes! Switch to BYOK mode anytime.

**Q: Which mode should I use?**
A: Backend mode for most users. BYOK for advanced users who want full control.

**Q: Is my data sent to a server?**
A: Only messages and tool calls. No chat history is stored on the server.

**Q: What if backend is down?**
A: Extension automatically falls back to BYOK mode if configured.

## Need Help?

- [GitHub Issues](https://github.com/your-username/chrome-ai/issues)
- [Documentation](https://github.com/your-username/chrome-ai)
\`\`\`

---

### Step 10: Update README

**File**: `README.md`

Add backend mode section:

```markdown
# Chrome AI Extension

## 🆕 Backend Mode

The extension now supports two modes:

### Backend Mode (Default) 🚀
- No API key setup required
- Server-side AI processing
- Cost-effective and fast
- Managed by us

### BYOK Mode 🔑
- Bring Your Own Key
- Use your Google AI Studio API key
- Full control over usage and costs
- Works exactly as before

## Quick Start

### Using Backend Mode (Recommended)

1. Install extension
2. Click extension icon
3. Start chatting - that's it!

### Using BYOK Mode

1. Install extension
2. Menu → "BYOK Setup"
3. Enter your Google AI Studio API key
4. Start chatting

## Features

- 🤖 AI-powered chat assistant
- 🛠️ Browser automation tools
- 🔍 Web search and research
- 💻 Code assistance
- 📊 Data analysis
- 🔄 Workflow templates
- 🌐 MCP integration

## Architecture

\`\`\`
Extension ↔ Backend (Vercel) ↔ Gemini API
     ↓
  Browser Tools (Extension-side)
     ↓
  Local Execution
\`\`\`

## Documentation

- [Backend Deployment](./BACKEND_DEPLOYMENT.md)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Contributing](./CONTRIBUTING.md)

## Development

### Extension

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

### Backend

\`\`\`bash
cd backend
pnpm install
pnpm run start:dev
\`\`\`

## Deployment

See [BACKEND_DEPLOYMENT.md](./BACKEND_DEPLOYMENT.md)

## License

MIT
\`\`\`

---

### Step 11: Create Troubleshooting Guide

**Create file**: `TROUBLESHOOTING.md`

```markdown
# Troubleshooting Guide

## Backend Mode Issues

### Backend Not Responding

**Symptoms:**
- "Backend offline" indicator
- Requests timing out
- No response from AI

**Solutions:**
1. Check internet connection
2. Visit backend health: `https://your-backend.vercel.app/health`
3. Try switching to BYOK mode temporarily
4. Check browser console for errors
5. Restart extension

### Slow Responses

**Solutions:**
1. Check backend status indicator (shows latency)
2. Try selecting "Flash" model (faster)
3. Reduce tool usage
4. Check network speed

### Tool Execution Fails

**Symptoms:**
- Tools not working
- "Tool not found" errors

**Solutions:**
1. Refresh extension
2. Check browser permissions
3. Try simpler tools first
4. Check console for specific errors

## BYOK Mode Issues

### Invalid API Key

**Symptoms:**
- "Invalid API key" error
- Requests failing immediately

**Solutions:**
1. Get new key: https://aistudio.google.com/apikey
2. Menu → "BYOK Setup"
3. Enter new key
4. Save and try again

### Rate Limit Exceeded

**Solutions:**
1. Wait for quota reset
2. Upgrade API quota
3. Switch to Backend mode

## General Issues

### Extension Not Loading

1. Check Chrome version (requires latest)
2. Disable conflicting extensions
3. Clear browser cache
4. Reinstall extension

### Tool Permissions

If tools not working:
1. Open Chrome settings
2. Extensions → Chrome AI
3. Grant necessary permissions
4. Reload extension

### Memory Issues

If extension becomes slow:
1. Close unused tabs
2. Restart browser
3. Clear extension storage
4. Reduce active workflows

## Error Messages

### "Backend unavailable"
Backend is down or unreachable. Try BYOK mode.

### "Tool execution failed"
Tool encountered error. Check permissions and try again.

### "Rate limit exceeded"
Too many requests. Wait or upgrade quota.

### "Invalid workflow"
Workflow not found. Reset to "General" workflow.

## Getting Help

1. Check [Issues](https://github.com/your-username/chrome-ai/issues)
2. Search existing issues
3. Create new issue with:
   - Browser version
   - Extension version
   - Error messages
   - Steps to reproduce

## Debug Mode

Enable debug logs:
1. Open extension console (F12)
2. Check for detailed logs
3. Include logs when reporting issues
\`\`\`

---

## ✅ Testing Phase 10

### Test 1: Production Deployment

1. Deploy backend to Vercel
2. Update extension with production URL
3. Build and load extension
4. Send test message
5. Verify:
   - Backend responds
   - Tools work
   - Streaming works
   - No errors

---

### Test 2: Health Monitoring

1. Visit `https://your-backend.vercel.app/health`
2. Verify healthy status
3. Check backend status indicator in extension
4. Verify latency is reasonable (<500ms)

---

### Test 3: Production Load Test

1. Send multiple concurrent requests
2. Verify all complete successfully
3. Check Vercel logs for errors
4. Monitor performance metrics

---

### Test 4: Error Scenarios

1. Disconnect internet
2. Verify graceful error handling
3. Reconnect
4. Verify automatic recovery

---

### Test 5: Documentation

1. Follow deployment guide
2. Verify all steps work
3. Test migration guide
4. Verify troubleshooting solutions

---

## 🎯 Phase 10 Completion Checklist

- [ ] Backend deployed to Vercel
- [ ] Production URL configured
- [ ] Extension updated with production backend
- [ ] Health checks working in production
- [ ] Backend status indicator in UI
- [ ] Deployment documentation created
- [ ] Migration guide written
- [ ] Troubleshooting guide created
- [ ] README updated
- [ ] All production tests passing
- [ ] Monitoring setup
- [ ] Documentation reviewed

---

## 🎉 Project Complete!

Congratulations! You've successfully implemented a production-ready NestJS backend for your Chrome extension.

### What You've Built

✅ **Phase 1**: Backend foundation with NestJS
✅ **Phase 2**: Backend/BYOK mode infrastructure
✅ **Phase 3**: Basic backend API with streaming
✅ **Phase 4**: Tool schema synchronization
✅ **Phase 5**: Hybrid tool execution flow
✅ **Phase 6**: Model selection (Flash/Pro)
✅ **Phase 7**: MCP integration
✅ **Phase 8**: Workflow support
✅ **Phase 9**: Production hardening
✅ **Phase 10**: Deployment & documentation

### Success Metrics

- [ ] Backend mode is default and works seamlessly
- [ ] BYOK mode still works exactly as before
- [ ] All tools execute correctly
- [ ] Multi-step tool calling works
- [ ] MCP integration functional
- [ ] Workflows work with backend
- [ ] No breaking changes for users
- [ ] Production deployment successful
- [ ] Response times acceptable
- [ ] Error handling graceful
- [ ] Documentation complete

### Next Steps

1. Monitor production usage
2. Gather user feedback
3. Optimize based on metrics
4. Add new features
5. Improve documentation

### Resources

- Backend: `https://your-backend.vercel.app`
- Health: `https://your-backend.vercel.app/health`
- Docs: Your GitHub repository

Thank you for building with AI SDK! 🚀
