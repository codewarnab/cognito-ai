import Link from "next/link"
import { FileQuestion } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty"

export default function NotFound() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Empty className="border-none">
                <EmptyMedia variant="icon">
                    <FileQuestion className="size-5" />
                </EmptyMedia>
                <EmptyHeader>
                    <EmptyTitle>404 - Page Not Found</EmptyTitle>
                    <EmptyDescription>
                        The page you&apos;re looking for doesn&apos;t exist or has been moved.
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button asChild>
                        <Link href="/">Go back home</Link>
                    </Button>
                </EmptyContent>
            </Empty>
        </div>
    )
}
