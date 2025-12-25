'use client';

import { useState, useId } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import type { Reminder } from '@cognito/shared';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

type RepeatFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

interface EditReminderDialogProps {
    isOpen: boolean;
    reminder: Reminder;
    onSave: (updatedReminder: Reminder) => void;
    onDelete: (id: string) => void;
    onCancel: () => void;
}

export function EditReminderDialog({
    isOpen,
    reminder,
    onSave,
    onDelete,
    onCancel,
}: EditReminderDialogProps) {
    const [title, setTitle] = useState(reminder.generatedTitle || reminder.title);
    const [description, setDescription] = useState(reminder.generatedDescription || '');
    const [repeat, setRepeat] = useState<RepeatFrequency>((reminder.repeat as RepeatFrequency) || 'none');
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
    const timeId = useId();

    const handleSave = () => {
        if (!title.trim()) {
            setError('Name is required.');
            return;
        }

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

    const confirmDelete = () => {
        onDelete(reminder.id);
        setShowDeleteConfirm(false);
    };

    if (showDeleteConfirm) {
        return (
            <Dialog open={true} onOpenChange={() => setShowDeleteConfirm(false)}>
                <DialogContent className="bg-slate-900 border-white/10 text-white max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Reminder?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-white/70 py-4">
                        Are you sure you want to delete this reminder? This action cannot be undone.
                    </p>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
            <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Reminder</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-4">
                    {/* Name Field */}
                    <div className="flex flex-col gap-2">
                        <Label htmlFor={titleId} className="text-white/70">Name</Label>
                        <Input
                            id={titleId}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="What should I remind you about?"
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                        />
                    </div>

                    {/* Instructions Field */}
                    <div className="flex flex-col gap-2">
                        <Label htmlFor={descriptionId} className="text-white/70">Instructions</Label>
                        <Textarea
                            id={descriptionId}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add details about this reminder..."
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
                        />
                    </div>

                    {/* When Section */}
                    <div className="flex flex-col gap-2">
                        <Label className="text-white/70">When</Label>
                        <Select value={repeat} onValueChange={(value) => setRepeat(value as RepeatFrequency)}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                <SelectValue placeholder="Repeat" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10">
                                <SelectItem value="none" className="text-white hover:bg-white/10">Doesn&apos;t repeat</SelectItem>
                                <SelectItem value="daily" className="text-white hover:bg-white/10">Daily</SelectItem>
                                <SelectItem value="weekly" className="text-white hover:bg-white/10">Weekly</SelectItem>
                                <SelectItem value="monthly" className="text-white hover:bg-white/10">Monthly</SelectItem>
                                <SelectItem value="yearly" className="text-white hover:bg-white/10">Yearly</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex gap-2">
                            {/* Date Picker */}
                            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="flex-1 justify-start text-left bg-white/5 border-white/10 text-white hover:bg-white/10"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                                        {date ? format(date, 'dd-MM-yyyy') : 'Pick date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-slate-900 border-white/10">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={(selectedDate) => {
                                            setDate(selectedDate);
                                            setIsCalendarOpen(false);
                                        }}
                                        disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                                        className="rounded-lg"
                                    />
                                </PopoverContent>
                            </Popover>

                            {/* Time Picker */}
                            <div className="flex-1">
                                <Input
                                    id={timeId}
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="text-red-400 text-sm" role="alert">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter className="flex justify-between gap-2">
                    <div className="flex gap-2">
                        <Button
                            variant={isPaused ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setIsPaused(!isPaused)}
                            className={isPaused ? 'bg-blue-500 hover:bg-blue-600' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}
                        >
                            {isPaused ? 'Resume' : 'Pause'}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDelete}
                            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                        >
                            Delete
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={!title.trim()}>
                            Save
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
