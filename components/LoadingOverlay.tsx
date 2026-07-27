'use client';

import { Loader2, Check, FileText, Upload, Image, Database, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UploadStep {
    id: string;
    label: string;
    icon: React.ElementType;
}

export const UPLOAD_STEPS: UploadStep[] = [
    { id: 'parsing', label: 'Parsing PDF content', icon: FileText },
    { id: 'uploading-file', label: 'Uploading book file', icon: Upload },
    { id: 'uploading-cover', label: 'Preparing cover image', icon: Image },
    { id: 'saving-book', label: 'Saving book to library', icon: BookOpen },
    { id: 'saving-segments', label: 'Indexing content for search', icon: Database },
];

interface LoadingOverlayProps {
    currentStep: string;
    completedSteps: string[];
    error?: string | null;
}

const LoadingOverlay = ({ currentStep, completedSteps, error }: LoadingOverlayProps) => {
    return (
        <div className="loading-wrapper">
            <div className="loading-shadow-wrapper bg-white shadow-soft-lg">
                <div className="loading-shadow">
                    <Loader2 className="loading-animation w-12 h-12 text-[#663820]" />
                    <h2 className="loading-title">Synthesizing Your Book</h2>
                    <p className="text-[#777] text-center max-w-xs mb-4">
                        {error ? 'Something went wrong' : 'Please wait while we process your PDF'}
                    </p>

                    {error ? (
                        <div className="w-full max-w-xs">
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
                                {error}
                            </div>
                        </div>
                    ) : (
                        <div className="w-full max-w-xs space-y-2">
                            {UPLOAD_STEPS.map((step) => {
                                const isCompleted = completedSteps.includes(step.id);
                                const isCurrent = currentStep === step.id;
                                const StepIcon = step.icon;

                                return (
                                    <div
                                        key={step.id}
                                        className={cn(
                                            'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300',
                                            isCurrent && 'bg-[#f3e4c7]',
                                            isCompleted && 'opacity-60',
                                            !isCurrent && !isCompleted && 'opacity-40'
                                        )}
                                    >
                                        <div className="w-6 h-6 flex items-center justify-center shrink-0">
                                            {isCompleted ? (
                                                <Check className="w-4 h-4 text-[#663820]" />
                                            ) : isCurrent ? (
                                                <Loader2 className="w-4 h-4 text-[#663820] animate-spin" />
                                            ) : (
                                                <StepIcon className="w-4 h-4 text-[#8B7355]" />
                                            )}
                                        </div>
                                        <span className={cn(
                                            'text-sm font-medium',
                                            isCurrent ? 'text-[#663820]' : 'text-[#777]'
                                        )}>
                                            {step.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoadingOverlay;
