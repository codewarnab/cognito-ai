import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Trash2, Calendar, Copy, Check } from 'lucide-react';
import { ClockIcon } from '../../../../assets/icons/chat/clock';
import { getActiveReminders, deleteReminder } from '../../../actions/reminder/storage';
import { updateReminderWithAlarm } from '../../../actions/reminder/utils';
import type { Reminder } from '../../../actions/reminder/types';
import { createLogger } from '~logger';
import { EditReminderDialog } from './EditReminderDialog';
import { SquarePenIcon } from '../../shared/icons/SquarePenIcon';

const log = createLogger('ReminderPanel');

// Example suggestions for creating reminders
const REMINDER_SUGGESTIONS = [
    "Remind me tomorrow at 9am",
    "Take a break in 30 minutes",
];

interface ReminderPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ReminderPanel: React.FC<ReminderPanelProps> = ({ isOpen, onClose }) => {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // Load reminders when panel opens
    useEffect(() => {
        if (isOpen) {
            loadReminders();
        }
    }, [isOpen]);

    const loadReminders = async () => {
        try {
            setLoading(true);
            const activeReminders = await getActiveReminders();
            setReminders(activeReminders);
            log.info('Loaded active reminders', { count: activeReminders.length });
        } catch (error) {
            log.error('Failed to load reminders', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCopySuggestion = async (suggestion: string, index: number) => {
        try {
            await navigator.clipboard.writeText(suggestion);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch (error) {
            log.error('Failed to copy suggestion', error);
        }
    };

    const handleDeleteReminder = async (id: string) => {
        try {
            // Cancel the alarm
            await chrome.alarms.clear(`reminder:${id}`);

            // Delete from storage
            await deleteReminder(id);

            log.info('Deleted reminder', { id });

            // Reload the list
            await loadReminders();
        } catch (error) {
            log.error('Failed to delete reminder', error);
        }
    };

    const handleEditClick = (reminder: Reminder) => {
        setEditingReminder(reminder);
        setIsEditDialogOpen(true);
    };

    const handleSaveEdit = async (updatedReminder: Reminder) => {
        try {
            if (!editingReminder) return;

            // Use the utility function to update reminder and reschedule alarm
            await updateReminderWithAlarm(
                updatedReminder.id,
                editingReminder,
                {
                    title: updatedReminder.title,
                    generatedTitle: updatedReminder.generatedTitle,
                    generatedDescription: updatedReminder.generatedDescription,
                    when: updatedReminder.when,
                    repeat: updatedReminder.repeat,
                    isPaused: updatedReminder.isPaused,
                }
            );

            log.info('Updated reminder successfully', { id: updatedReminder.id });

            // Reload the list
            await loadReminders();

            // Close dialog
            setIsEditDialogOpen(false);
            setEditingReminder(null);
        } catch (error) {
            log.error('Failed to update reminder', error);
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
            hour12: true
        });

        if (isToday) {
            return `Today at ${timeStr}`;
        } else if (isTomorrow) {
            return `Tomorrow at ${timeStr}`;
        } else {
            const dateStr = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
            return `${dateStr} at ${timeStr}`;
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 bg-black/50 z-[1000] backdrop-blur-[4px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                    />

                    {/* Side Panel */}
                    <motion.div
                        className="fixed inset-y-0 left-0 w-[320px] max-w-[320px] min-w-[320px] bg-[#0a0e1a] border-r border-white/[0.08] z-[1001] flex flex-col shadow-[-4px_0_20px_rgba(0,0,0,0.3)] md:w-[60%] md:max-w-[350px] md:min-w-[280px] sm:!w-screen sm:!max-w-[100vw] sm:!min-w-[100vw]"
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-[20px_20px_16px] border-b border-white/[0.08] bg-[#0a0e1a]">
                            <div className="flex items-center gap-2.5">
                                <ClockIcon size={18} className="shrink-0 text-white" />
                                <h2 className="m-0 text-xl font-semibold text-white leading-[1.2]">Reminders</h2>
                            </div>
                            <button
                                className="flex items-center justify-center p-2 bg-transparent border-none text-[#888] cursor-pointer rounded-md transition-all duration-200 hover:bg-white/5 hover:text-white"
                                onClick={onClose}
                                aria-label="Close reminders panel"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-0">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-[60px] px-6 gap-5 text-white/60">
                                    <div className="w-10 h-10 border-2 border-white/10 border-t-white/80 rounded-full animate-spin" />
                                    <p className="text-sm text-white/60 font-normal m-0 font-sans">Loading reminders...</p>
                                </div>
                            ) : reminders.length === 0 ? (
                                <div className="flex flex-col items-center py-8 px-5 gap-5">
                                    <div className="flex flex-col items-center gap-3 text-center">
                                        <ClockIcon size={48} className="text-white/25" />
                                        <p className="text-sm font-medium m-0 text-white/90 font-sans">No active reminders</p>
                                        <span className="text-[13px] text-white/50 leading-relaxed font-sans font-normal">
                                            Try one of these examples to get started
                                        </span>
                                    </div>

                                    {/* Suggestions */}
                                    <div className="flex flex-col gap-2 w-full mt-2">
                                        {REMINDER_SUGGESTIONS.map((suggestion, index) => (
                                            <div
                                                key={index}
                                                className="group flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/[0.06] hover:border-white/[0.1]"
                                                onClick={() => handleCopySuggestion(suggestion, index)}
                                            >
                                                <span className="flex-1 text-[13px] text-white/70 leading-snug font-sans">
                                                    {suggestion}
                                                </span>
                                                <button
                                                    className="flex items-center justify-center p-1.5 bg-transparent border-none text-white/30 cursor-pointer rounded transition-all duration-200 group-hover:text-white/60 hover:!text-white hover:!bg-white/10"
                                                    title="Copy to clipboard"
                                                    aria-label="Copy suggestion"
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
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 p-4">
                                    {reminders.map((reminder) => (
                                        <div key={reminder.id} className="bg-[#1e2332]/80 border border-white/[0.08] rounded-xl px-4 pt-[14px] pb-10 transition-all duration-200 relative overflow-visible hover:bg-[#232837]/90 hover:border-white/[0.12]">
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-start justify-between gap-3 mb-1.5">
                                                    <h3 className="text-[13px] font-semibold text-white m-0 flex-1 leading-snug tracking-[-0.01em] font-sans">
                                                        {reminder.generatedTitle || reminder.title}
                                                    </h3>
                                                    <button
                                                        className="bg-transparent border-none px-1.5 py-0.5 cursor-pointer text-white/40 rounded transition-all duration-200 flex items-center justify-center shrink-0 hover:bg-red-500/10 hover:text-[#ff4444]"
                                                        onClick={() => handleDeleteReminder(reminder.id)}
                                                        title="Delete reminder"
                                                        aria-label="Delete reminder"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>

                                                {reminder.generatedDescription && (
                                                    <p className="text-[13px] text-white/80 m-0 mb-2 leading-snug font-sans font-normal">
                                                        {reminder.generatedDescription}
                                                    </p>
                                                )}

                                                <div className="inline-flex items-center gap-1.5 text-[11px] text-white/50 font-normal py-0.5 w-fit font-sans">
                                                    <Calendar size={14} />
                                                    <span>{formatDateTime(reminder.when)}</span>
                                                </div>
                                            </div>

                                            {/* Edit button positioned at right bottom */}
                                            <button
                                                className="absolute bottom-[14px] right-4 bg-transparent border-none p-1.5 cursor-pointer text-white/40 rounded transition-all duration-200 flex items-center justify-center hover:bg-white/10 hover:text-white"
                                                onClick={() => handleEditClick(reminder)}
                                                title="Edit reminder"
                                                aria-label="Edit reminder"
                                            >
                                                <SquarePenIcon size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}

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
        </AnimatePresence>
    );
};
