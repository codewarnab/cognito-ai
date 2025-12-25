'use client';

import { useState } from 'react';
import { Heart, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const FEEDBACK_REASONS = [
    { id: 'missing-features', label: 'Missing features I needed' },
    { id: 'too-complicated', label: 'Too complicated to use' },
    { id: 'performance', label: 'Performance issues' },
    { id: 'alternative', label: 'Found a better alternative' },
    { id: 'privacy', label: 'Privacy concerns' },
    { id: 'not-using', label: 'Not using the browser enough' },
] as const;

export default function UninstalledPage() {
    const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
    const [feedback, setFeedback] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const toggleReason = (reasonId: string) => {
        setSelectedReasons((prev) =>
            prev.includes(reasonId)
                ? prev.filter((id) => id !== reasonId)
                : [...prev, reasonId]
        );
    };

    const handleSubmit = async () => {
        if (selectedReasons.length === 0 && !feedback.trim()) return;

        setIsSubmitting(true);

        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://cognito-backend.vercel.app'}/feedback/uninstall`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        reasons: selectedReasons,
                        feedback: feedback.trim() || undefined,
                        timestamp: new Date().toISOString(),
                    }),
                }
            );

            if (!response.ok) {
                console.error('Failed to submit feedback:', response.status);
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
        }

        setIsSubmitting(false);
        setIsSubmitted(true);
    };

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-100 via-white to-amber-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center">
                    <div className="mb-6 inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                        <Check size={32} className="text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-3">
                        Thank you for your feedback
                    </h1>
                    <p className="text-slate-600">
                        We appreciate you taking the time to help us improve Cognito AI.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-100 via-white to-amber-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="mb-4 inline-flex items-center justify-center w-14 h-14 bg-blue-50 rounded-full">
                        <Heart size={24} className="text-blue-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-3">
                        Sorry to see you go
                    </h1>
                    <p className="text-slate-600">
                        We&apos;d love to hear what we could have done better.
                    </p>
                </div>

                {/* Feedback Form */}
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/80">
                    {/* Reason Selection - Two Column Grid */}
                    <div className="mb-5">
                        <Label className="text-sm font-medium text-slate-700 mb-3 block">
                            What made you uninstall Cognito?
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                            {FEEDBACK_REASONS.map((reason) => (
                                <button
                                    key={reason.id}
                                    type="button"
                                    onClick={() => toggleReason(reason.id)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all cursor-pointer ${selectedReasons.includes(reason.id)
                                        ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                                        : 'bg-slate-50 text-slate-700 border-2 border-transparent hover:bg-slate-100'
                                        }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <span
                                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${selectedReasons.includes(reason.id)
                                                ? 'bg-blue-500 border-blue-500'
                                                : 'border-slate-300'
                                                }`}
                                        >
                                            {selectedReasons.includes(reason.id) && (
                                                <Check size={10} className="text-white" />
                                            )}
                                        </span>
                                        {reason.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Additional Feedback */}
                    <div className="mb-4">
                        <Label htmlFor="feedback" className="text-sm font-medium text-slate-700 mb-2 block">
                            Additional feedback (optional)
                        </Label>
                        <Textarea
                            id="feedback"
                            placeholder="Tell us more about your experience..."
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            className="min-h-[80px] bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 resize-none"
                        />
                    </div>

                    {/* Submit Button */}
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || (selectedReasons.length === 0 && !feedback.trim())}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Sending...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <Send size={16} />
                                Send Feedback
                            </span>
                        )}
                    </Button>
                </div>

                {/* Footer */}
                <div className="text-center mt-5">
                    <p className="text-sm text-slate-500">
                        Changed your mind?{' '}
                        <a
                            href="https://chrome.google.com/webstore/detail/cognito-ai"
                            className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                            Reinstall Cognito AI
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
