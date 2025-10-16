import React from "react"
import { Ahrefs } from "../../assets/Ahrefs"
import { Asana } from "../../assets/Asana"
import { Astro } from "../../assets/astro-docs"
import { Atlassian } from "../../assets/Atlassian"
import { Canva } from "../../assets/canva"
import { Figma } from "../../assets/figma"
import { GitHub } from "../../assets/github"
import { HuggingFace } from "../../assets/huggingface"
import { Linear } from "../../assets/linear"
import { Netlify } from "../../assets/Netlify"
import { Notion } from "../../assets/notion"
import { PayPal } from "../../assets/paypal"
import { Sentry } from "../../assets/sentry"
import { Stripe } from "../../assets/stripe"
import { Supabase } from "../../assets/supabase"
import { Vercel } from "../../assets/vercel"
import { Webflow } from "../../assets/webflow"

export interface ServerConfig {
    id: string
    name: string
    icon: React.ReactNode
    initialEnabled?: boolean
    initialAuthenticated?: boolean
    url?: string
}

export const MCP_SERVERS: ServerConfig[] = [
    {
        id: "ahrefs",
        name: "Ahrefs",
        icon: <Ahrefs />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://api.ahrefs.com"
    },
    {
        id: "asana",
        name: "Asana",
        icon: <Asana />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://api.asana.com"
    },
    {
        id: "astro-docs",
        name: "Astro Docs",
        icon: <Astro />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://docs.astro.build"
    },
    {
        id: "atlassian",
        name: "Atlassian",
        icon: <Atlassian />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://api.atlassian.com"
    },
    {
        id: "canva",
        name: "Canva",
        icon: <Canva />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://api.canva.com"
    },
    {
        id: "figma",
        name: "Figma",
        icon: <Figma />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://api.figma.com"
    },
    {
        id: "github",
        name: "GitHub",
        icon: <GitHub />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://api.github.com"
    },

    {
        id: "huggingface",
        name: "Hugging Face",
        icon: <HuggingFace />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://huggingface.co"
    },
    {
        id: "linear",
        name: "Linear",
        icon: <Linear />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://api.linear.app"
    },
    {
        id: "netlify",
        name: "Netlify",
        icon: <Netlify />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://api.netlify.com"
    },
    {
        id: "notion",
        name: "Notion",
        icon: <Notion />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://api.notion.com"
    },
    {
        id: "paypal",
        name: "PayPal",
        icon: <PayPal />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://api.paypal.com"
    },
    {
        id: "sentry",
        name: "Sentry",
        icon: <Sentry />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://sentry.io/api"
    },
    {
        id: "stripe",
        name: "Stripe",
        icon: <Stripe />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://api.stripe.com"
    },
    {
        id: "supabase",
        name: "Supabase",
        icon: <Supabase />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://supabase.com"
    },
    {
        id: "vercel",
        name: "Vercel",
        icon: <Vercel />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://api.vercel.com"
    },
    {
        id: "webflow",
        name: "Webflow",
        icon: <Webflow />,
        initialEnabled: false,
        initialAuthenticated: false,
        url: "https://api.webflow.com"
    }
]
