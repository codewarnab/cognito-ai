import React, { useState, useMemo, useCallback } from 'react';
import {
    WheelPicker,
    WheelPickerWrapper,
    type WheelPickerOption,
} from '@ncdai/react-wheel-picker';
import '@ncdai/react-wheel-picker/style.css';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../dialog/Dialog';
import { Clock } from 'lucide-react';

interface WheelTimePickerProps {
    value: string; // "HH:MM" format
    onChange: (value: string) => void;
    label?: string;
}

// Generate hour options (00-23)
const hourOptions: WheelPickerOption<string>[] = Array.from({ length: 24 }, (_, i) => ({
    value: String(i).padStart(2, '0'),
    label: String(i).padStart(2, '0'),
}));

// Generate minute options (00-59)
const minuteOptions: WheelPickerOption<string>[] = Array.from({ length: 60 }, (_, i) => ({
    value: String(i).padStart(2, '0'),
    label: String(i).padStart(2, '0'),
}));

export const WheelTimePicker: React.FC<WheelTimePickerProps> = ({
    value,
    onChange,
    label = 'Select Time',
}) => {
    const [isOpen, setIsOpen] = useState(false);

    // Parse the time value
    const [hour, minute] = useMemo(() => {
        const [h, m] = value.split(':');
        return [h || '00', m || '00'];
    }, [value]);

    // Temporary state for picker
    const [tempHour, setTempHour] = useState(hour);
    const [tempMinute, setTempMinute] = useState(minute);

    const handleOpen = useCallback(() => {
        setTempHour(hour);
        setTempMinute(minute);
        setIsOpen(true);
    }, [hour, minute]);

    const handleConfirm = useCallback(() => {
        onChange(`${tempHour}:${tempMinute}`);
        setIsOpen(false);
    }, [tempHour, tempMinute, onChange]);

    const handleCancel = useCallback(() => {
        setIsOpen(false);
    }, []);

    // Format display time in 12-hour format
    const displayTime = useMemo(() => {
        const h = parseInt(hour, 10);
        const period = h >= 12 ? 'PM' : 'AM';
        const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${displayHour}:${minute} ${period}`;
    }, [hour, minute]);

    return (
        <>
            {/* Time button that opens the dialog */}
            <button
                type="button"
                onClick={handleOpen}
                className="w-full px-2.5 py-2 bg-white/5 border border-white/[0.08] rounded-lg text-white text-[13px] transition-all duration-150 box-border focus:outline-none focus:border-[#6496ff]/35 focus:bg-white/[0.07] hover:bg-white/[0.07] flex items-center justify-between gap-2 cursor-pointer"
            >
                <span className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-white/50" />
                    <span>{displayTime}</span>
                </span>
                <svg
                    className="w-3 h-3 text-white/50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Time picker dialog */}
            <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
                <DialogContent className="w-[280px] max-w-[90vw] !bg-[#1a1f2e] !rounded-xl !z-[10001] p-4 flex flex-col overflow-hidden outline-none">
                    <DialogHeader className="pb-3 border-b border-white/[0.06] mb-0 space-y-0 text-left">
                        <DialogTitle className="text-base font-semibold text-white">{label}</DialogTitle>
                    </DialogHeader>

                    <div className="py-4 flex items-center justify-center">
                        <WheelPickerWrapper className="rounded-lg bg-white/5 border border-white/[0.08]">
                            <WheelPicker
                                options={hourOptions}
                                value={tempHour}
                                onValueChange={setTempHour}
                                infinite
                                classNames={{
                                    optionItem: 'text-white/40 text-lg font-medium',
                                    highlightWrapper: 'bg-white/[0.08] rounded-md',
                                    highlightItem: 'text-white text-lg font-semibold',
                                }}
                            />
                            <div className="flex items-center justify-center text-white/60 text-xl font-semibold px-1">
                                :
                            </div>
                            <WheelPicker
                                options={minuteOptions}
                                value={tempMinute}
                                onValueChange={setTempMinute}
                                infinite
                                classNames={{
                                    optionItem: 'text-white/40 text-lg font-medium',
                                    highlightWrapper: 'bg-white/[0.08] rounded-md',
                                    highlightItem: 'text-white text-lg font-semibold',
                                }}
                            />
                        </WheelPickerWrapper>
                    </div>

                    <DialogFooter className="shrink-0 mt-0 pt-0">
                        <div className="flex justify-end items-center gap-2 pt-3 border-t border-white/[0.06] w-full">
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-150 border-none bg-white/[0.08] text-white/[0.85] hover:bg-white/[0.12]"
                                onClick={handleCancel}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-150 border-none bg-white text-black hover:bg-white/90"
                                onClick={handleConfirm}
                            >
                                Confirm
                            </button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog >
        </>
    );
};
