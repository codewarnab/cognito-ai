import { ExtensionStatus } from '@/components/extension/ExtensionStatus';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start w-full max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight">Cognito AI</h1>
        <p className="text-muted-foreground text-lg">
          Web Application - Settings & Configuration
        </p>

        <ExtensionStatus />

        <nav className="flex flex-col gap-3 w-full mt-4">
          <Link
            href="/onboarding"
            className="px-4 py-3 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
          >
            <span className="font-medium">Onboarding</span>
            <p className="text-sm text-muted-foreground">Get started with Cognito AI</p>
          </Link>
          <Link
            href="/providers"
            className="px-4 py-3 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
          >
            <span className="font-medium">AI Provider Setup</span>
            <p className="text-sm text-muted-foreground">Configure Google AI or Vertex AI credentials</p>
          </Link>
        </nav>
      </main>
    </div>
  );
}

