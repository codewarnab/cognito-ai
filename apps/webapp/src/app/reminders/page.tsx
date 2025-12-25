'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, Calendar, Copy, Check, Edit2 } from 'lucide-react';
import { Clock } from '@phosphor-icons/react';
import { extensionAPI } from '@/lib/extension-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Reminder } from '@cognito/shared';
import { EditReminderDialog } from '@/components/reminders/EditReminderDialog';
import { ExtensionStatus } from '@/components/extension/ExtensionStatus';
import { useExtension } from '@/hooks/useExtension';
import { Header } from '@/components/shared/Header';

// Example suggestions for creating reminders
const REMINDER_SUGGESTIONS = [
    'Remind me tomorrow at 9am',
    'Take a break in 30 minutes',
];

export default function RemindersPage() {
    const { isInstalled, isLoading: extensionLoading } = useExtension();
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const loadReminders = useCallback(async () => {
        if (!isInstalled) return;

        try {
            setLoading(true);
            const response = await extensionAPI.getReminders();
            if (response.success && response.data) {
                setReminders(response.data);
            }
        } catch (error) {
            console.error('Failed to load reminders', error);
        } finally {
            setLoading(false);
        }
    }, [isInstalled]);

    useEffect(() => {
        if (isInstalled) {
            loadReminders();
        }
    }, [isInstalled, loadReminders]);

    const handleCopySuggestion = async (suggestion: string, index: number) => {
        try {
            await navigator.clipboard.writeText(suggestion);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch (error) {
            console.error('Failed to copy suggestion', error);
        }
    };

    const handleDeleteReminder = async (id: string) => {
        try {
            await extensionAPI.deleteReminder(id);
            await loadReminders();
        } catch (error) {
            console.error('Failed to delete reminder', error);
        }
    };

    const handleEditClick = (reminder: Reminder) => {
        setEditingReminder(reminder);
        setIsEditDialogOpen(true);
    };

    const handleSaveEdit = async (updatedReminder: Reminder) => {
        try {
            if (!editingReminder) return;

            await extensionAPI.updateReminder(updatedReminder.id, {
                title: updatedReminder.title,
                generatedTitle: updatedReminder.generatedTitle,
                generatedDescription: updatedReminder.generatedDescription,
                when: updatedReminder.when,
                repeat: updatedReminder.repeat,
                isPaused: updatedReminder.isPaused,
            });

            await loadReminders();
            setIsEditDialogOpen(false);
            setEditingReminder(null);
        } catch (error) {
            console.error('Failed to update reminder', error);
        }
    };

    const handleDeleteFromDialog = async (id: string) => {
        await handleDeleteReminder(id);
        setIsEditDialogOpen(false);
        setEditingReminder(null);
    };

    const formatDateTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString();

        const timeStr = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });

        if (isToday) {
            return `Today at ${timeStr}`;
        } else if (isTomorrow) {
            return `Tomorrow at ${timeStr}`;
        } else {
            const dateStr = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
            });
            return `${dateStr} at ${timeStr}`;
        }
    };

    if (extensionLoading) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)]">
                <Header title="Reminders" />
                <div className="flex items-center justify-center py-16">
                    <div className="w-10 h-10 border-2 border-white/10 border-t-white/80 rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    if (!isInstalled) {
        return <ExtensionStatus />;
    }

    return (
        <div className="min-h-screen bg-[var(--bg-primary)]">
            <Header title="Reminders" />
            <div className="container mx-auto max-w-2xl py-8 px-4">
                {/* Page Description */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
                        <Clock size={24} weight="duotone" className="text-[var(--blue-stride)]" />
                    </div>
                    <p className="text-[var(--text-secondary)] text-sm">Manage your scheduled reminders</p>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-5">
                        <div className="w-10 h-10 border-2 border-white/10 border-t-white/80 rounded-full animate-spin" />
                        <p className="text-sm text-[var(--text-secondary)]">Loading reminders...</p>
                    </div>
                ) : reminders.length === 0 ? (
                    <Card className="bg-[var(--bg-secondary)] border-[var(--border-color)]">
                        <CardContent className="flex flex-col items-center py-12 gap-5">
                            <Clock size={48} weight="duotone" className="text-[var(--text-tertiary)]" />
                            <div className="text-center">
                                <CardTitle className="text-lg text-[var(--text-primary)] mb-2">No active reminders</CardTitle>
                                <CardDescription className="text-[var(--text-secondary)]">
                                    Ask Cognito to create reminders for you using natural language.
                                    <br />
                                    Try one of these examples to get started:
                                </CardDescription>
                            </div>

                            {/* Suggestions */}
                            <div className="flex flex-col gap-2 w-full max-w-md mt-2">
                                {REMINDER_SUGGESTIONS.map((suggestion, index) => (
                                    <div
                                        key={index}
                                        className="group flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg cursor-pointer transition-all duration-200 hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)]"
                                        onClick={() => handleCopySuggestion(suggestion, index)}
                                    >
                                        <span className="flex-1 text-sm text-[var(--text-secondary)]">
                                            {suggestion}
                                        </span>
                                        <button
                                            className="p-1.5 text-[var(--text-tertiary)] rounded transition-all duration-200 group-hover:text-[var(--text-secondary)] hover:!text-[var(--text-primary)] hover:!bg-[var(--bg-hover)]"
                                            title="Copy to clipboard"
                                        >
                                            {copiedIndex === index ? (
                                                <Check size={14} className="text-green-400" />
                                            ) : (
                                                <Copy size={14} />
                                            )}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="flex flex-col gap-3">
                        {reminders.map((reminder) => (
                            <Card
                                key={reminder.id}
                                className="bg-[var(--bg-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)] transition-all"
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                                                {reminder.generatedTitle || reminder.title}
                                            </h3>
                                            {reminder.generatedDescription && (
                                                <p className="text-sm text-[var(--text-secondary)] mb-2">
                                                    {reminder.generatedDescription}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                                                <Calendar size={14} />
                                                <span>{formatDateTime(reminder.when)}</span>
                                                {reminder.repeat && reminder.repeat !== 'none' && (
                                                    <span className="ml-2 px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px]">
                                                        {reminder.repeat}
                                                    </span>
                                                )}
                                                {reminder.isPaused && (
                                                    <span className="ml-2 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-[10px]">
                                                        Paused
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                                                onClick={() => handleEditClick(reminder)}
                                            >
                                                <Edit2 size={16} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10"
                                                onClick={() => handleDeleteReminder(reminder.id)}
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Reminder Dialog */}
            {editingReminder && (
                <EditReminderDialog
                    isOpen={isEditDialogOpen}
                    reminder={editingReminder}
                    onSave={handleSaveEdit}
                    onDelete={handleDeleteFromDialog}
                    onCancel={() => {
                        setIsEditDialogOpen(false);
                        setEditingReminder(null);
                    }}
                />
            )}
        </div>
    );
}
