# Gemini Live Client - Singleton Architecture

## Overview

The Gemini Live integration uses a **Singleton Manager Pattern** to prevent multiple concurrent instances of the voice model, ensuring efficient resource usage and preventing conflicts.

## Problem Statement

Without proper instance management, multiple `GeminiLiveClient` instances could be created simultaneously, leading to:

- **Resource Wastage**: Multiple WebSocket connections consuming API quota
- **Audio Conflicts**: Multiple microphone streams interfering with each other
- **State Confusion**: Unclear which instance is "active"
- **Memory Leaks**: Improperly cleaned up instances holding resources
- **API Rate Limiting**: Excessive concurrent connections hitting quota limits

## Architecture Pattern: Singleton Manager

### Components

#### 1. **GeminiLiveManager** (Singleton)
Location: `src/ai/geminiLive/GeminiLiveManager.ts`

**Responsibilities:**
- Ensures only ONE active `GeminiLiveClient` instance exists at a time
- Manages client lifecycle (creation, initialization, cleanup)
- Provides centralized access to the active client
- Handles concurrent initialization requests
- Prevents race conditions during cleanup

**Key Features:**
```typescript
class GeminiLiveManager {
  private static instance: GeminiLiveManager | null = null;
  private activeClient: GeminiLiveClient | null = null;
  private state: 'idle' | 'initializing' | 'active' | 'cleaning';
  
  // Singleton access
  public static getInstance(): GeminiLiveManager
  
  // Get or create client (cleans up existing if necessary)
  public async getClient(config): Promise<GeminiLiveClient>
  
  // Get active client without creating new one
  public getActiveClient(): GeminiLiveClient | null
  
  // Safe cleanup (idempotent)
  public async cleanup(): Promise<void>
  
  // Diagnostics
  public getDiagnostics()
}
```

#### 2. **GeminiLiveClient** (Instance)
Location: `src/ai/geminiLive/GeminiLiveClient.ts`

**Enhanced with:**
- **Instance Tracking**: Static counter for all instances
- **Instance ID**: Unique identifier for each instance
- **Cleanup Protection**: Prevents reuse of cleaned-up instances
- **Concurrent Session Prevention**: Guards against multiple session starts
- **Diagnostics**: Detailed instance state information

**New Properties:**
```typescript
class GeminiLiveClient {
  private static instanceCount = 0;      // Total instances created
  private instanceId: number;            // Unique ID
  private isCleanedUp = false;           // Cleanup state
  private sessionStartPromise: Promise<void> | null; // Prevent concurrent starts
}
```

## Usage Patterns

### ✅ CORRECT: Using GeminiLiveManager

```typescript
import { getGeminiLiveManager } from '../../ai/geminiLive/GeminiLiveManager';

// In React component
const manager = getGeminiLiveManager();

// Get client (will cleanup existing if needed)
const client = await manager.getClient({
  apiKey,
  systemInstruction,
  eventHandlers,
  errorRecoveryConfig
});

// Cleanup when done
await manager.cleanup();
```

### ❌ INCORRECT: Direct instantiation

```typescript
// DON'T DO THIS - Creates unmanaged instances
const client1 = new GeminiLiveClient(config1);
const client2 = new GeminiLiveClient(config2); // ⚠️ Multiple instances!
```

## State Management Flow

### Initialization Flow

```
1. Component calls manager.getClient(config)
   ↓
2. Manager checks for existing client
   ↓
3. If exists → cleanup old client
   ↓
4. Create new GeminiLiveClient
   ↓
5. Initialize client (WebSocket, audio)
   ↓
6. Store as activeClient
   ↓
7. Return client to component
```

### Cleanup Flow

```
1. Component calls manager.cleanup()
   ↓
2. Manager sets state to 'cleaning'
   ↓
3. Stop active session (if running)
   ↓
4. Call client.cleanup() (audio, WebSocket)
   ↓
5. Set activeClient = null
   ↓
6. Set state to 'idle'
   ↓
7. Ready for new client
```

## Safeguards & Protection

### 1. **Concurrent Initialization Prevention**

```typescript
// If initialization is in progress, wait for it
if (this.initializationPromise) {
  log.info('Initialization already in progress, waiting...');
  return this.initializationPromise;
}
```

### 2. **Concurrent Cleanup Prevention**

```typescript
// If cleanup is in progress, wait for it
if (this.cleanupPromise) {
  log.info('Cleanup already in progress, waiting...');
  return this.cleanupPromise;
}
```

### 3. **Reuse Prevention**

```typescript
// In GeminiLiveClient
if (this.isCleanedUp) {
  throw new Error('Client has been cleaned up and cannot be reused');
}
```

### 4. **Instance Tracking**

```typescript
// Static counter warns about multiple instances
if (GeminiLiveClient.instanceCount > 1) {
  log.warn(`Multiple instances detected! Count: ${instanceCount}`);
  log.warn('Consider using GeminiLiveManager');
}
```

### 5. **Session Start Protection**

```typescript
// Prevent multiple concurrent session starts
if (this.sessionStartPromise) {
  log.info('Session start already in progress, waiting...');
  return this.sessionStartPromise;
}
```

