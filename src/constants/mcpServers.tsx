import React from "react"
import { Globe, Workflow, Download, LucideSearch } from "lucide-react"
import { Ahrefs } from "../../assets/Ahrefs"
import { Astro } from "../../assets/astro-docs"
import { HuggingFace } from "../../assets/huggingface"
import { Linear } from "../../assets/linear"
import { Netlify } from "../../assets/Netlify"
import { Notion } from "../../assets/notion"
import { PayPal } from "../../assets/paypal"
import { Sentry } from "../../assets/sentry"
import { Supabase } from "../../assets/supabase"
import { Webflow } from "../../assets/webflow"
import deepwikiImage from "../../assets/deepwiki.webp"
import coingeckoImage from "../../assets/coingecko.webp"
import context7Image from "../../assets/context7.png"

export interface ServerConfig {
    id: string
    name: string
    icon: React.ReactNode
    initialEnabled?: boolean
    initialAuthenticated?: boolean
    url?: string
    description: string
    requiresAuthentication: boolean
    paid?: boolean

    // OAuth configuration (optional - will use discovery if not provided)
    oauth?: {
        discoveryHints?: {
            registrationEndpoint?: string  // Hint for faster registration
            authorizationEndpoint?: string
            tokenEndpoint?: string
        }
        scopes?: string[]  // Default scopes to request
        resource?: string  // RFC 8707 resource parameter
        audience?: string  // Expected token audience (if different from resource)
    }
}

