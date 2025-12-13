
import React, { useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/primitives/popover/Popover";
import { ExternalLink, Github, Twitter, Linkedin, Youtube, Facebook, Instagram, BookOpen, MessageSquare, FileCode, Package, Code2, Globe, Newspaper, Bookmark, Server, Zap, Coffee } from 'lucide-react';
import { ENV } from "@/utils/env";
import { LRUCache } from "@/utils/cache/LRUCache";

interface LinkPreviewProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    href?: string;
    children?: React.ReactNode;
}

interface MetadataResponse {
    title: string | null;
    description: string | null;
    image: string | null;
    siteName: string | null;
    url: string | null;
    type: string | null;
    favicon: string | null;
    publishedTime: string | null;
    author: string | null;
    error?: string;
}

// LRU Cache for metadata with max 100 entries and 30-minute TTL
const metadataCache = new LRUCache<string, MetadataResponse>({
    maxSize: 100,
    ttlMs: 30 * 60 * 1000, // 30 minutes
});
// Track pending requests to prevent duplicate in-flight requests
const pendingRequests = new Map<string, Promise<MetadataResponse | null>>();

// Map of popular domains to their corresponding icons
const siteIcons: Record<string, React.ReactNode> = {
    "github.com": <Github className="w-3.5 h-3.5" />,
    "twitter.com": <Twitter className="w-3.5 h-3.5" />,
    "x.com": <Twitter className="w-3.5 h-3.5" />,
    "linkedin.com": <Linkedin className="w-3.5 h-3.5" />,
    "youtube.com": <Youtube className="w-3.5 h-3.5" />,
    "youtu.be": <Youtube className="w-3.5 h-3.5" />,
    "facebook.com": <Facebook className="w-3.5 h-3.5" />,
    "fb.com": <Facebook className="w-3.5 h-3.5" />,
    "instagram.com": <Instagram className="w-3.5 h-3.5" />,
    "medium.com": <BookOpen className="w-3.5 h-3.5" />,
    "stackoverflow.com": <MessageSquare className="w-3.5 h-3.5" />,
    "reddit.com": <MessageSquare className="w-3.5 h-3.5" />,
    "news.ycombinator.com": <Newspaper className="w-3.5 h-3.5" />,
    "npmjs.com": <Package className="w-3.5 h-3.5" />,
    "vercel.com": <Zap className="w-3.5 h-3.5" />,
    "nextjs.org": <Zap className="w-3.5 h-3.5" />,
    "reactjs.org": <Code2 className="w-3.5 h-3.5" />,
    "react.dev": <Code2 className="w-3.5 h-3.5" />,
    "developer.mozilla.org": <FileCode className="w-3.5 h-3.5" />,
    "mdn.dev": <FileCode className="w-3.5 h-3.5" />,
    "docs.microsoft.com": <FileCode className="w-3.5 h-3.5" />,
    "aws.amazon.com": <Server className="w-3.5 h-3.5" />,
    "cloud.google.com": <Server className="w-3.5 h-3.5" />,
    "azure.microsoft.com": <Server className="w-3.5 h-3.5" />,
    "digitalocean.com": <Server className="w-3.5 h-3.5" />,
    "dev.to": <Code2 className="w-3.5 h-3.5" />,
    "hashnode.com": <Bookmark className="w-3.5 h-3.5" />,
    "codepen.io": <Code2 className="w-3.5 h-3.5" />,
    "codesandbox.io": <Code2 className="w-3.5 h-3.5" />,
    "stackblitz.com": <Code2 className="w-3.5 h-3.5" />,
    "replit.com": <Code2 className="w-3.5 h-3.5" />,
    "kaggle.com": <FileCode className="w-3.5 h-3.5" />,
    "huggingface.co": <FileCode className="w-3.5 h-3.5" />,
    "buymeacoffee.com": <Coffee className="w-3.5 h-3.5" />,
    "patreon.com": <Bookmark className="w-3.5 h-3.5" />,
};

