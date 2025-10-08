# Chrome Built-in AI — Documentation Collection (> A consolidated, ready-to-read markdown reference gathering the relevant Chrome Built-in AI documentation, APIs, usage notes, and limits. This copy is intended for quick offline reading; always double-check the live docs before production.)

---

## Table of contents

1. Overview
2. Key built-in AI APIs

   * Prompt API
   * WebAI / Web AI
   * Translator & Expert models
   * Extensions integration
3. Quick start (developer flow)
4. Authentication, origin trials & EPP
5. Usage examples (code snippets)
6. Limits & quotas (token limits, rate limits, session limits)
7. Privacy, security, and best practices
8. Troubleshooting & developer tips
9. Useful links

---

## 1. Overview

Chrome Built-in AI brings on-device and browser‑mediated AI capabilities to websites and extensions. It exposes standardized web APIs so web apps and extensions can call locally-run or browser-managed models (for example, Gemini Nano) for tasks like summarization, translation, image understanding, or multimodal prompts. The design goals are low-latency, improved privacy (when models run locally), and a better UX by leveraging the browser as a first-class AI runtime.

## 2. Key built-in AI APIs

### Prompt API

* Purpose: Send natural-language (and multimodal) prompts to built-in models (e.g., Gemini Nano) from web pages or extensions.
* Inputs: text, images, audio (varies by implementation and origin-trial status).
* Typical use cases: summarization, question answering, content enrichment, structured output extraction.
* Availability: The Prompt API has run in origin trials and is available to extensions in stable channels in some Chrome versions. See official docs for exact Chrome version availability.

### WebAI / Web AI

* Purpose: A broader set of browser APIs to let sites interact with AI models via the browser environment (including scheduling, on-device acceleration, and fallback to cloud models when necessary).
* Focus: Standardization across browsers (where possible) and enabling both local model execution and hybrid cloud fallback.

### Translator & Expert models

* Purpose: Single-purpose expert models (for example, translator or OCR-focused models) that offer better performance for specific tasks while keeping hardware requirements low.

### Extensions integration

* Chrome exposes extension-specific routes to use Prompt API functionality from extension background pages, content scripts, or popup UI. There are samples in the Chromium and Chrome Developers repositories showing manifest entries and usage patterns.

## 3. Quick start (developer flow)

1. Read the API docs on developer.chrome.com and confirm the API status (Stable / Origin Trial / EPP).
2. If the API requires an origin trial, register and install the trial token on your site or extension.
3. Prototype with the Prompt API playground (when available) or the sample repos linked from the docs.
4. Build a small demo: send a text prompt, receive a structured JSON or text response, and present it in the UI.
5. Test on the Chrome versions listed by the origin trial/feature status pages.

## 4. Authentication, origin trials & Early Preview Program (EPP)

* Origin trials: Certain experimental APIs (Prompt API, advanced multimodal features) were made available via origin trials—time-limited programs that let developers test features on real users and give feedback.
* EPP: The Early Preview Program gives select developers early access to cutting-edge APIs.
* Extensions: Some APIs are directly available to extensions in stable Chrome releases — check the extensions docs for exact manifest flags and permissions.

## 5. Usage examples (code snippets)

> **Note:** The examples below are reference-style pseudocode based on the public docs and samples. Always copy the latest snippet from the official docs when implementing.

### Example: Basic Prompt API usage (web page)

```js
// Request permission / feature-detect
if ('prompt' in navigator) {
  const promptReq = {
    input: [{type: 'TEXT', text: 'Summarize the following article: <paste article text here>'}],
    // optional: format, temperature, instructions
  };

  const response = await navigator.prompt.send(promptReq);
  console.log('Response:', response);
} else {
  console.warn('Prompt API not available in this browser version');
}
```

### Example: Using the Prompt API inside an extension

```js
// background.js (extension)
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === 'PROMPT') {
    const response = await navigator.prompt.send({ input: [{ type: 'TEXT', text: msg.text }] });
    sendResponse({ result: response });
  }
});
```

## 6. Limits & quotas

> **Important:** Limits change frequently. Always consult the live API docs or model provider pages for the latest numbers. The items below summarize documented limits and community reports as of the time this document was compiled.

### Token / context limits

* Models vary by family and deployment: small on-device models (like Gemini Nano) have smaller per-prompt and session capacities; larger cloud models (Gemini family on Vertex AI / GenAI endpoints) may offer very large context windows (including models with 1,000,000-token windows).
* Token types: some implementations distinguish input tokens, output tokens, and session retention (sliding window) limits.

### Example reported numbers (subject to change)

* Per-prompt and session numbers have been reported in developer discussions and official model pages; an example community post mentioned a 1024-token per-prompt limit and 4096 token session retention for some early Prompt API runs. Larger Gemini models on cloud APIs report much larger limits (up to ~1,048,576 input tokens for some Gemini 2.5 Flash variants), with substantial output token caps as well.

### Rate limits

* The backend model APIs (for cloud models) often apply rate limits (requests per minute, tokens per minute, daily quotas). Exceeding quotas typically returns HTTP 429/ rate-limited errors.

### Other quotas

* Model invocation concurrency, per-project quotas, and daily caps may apply for cloud-hosted endpoints.

## 7. Privacy, security, and best practices

* On-device/local execution improves privacy because data can remain on the user's device. However, when your app uses cloud fallback, ensure you disclose this behavior clearly to users.
* Minimize sensitive data in prompts; redact or obfuscate PII when possible.
* Cache model responses thoughtfully and avoid exposing secrets in client-side code.

## 8. Troubleshooting & developer tips

* Feature-detection is essential (not all Chrome versions support all APIs). Use graceful fallbacks.
* If an API requires an origin trial token, ensure the token is installed and valid for your domain.
* For heavy workloads or large contexts, consider hybrid approaches (client-side for short/interactive tasks, server-side for long-context jobs using Vertex AI or cloud GenAI APIs).

## 9. Useful links (official)

* Chrome Built-in AI main overview: [https://developer.chrome.com/docs/ai/built-in](https://developer.chrome.com/docs/ai/built-in)
* Built-in AI APIs index: [https://developer.chrome.com/docs/ai/built-in-apis](https://developer.chrome.com/docs/ai/built-in-apis)
* Prompt API: [https://developer.chrome.com/docs/ai/prompt-api](https://developer.chrome.com/docs/ai/prompt-api)
* Extensions Prompt API: [https://developer.chrome.com/docs/extensions/ai/prompt-api](https://developer.chrome.com/docs/extensions/ai/prompt-api)
* Get started guide: [https://developer.chrome.com/docs/ai/get-started](https://developer.chrome.com/docs/ai/get-started)
* Gemini API (model limits & tokens): [https://ai.google.dev/gemini-api/docs/tokens](https://ai.google.dev/gemini-api/docs/tokens)
* Gemini long context guide: [https://ai.google.dev/gemini-api/docs/long-context](https://ai.google.dev/gemini-api/docs/long-context)
* Vertex AI Gemini model page: [https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash)

---

*End of document — keep this copy as a developer quick reference. For the most accurate numbers (token limits, rate limits, origin trial dates), always check the live pages listed above.*
