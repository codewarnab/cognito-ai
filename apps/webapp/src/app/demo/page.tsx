"use client";

import {
  ChatCircle,
  GearSix,
  MagnifyingGlass,
  SpeakerHigh,
  Sparkle,
  Lightning,
} from "@phosphor-icons/react";
import { AnimatedTabs, type AnimatedTab } from "@/components/ui/animated-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/shared/Header";

export default function DemoPage() {
  const tabs: AnimatedTab[] = [
    {
      name: "AI Chat",
      icon: <ChatCircle size={18} weight="duotone" />,
      content: (
        <Card className="border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[var(--text-primary)]">
              <Sparkle size={20} weight="fill" className="text-[var(--green-pulse)]" />
              AI Chat Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[var(--text-secondary)]">
            Configure your AI conversation preferences, model selection, and context settings.
          </CardContent>
        </Card>
      ),
    },
    {
      name: "Search",
      icon: <MagnifyingGlass size={18} weight="duotone" />,
      content: (
        <Card className="border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[var(--text-primary)]">
              <MagnifyingGlass size={20} weight="fill" className="text-[var(--blue-stride)]" />
              Web Search
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[var(--text-secondary)]">
            Configure search providers and API keys for web research capabilities.
          </CardContent>
        </Card>
      ),
    },
    {
      name: "Voice",
      icon: <SpeakerHigh size={18} weight="duotone" />,
      content: (
        <Card className="border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[var(--text-primary)]">
              <SpeakerHigh size={20} weight="fill" className="text-purple-400" />
              Voice & Audio
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[var(--text-secondary)]">
            Customize text-to-speech voice settings and audio preferences.
          </CardContent>
        </Card>
      ),
    },
    {
      name: "Features",
      icon: <Lightning size={18} weight="duotone" />,
      content: (
        <Card className="border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[var(--text-primary)]">
              <Lightning size={20} weight="fill" className="text-yellow-400" />
              Features
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[var(--text-secondary)]">
            Toggle and configure AI-powered writing, summarization, and rewriting tools.
          </CardContent>
        </Card>
      ),
    },
    {
      name: "Settings",
      icon: <GearSix size={18} weight="duotone" />,
      content: (
        <Card className="border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[var(--text-primary)]">
              <GearSix size={20} weight="fill" className="text-gray-400" />
              Advanced Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[var(--text-secondary)]">
            Manage data, supermemory integration, and advanced system settings.
          </CardContent>
        </Card>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Header title="Animated Tabs Demo" />

      <div className="container mx-auto max-w-4xl py-8 px-4">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            Animated Tab Component
          </h2>
          <p className="text-[var(--text-secondary)]">
            Smooth spring-based transitions with icons and sliding indicator.
          </p>
        </div>

        <AnimatedTabs tabs={tabs} />
      </div>
    </div>
  );
}
