import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
    matches: ["<all_urls>"],
    run_at: "document_idle"
}

/**
 * Message Types for Content <-> Background Communication
 */

export interface PageSeenMessage {
    type: "PageSeen"
    url: string
    title: string
    description: string | null
    ts: number
    textSizeBytes: number
    imageCaptionCount: number
    spa: boolean
    host: string
}

export interface RequestPageCaptureMessage {
    type: "RequestPageCapture"
    reason: "queue" | "user" | "retry"
}

export interface ImageCaption {
    src: string
    caption: string
}

export interface PageCaptureMessage {
    type: "PageCapture"
    url: string
    title: string
    description: string | null
    ts: number
    text: string
    textSizeBytes: number
    images: ImageCaption[]
    version: number
}

/**
 * Privacy Settings
 */
interface PrivacySettings {
    paused: boolean
    domainAllowlist: string[]
    domainDenylist: string[]
}

/**
 * State Management
 */
let lastExtractTime = 0
let lastUrl = ""
let cachedExtraction: {
    text: string
    images: ImageCaption[]
    textSizeBytes: number
} | null = null

const MIN_EXTRACT_INTERVAL_MS = 30_000 // 30 seconds
const DEBOUNCE_INITIAL_MS = 2000
const DEBOUNCE_SPA_MS = 3000
const MIN_BYTE_BUDGET = 50_000
const TARGET_BYTE_BUDGET = 100_000
const MAX_BYTE_BUDGET = 150_000
const MAX_IMAGE_CAPTIONS = 50

/**
 * Utility: Debounce function
 */
function debounce<T extends (...args: any[]) => void>(
    fn: T,
    ms: number
): (...args: Parameters<T>) => void {
    let timeout: number | undefined
    return (...args: Parameters<T>) => {
        clearTimeout(timeout)
        timeout = setTimeout(() => fn(...args), ms) as unknown as number
    }
}

/**
 * Utility: Get byte size of string
 */
function getByteSize(text: string): number {
    return new TextEncoder().encode(text).length
}

/**
 * Privacy Gates: Check if extraction is allowed
 */
async function isExtractionAllowed(): Promise<boolean> {
    try {
        const settings = await chrome.storage.local.get([
            "paused",
            "domainAllowlist",
            "domainDenylist"
        ]) as Partial<PrivacySettings>

        // If globally paused, no extraction
        if (settings.paused === true) {
            return false
        }

        const currentHost = window.location.hostname

        // Check denylist first
        const denylist = settings.domainDenylist || []
        if (denylist.some((domain) => currentHost.includes(domain))) {
            return false
        }

        // If allowlist is defined and non-empty, check inclusion
        const allowlist = settings.domainAllowlist || []
        if (allowlist.length > 0) {
            return allowlist.some((domain) => currentHost.includes(domain))
        }

        // No denylist match, no allowlist defined or empty -> allow
        return true
    } catch (error) {
        console.error("[extract] Error checking privacy settings:", error)
        // Fail safe: don't extract if we can't determine settings
        return false
    }
}

/**
 * Privacy: Check if element should be excluded
 */
function isPrivateElement(el: Element): boolean {
    // Check for password or secret fields
    const sensitiveAttrs = [
        'type="password"',
        'autocomplete="password"',
        'autocomplete="current-password"',
        'autocomplete="new-password"'
    ]

    const html = el.outerHTML.toLowerCase()
    if (sensitiveAttrs.some((attr) => html.includes(attr))) {
        return true
    }

    // Check name attributes
    const name = el.getAttribute("name")?.toLowerCase() || ""
    if (name.includes("password") || name.includes("secret")) {
        return true
    }

    // Check for private/sensitive markers
    if (
        el.hasAttribute("data-private") ||
        el.hasAttribute("data-sensitive")
    ) {
        return true
    }

    return false
}

/**
 * DOM Filtering: Get candidate root element
 */
function getCandidateRoot(): Element {
    const candidates = [
        document.querySelector("article"),
        document.querySelector("main"),
        document.querySelector('[role="main"]'),
        document.querySelector("#content"),
        document.querySelector(".article"),
        document.querySelector(".post")
    ]

    for (const candidate of candidates) {
        if (candidate) return candidate
    }

    return document.body
}

/**
 * DOM Filtering: Check if element should be filtered out
 */