## React Component Integration

### VoiceModeUI Pattern

```typescript
export const VoiceModeUI: React.FC<Props> = ({ apiKey, systemInstruction }) => {
  const liveClientRef = useRef<GeminiLiveClient | null>(null);

  // Initialize with manager
  useEffect(() => {
    const initializeClient = async () => {
      const manager = getGeminiLiveManager();
      
      // Get diagnostics
      const diagnostics = manager.getDiagnostics();
      log.info('Manager state:', diagnostics);
      
      // Get client (ensures singleton)
      const client = await manager.getClient({
        apiKey,
        systemInstruction,
        eventHandlers,
        errorRecoveryConfig
      });
      
      liveClientRef.current = client;
    };
    
    initializeClient();
    
    // Cleanup on unmount
    return () => {
      const manager = getGeminiLiveManager();
      manager.cleanup().catch(err => 
        log.error('Cleanup error:', err)
      );
      liveClientRef.current = null;
    };
  }, [apiKey, systemInstruction]);
  
  // Reset handler
  const handleReset = async () => {
    const manager = getGeminiLiveManager();
    await manager.cleanup();
    
    const newClient = await manager.getClient(config);
    liveClientRef.current = newClient;
  };
};
```

## Diagnostics & Debugging

### Manager Diagnostics

```typescript
const manager = getGeminiLiveManager();
const diagnostics = manager.getDiagnostics();

console.log({
  state: diagnostics.state,              // idle | initializing | active | cleaning
  hasActiveClient: diagnostics.hasActiveClient,
  isInitializing: diagnostics.isInitializing,
  isCleaningUp: diagnostics.isCleaningUp,
  instanceId: diagnostics.instanceId,
  clientStatus: diagnostics.clientStatus
});
```

### Client Diagnostics

```typescript
const client = manager.getActiveClient();
if (client) {
  const diagnostics = client.getDiagnostics();
  
  console.log({
    instanceId: diagnostics.instanceId,
    isInitialized: diagnostics.isInitialized,
    isSessionActive: diagnostics.isSessionActive,
    isCleanedUp: diagnostics.isCleanedUp,
    currentStatus: diagnostics.currentStatus,
    totalInstances: diagnostics.totalInstances
  });
}
```

## Best Practices

### ✅ DO

1. **Always use GeminiLiveManager** for client creation
2. **Cleanup on component unmount** using manager
3. **Check diagnostics** when debugging
4. **Handle cleanup errors** gracefully
5. **Use forceReset()** only for error recovery

### ❌ DON'T

1. **Don't create multiple clients** directly
2. **Don't forget cleanup** in useEffect return
3. **Don't reuse cleaned-up clients**
4. **Don't call cleanup multiple times** without checking state
5. **Don't skip error handling** in async operations

## Error Recovery

### Force Reset (Emergency Only)

```typescript
const manager = getGeminiLiveManager();

// Only use when normal cleanup fails
try {
  await manager.cleanup();
} catch (error) {
  log.error('Normal cleanup failed, forcing reset');
  manager.forceReset();
}
```

## Benefits Summary

✅ **Resource Efficiency**: Single WebSocket connection, one microphone stream
✅ **State Clarity**: Always know which client is active
✅ **Memory Safety**: Proper cleanup prevents leaks
✅ **Concurrent Safety**: Guards against race conditions
✅ **Debuggability**: Rich diagnostics for troubleshooting
✅ **API Quota**: Prevents excessive concurrent connections
✅ **Error Recovery**: Graceful handling of edge cases

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│         VoiceModeUI Component           │
│  (React Component)                      │
└────────────────┬────────────────────────┘
                 │
                 │ getGeminiLiveManager()
                 ↓
┌─────────────────────────────────────────┐
│      GeminiLiveManager (Singleton)      │
│  ┌───────────────────────────────────┐  │
│  │ State: idle | initializing |      │  │
│  │        active | cleaning          │  │
│  │                                   │  │
│  │ activeClient: GeminiLiveClient?  │  │
│  │ initPromise: Promise?            │  │
│  │ cleanupPromise: Promise?         │  │
│  └───────────────────────────────────┘  │
└────────────────┬────────────────────────┘
                 │
                 │ manages
                 ↓
┌─────────────────────────────────────────┐
│        GeminiLiveClient Instance        │
│  ┌───────────────────────────────────┐  │
│  │ instanceId: 1                     │  │
│  │ isInitialized: true               │  │
│  │ isSessionActive: true             │  │
│  │ isCleanedUp: false                │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌─────────────┐  ┌──────────────────┐ │
│  │ AudioManager│  │ WebSocket Session│ │
│  └─────────────┘  └──────────────────┘ │
└─────────────────────────────────────────┘
```

## Conclusion

The Singleton Manager Pattern ensures that the Gemini Live integration is:
- **Robust**: Protected against common pitfalls
- **Efficient**: Optimal resource usage
- **Maintainable**: Clear lifecycle management
- **Debuggable**: Rich diagnostics and logging

Always use `getGeminiLiveManager()` instead of direct instantiation!
