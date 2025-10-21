# Gemini Live Integration Plan for Chrome AI Extension

## Executive Summary

This document outlines the comprehensive plan to integrate Gemini Live API (real-time voice conversation with tool calling) into the Chrome AI extension. The integration will add a "Voice Mode" that uses continuous audio streaming with the visual orb interface, while maintaining the existing text chat mode.

---

## 1. Deep Analysis

### 1.1 Gemini Live API Architecture

**Key Characteristics:**
- **Protocol**: WebSocket-based bidirectional streaming (`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`)
- **SDK**: `@google/generative-ai` (NOT `@ai-sdk/google`)
- **Model**: `gemini-2.5-flash-native-audio-preview-09-2025` (native audio) or `gemini-live-2.5-flash-preview` (half-cascade)
- **Audio Format**: 
  - Input: 16-bit PCM, 16kHz, mono
  - Output: 16-bit PCM, 24kHz, mono
- **Session**: Stateful, persistent WebSocket connection
- **No Message History**: Continuous conversation context maintained in session
- **Voice Activity Detection**: Built-in interruption handling
- **Tool Calling**: Google's `FunctionDeclaration` format (different from AI SDK v5)

**Lifecycle:**
```
Initialize Client → Connect Session → Stream Audio ↔ Receive Audio + Tool Calls → Handle Tools → Close Session
```

### 1.2 Audio Orb Example Analysis

**Architecture:**
```
GdmLiveAudio (Lit Component)
├── GoogleGenAI Client
├── Live Session (WebSocket)
├── Audio Contexts (16kHz input, 24kHz output)
│   ├── inputNode (GainNode)
│   └── outputNode (GainNode)
├── Audio Capture (ScriptProcessorNode)
├── Audio Playback (AudioBufferSource queue)
├── Tool Handling (changeSphereColor)
└── GdmLiveAudioVisuals3D (Three.js orb)
    ├── Analyser (input/output frequency data)
    ├── Sphere (reactive mesh with shaders)
    └── Backdrop (shader background)
```

**Key Implementation Details:**

1. **Session Management:**
   ```typescript
   session = await client.live.connect({
     model: 'gemini-2.5-flash-native-audio-preview-09-2025',
     callbacks: { onopen, onmessage, onerror, onclose },
     config: { responseModalities, speechConfig, tools, systemInstruction }
   })
   ```

2. **Audio Capture Flow:**
   ```
   Microphone → MediaStreamSource → GainNode (inputNode) → ScriptProcessorNode
   → onaudioprocess → Float32Array → Int16Array (PCM) → Base64 → session.sendRealtimeInput()
   ```

3. **Audio Playback Flow:**
   ```
   WebSocket message → Base64 audio → Uint8Array → Int16Array → Float32Array
   → AudioBuffer → AudioBufferSource → GainNode (outputNode) → speakers
   ```

4. **Tool Call Handling:**
   ```typescript
   if (message.toolCall) {
     for (const fc of message.toolCall.functionCalls) {
       // Execute tool
       const result = executeFunction(fc.name, fc.args);
       // Send response
       session.sendToolResponse({
         functionResponses: { id: fc.id, name: fc.name, response: result }
       });
     }
   }
   ```

5. **Interruption Handling:**
   ```typescript
   if (message.serverContent?.interrupted) {
     // Stop all playing audio
     sources.forEach(source => source.stop());
     nextStartTime = 0;
   }
   ```

6. **Audio Queueing:**
   - Maintains scheduled playback time (`nextStartTime`)
   - Queues audio buffers sequentially
   - Tracks active sources in a Set

### 1.3 Current Extension Architecture

**AI Backend:**
- Uses `@ai-sdk/google` with AI SDK v5
- `streamText()` API with message history
- Tool format: `{ description, inputSchema: z.ZodSchema, execute }`
- Streaming UI with `useChat` hook

**Tool System:**
- Custom registry (`registerTool()`)
- Categories: tabs, selection, interactions, history, memory, reminders
- Example tools: navigateTo, switchTabs, getActiveTab, clickElement, scrollPage, etc.
- Format: Zod schemas with async execute functions

**UI:**
- React-based with Framer Motion
- CopilotChatWindow (text chat)
- Side panel integration
- Thread management with IndexedDB
- MCP tool integration (background service worker)

**Audio (Current):**
- Browser Speech Recognition API (webkitSpeechRecognition)
- Speech-to-text → text input
- No real-time audio streaming

### 1.4 Key Integration Challenges

#### Challenge 1: Dual SDK Architecture
- **Current**: `@ai-sdk/google` for text chat
- **New**: `@google/generative-ai` for voice mode
- **Solution**: Maintain both, use conditionally based on mode

#### Challenge 2: Tool Format Conversion
- **AI SDK v5 Format**:
  ```typescript
  {
    description: string;
    inputSchema: z.ZodSchema;
    execute: (args) => Promise<any>;
  }
  ```
- **Live API Format**:
  ```typescript
  {
    name: string;
    parameters: {
      type: Type.OBJECT;
      description: string;
      properties: { [key: string]: { type, description } };
      required: string[];
    };
  }
  ```