function shouldFilterElement(el: Element): boolean {
    const tagName = el.tagName.toLowerCase()

    // Filter by tag
    const filteredTags = [
        "script",
        "style",
        "noscript",
        "svg",
        "canvas",
        "video",
        "audio",
        "iframe",
        "form",
        "input",
        "textarea",
        "select",
        "button",
        "nav",
        "aside",
        "footer",
        "header",
        "menu",
        "template"
    ]

    if (filteredTags.includes(tagName)) {
        return true
    }

    // Filter by attributes
    if (
        el.hasAttribute("aria-hidden") ||
        el.hasAttribute("hidden") ||
        el.getAttribute("contenteditable") !== null
    ) {
        return true
    }

    // Filter ads and utility blocks (best effort)
    const classList = el.className.toLowerCase()
    const id = el.id.toLowerCase()

    const adPatterns = [
        "ad-",
        "ad_",
        "advertisement",
        "comment",
        "sidebar",
        "share",
        "subscribe",
        "cookie",
        "banner"
    ]

    for (const pattern of adPatterns) {
        if (classList.includes(pattern) || id.includes(pattern)) {
            return true
        }
    }

    // Check for private elements
    if (isPrivateElement(el)) {
        return true
    }

    return false
}

/**
 * Text Extraction: Build filtered text from DOM
 */
function extractText(): string {
    const root = getCandidateRoot()
    const textParts: string[] = []

    function traverse(node: Node) {
        // Skip non-element nodes except text
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim() || ""
            if (text.length > 0) {
                textParts.push(text)
            }
            return
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return
        }

        const el = node as Element

        // Filter unwanted elements
        if (shouldFilterElement(el)) {
            return
        }

        // Add heading markers for structure
        const tagName = el.tagName.toLowerCase()
        if (["h1", "h2", "h3"].includes(tagName)) {
            const text = el.textContent?.trim() || ""
            if (text.length > 0) {
                textParts.push("\n" + text + "\n")
            }
            return // Don't traverse children of headings
        }

        // Traverse children
        for (const child of Array.from(node.childNodes)) {
            traverse(child)
        }
    }

    traverse(root)

    // Join and normalize whitespace
    let text = textParts.join(" ")
    text = text.replace(/\s+/g, " ").trim()

    // Enforce byte budget
    let byteSize = getByteSize(text)
    while (byteSize > MAX_BYTE_BUDGET) {
        // Truncate by 10% and retry
        const targetLength = Math.floor(text.length * 0.9)
        text = text.substring(0, targetLength)
        byteSize = getByteSize(text)
    }

    return text
}

/**
 * Image Caption Extraction
 */
function extractImageCaptions(): ImageCaption[] {
    const root = getCandidateRoot()
    const images = Array.from(root.querySelectorAll("img")).slice(
        0,
        MAX_IMAGE_CAPTIONS
    )
    const captions: ImageCaption[] = []

    for (const img of images) {
        try {
            const src = img.src

            // Skip data URIs
            if (!src || src.startsWith("data:")) {
                continue
            }

            // Skip decorative images
            if (img.getAttribute("role") === "presentation") {
                continue
            }

            let caption = ""

            // Try alt text first
            const alt = img.alt?.trim() || ""
            if (alt && alt.length > 0) {
                caption = alt
            }

            // Try figcaption if in figure
            if (!caption) {
                const figure = img.closest("figure")
                if (figure) {
                    const figcaption = figure.querySelector("figcaption")
                    if (figcaption) {
                        caption = figcaption.textContent?.trim() || ""
                    }
                }
            }

            // Try nearby text
            if (!caption) {
                // Check previous sibling
                const prevSibling = img.previousElementSibling
                if (prevSibling) {
                    caption = prevSibling.textContent?.trim() || ""
                }

                // Check next sibling if still empty
                if (!caption) {
                    const nextSibling = img.nextElementSibling
                    if (nextSibling) {
                        caption = nextSibling.textContent?.trim() || ""
                    }
                }

                // Check parent's aria-label or title
                if (!caption) {
                    const parent = img.parentElement
                    if (parent) {
                        caption =
                            parent.getAttribute("aria-label")?.trim() ||
                            parent.getAttribute("title")?.trim() ||
                            ""
                    }
                }
            }

            // Clamp caption to 160 chars
            if (caption.length > 160) {
                caption = caption.substring(0, 157) + "..."
            }

            captions.push({ src, caption })
        } catch (error) {
            // Skip this image on error
            continue
        }
    }

    return captions
}

/**
 * Core Extraction Logic
 */
