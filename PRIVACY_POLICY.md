# Privacy Policy for Cognito: Your AI Browser Agent

**Last Updated:** November 30, 2025  
**Version:** 0.0.2

## Introduction

Cognito ("we," "our," or "the extension") is a Chrome browser extension that provides AI-powered assistance directly in your browser. This Privacy Policy explains how we collect, use, store, and protect your information when you use Cognito.

**Our Privacy Commitment:** Cognito is designed with a privacy-first approach. Your data stays in your browser, and you maintain full control over what information is shared with external AI services.

---

## Table of Contents

1. [Information We Collect](#1-information-we-collect)
2. [How We Use Your Information](#2-how-we-use-your-information)
3. [Data Storage and Security](#3-data-storage-and-security)
4. [Third-Party Services and API Usage](#4-third-party-services-and-api-usage)
5. [Browser Permissions Explained](#5-browser-permissions-explained)
6. [Your Privacy Rights and Controls](#6-your-privacy-rights-and-controls)
7. [Data Retention and Deletion](#7-data-retention-and-deletion)
8. [Children's Privacy](#8-childrens-privacy)
9. [Changes to This Policy](#9-changes-to-this-policy)
10. [Contact Information](#10-contact-information)

---

## 1. Information We Collect

### 1.1 Information You Provide Directly

**API Keys and Credentials:**
- Google Gemini API keys (if you choose to use remote AI models)
- Tavily API key (if you enable enhanced web search)
- OAuth tokens for third-party service integrations (MCP servers like Notion, Linear, etc.)
- Service account credentials for Vertex AI (if configured)

**Chat Messages:**
- Text messages you send to the AI assistant
- File attachments you upload (images, PDFs, documents)
- Voice recordings (when using voice input features)

**Memory and Preferences:**
- Personal information you explicitly ask the AI to remember (name, preferences, behavioral patterns)
- User settings and configuration preferences
- Enabled/disabled tools and features

### 1.2 Information Collected Automatically

**Browsing Context (Only When You Interact with the Extension):**
- Current webpage URL and title
- Visible page content (text, headings, buttons, links, input fields)
- Page metadata (descriptions, keywords)
- YouTube video information (when on YouTube pages)

**Browser Activity (Only When Using Specific Features):**
- Open tabs information (titles, URLs) - only when using tab management features
- Browser history - only when you explicitly use search history features
- Bookmarks - only when you use bookmark-related features

**Usage Data:**
- Chat thread metadata (creation time, last updated)
- Token usage statistics (for AI model usage tracking)
- Tool execution logs (for debugging and error handling)
- Extension settings and preferences

### 1.3 Information We Do NOT Collect

- We do NOT track your browsing history automatically
- We do NOT collect data from websites you visit unless you explicitly interact with the extension on that page
- We do NOT send your data to our servers (we don't have any servers)
- We do NOT sell, rent, or share your personal information with third parties for marketing purposes
- We do NOT use analytics or tracking services

---

## 2. How We Use Your Information

### 2.1 Core Functionality

**AI Assistance:**
- Process your chat messages to generate AI responses
- Analyze page content when you request assistance with a specific webpage
- Execute browser automation tasks you request (clicking, typing, navigation)
- Remember information you explicitly ask to be saved

**Browser Automation:**
- Organize tabs into groups based on your requests
- Navigate to websites and interact with page elements
- Extract and summarize content from web pages
- Search your browsing history or bookmarks when requested

**Research & Workflows:**
- Perform deep research on topics using multiple search queries
- Analyze and synthesize information from various sources
- Execute multi-step workflows (e.g., "Research this topic", "Summarize this video")

**Supermemory System:**
- Store facts and preferences you want the AI to remember across conversations
- Retrieve stored memories to provide personalized responses
- Suggest saving important information discovered during conversations

### 2.2 Service Improvement

- Analyze error logs locally to improve reliability
- Track token usage to help you manage API costs
- Store chat history to maintain conversation context

### 2.3 External Service Integration

When you enable MCP (Model Context Protocol) servers:
- Authenticate with third-party services using OAuth
- Send requests to external services on your behalf
- Retrieve data from connected services (e.g., Notion pages, Linear issues)

---

## 3. Data Storage and Security

### 3.1 Local Storage

**All your data is stored locally in your browser:**

**IndexedDB (Primary Storage):**
- Chat messages and conversation threads
- User settings and preferences
- Token usage statistics

**Chrome Storage (Sync):**
- Memory system data (facts, behavioral preferences)
- Synced across your Chrome browsers if Chrome Sync is enabled

**Chrome Storage (Local):**
- API keys and authentication tokens (encrypted by Chrome)
- OAuth credentials for MCP servers
- Extension configuration settings

### 3.2 Data Security Measures

**Encryption:**
- API keys and OAuth tokens are stored using Chrome's secure storage APIs
- Sensitive credentials are never stored in plain text
- OAuth tokens are automatically refreshed before expiration

**Access Control:**
- Data is isolated per Chrome profile
- No external access to your local data
- Extension permissions are limited to necessary functionality

**Secure Communication:**
- All API requests use HTTPS encryption
- OAuth flows use industry-standard security (PKCE, state validation)
- MCP server connections use secure SSE (Server-Sent Events) or HTTPS

### 3.3 Data Not Stored

- Voice recordings are processed in real-time and not permanently stored
- Temporary page content extracted for AI context is not persisted
- Screenshot data is processed and discarded after use

---

## 4. Third-Party Services and API Usage

### 4.1 Google Gemini AI (Required for AI Features)

**What is sent:**
- Your chat messages and conversation history
- Page content you explicitly share or request analysis of
- File attachments you upload
- System prompts describing available tools and context

**What is NOT sent:**
- Your browsing history (unless you explicitly ask to search it)
- Content from websites you visit (unless you explicitly request analysis)
- Your API key (used only for authentication headers)

**Data Processing:**
- Processed according to [Google's AI Services Terms](https://ai.google.dev/terms)
- Subject to [Google's Privacy Policy](https://policies.google.com/privacy)
- You control what data is sent by choosing what to share with the AI

**Your API Key:**
- You provide your own Google Gemini API key (BYOK - Bring Your Own Key)
- Your API key is stored locally and never shared with us
- You can revoke or change your API key at any time

### 4.2 MCP (Model Context Protocol) Servers (Optional)

When you enable and authenticate with MCP servers:

**Supported Services:**
- Notion, Linear, Supabase, Vercel, Ahrefs, Hugging Face, and others
- Each service has its own privacy policy and terms of service

**What is sent:**
- OAuth access tokens for authentication
- Specific requests you make through the AI (e.g., "create a Notion page")
- Data required to fulfill your requests

**Your Control:**
- You explicitly authorize each service connection
- You can disconnect any service at any time
- You can view and manage connected services in settings

### 4.3 YouTube Transcript Service (Optional)

**Service URL:** `https://youtube-transcript-generator-five.vercel.app`

**What is sent:**
- YouTube video IDs when you request video analysis
- No personal information or browsing history

**Purpose:**
- Retrieve video transcripts for summarization
- Only used when you explicitly request YouTube video analysis

### 4.4 Chrome Built-in AI (Optional)

If you use Chrome's built-in Gemini Nano model:
- All processing happens locally on your device
- No data is sent to external servers
- Subject to Chrome's privacy policies

### 4.5 Tavily Search API (Optional)

**Service URL:** `https://api.tavily.com`

**What is sent:**
- Search queries you explicitly make or those generated by the AI during research
- No personal browsing history is sent

**Purpose:**
- Provide real-time web search results and content extraction
- Used only when Web Search is enabled or during Research Mode

**Data Processing:**
- Subject to [Tavily's Privacy Policy](https://tavily.com/privacy)
- You provide your own API key which is stored locally

---

## 5. Browser Permissions Explained

Cognito requests the following Chrome permissions. Here's why each is needed:

### 5.1 Required Permissions

**`storage` and `unlimitedStorage`**
- Store chat history, settings, and user preferences locally
- Save memory system data and API keys securely

**`sidePanel`**
- Display the AI chat interface in Chrome's side panel
- Provide quick access via keyboard shortcut (Ctrl+Shift+H)

**`tabs` and `tabGroups`**
- Organize tabs into groups when you request it
- Switch between tabs and get information about open tabs
- Required for tab management features

**`scripting` and `activeTab`**
- Interact with web pages when you request automation
- Extract page content for AI analysis
- Click buttons, fill forms, and navigate pages on your behalf

**`webNavigation`**
- Track when pages finish loading for automation tasks
- Ensure page is ready before executing actions

**`alarms`**
- Schedule reminders you create
- Refresh OAuth tokens automatically

**`notifications`**
- Show reminder notifications
- Display important status updates

**`offscreen`**
- Use Chrome's built-in Summarizer API for local text summarization
- Process data without opening visible windows

**`history`**
- Search your browsing history when you explicitly request it
- Only accessed when you use history search features

**`search`**
- Perform web searches when requested
- Access Chrome's search functionality

**`bookmarks`**
- Search and access bookmarks when you request it
- Only used for bookmark-related features

**`omnibox`**
- Allow typing "ai" in the address bar to open the extension
- Quick access to AI assistant

**`identity`**
- Handle OAuth authentication for MCP servers
- Securely manage third-party service connections

**`cookies`**
- Maintain authentication sessions with MCP servers
- Required for OAuth token management

### 5.2 Optional Permissions

**`tabCapture` and `desktopCapture`** (Not Currently Used)
- Reserved for future features
- Will require explicit user consent if implemented

### 5.3 Host Permissions

**`<all_urls>`**
- Required to interact with any website you choose
- Only used when you explicitly request page interaction
- Necessary for browser automation features

**`https://youtube-transcript-generator-five.vercel.app/*`**
- Access YouTube transcript service for video analysis
- Only used when analyzing YouTube videos

---

## 6. Your Privacy Rights and Controls

### 6.1 Data Access and Export

**View Your Data:**
- Access all chat history through the side panel
- View stored memories in the Memory Manager
- Review connected MCP services in settings

**Export Your Data:**
- Chat threads can be exported manually (copy/paste)
- Memory data can be viewed and copied
- Settings can be backed up through Chrome's sync

### 6.2 Data Deletion

**Delete Specific Data:**
- Delete individual chat messages or entire threads
- Remove specific memories from the Memory Manager
- Clear individual settings or preferences

**Delete All Data:**
- Use "Clear All Data" in settings to wipe everything
- Disconnect MCP services to revoke OAuth tokens
- Remove API keys to stop AI service access
- Uninstall the extension to remove all local data

### 6.3 Privacy Controls

**Control What's Shared:**
- Choose which tools are enabled (disable history, bookmarks, etc.)
- Control Supermemory suggestions (opt-out of automatic memory detection)
- Disable specific MCP servers
- Adjust "Ask AI" button visibility per website

**Limit Data Collection:**
- Use local AI models (Gemini Nano) to avoid sending data externally
- Disable voice features if you don't want voice processing
- Turn off contextual suggestions to reduce page content analysis

### 6.4 Opt-Out Options

**Stop Using External AI:**
- Remove your API key to stop sending data to Google Gemini
- Use only local AI models (if available)

**Disconnect Third-Party Services:**
- Revoke OAuth tokens for any MCP server
- Disconnect all external integrations

**Disable Specific Features:**
- Turn off memory system to stop storing personal information
- Disable browser automation tools
- Limit extension to basic chat functionality

---

## 7. Data Retention and Deletion

### 7.1 Retention Periods

**Chat History:**
- Stored indefinitely until you delete it
- Organized in threads for easy management
- Can be cleared at any time

**Memory System:**
- Facts and preferences stored until you delete them
- No automatic expiration
- Full control over what's remembered

**OAuth Tokens:**
- Stored until you disconnect the service
- Automatically refreshed before expiration
- Cleared when you revoke access

**API Keys:**
- Stored until you remove them
- Can be changed or deleted at any time

### 7.2 Automatic Deletion

**Temporary Data:**
- Page content extracted for AI context (not persisted)
- Voice recordings (processed in real-time, not stored)
- Screenshot data (discarded after processing)

**Cache Cleanup:**
- File upload cache cleared periodically
- Temporary processing data removed automatically

### 7.3 Account Deletion

**Uninstalling the Extension:**
- Removes all local data from your browser
- Clears IndexedDB and Chrome Storage
- OAuth tokens are revoked (you may need to manually revoke in service settings)
- API keys are deleted

**Note:** Data sent to third-party services (Google Gemini, MCP servers) is subject to their retention policies. You may need to contact those services directly to request deletion.

---

## 8. Children's Privacy

Cognito is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us, and we will delete such information.

---

## 9. Changes to This Policy

We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons.

**How We Notify You:**
- Updated "Last Updated" date at the top of this policy
- Significant changes will be announced in the extension
- Continued use after changes constitutes acceptance

**Your Options:**
- Review this policy periodically for updates
- Contact us with questions about changes
- Stop using the extension if you disagree with changes

---

## 10. Contact Information

If you have questions, concerns, or requests regarding this Privacy Policy or your data:

**Email:** dev@codewarnab.in

**GitHub Issues:** [https://github.com/codewarnab/cognito-ai/issues](https://github.com/codewarnab/cognito-ai/issues)

**Response Time:** We aim to respond to privacy inquiries within 7 business days.

---

## Summary of Key Privacy Points

✅ **Privacy-First Design:** Your data stays in your browser  
✅ **No Tracking:** We don't track your browsing or collect analytics  
✅ **Your API Key:** You provide and control your own AI service credentials  
✅ **Local Storage:** All data stored locally in Chrome's secure storage  
✅ **Full Control:** Delete any or all data at any time  
✅ **Transparent Permissions:** Every permission explained with clear purpose  
✅ **Optional Features:** Choose which features and integrations to enable  
✅ **No Data Sales:** We never sell or share your data for marketing  
✅ **Open Source:** Code is available for review and audit  

---

## Legal Compliance

This extension complies with:
- General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)
- Chrome Web Store Developer Program Policies
- Google API Services User Data Policy

**Your Rights Under GDPR (if applicable):**
- Right to access your data
- Right to rectification
- Right to erasure ("right to be forgotten")
- Right to data portability
- Right to object to processing
- Right to withdraw consent

**Your Rights Under CCPA (if applicable):**
- Right to know what personal information is collected
- Right to delete personal information
- Right to opt-out of sale of personal information (we don't sell data)
- Right to non-discrimination for exercising privacy rights

---

**By using Cognito, you acknowledge that you have read and understood this Privacy Policy and agree to its terms.**

---

*This privacy policy is effective as of November 21, 2025, and applies to version 0.0.1 and all subsequent versions until superseded.*