- **Solution**: Create converter function to transform Zod schemas to Live API format

#### Challenge 3: UI Integration
- **Current**: Text-based scrollable chat
- **New**: Full-screen orb with minimal controls
- **Solution**: Toggle between two modes with separate UI

#### Challenge 4: Session Lifecycle
- **Live API**: Stateful persistent WebSocket
- **Chrome Extension**: Side panel can close/reopen
- **Solution**: Manage session lifecycle carefully, cleanup on panel close

#### Challenge 5: Audio Context Management
- **Need**: Two AudioContexts (16kHz input, 24kHz output)
- **Chrome**: May suspend contexts when inactive
- **Solution**: Resume contexts before use, proper cleanup

#### Challenge 6: Web Audio API in Extension
- **ScriptProcessorNode**: Deprecated but used in example
- **Alternative**: AudioWorklet (requires separate file)
- **Solution**: Start with ScriptProcessorNode (simpler), migrate to AudioWorklet later

---

## 2. Integration Plan

### 2.1 Architecture Overview

```
Chrome Extension Side Panel
├── Mode Toggle (Text / Voice)
├── Text Mode (Existing)
│   ├── AI SDK v5 + streamText()
│   ├── Extension Tools + MCP Tools
│   └── CopilotChatWindow UI
└── Voice Mode (NEW)
    ├── @google/generative-ai + Live API
    ├── Extension Tools ONLY (converted to Live API format)
    ├── VoiceModeUI
    │   ├── AudioOrb3D (Three.js visualization)
    │   ├── Controls (Start/Stop/Reset)
    │   └── Status Display
    └── GeminiLiveSession (WebSocket manager)
```

### 2.2 File Structure

```
src/
├── ai/
│   ├── aiLogic.ts (existing - text chat)
│   ├── geminiLive/ (NEW)
│   │   ├── GeminiLiveClient.ts (session management)
│   │   ├── audioManager.ts (capture + playback)
│   │   ├── toolConverter.ts (Zod → Live API format)
│   │   └── types.ts (Live API types)
│   └── toolRegistryUtils.ts (existing)
├── components/
│   ├── CopilotChatWindow.tsx (existing)
│   ├── voice/ (NEW)
│   │   ├── VoiceModeUI.tsx (main voice mode component)
│   │   ├── AudioOrb3D.tsx (Three.js orb)
│   │   ├── VoiceControls.tsx (start/stop/reset buttons)
│   │   ├── AudioAnalyser.ts (frequency analysis)
│   │   └── shaders/
│   │       ├── sphereShader.ts
│   │       └── backdropShader.ts
│   └── ModeToggle.tsx (NEW - switch text/voice)
├── sidepanel.tsx (update - add mode state)
└── audio/
    └── useSpeechRecognition.ts (existing - keep for text mode)
```

### 2.3 Implementation Phases

#### Phase 1: Dependencies & Core Setup
**Files**: `package.json`, type definitions

**Tasks:**
1. Add `@google/generative-ai` dependency
2. Add `three` and Three.js addons for orb visualization
3. Add TypeScript types for Live API

**Changes:**
```json
// package.json
"dependencies": {
  "@google/generative-ai": "^0.24.1",  // ALREADY INSTALLED ✓
  "three": "^0.176.0"  // NEW
}
```

#### Phase 2: Tool Converter
**Files**: `src/ai/geminiLive/toolConverter.ts`

**Purpose**: Convert extension tools from AI SDK v5 format to Gemini Live API format

**Key Function:**
```typescript
function convertToolToLiveAPIFormat(
  toolName: string,
  toolDef: ToolDefinition
): FunctionDeclaration {
  // Convert Zod schema to Live API parameters
  // Extract description, properties, required fields
  // Return FunctionDeclaration
}
```

**Challenges:**
- Zod schema introspection (limited)
- Nested object support
- Array type handling
- Optional vs required fields

#### Phase 3: Audio Manager
**Files**: `src/ai/geminiLive/audioManager.ts`

**Purpose**: Handle audio capture and playback

**Components:**
1. **AudioCapture**:
   - Create 16kHz AudioContext
   - Request microphone permission
   - Create MediaStreamSource
   - Setup ScriptProcessorNode (4096 buffer)
   - Convert Float32 → Int16 → Base64
   - Return PCM blob generator

2. **AudioPlayback**:
   - Create 24kHz AudioContext
   - Decode base64 → Uint8Array → Int16 → Float32
   - Create AudioBuffer
   - Queue AudioBufferSource nodes
   - Handle scheduling with `nextStartTime`
   - Track active sources for interruption

3. **AudioAnalyser**:
   - Create AnalyserNode for input and output
   - FFT size 32 for frequency data
   - Provide data arrays for visualization

#### Phase 4: Gemini Live Client
**Files**: `src/ai/geminiLive/GeminiLiveClient.ts`

**Purpose**: Manage Live API session lifecycle

