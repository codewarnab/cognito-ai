import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SettingsSectionProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

export function SettingsSection({ title, description, children, defaultOpen = false }: SettingsSectionProps) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <Card>
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base">{title}</CardTitle>
                                {description && <CardDescription>{description}</CardDescription>}
                            </div>
                            <span className="text-muted-foreground text-sm">{open ? "−" : "+"}</span>
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="pt-0">
                        {children}
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
