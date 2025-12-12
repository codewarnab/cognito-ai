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
                <DialogContent className="w-[calc(100vw-2rem)] max-w-[380px] sm:max-w-[400px] !bg-[#1a1f2e] !rounded-xl !z-[10000] p-4 flex flex-col overflow-hidden outline-none" onKeyDown={handleKeyDown}>
                    <DialogHeader className="pb-3 border-b border-white/[0.06] mb-0 space-y-0 text-left">
                        <DialogTitle className="text-base font-semibold text-white">Edit Reminder</DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col gap-3.5 py-3.5 overflow-y-auto flex-[1_1_auto] min-h-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-sm">
                        {/* Name Field */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor={titleId} className="text-xs font-medium text-white/70">Name</label>
                            <input
                                id={titleId}
                                type="text"
                                className="w-full px-2.5 py-2 bg-white/5 border border-white/[0.08] rounded-lg text-white text-[13px] transition-all duration-150 box-border focus:outline-none focus:border-[#6496ff]/35 focus:bg-white/[0.07] placeholder:text-white/25"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="What should I remind you about?"
                                autoFocus
                            />
                        </div>

                        {/* Instructions Field */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor={descriptionId} className="text-xs font-medium text-white/70">Instructions</label>
                            <textarea
                                id={descriptionId}
                                className="w-full px-2.5 py-2 bg-white/5 border border-white/[0.08] rounded-lg text-white text-[13px] transition-all duration-150 box-border focus:outline-none focus:border-[#6496ff]/35 focus:bg-white/[0.07] placeholder:text-white/25 min-h-[56px] max-h-[100px] resize-none leading-[1.4]"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Add details about this reminder..."
                                rows={3}
                            />
                        </div>

                        {/* When Section - 3 separate fields */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-white/70">When</label>
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-2">
                                {/* Repeat Dropdown */}
                                <select
                                    id={repeatId}
                                    className="w-full px-2.5 py-2 bg-white/5 border border-white/[0.08] rounded-lg text-white text-[13px] transition-all duration-150 box-border focus:outline-none focus:border-[#6496ff]/35 focus:bg-white/[0.07] appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%2210%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23888%22%20d%3D%22M6%209L1%204h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center] pr-7 cursor-pointer sm:col-span-full"
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
                                    className="w-full px-2.5 py-2 bg-white/5 border border-white/[0.08] rounded-lg text-white text-[13px] transition-all duration-150 box-border focus:outline-none focus:border-[#6496ff]/35 focus:bg-white/[0.07] text-xs min-w-0 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />

                                {/* Time Picker */}
                                <input
                                    id={timeId}
                                    type="time"
                                    className="w-full px-2.5 py-2 bg-white/5 border border-white/[0.08] rounded-lg text-white text-[13px] transition-all duration-150 box-border focus:outline-none focus:border-[#6496ff]/35 focus:bg-white/[0.07] text-xs min-w-0 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="text-red-400 text-[11px] -mt-1" role="alert" aria-live="polite">
                                {error}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="shrink-0 mt-0 pt-0 sm:justify-between">
                        <div className="flex justify-between items-center gap-2 pt-3.5 border-t border-white/[0.06] flex-nowrap sm:gap-1.5 w-full">
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                    type="button"
                                    className={`inline-flex items-center justify-center px-3 py-[7px] rounded-md text-xs font-medium cursor-pointer transition-all duration-150 border h-8 box-border sm:px-2 sm:py-1.5 sm:text-[11px] sm:h-7 whitespace-nowrap bg-white/[0.08] text-white/[0.85] border-white/10 hover:bg-white/[0.12] ${isPaused ? '!bg-blue-500 !text-white !border-blue-500' : ''}`}
                                    onClick={handlePause}
                                    title={isPaused ? 'Resume reminder' : 'Pause reminder'}
                                >
                                    {isPaused ? 'Resume' : 'Pause'}
                                </button>
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center px-3 py-[7px] rounded-md text-xs font-medium cursor-pointer transition-all duration-150 border h-8 box-border sm:px-2 sm:py-1.5 sm:text-[11px] sm:h-7 whitespace-nowrap bg-transparent border-red-500/50 text-red-400 hover:bg-red-500/10"
                                    onClick={handleDelete}
                                >
                                    Delete
                                </button>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center px-3 py-[7px] rounded-md text-xs font-medium cursor-pointer transition-all duration-150 border-none h-8 box-border sm:px-2 sm:py-1.5 sm:text-[11px] sm:h-7 whitespace-nowrap bg-white/[0.08] text-white/[0.85] hover:bg-white/[0.12]"
                                    onClick={onCancel}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center px-3 py-[7px] rounded-md text-xs font-medium cursor-pointer transition-all duration-150 border-none h-8 box-border sm:px-2 sm:py-1.5 sm:text-[11px] sm:h-7 whitespace-nowrap bg-white text-black hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed"
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