**Class Structure:**
```typescript
class GeminiLiveClient {
  private client: GoogleGenAI;
  private session: Session | null;
  private audioManager: AudioManager;
  
  async initialize(apiKey: string): Promise<void>
  async startSession(config: LiveSessionConfig): Promise<void>
  async stopSession(): Promise<void>
  async sendAudio(pcmData: Float32Array): Promise<void>
  private handleMessage(message: LiveServerMessage): Promise<void>
  private handleToolCall(toolCall: ToolCall): Promise<void>
  private handleInterruption(): void
}
```

**Session Config:**
```typescript
{
  model: 'gemini-2.5-flash-native-audio-preview-09-2025',
  responseModalities: [Modality.AUDIO],
  speechConfig: {
    voiceConfig: { 
      prebuiltVoiceConfig: { voiceName: 'Aoede' } // Or 'Orus', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Orion'
    }
  },
  tools: [{ functionDeclarations: convertedTools }],
  systemInstruction: `You are an AI assistant integrated into a Chrome browser extension...`
}
```

**Message Handling:**
- `serverContent.modelTurn.parts[].inlineData` → Audio playback
- `serverContent.interrupted` → Stop current audio
- `toolCall.functionCalls[]` → Execute tools, send response
- `serverContent.generationComplete` → End of turn marker

#### Phase 5: Audio Orb Visualization
**Files**: `src/components/voice/AudioOrb3D.tsx`, `shaders/*.ts`

**Purpose**: Three.js visualization that reacts to audio

