import React, { useState, useId } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../../ui/primitives/dialog/Dialog';
import type { Reminder, RepeatFrequency } from '../../../actions/reminder/types';
import { ConfirmDialog } from '../../ui/primitives/dialog/ConfirmDialog';
import { WheelTimePicker } from '../../ui/primitives/wheel-time-picker/WheelTimePicker';
import { Calendar } from '../../ui/primitives/calendar/Calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/primitives/popover/Popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../ui/primitives/select/Select';

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
    const [date, setDate] = useState<Date | undefined>(() => new Date(reminder.when));
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
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

    const handleSave = () => {
        // Validate title
        if (!title.trim()) {
            setError('Name is required.');
            return;
        }

        // Combine date and time
        if (!date) {
            setError('Please select a date.');
            return;
        }
        const [hours, minutes] = time.split(':').map(Number);
        const combinedDate = new Date(date);
        combinedDate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
        const when = combinedDate.getTime();
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
                            <div className="flex flex-col gap-2">
                                {/* Repeat Dropdown */}
                                <Select value={repeat} onValueChange={(value) => setRepeat(value as RepeatFrequency)}>
                                    <SelectTrigger className="w-full px-2.5 py-2 h-auto bg-white/5 border-white/[0.08] rounded-lg text-white text-[13px] transition-all duration-150 box-border focus:border-[#6496ff]/35 focus:bg-white/[0.07]">
                                        <SelectValue placeholder="Repeat" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1a1f2e] border-white/[0.08] rounded-lg shadow-lg z-[10001]">
                                        <SelectItem value="none" className="text-white hover:bg-white/[0.08] focus:bg-white/[0.08] focus:text-white">Doesn't repeat</SelectItem>
                                        <SelectItem value="daily" className="text-white hover:bg-white/[0.08] focus:bg-white/[0.08] focus:text-white">Daily</SelectItem>
                                        <SelectItem value="weekly" className="text-white hover:bg-white/[0.08] focus:bg-white/[0.08] focus:text-white">Weekly</SelectItem>
                                        <SelectItem value="monthly" className="text-white hover:bg-white/[0.08] focus:bg-white/[0.08] focus:text-white">Monthly</SelectItem>
                                        <SelectItem value="yearly" className="text-white hover:bg-white/[0.08] focus:bg-white/[0.08] focus:text-white">Yearly</SelectItem>
                                    </SelectContent>
                                </Select>
                                {/* Date and Time row */}
                                <div className="flex gap-2">
                                    {/* Date Picker */}
                                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                        <PopoverTrigger asChild>
                                            <button
                                                type="button"
                                                className="flex-1 px-2.5 py-2 bg-white/5 border border-white/[0.08] rounded-lg text-white text-[13px] transition-all duration-150 box-border focus:outline-none focus:border-[#6496ff]/35 focus:bg-white/[0.07] flex items-center justify-between gap-1.5 min-w-0"
                                            >
                                                <span className="truncate">
                                                    {date ? format(date, 'dd-MM-yyyy') : 'Pick date'}
                                                </span>
                                                <CalendarIcon className="h-3.5 w-3.5 opacity-50 shrink-0" />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            className="w-auto p-0 bg-[#1a1f2e] border-white/[0.08] rounded-xl shadow-lg z-[10001]"
                                            align="start"
                                            sideOffset={4}
                                        >
                                            <Calendar
                                                mode="single"
                                                selected={date}
                                                onSelect={(selectedDate) => {
                                                    setDate(selectedDate);
                                                    setIsCalendarOpen(false);
                                                }}
                                                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                                                className="rounded-xl bg-[#1a1f2e] text-white [--rdp-accent-color:rgba(100,150,255,0.3)] [--rdp-accent-background-color:rgba(100,150,255,0.15)]"
                                                classNames={{
                                                    months: "flex flex-col",
                                                    month: "space-y-3",
                                                    caption: "flex justify-center pt-1 relative items-center",
                                                    caption_label: "text-sm font-medium text-white",
                                                    nav: "flex items-center gap-1",
                                                    nav_button: "h-7 w-7 bg-transparent hover:bg-white/[0.08] rounded-md flex items-center justify-center transition-colors",
                                                    nav_button_previous: "absolute left-1",
                                                    nav_button_next: "absolute right-1",
                                                    table: "w-full border-collapse",
                                                    head_row: "flex",
                                                    head_cell: "text-white/40 rounded-md w-8 font-normal text-[0.8rem]",
                                                    row: "flex w-full mt-1",
                                                    cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-white/[0.08] rounded-md",
                                                    day: "h-8 w-8 p-0 font-normal text-white/80 hover:bg-white/[0.08] rounded-md transition-colors aria-selected:opacity-100",
                                                    day_selected: "bg-[#6496ff] text-white hover:bg-[#6496ff] hover:text-white",
                                                    day_today: "bg-white/[0.08] text-white",
                                                    day_outside: "text-white/20 opacity-50",
                                                    day_disabled: "text-white/20 opacity-30 cursor-not-allowed",
                                                    day_hidden: "invisible",
                                                }}
                                            />
                                        </PopoverContent>
                                    </Popover>

                                    {/* Time Picker */}
                                    <div className="flex-1">
                                        <WheelTimePicker
                                            value={time}
                                            onChange={setTime}
                                            label="Select Time"
                                        />
                                    </div>
                                </div>
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