async function performExtraction(): Promise<void> {
    // Check rate limiting
    const now = Date.now()
    if (now - lastExtractTime < MIN_EXTRACT_INTERVAL_MS) {
        return
    }

    // Check privacy gates
    const allowed = await isExtractionAllowed()
    if (!allowed) {
        return
    }

    lastExtractTime = now
    lastUrl = window.location.href

    // Extract text and images
    const text = extractText()
    const images = extractImageCaptions()
    const textSizeBytes = getByteSize(text)

    // Cache extraction for potential PageCapture request
    cachedExtraction = {
        text,
        images,
        textSizeBytes
    }

    // Get metadata
    const title = document.title
    const description =
        document
            .querySelector('meta[name="description"]')
            ?.getAttribute("content") || null

    // Send PageSeen message
    const pageSeen: PageSeenMessage = {
        type: "PageSeen",
        url: window.location.href,
        title,
        description,
        ts: now,
        textSizeBytes,
        imageCaptionCount: images.length,
        spa: isSPA(),
        host: window.location.hostname
    }

    try {
        await chrome.runtime.sendMessage(pageSeen)
    } catch (error) {
        console.error("[extract] Error sending PageSeen:", error)
    }
}

/**
 * SPA Detection Heuristic
 */
function isSPA(): boolean {
    // Simple heuristic: check for common SPA frameworks
    const html = document.documentElement.outerHTML.toLowerCase()
    const spaIndicators = [
        "react",
        "vue",
        "angular",
        "ng-app",
        "data-reactroot",
        "data-react-helmet",
        "__next"
    ]

    return spaIndicators.some((indicator) => html.includes(indicator))
}

/**
 * SPA History Hooks
 */
function hookHistory() {
    const pushState = history.pushState
    const replaceState = history.replaceState

    const onUrlChange = () => {
        const newUrl = window.location.href
        if (newUrl !== lastUrl) {
            debouncedSPAExtract()
        }
    }

    history.pushState = function (...args: any[]) {
        const result = pushState.apply(this, args)
        onUrlChange()
        return result
    }

    history.replaceState = function (...args: any[]) {
        const result = replaceState.apply(this, args)
        onUrlChange()
        return result
    }

    window.addEventListener("popstate", onUrlChange)
}

/**
 * DOM Mutation Observer for SPA Content Changes
 */
function observeDOMMutations() {
    let accumulatedTextAdded = 0
    const resetAccumulator = debounce(() => {
        accumulatedTextAdded = 0
    }, 10000) // Reset every 10s

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === "childList") {
                for (const node of Array.from(mutation.addedNodes)) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const text = (node as Element).textContent || ""
                        accumulatedTextAdded += getByteSize(text)
                    }
                }
            }
        }

        // If significant content added (>10KB), trigger re-extract
        if (accumulatedTextAdded > 10_000) {
            accumulatedTextAdded = 0
            debouncedSPAExtract()
        }

        resetAccumulator()
    })

    observer.observe(document.body, {
        childList: true,
        subtree: true
    })
}

/**
 * Message Listener: Handle RequestPageCapture
 */
chrome.runtime.onMessage.addListener(
    (
        message: RequestPageCaptureMessage,
        sender,
        sendResponse: (response: PageCaptureMessage) => void
    ) => {
        if (message.type === "RequestPageCapture") {
            // If we have cached extraction, send it
            if (cachedExtraction) {
                const description =
                    document
                        .querySelector('meta[name="description"]')
                        ?.getAttribute("content") || null

                const pageCapture: PageCaptureMessage = {
                    type: "PageCapture",
                    url: window.location.href,
                    title: document.title,
                    description,
                    ts: Date.now(),
                    text: cachedExtraction.text,
                    textSizeBytes: cachedExtraction.textSizeBytes,
                    images: cachedExtraction.images,
                    version: 1
                }

                sendResponse(pageCapture)
            } else {
                // Perform extraction now and send
                performExtractionAndSendCapture().then(sendResponse)
            }

            return true // Keep channel open for async response
        }
    }
)

async function performExtractionAndSendCapture(): Promise<PageCaptureMessage> {
    const text = extractText()
    const images = extractImageCaptions()
    const textSizeBytes = getByteSize(text)

    // Update cache
    cachedExtraction = {
        text,
        images,
        textSizeBytes
    }

    const description =
        document
            .querySelector('meta[name="description"]')
            ?.getAttribute("content") || null

    return {
        type: "PageCapture",
        url: window.location.href,
        title: document.title,
        description,
        ts: Date.now(),
        text,
        textSizeBytes,
        images,
        version: 1
    }
}

/**
 * Debounced Extraction Functions
 */
const debouncedInitialExtract = debounce(
    performExtraction,
    DEBOUNCE_INITIAL_MS
)
const debouncedSPAExtract = debounce(performExtraction, DEBOUNCE_SPA_MS)

/**
 * Initialization
 */
function init() {
    // Initial extraction after page idle
    debouncedInitialExtract()

    // Hook history for SPA navigation
    hookHistory()

    // Observe DOM mutations for SPA content updates
    observeDOMMutations()
}

// Start on document_idle (Plasmo handles this via run_at config)
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
} else {
    init()
}