**Components:**
1. **Scene Setup**:
   - Camera: PerspectiveCamera (75° FOV)
   - Renderer: WebGLRenderer with post-processing
   - Scene: Dark background (#100c14)

2. **Sphere**:
   - Geometry: IcosahedronGeometry (high subdivision)
   - Material: MeshStandardMaterial with custom vertex shader
   - Deformation: Based on audio frequency data
   - Lighting: Environment map (EXR) for reflections
   - Color: Dynamic (can change via tool calls)

3. **Backdrop**:
   - Geometry: Inverted Icosahedron
   - Material: Custom shader (gradient with noise)
   - Effect: Subtle animated background

4. **Post-Processing**:
   - UnrealBloomPass (glow effect)
   - FXAA (anti-aliasing)

5. **Animation Loop**:
   - Update analysers (input/output frequency data)
   - Scale sphere based on audio amplitude
   - Rotate camera based on audio intensity
   - Update shader uniforms (time, audio data)

**Integration with Audio:**
```typescript
// Props from parent
inputNode: AudioNode;
outputNode: AudioNode;

// Create analysers
inputAnalyser = new Analyser(inputNode);  // FFT size 32
outputAnalyser = new Analyser(outputNode);

// In animation loop
inputAnalyser.update();  // Get frequency data
outputAnalyser.update();

// Apply to sphere
sphere.scale.setScalar(1 + (0.2 * outputAnalyser.data[1]) / 255);
sphereMaterial.userData.shader.uniforms.inputData.value.set(...);
sphereMaterial.userData.shader.uniforms.outputData.value.set(...);
```

#### Phase 6: Voice Mode UI
**Files**: `src/components/voice/VoiceModeUI.tsx`, `VoiceControls.tsx`

**Purpose**: Main voice mode interface

**Layout:**
```
┌──────────────────────────────────────┐
│  [< Back to Text]        [Settings]  │  ← Header
├──────────────────────────────────────┤
│                                      │
│                                      │
│           [  ORB  ]                  │  ← Full-screen orb
│                                      │
│                                      │
├──────────────────────────────────────┤
│         Status: "Listening..."       │  ← Status
├──────────────────────────────────────┤
│    [Reset]  [Start]  [Stop]          │  ← Controls
└──────────────────────────────────────┘
```

**State Management:**
```typescript
const [isRecording, setIsRecording] = useState(false);
const [status, setStatus] = useState('Ready');
const [error, setError] = useState<string | null>(null);
const [sphereColor, setSphereColor] = useState('#000010');

// Audio contexts
const inputNode = useRef<GainNode>(null);
const outputNode = useRef<GainNode>(null);

// Live client
const liveClient = useRef<GeminiLiveClient>(null);
```

**Button Actions:**
- **Start**: Request mic → initialize session → start audio capture → set recording true
- **Stop**: Stop audio capture → set recording false (keep session alive)
- **Reset**: Close session → reinitialize → clear status

#### Phase 7: Mode Toggle & Integration
**Files**: `src/sidepanel.tsx`, `src/components/ModeToggle.tsx`

**Purpose**: Allow switching between text and voice modes

**State in SidePanel:**
```typescript
type ChatMode = 'text' | 'voice';
const [mode, setMode] = useState<ChatMode>('text');

// Conditional rendering
{mode === 'text' ? (
  <CopilotChatWindow {...textChatProps} />
) : (
  <VoiceModeUI />
)}
```

**ModeToggle Component:**
```tsx
<div className="mode-toggle">
  <button 
    className={mode === 'text' ? 'active' : ''}
    onClick={() => setMode('text')}
  >
    💬 Text
  </button>
  <button 
    className={mode === 'voice' ? 'active' : ''}
    onClick={() => setMode('voice')}
  >
    🎤 Voice
  </button>
</div>
```

#### Phase 8: Tool Integration
**Files**: `src/ai/geminiLive/toolConverter.ts`, `GeminiLiveClient.ts`

**Purpose**: Make extension tools available to Live API

**Process:**
1. Get registered tools from registry
2. Filter out MCP tools (only extension tools)
3. Convert each tool to `FunctionDeclaration` format
4. Pass to session config
5. Handle tool calls in message handler
6. Execute tools using existing registry
7. Send responses back to session

**Tool Execution Flow:**
```
Live API calls tool
  ↓
message.toolCall.functionCalls
  ↓
Extract: fc.id, fc.name, fc.args
  ↓
Get tool from registry: getTool(fc.name)
  ↓
Execute: await tool.execute(fc.args)
  ↓
Format response: { id: fc.id, name: fc.name, response: { result } }
  ↓
Send: session.sendToolResponse({ functionResponses })
```

**Async Tool Calling (Optional Enhancement):**
```typescript
// In tool declaration
{
  name: 'navigateTo',
  behavior: 'NON_BLOCKING',  // Run async, don't block conversation
  parameters: {...}
}

// In response
{
  id: fc.id,
  name: fc.name,
  response: { 
    result: {...},
    scheduling: 'INTERRUPT'  // or 'WHEN_IDLE', 'SILENT'
  }
}
```

#### Phase 9: Error Handling & Edge Cases
**Files**: All new files

**Scenarios to Handle:**

1. **Microphone Permission Denied**:
   - Show error message
   - Provide button to request again
   - Link to Chrome settings

2. **WebSocket Connection Failure**:
   - Retry logic (exponential backoff)
   - Show connection status
   - Fallback to text mode option

3. **Session Timeout/GoAway**:
   - Listen for GoAway messages
   - Show warning before disconnect
   - Auto-reconnect option

4. **Audio Context Suspended**:
   - Resume on user interaction
   - Show warning if suspended

5. **Tool Execution Failure**:
   - Catch errors in execute()
   - Send error response to Live API
   - Log for debugging

6. **Side Panel Close During Session**:
   - Cleanup event listener
   - Close session gracefully
   - Stop audio capture

7. **Browser Tab Suspended**:
   - Detect visibility change
   - Pause/resume session

8. **Rapid Mode Switching**:
   - Debounce mode changes
   - Cleanup previous mode before switching

#### Phase 10: Testing & Optimization
**Tasks:**

1. **Unit Tests**:
   - Tool converter (Zod → Live API)
   - Audio encoding/decoding
   - Session lifecycle

2. **Integration Tests**:
   - End-to-end voice conversation
   - Tool calling during voice
   - Mode switching
   - Error scenarios

3. **Performance**:
   - Profile Three.js rendering
   - Optimize shader complexity
   - Monitor WebSocket message rate
   - Check memory leaks (audio sources)

4. **User Testing**:
   - Voice quality
   - Latency perception
   - Tool usage in conversation
   - UI/UX feedback

---

## 3. Technical Specifications

### 3.1 Tool Converter Algorithm

**Challenge**: Convert Zod schemas to Live API parameter format

**Zod Type → Live API Type Mapping**:
```typescript
z.string()       → Type.STRING
z.number()       → Type.NUMBER
z.boolean()      → Type.BOOLEAN
z.array(T)       → Type.ARRAY
z.object({...})  → Type.OBJECT
z.enum([...])    → Type.STRING (with description listing options)
```

**Algorithm**:
```typescript
function zodToLiveAPIParameters(schema: z.ZodSchema): {
  type: Type;
  description?: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
} {
  // Get Zod internal type
  const zodType = schema._def.typeName;
  
  switch (zodType) {
    case 'ZodString':
      return { type: Type.STRING };
    case 'ZodNumber':
      return { type: Type.NUMBER };
    case 'ZodBoolean':
      return { type: Type.BOOLEAN };
    case 'ZodArray':
      return {
        type: Type.ARRAY,
        items: zodToLiveAPIParameters(schema._def.type)
      };
    case 'ZodObject':
      const shape = schema._def.shape();
      const properties = {};
      const required = [];
      
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToLiveAPIParameters(value as z.ZodSchema);
        if (!value._def.isOptional) {
          required.push(key);
        }
      }
      
      return {
        type: Type.OBJECT,
        properties,
        required: required.length > 0 ? required : undefined
      };
    case 'ZodOptional':
      return zodToLiveAPIParameters(schema._def.innerType);
    case 'ZodEnum':
      return {
        type: Type.STRING,
        description: `One of: ${schema._def.values.join(', ')}`
      };
    default:
      console.warn('Unsupported Zod type:', zodType);
      return { type: Type.STRING };
  }
}
```

**Extraction of Tool Metadata**:
```typescript
function convertToolToLiveAPIFormat(
  toolName: string,
  toolDef: ToolDefinition
): FunctionDeclaration {
  const parameters = zodToLiveAPIParameters(toolDef.parameters);
  
  return {
    name: toolName,
    parameters: {
      type: Type.OBJECT,
      description: toolDef.description,
      properties: parameters.properties || {},
      required: parameters.required || []
    }
  };
}
```

### 3.2 Audio Pipeline

**Input Pipeline (16kHz)**:
```
User voice
  ↓
navigator.mediaDevices.getUserMedia({ audio: true })
  ↓
MediaStream
  ↓
AudioContext (16000 Hz)
  ↓
createMediaStreamSource()
  ↓
GainNode (inputNode) ← Connected to Analyser
  ↓
ScriptProcessorNode (4096 buffer)
  ↓
onaudioprocess: Float32Array (-1 to 1)
  ↓
Convert to Int16Array (-32768 to 32767)
  ↓
Uint8Array (raw bytes)
  ↓
Base64 encode
  ↓
session.sendRealtimeInput({ media: { data, mimeType: 'audio/pcm;rate=16000' } })
```

**Output Pipeline (24kHz)**:
```
Live API WebSocket message
  ↓
serverContent.modelTurn.parts[0].inlineData
  ↓
Base64 audio data
  ↓
Base64 decode → Uint8Array
  ↓
Int16Array view (2 bytes per sample)
  ↓
Convert to Float32Array (-1 to 1)
  ↓
AudioContext.createBuffer(1 channel, length, 24000 Hz)
  ↓
copyToChannel(Float32Array)
  ↓
createBufferSource()
  ↓
Connect to GainNode (outputNode) ← Connected to Analyser
  ↓
Connect to destination (speakers)
  ↓
Schedule: source.start(nextStartTime)
  ↓
Track in Set<AudioBufferSource> for interruption handling
```

**Scheduling Algorithm**:
```typescript
// Initialize
nextStartTime = audioContext.currentTime;

// For each audio chunk received
const now = audioContext.currentTime;
nextStartTime = Math.max(nextStartTime, now);

source.start(nextStartTime);
nextStartTime += audioBuffer.duration;

// On interruption
sources.forEach(source => source.stop());
nextStartTime = 0; // Reset
```

### 3.3 Session Configuration

**Model Selection**:
- **Native Audio** (`gemini-2.5-flash-native-audio-preview-09-2025`):
  - Most natural speech
  - Emotion-aware dialogue
  - "Thinking" capability
  - Best for conversational experience
  
- **Half-Cascade** (`gemini-live-2.5-flash-preview`):
  - Better tool use reliability
  - More stable in production
  - Text-to-speech output

**Recommendation**: Start with native audio for best UX, fallback to half-cascade if tool reliability issues.

**Voice Selection**:
Available voices: `Aoede`, `Orus`, `Puck`, `Charon`, `Kore`, `Fenrir`, `Orion`

**System Instruction Template**:
```typescript
const systemInstruction = `You are an intelligent AI assistant integrated into a Chrome browser extension.

You can help users with:
- Browser navigation and tab management
- Web page interaction (clicking, scrolling, filling forms)
- Information retrieval from the current page
- Managing browser history and bookmarks
- Setting reminders
- Remembering important information

Current context:
- Browser: ${browser}
- Active tab: ${activeTab.title}
- URL: ${activeTab.url}

You have access to tools to perform these actions. When users ask you to do something, use the appropriate tools. Always confirm actions before executing them.

Be conversational, friendly, and helpful. Keep responses concise since this is a voice conversation.`;
```

**Response Modalities**:
- `[Modality.AUDIO]`: Voice-only responses
- `[Modality.TEXT]`: Text-only (not useful for voice mode)
- `[Modality.AUDIO, Modality.TEXT]`: Both (could display transcript)

**Recommendation**: Start with AUDIO-only, optionally add TEXT for debugging/transcript.

### 3.4 Three.js Orb Specifications

**Sphere Geometry**:
- Base: `IcosahedronGeometry(radius=1, detail=10)`
- Subdivision level 10 for smooth deformation

**Material**:
- Base: `MeshStandardMaterial`
- Metalness: 0.5
- Roughness: 0.1
- Emissive: Dynamic based on color
- EmissiveIntensity: 1.5
- Environment map: EXR for reflections

**Custom Vertex Shader**:
- Deforms sphere based on audio frequency data
- Two sets of uniforms: `inputData` (vec4), `outputData` (vec4)
- Sine wave modulation along different axes
- Time-based animation
- Recalculates normals for proper lighting

**Backdrop**:
- Inverted icosahedron (BackSide)
- Gradient from dark purple to black
- Noise overlay for texture
- Adapts to viewport aspect ratio

**Camera Animation**:
- Orbits around sphere
- Rotation speed influenced by audio
- LookAt sphere center
- Distance: 5 units

**Post-Processing**:
- Bloom effect for glow
- FXAA for smooth edges
- Render at device pixel ratio for sharpness

**Performance Considerations**:
- Use `requestAnimationFrame` for smooth 60fps
- Update shader uniforms efficiently (no object creation in loop)
- Reuse AudioBufferSource nodes where possible
- Limit particle effects if added later

### 3.5 Extension Permissions

**Required (Already in manifest)**:
- `storage`: For API key storage
- `tabs`: For tab tools
- `activeTab`: For current tab info
- `scripting`: For page interaction
- No additional permissions needed ✓

**Microphone**:
- Requested at runtime via `navigator.mediaDevices.getUserMedia()`
- Not a manifest permission
- User grants per-session or persistently

---

## 4. Questions for Developer

### 4.1 Architecture Decisions

**Q1**: Should voice mode be a separate panel or toggle within the same panel?
- **Option A**: Same side panel with mode toggle (proposed plan) 
- **Option B**: Separate popup window for voice mode
- **Option C**: New side panel just for voice (dual panels)

ANs : A 

**Q2**: Should we maintain conversation context between text and voice modes?
- **Option A**: Completely separate (proposed plan)
- **Option B**: Share context (complex - different formats)
- **Option C**: Allow explicit context transfer (user action)

ANS : A

**Q3**: WebSocket session persistence strategy?
- **Option A**: One session per voice mode activation (close on stop)
- **Option B**: Keep session alive across recordings (proposed plan)
- **Option C**: Persistent session as long as side panel is open

ANS : A 


### 4.2 User Experience

**Q4**: How should we handle tool confirmation during voice conversation?
- **Option A**: Execute tools automatically (trust the AI)
- **Option B**: Require voice confirmation ("say yes to confirm")
- **Option C**: Visual confirmation button (breaks voice-only flow)
- **Option D**: Configurable per tool (sensitive vs. safe)

ANS A 

**Q5**: Should users see a transcript of the conversation?
- **Option A**: No transcript, voice-only (proposed plan)
- **Option B**: Show live transcript below orb
- **Option C**: Optional transcript (toggle)


ANS : A
**Q6**: What should happen when users switch tabs during voice conversation?
- **Option A**: Continue conversation (AI adapts to new context)
- **Option B**: Pause session (show warning)
- **Option C**: Update AI context automatically (send new tab info)

ANS : A

**Q7**: Orb color changes - automatic or manual?
- **Option A**: AI decides when to change color
- **Option B**: User can request colors
- **Option C**: Automatic based on mood/context
- **Option D**: Fixed color, only animation changes

ans : D 

### 4.3 Tool Integration

**Q8**: Which extension tools should be available in voice mode?
- **Option A**: All tools (might be overwhelming)
- **Option B**: Subset of most useful tools (proposed plan)
- **Option C**: User-configurable whitelist

A all tools 

**Suggested subset for voice mode**:
- ✅ navigateTo (go to URL)
- ✅ switchTabs (switch between tabs)
- ✅ getActiveTab (get current tab info)
- ✅ readPageContent (get page text)
- ✅ scrollPage (scroll up/down)
- ✅ clickElement (click something)
- ✅ saveMemory (remember information)
- ✅ retrieveMemory (recall information)
- ✅ setReminder (create reminder)
- ❌ Complex tools (form filling, tab grouping) - might be too complex for voice

**Q9**: Tool response format for voice?
- **Option A**: Simple success/failure (proposed)
- **Option B**: Detailed results (AI narrates)
- **Option C**: Visual feedback + voice confirmation


C: only voice confirmation 

**Q10**: Should MCP tools be available in voice mode?
- **Current requirement**: NO
- **Future consideration**: If yes, how to handle OAuth flow during voice?

NO 
### 4.4 Technical Implementation

**Q11**: Audio processing approach?
- **Option A**: ScriptProcessorNode (deprecated but simple) (proposed plan)
- **Option B**: AudioWorklet (modern, requires separate file + registration)
- **Option C**: Both (feature detection)

Option A

**Q12**: Environment map for orb reflections?
- **Option A**: Use EXR file from example (requires asset in extension)
- **Option B**: Generate programmatically (cubeCamera)
- **Option C**: Skip environment map (simpler but less realistic)

option a 

**Q13**: Error recovery strategy?
- **Option A**: Auto-retry failed connections
- **Option B**: Show error, require manual retry
- **Option C**: Fallback to text mode on persistent errors

option a 

**Q14**: Session resumption support?
- **Option A**: Not needed (sessions are short)
- **Option B**: Implement for connection stability (adds complexity)

option A 

**Q15**: Context window compression?
- **Option A**: Not needed (short conversations)
- **Option B**: Enable for longer sessions
- **Config**: `triggerTokens: 10000, slidingWindow: 5000`

option B
### 4.5 API Key Management

**Q16**: API key storage?
- **Current**: Stored in chrome.storage.local (text mode)
- **Voice mode**: Use same key?
- **Validation**: Check key works with Live API before enabling voice mode?

use same key

**Q17**: Rate limiting handling?
- Live API has different rate limits than text API
- Show warning if approaching limit?
- Throttle audio streaming?



### 4.6 Testing & Debugging

**Q18**: Debug mode for voice?
- **Option A**: Show WebSocket messages in console
- **Option B**: Visual debug panel (message log, audio stats)
- **Option C**: Export session logs

**Q19**: Voice quality testing?
- Test with different microphones?
- Test with background noise?
- Test with different accents?

**Q20**: Browser compatibility?
- Test on different Chromium-based browsers (Edge, Brave)?
- Handle browser-specific audio issues?

---

## 5. Implementation Checklist

### Phase 1: Setup ✓ (Estimated: 1 hour)
- [x] Install `three` package
- [x] Create folder structure (`src/ai/geminiLive/`, `src/components/voice/`)
- [x] Setup TypeScript types for Live API
- [x] Verify `@google/generative-ai` version (already installed)

### Phase 2: Tool Converter (Estimated: 4 hours)
- [x] Implement `zodToLiveAPIParameters()` function
- [x] Implement `convertToolToLiveAPIFormat()` function
- [x] Handle edge cases (nested objects, arrays, enums)
- [x] Write unit tests for converter
- [x] Test with actual extension tools

### Phase 3: Audio Manager ✓ (Estimated: 6 hours)
- [x] Implement AudioCapture class
  - [x] Microphone permission handling
  - [x] AudioContext setup (16kHz)
  - [x] MediaStreamSource creation
  - [x] ScriptProcessorNode processing
  - [x] PCM encoding (Float32 → Int16 → Base64)
- [x] Implement AudioPlayback class
  - [x] AudioContext setup (24kHz)
  - [x] PCM decoding (Base64 → Int16 → Float32)
  - [x] AudioBuffer creation
  - [x] Source queueing and scheduling
  - [x] Interruption handling
- [x] Implement Analyser wrapper
  - [x] AnalyserNode setup
  - [x] Frequency data extraction
- [ ] Test audio pipeline end-to-end

### Phase 4: Gemini Live Client (Estimated: 8 hours)
- [x] Implement GeminiLiveClient class
  - [x] Initialize GoogleGenAI client
  - [x] Session connection with config
  - [x] Message handling (onopen, onmessage, onerror, onclose)
  - [x] Audio message handling
  - [x] Tool call handling
  - [x] Interruption handling
  - [x] Session cleanup
- [x] Integrate with AudioManager
- [x] Implement tool execution flow
- [x] Handle error scenarios
- [x] Add logging for debugging

### Phase 5: Audio Orb (Estimated: 10 hours)
- [x] Port shader files (sphereShader.ts, backdropShader.ts)
- [x] Implement AudioOrb3D component
  - [x] Scene setup
  - [x] Sphere with custom shader
  - [x] Backdrop with custom shader
  - [x] Camera setup
  - [x] Post-processing (bloom, FXAA)
  - [x] Animation loop
  - [x] Analyser integration
- [x] Handle window resize
- [x] Optimize performance
- [x] Add/prepare EXR environment map asset
- [x] Test visual responsiveness to audio
- [x] Create AudioAnalyser utility class
- [x] Add CSS styling for orb container
- [x] Export all components from index.ts
- [x] Create usage example

### Phase 6: Voice Mode UI ✓ (Estimated: 6 hours)
- [x] Implement VoiceModeUI component
  - [x] Layout and structure
  - [x] State management (recording, status, error)
  - [x] Integration with GeminiLiveClient
  - [x] Integration with AudioOrb3D
  - [x] Audio context refs (inputNode, outputNode)
- [x] Implement VoiceControls component
  - [x] Start button (mic permission + session start)
  - [x] Stop button (stop recording)
  - [x] Reset button (close session)
  - [x] Button states (disabled when appropriate)
- [x] Add status display
- [x] Add error display
- [x] Style with CSS (dark theme, glassmorphism)
- [x] Create VoiceModeUI.css (main container styles)
- [x] Create VoiceControls.css (button styles)
- [x] Add loading state UI
- [x] Add back button for mode switching
- [x] Create usage examples
- [x] Add proper cleanup on unmount

### Phase 7: Mode Integration (Estimated: 4 hours)
- [x] Implement ModeToggle component
- [x] Update SidePanel to support modes
  - [x] Add mode state
  - [x] Conditional rendering
  - [x] Mode switching logic
  - [x] Cleanup on mode change
- [x] Style mode toggle (tab-like interface)
- [x] Test mode switching
- [x] Handle edge cases (switching while recording)

### Phase 8: Tool Integration (Estimated: 4 hours)
- [x] Get extension tools from registry
- [x] Filter out MCP tools
- [x] Convert tools to Live API format
- [x] Pass tools to session config
- [x] Test tool calling during voice conversation
- [x] Verify tool responses format
- [x] Handle tool execution errors

### Phase 9: Error Handling (Estimated: 6 hours)
- [x] Microphone permission denied handling
- [x] WebSocket connection failure handling
- [x] Session timeout handling
- [x] GoAway message handling
- [x] Audio context suspended handling
- [x] Tool execution error handling
- [x] Side panel close cleanup
- [x] Tab visibility change handling
- [x] Rapid mode switching safeguards

### Phase 10: Testing & Polish (Estimated: 8 hours)
- [ ] Unit tests for core functions
- [ ] Integration tests for voice flow
- [ ] Manual testing scenarios
- [ ] Performance profiling
- [ ] Memory leak detection
- [ ] User acceptance testing
- [ ] Bug fixes
- [ ] Documentation
- [ ] Code cleanup

**Total Estimated Time: 57 hours (~7-8 working days)**

---

## 6. Risk Assessment

### High Risk

**Risk**: WebSocket connection instability
- **Mitigation**: Implement retry logic, GoAway handling, session resumption
- **Fallback**: Text mode remains available

**Risk**: Audio quality issues (latency, echo, distortion)
- **Mitigation**: Proper buffer sizing, echo cancellation research, volume normalization
- **Fallback**: Adjust audio context settings, add user controls

**Risk**: Tool converter fails for complex Zod schemas
- **Mitigation**: Extensive testing, graceful degradation (skip unsupported tools)
- **Fallback**: Manual tool definition override

### Medium Risk

**Risk**: Three.js performance in extension environment
- **Mitigation**: Performance profiling, shader optimization, reduce complexity
- **Fallback**: Simpler 2D visualization

**Risk**: Microphone permission issues
- **Mitigation**: Clear UI prompts, link to Chrome settings, test on different systems
- **Fallback**: Text mode, clear error messages

**Risk**: API rate limiting
- **Mitigation**: Monitor usage, show warnings, implement throttling
- **Fallback**: Graceful degradation, retry with backoff

### Low Risk

**Risk**: Browser compatibility
- **Mitigation**: Test on Edge, Brave, feature detection
- **Fallback**: Chromium-based browsers have good API support

**Risk**: Memory leaks from audio sources
- **Mitigation**: Proper cleanup, track sources in Set, disconnect on stop
- **Fallback**: Regular session resets

**Risk**: Mode switching state conflicts
- **Mitigation**: Proper cleanup, state isolation, debouncing
- **Fallback**: Clear separation of concerns

---

## 7. Success Criteria

### Functional Requirements
- ✅ Voice mode toggles on/off without errors
- ✅ Microphone captures audio and streams to Live API
- ✅ AI responses play through speakers with acceptable latency (<500ms perceived)
- ✅ Orb visualizes audio in real-time
- ✅ Extension tools are callable during voice conversation
- ✅ Tool execution completes successfully
- ✅ Session cleans up properly on mode switch or panel close
- ✅ Errors are handled gracefully with user feedback

### Performance Requirements
- ✅ Orb renders at minimum 30fps (target 60fps)
- ✅ Audio streaming has minimal latency
- ✅ No memory leaks over 10-minute session
- ✅ CPU usage acceptable (<20% on modern hardware)
- ✅ Extension remains responsive during voice conversation

### User Experience Requirements
- ✅ Clear visual feedback for all states (ready, listening, thinking, speaking, error)
- ✅ Intuitive controls (single button to start/stop)
- ✅ Smooth mode switching
- ✅ Voice quality is clear and natural
- ✅ Tool actions are confirmed via voice
- ✅ Works without looking at screen (voice-first)

### Code Quality Requirements
- ✅ TypeScript types for all new code
- ✅ Error boundaries prevent crashes
- ✅ Logging for debugging
- ✅ Comments for complex logic
- ✅ Consistent code style
- ✅ No console errors in production

---

## 8. Future Enhancements

### Short Term
- Add voice activity visualization (speaking indicator)
- Configurable voice selection (Aoede, Orus, etc.)
- Adjustable audio sensitivity
- Export conversation transcript
- Push-to-talk mode (alternative to voice activity detection)

### Medium Term
- AudioWorklet migration (replace ScriptProcessorNode)
- Session resumption for connection stability
- Context window compression for longer conversations
- Multi-language support
- Custom orb colors/themes
- Screen sharing during voice conversation

### Long Term
- Video input support (camera)
- MCP tools in voice mode (with OAuth handling)
- Multi-modal responses (voice + visual)
- Voice commands for browser control
- Integration with other Google AI features
- Offline voice mode (on-device model)

---

## 9. Conclusion

This integration plan provides a comprehensive roadmap for adding Gemini Live API support to your Chrome extension. The phased approach ensures manageable implementation while maintaining the existing text chat functionality.

**Key Success Factors:**
1. Proper separation between text and voice modes
2. Robust audio pipeline implementation
3. Reliable tool conversion and execution
4. Performant Three.js visualization
5. Thorough error handling and testing

**Next Steps:**
1. Review this plan and answer the questions in Section 4
2. Approve architecture decisions
3. Begin Phase 1 implementation
4. Iterate based on testing feedback

The estimated timeline of 7-8 working days assumes focused development time. Adjust as needed based on your schedule and any additional requirements discovered during implementation.

---

**Document Version**: 1.0  
**Created**: October 22, 2025  
**Author**: GitHub Copilot  
**Status**: Pending Developer Review
