import React, { useState, useId } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../../ui/primitives/dialog/Dialog';
import type { Reminder, RepeatFrequency } from '../../../actions/reminder/types';
import { ConfirmDialog } from '../../ui/primitives/dialog/ConfirmDialog';

interface EditReminderDialogProps {
    isOpen: boolean;
    reminder: Reminder;
    onSave: (updatedReminder: Reminder) => void;
    onDelete: (id: string) => void;
    onCancel: () => void;
}

export const EditReminderDialog: React.FC<EditReminderDialogProps> = ({
    isOpen,
    reminder,
    onSave,
    onDelete,
    onCancel,
}) => {
    const [title, setTitle] = useState(reminder.generatedTitle || reminder.title);
    const [description, setDescription] = useState(reminder.generatedDescription || '');

    // Split date and time
    const [repeat, setRepeat] = useState<RepeatFrequency>(reminder.repeat || 'none');
    const [date, setDate] = useState(() => {
        const d = new Date(reminder.when);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    const [time, setTime] = useState(() => {
        const d = new Date(reminder.when);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    });

    const [isPaused, setIsPaused] = useState(reminder.isPaused || false);
    const [error, setError] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const titleId = useId();
    const descriptionId = useId();
    const repeatId = useId();
    const dateId = useId();
    const timeId = useId();

    const handleSave = () => {
        // Validate title
        if (!title.trim()) {
            setError('Name is required.');
            return;
        }

        // Combine date and time
        const dateTimeString = `${date}T${time}`;
        const when = new Date(dateTimeString).getTime();
        const now = Date.now();

        if (isNaN(when) || when <= now) {
            setError('Please select a valid future date and time.');
            return;
        }

        setError('');

        // Create updated reminder
        const updatedReminder: Reminder = {
            ...reminder,
            title: title.trim(),
            generatedTitle: title.trim(),
            generatedDescription: description.trim() || undefined,
            when,
            repeat,
            isPaused,
        };

        onSave(updatedReminder);
    };

    const handleDelete = () => {
        setShowDeleteConfirm(true);
    };

    const handlePause = () => {
        setIsPaused(!isPaused);
    };

    const confirmDelete = () => {
        onDelete(reminder.id);
        setShowDeleteConfirm(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleSave();
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
                <DialogContent className="edit-reminder-dialog" onKeyDown={handleKeyDown}>
                    <DialogHeader>
                        <DialogTitle>Edit Reminder</DialogTitle>
                    </DialogHeader>

                    <div className="edit-reminder-form">
                        {/* Name Field */}
                        <div className="edit-reminder-field">
                            <label htmlFor={titleId}>Name</label>
                            <input
                                id={titleId}
                                type="text"
                                className="edit-reminder-input"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="What should I remind you about?"
                                autoFocus
                            />
                        </div>

                        {/* Instructions Field */}
                        <div className="edit-reminder-field">
                            <label htmlFor={descriptionId}>Instructions</label>
                            <textarea
                                id={descriptionId}
                                className="edit-reminder-textarea"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Add details about this reminder..."
                                rows={3}
                            />
                        </div>

                        {/* When Section - 3 separate fields */}
                        <div className="edit-reminder-field">
                            <label>When</label>
                            <div className="edit-reminder-when-grid">
                                {/* Repeat Dropdown */}
                                <select
                                    id={repeatId}
                                    className="edit-reminder-select"
                                    value={repeat}
                                    onChange={(e) => setRepeat(e.target.value as RepeatFrequency)}
                                >
                                    <option value="none">Doesn't repeat</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="yearly">Yearly</option>
                                </select>

                                {/* Date Picker */}
                                <input
                                    id={dateId}
                                    type="date"
                                    className="edit-reminder-input edit-reminder-date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />

                                {/* Time Picker */}
                                <input
                                    id={timeId}
                                    type="time"
                                    className="edit-reminder-input edit-reminder-time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="edit-reminder-error" role="alert" aria-live="polite">
                                {error}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <div className="edit-reminder-actions">
                            <div className="edit-reminder-actions-left">
                                <button
                                    type="button"
                                    className={`edit-reminder-btn edit-reminder-btn-pause ${isPaused ? 'paused' : ''}`}
                                    onClick={handlePause}
                                    title={isPaused ? 'Resume reminder' : 'Pause reminder'}
                                >
                                    {isPaused ? 'Resume' : 'Pause'}
                                </button>
                                <button
                                    type="button"
                                    className="edit-reminder-btn edit-reminder-btn-delete"
                                    onClick={handleDelete}
                                >
                                    Delete
                                </button>
                            </div>
                            <div className="edit-reminder-actions-right">
                                <button
                                    type="button"
                                    className="edit-reminder-btn edit-reminder-btn-cancel"
                                    onClick={onCancel}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="edit-reminder-btn edit-reminder-btn-save"
                                    onClick={handleSave}
                                    disabled={!title.trim()}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Delete Reminder?"
                message="Are you sure you want to delete this reminder? This action cannot be undone."
                confirmLabel="Delete"
                cancelLabel="Cancel"
                onConfirm={confirmDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                variant="danger"
            />
        </>
    );
};
