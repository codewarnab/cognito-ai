import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ExternalLink, Calendar } from 'lucide-react';
import { ClockIcon } from '../../../../assets/icons/chat/clock';
import { getActiveReminders } from '../../../actions/reminder/storage';
import type { Reminder } from '../../../actions/reminder/types';
import { createLogger } from '~logger';
import { openWebappRoute } from '@/constants/webapp';

const log = createLogger('ReminderPanel', 'UI_REMINDERS');

interface ReminderPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Simplified ReminderPanel that shows a quick preview and redirects to webapp for full management.
 */
export const ReminderPanel: React.FC<ReminderPanelProps> = ({ isOpen, onClose }) => {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);

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
            setReminders(activeReminders.slice(0, 3)); // Show only first 3
            log.info('Loaded active reminders preview', { count: activeReminders.length });
        } catch (error) {
            log.error('Failed to load reminders', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenWebapp = () => {
        openWebappRoute('REMINDERS');
        onClose();
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
                        className="fixed inset-y-0 left-0 w-[320px] max-w-[320px] min-w-[320px] bg-[#0a0e1a] border-r border-white/[0.08] z-[1001] flex flex-col shadow-[-4px_0_20px_rgba(0,0,0,0.3)]"
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
                        <div className="flex-1 overflow-y-auto p-4">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-[60px] px-6 gap-5 text-white/60">
                                    <div className="w-10 h-10 border-2 border-white/10 border-t-white/80 rounded-full animate-spin" />
                                    <p className="text-sm text-white/60 font-normal m-0">Loading reminders...</p>
                                </div>
                            ) : reminders.length === 0 ? (
                                <div className="flex flex-col items-center py-8 px-5 gap-5">
                                    <div className="flex flex-col items-center gap-3 text-center">
                                        <ClockIcon size={48} className="text-white/25" />
                                        <p className="text-sm font-medium m-0 text-white/90">No active reminders</p>
                                        <span className="text-[13px] text-white/50 leading-relaxed">
                                            Create reminders by asking Cognito in chat
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {/* Quick preview of reminders */}
                                    {reminders.map((reminder) => (
                                        <div key={reminder.id} className="bg-[#1e2332]/80 border border-white/[0.08] rounded-lg p-3">
                                            <h3 className="text-[13px] font-medium text-white m-0 mb-1.5 line-clamp-1">
                                                {reminder.generatedTitle || reminder.title}
                                            </h3>
                                            <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                                                <Calendar size={12} />
                                                <span>{formatDateTime(reminder.when)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer with manage button */}
                        <div className="p-4 border-t border-white/[0.08]">
                            <button
                                onClick={handleOpenWebapp}
                                className="w-full flex items-center justify-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-blue-500/20 hover:border-blue-500/50"
                            >
                                <span>Manage All Reminders</span>
                                <ExternalLink size={14} />
                            </button>
                            <p className="text-[11px] text-white/40 text-center mt-2 m-0">
                                Opens in the Cognito webapp
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