export const MCP_SERVERS: ServerConfig[] = [
    {   // working 
        id: "ahrefs",
        name: "Ahrefs",
        icon: <Ahrefs />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://api.ahrefs.com/mcp/mcp",
        description: "Ahrefs is an SEO platform for website analysis and keyword research.",
        requiresAuthentication: true
    },
    // { 
    // apply to allowlist at http://developers.asana.com/docs/integrating-with-asanas-mcp-server#why-do-we-have-an-allowlist
    // id: "asana",
    // name: "Asana",
    // icon: <Asana />,
    // initialEnabled: false,
    // initialAuthenticated: false,
    // url: "https://mcp.asana.com/sse",
    // description: "Asana is a project management tool for teams.",
    // requiresAuthentication: true
    //},
    {
        id: "astro-docs",
        name: "Astro Docs",
        icon: <Astro />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://mcp.docs.astro.build/mcp",
        description: "Astro is a static site builder for the modern web.",
        requiresAuthentication: false
    },
    // {
    //     id: "atlassian",
    //     name: "Atlassian",
    //     icon: <Atlassian />,
    //     initialEnabled: false,
    //     initialAuthenticated: false,
    //     url: "https://mcp.atlassian.com/v1/sse",
    //     description: "Atlassian is a project management tool for teams.",
    //     requiresAuthentication: true
    // },
    // { // failed to launch auth flow  need to debug more or raise an issue in github     //     id: "canva",
    //     name: "Canva",
    //     icon: <Canva />,
    //     initialEnabled: false,
    //     initialAuthenticated: false,
    //     url: "https://mcp.canva.com/mcp",
    //     description: "Canva is a design tool for creating beautiful designs.",
    //     requiresAuthentication: true
    // },
    // { apply for mcp client at https://forum.figma.com/report-a-problem-6/remote-mcp-server-oauth-client-registration-issue-45936 and https://form.asana.com/?k=kBG-ejRQTdY8x_H6a4vM3Q&d=10497086658021
    //     id: "figma",
    //     name: "Figma",
    //     icon: <Figma />,
    //     initialEnabled: false,
    //     initialAuthenticated: false,
    //     url: "https://mcp.figma.com/mcp",
    //     description: "Figma is a design tool for creating beautiful designs.",
    //     requiresAuthentication: true
    // },
    // {
    //     id: "github",
    //     name: "GitHub",
    //     icon: <GitHub />,
    //     initialEnabled: false,
    //     initialAuthenticated: false,
    //     url: "https://api.githubcopilot.com/mcp/",
    //     description: "GitHub is a code hosting platform for version control and collaboration.",
    //     requiresAuthentication: true
    // },
    {
        id: "huggingface",
        name: "Hugging Face",
        icon: <HuggingFace />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://hf.co/mcp",
        description: "Hugging Face is a platform for building and sharing machine learning models.",
        requiresAuthentication: false
    },
    { // worked 
        id: "linear",
        name: "Linear",
        icon: <Linear />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://mcp.linear.app/sse",
        description: "Linear is a project management tool for teams.",
        requiresAuthentication: true
    },
    { // working 
        id: "netlify",
        name: "Netlify",
        icon: <Netlify />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://netlify-mcp.netlify.app/mcp",
        description: "Netlify is a platform for building and deploying websites.",
        requiresAuthentication: true
    },
    { // working 
        id: "notion",
        name: "Notion",
        icon: <Notion />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://mcp.notion.com/mcp",
        description: "Notion is a project management tool for teams.",
        requiresAuthentication: true
    },
    {
        id: "context7",
        name: "Context7",
        icon: <img src={context7Image} alt="Context7" style={{ width: 24, height: 24 }} />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://mcp.context7.com/mcp",
        description: "Up-to-date code documentation for LLMs and AI code editors",
        requiresAuthentication: false
    },
    { // working 
        id: "paypal",
        name: "PayPal",
        icon: <PayPal />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://mcp.paypal.com/sse",
        description: "PayPal is a payment platform for online transactions.",
        requiresAuthentication: true
    },
    { //  working 
        id: "sentry",
        name: "Sentry",
        icon: <Sentry />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://mcp.sentry.dev/sse",
        description: "Sentry is an error tracking platform for monitoring and logging errors.", requiresAuthentication: true
    },
    // { // does not support dynamic client registartion 
    //     id: "stripe",
    //     name: "Stripe",
    //     icon: <Stripe />,
    //     initialEnabled: false,
    //     initialAuthenticated: false,
    //     url: "https://api.stripe.com",
    //     description: "Stripe is a payment platform for online transactions.",
    //     requiresAuthentication: true
    // },
    { // working 
        id: "supabase",
        name: "Supabase",
        icon: <Supabase />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://mcp.supabase.com/mcp",
        description: "Supabase is a database platform for building web applications.",
        requiresAuthentication: true
    },
    //{ not approved by them ( maybe find form or reach out to them )    //     id: "vercel",
    //     name: "Vercel",
    //     icon: <Vercel />,
    //     initialEnabled: false,
    //     initialAuthenticated: false,
    //     url: "https://mcp.vercel.com/mcp",
    //     description: "Vercel is a platform for building and deploying websites.",
    //     requiresAuthentication: true
    // },
    { // working 
        id: "webflow",
        name: "Webflow",
        icon: <Webflow />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://mcp.webflow.com/sse",
        description: "Webflow is a platform for building and deploying websites.",
        requiresAuthentication: true
    },
    {
        id: "deepwiki",
        name: "DeepWiki",
        icon: <img src={deepwikiImage} alt="DeepWiki" style={{ width: 24, height: 24 }} />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://mcp.deepwiki.com/mcp",
        description: "DeepWiki automatically generates architecture diagrams, documentation, and links to source code to help you understand unfamiliar codebases quickly.",
        requiresAuthentication: false
    },
    {
        id: "coingecko",
        name: "CoinGecko",
        icon: <img src={coingeckoImage} alt="CoinGecko" style={{ width: 24, height: 24 }} />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://mcp.api.coingecko.com/sse",
        description: "CoinGecko provides real-time cryptocurrency data and market information.",
        requiresAuthentication: false
    },
    {
        id: "fetch",
        name: "Fetch",
        icon: <Download className="w-6 h-6" />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://remote.mcpservers.org/fetch/mcp",
        description: "An MCP server that provides web content fetching capabilities. This server enables LLMs to retrieve and process content from web pages, converting HTML to markdown for easier consumption.",
        requiresAuthentication: false
    },
    {
        id: "sequentialthinking",
        name: "Sequential Thinking",
        icon: <Workflow className="w-6 h-6" />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://remote.mcpservers.org/sequentialthinking/mcp",
        description: "An MCP server implementation that provides a tool for dynamic and reflective problem-solving through a structured thinking process.",
        requiresAuthentication: false
    },
    {
        id: "edgeone-pages",
        name: "EdgeOne Pages",
        icon: <Globe className="w-6 h-6" />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://remote.mcpservers.org/edgeone-pages/mcp",
        description: "An MCP service designed for deploying HTML content to EdgeOne Pages and obtaining an accessible public URL.",
        requiresAuthentication: false
    },
    {
        id: "parallel-search-mcp",
        name: "Parallel Search MCP",
        description: "Highly accurate deep search and batch tasks",
        url: "https://task-mcp.parallel.ai/mcp",
        icon: <LucideSearch className="w-6 h-6" />,
        requiresAuthentication: true,
        initialEnabled: false,
        initialAuthenticated: false,
        paid: true
    }
]
