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
    { id: 'other', label: 'Other' },
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

        // TODO: Send feedback to backend/analytics
        // For now, just simulate a delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        console.log('Uninstall feedback:', {
            reasons: selectedReasons,
            feedback: feedback.trim(),
            timestamp: new Date().toISOString(),
        });

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
        <div className="min-h-screen bg-gradient-to-br from-blue-100 via-white to-amber-50">
            <div className="container mx-auto max-w-lg px-4 py-12">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="mb-6 inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500/10 to-violet-500/10 rounded-full">
                        <Heart size={28} className="text-blue-600" />
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
                    {/* Reason Selection */}
                    <div className="mb-6">
                        <Label className="text-sm font-medium text-slate-700 mb-3 block">
                            What made you uninstall Cognito?
                        </Label>
                        <div className="space-y-2">
                            {FEEDBACK_REASONS.map((reason) => (
                                <button
                                    key={reason.id}
                                    type="button"
                                    onClick={() => toggleReason(reason.id)}
                                    className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${selectedReasons.includes(reason.id)
                                            ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                                            : 'bg-slate-50 text-slate-700 border-2 border-transparent hover:bg-slate-100'
                                        }`}
                                >
                                    <span className="flex items-center gap-3">
                                        <span
                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedReasons.includes(reason.id)
                                                    ? 'bg-blue-500 border-blue-500'
                                                    : 'border-slate-300'
                                                }`}
                                        >
                                            {selectedReasons.includes(reason.id) && (
                                                <Check size={12} className="text-white" />
                                            )}
                                        </span>
                                        {reason.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Additional Feedback */}
                    <div className="mb-6">
                        <Label htmlFor="feedback" className="text-sm font-medium text-slate-700 mb-2 block">
                            Additional feedback (optional)
                        </Label>
                        <Textarea
                            id="feedback"
                            placeholder="Tell us more about your experience..."
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            className="min-h-[120px] bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 resize-none"
                        />
                    </div>

                    {/* Submit Button */}
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || (selectedReasons.length === 0 && !feedback.trim())}
                        className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
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
                <div className="text-center mt-8">
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