export const LinkPreview: React.FC<LinkPreviewProps> = ({
    href,
    children,
    ...props
}) => {
    const [open, setOpen] = useState(false);
    const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [fetched, setFetched] = useState(false);
    const [hasUsefulData, setHasUsefulData] = useState(false);
    const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

    // Check if the URL is external (not relative)
    const isExternalLink = href?.startsWith("http") || href?.startsWith("https");

    // Extract hostname for fallback display
    let hostname = "";
    try {
        if (href) {
            hostname = new URL(href).hostname.replace("www.", "");
        }
    } catch (e) {
        // Ignore invalid URLs
    }

    // Get icon for the link
    let siteIcon: React.ReactNode = <Globe className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />;
    const icon = siteIcons[hostname];
    if (icon) {
        // Clone element to add custom classes if needed, or just use as is
        // But here we want to match the styling of the fallback Globe
        siteIcon = React.cloneElement(icon as React.ReactElement, {
            className: "w-4 h-4 mt-0.5 shrink-0"
        });
    }

    const fetchMetadata = async () => {
        if (!href || loading) return;

        // Check cache first
        if (metadataCache.has(href)) {
            const cached = metadataCache.get(href)!;
            setMetadata(cached);
            const hasData = !!(cached.title || cached.description || cached.image);
            setHasUsefulData(hasData);
            setFetched(true);
            return;
        }

        // Check if request is already in-flight
        if (pendingRequests.has(href)) {
            try {
                const data = await pendingRequests.get(href);
                if (data) {
                    setMetadata(data);
                    const hasData = !!(data.title || data.description || data.image);
                    setHasUsefulData(hasData);
                }
            } finally {
                setFetched(true);
            }
            return;
        }

        try {
            setLoading(true);

            // Create the fetch promise and store it
            const fetchPromise = (async (): Promise<MetadataResponse | null> => {
                const apiUrl = `${ENV.METADATA_API_URL}?url=${encodeURIComponent(href)}`;
                const response = await fetch(apiUrl);

                if (!response.ok) throw new Error("Failed to fetch");

                const data = await response.json();

                if (!data.error) {
                    // Store in cache
                    metadataCache.set(href, data);
                    return data;
                }
                return null;
            })();

            pendingRequests.set(href, fetchPromise);

            const data = await fetchPromise;
            if (data) {
                setMetadata(data);
                const hasData = !!(data.title || data.description || data.image);
                setHasUsefulData(hasData);
            }
        } catch (error) {
            console.warn("Failed to fetch link metadata:", error);
        } finally {
            pendingRequests.delete(href);
            setFetched(true);
            setLoading(false);
        }
    };

    const handleMouseEnter = () => {
        if (!isExternalLink) return;

        // Add a small delay before showing popover/fetching to avoid flickering on accidental hovers
        const timeout = setTimeout(() => {
            setOpen(true);
            if (!fetched) {
                fetchMetadata();
            }
        }, 300);
        setHoverTimeout(timeout);
    };

    const handleMouseLeave = () => {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            setHoverTimeout(null);
        }
        setOpen(false);
    };

    // If strictly internal or no useful data after fetch, just render normal link
    if (!isExternalLink || (fetched && !hasUsefulData)) {
        return (
            <a
                target="_blank"
                rel="noreferrer"
                href={href}
                className="text-primary hover:underline break-words"
                {...props}
            >
                {children}
            </a>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <a
                    target="_blank"
                    rel="noreferrer"
                    href={href}
                    className="text-primary hover:underline cursor-pointer break-words"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    {...props}
                >
                    {children}
                </a>
            </PopoverTrigger>
            <PopoverContent
                className="w-80 p-0 overflow-hidden bg-background border border-border shadow-xl z-50"
                align="start"
                sideOffset={5}
                onMouseEnter={() => {
                    if (hoverTimeout) clearTimeout(hoverTimeout);
                    setOpen(true);
                }}
                onMouseLeave={() => setOpen(false)}
            >
                {loading ? (
                    <div className="flex items-center justify-center p-6 text-muted-foreground text-sm">
                        <div className="animate-pulse flex flex-col items-center gap-2">
                            <Globe className="w-5 h-5 opacity-50" />
                            <span>Loading preview...</span>
                        </div>
                    </div>
                ) : metadata ? (
                    <div className="flex flex-col">
                        {metadata.image && (
                            <div className="relative w-full h-32 bg-muted overflow-hidden">
                                <img
                                    src={metadata.image}
                                    alt={metadata.title || "Preview"}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                />
                            </div>
                        )}
                        <div className="p-3">
                            <div className="flex items-start gap-2 mb-1">
                                {metadata.favicon ? (
                                    <img
                                        src={metadata.favicon}
                                        alt=""
                                        className="w-4 h-4 mt-0.5 rounded-sm shrink-0"
                                        onError={(e) => { (e.target as HTMLImageElement).src = ""; (e.target as HTMLImageElement).className = "hidden"; }}
                                    />
                                ) : (
                                    siteIcon
                                )}
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm leading-tight text-foreground line-clamp-2">
                                        {metadata.title || hostname}
                                    </h4>
                                    <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                                        <span className="truncate">{metadata.siteName || hostname}</span>
                                        {metadata.publishedTime && (
                                            <>
                                                <span>•</span>
                                                <span className="shrink-0">
                                                    {new Date(metadata.publishedTime).toLocaleDateString()}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {metadata.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                                    {metadata.description}
                                </p>
                            )}

                            <div className="mt-2 pt-2 border-t flex justify-between items-center text-xs text-muted-foreground">
                                <span className="flex items-center gap-1 hover:text-foreground transition-colors">
                                    <ExternalLink className="w-3 h-3" />
                                    {hostname}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : null}
            </PopoverContent>
        </Popover>
    );
};
