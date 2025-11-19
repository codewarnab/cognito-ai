import React, { useState, useEffect } from 'react';
import { X, Clock, Trash2, Calendar } from 'lucide-react';
import { getActiveReminders, deleteReminder } from '../../../actions/reminder/storage';
import type { Reminder } from '../../../actions/reminder/types';
import { createLogger } from '@logger';

const log = createLogger('ReminderPanel');

interface ReminderPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

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
            setReminders(activeReminders);
            log.info('Loaded active reminders', { count: activeReminders.length });
        } catch (error) {
            log.error('Failed to load reminders', error);
        } finally {
            setLoading(false);
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
        <>
            {/* Backdrop */}
            <div className="thread-sidepanel-backdrop" onClick={onClose} />

            {/* Side Panel */}
            <div className="thread-sidepanel reminder-panel">
                {/* Header */}
                <div className="thread-sidepanel-header">
                    <div className="thread-sidepanel-header-content">
                        <Clock size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
                        <h2 className="thread-sidepanel-title">Reminders</h2>
                    </div>
                    <button
                        className="thread-sidepanel-close"
                        onClick={onClose}
                        aria-label="Close reminders panel"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="thread-sidepanel-content">
                    {loading ? (
                        <div className="reminder-panel-loading">
                            <div className="spinner" />
                            <p>Loading reminders...</p>
                        </div>
                    ) : reminders.length === 0 ? (
                        <div className="reminder-panel-empty">
                            <Clock size={56} strokeWidth={1.5} />
                            <p>No active reminders</p>
                            <span className="reminder-panel-empty-hint">
                                Ask the AI assistant to create a reminder and it will appear here
                            </span>
                        </div>
                    ) : (
                        <div className="reminder-panel-list">
                            {reminders.map((reminder) => (
                                <div key={reminder.id} className="reminder-panel-item">
                                    <div className="reminder-panel-item-content">
                                        <div className="reminder-panel-item-header">
                                            <h3 className="reminder-panel-item-title">
                                                {reminder.generatedTitle || reminder.title}
                                            </h3>
                                            <button
                                                className="reminder-panel-delete-btn"
                                                onClick={() => handleDeleteReminder(reminder.id)}
                                                title="Delete reminder"
                                                aria-label="Delete reminder"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        {reminder.generatedDescription && (
                                            <p className="reminder-panel-item-description">
                                                {reminder.generatedDescription}
                                            </p>
                                        )}

                                        <div className="reminder-panel-item-time">
                                            <Calendar size={14} />
                                            <span>{formatDateTime(reminder.when)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
