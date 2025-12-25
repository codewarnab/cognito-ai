'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Trash2, Calendar, Copy, Check, Edit2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { extensionAPI } from '@/lib/extension-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Reminder } from '@cognito/shared';
import { EditReminderDialog } from '@/components/reminders/EditReminderDialog';
import { ExtensionStatus } from '@/components/extension/ExtensionStatus';
import { useExtension } from '@/hooks/useExtension';

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
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-white/10 border-t-white/80 rounded-full animate-spin" />
            </div>
        );
    }

    if (!isInstalled) {
        return <ExtensionStatus />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
            <div className="container mx-auto max-w-3xl px-4 py-12">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-6"
                    >
                        <ArrowLeft size={16} />
                        <span className="text-sm">Back to Home</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl">
                            <Clock size={24} className="text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Reminders</h1>
                            <p className="text-white/60 text-sm">Manage your scheduled reminders</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-5">
                        <div className="w-10 h-10 border-2 border-white/10 border-t-white/80 rounded-full animate-spin" />
                        <p className="text-sm text-white/60">Loading reminders...</p>
                    </div>
                ) : reminders.length === 0 ? (
                    <Card className="bg-white/[0.03] border-white/[0.06]">
                        <CardContent className="flex flex-col items-center py-12 gap-5">
                            <Clock size={48} className="text-white/25" />
                            <div className="text-center">
                                <CardTitle className="text-lg text-white/90 mb-2">No active reminders</CardTitle>
                                <CardDescription className="text-white/50">
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
                                        className="group flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/[0.06] hover:border-white/[0.1]"
                                        onClick={() => handleCopySuggestion(suggestion, index)}
                                    >
                                        <span className="flex-1 text-sm text-white/70">
                                            {suggestion}
                                        </span>
                                        <button
                                            className="p-1.5 text-white/30 rounded transition-all duration-200 group-hover:text-white/60 hover:!text-white hover:!bg-white/10"
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
                                className="bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all"
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <h3 className="text-sm font-semibold text-white mb-1">
                                                {reminder.generatedTitle || reminder.title}
                                            </h3>
                                            {reminder.generatedDescription && (
                                                <p className="text-sm text-white/70 mb-2">
                                                    {reminder.generatedDescription}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-1.5 text-xs text-white/50">
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
                                                className="h-8 w-8 p-0 text-white/40 hover:text-white hover:bg-white/10"
                                                onClick={() => handleEditClick(reminder)}
                                            >
                                                <Edit2 size={16} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-white/40 hover:text-red-400 hover:bg-red-500/10"
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
