'use server';

import {EndSessionResult, StartSessionResult} from "@/types";
import {connectToDatabase} from "@/database/mongoose";
import VoiceSession from "@/database/models/voice-session.model";
import {getUserPlan} from "@/lib/subscription.server";
import {PLAN_LIMITS, getCurrentBillingPeriodStart} from "@/lib/subscription-constants";

export const checkSessionLimit = async (clerkId: string): Promise<{ allowed: boolean; error?: string; isBillingError?: boolean }> => {
    try {
        await connectToDatabase();

        const plan = await getUserPlan();
        const limits = PLAN_LIMITS[plan];
        const billingPeriodStart = getCurrentBillingPeriodStart();

        const sessionCount = await VoiceSession.countDocuments({
            clerkId,
            billingPeriodStart
        });

        if (sessionCount >= limits.maxSessionsPerMonth) {
            return {
                allowed: false,
                error: `You have reached the monthly session limit for your ${plan} plan (${limits.maxSessionsPerMonth}). Please upgrade for more sessions.`,
                isBillingError: true,
            };
        }

        return { allowed: true };
    } catch (e) {
        console.error('Error checking session limit', e);
        return { allowed: false, error: 'Failed to check session limits.' };
    }
}

export const createVoiceSession = async (clerkId: string, bookId: string): Promise<StartSessionResult> => {
    try {
        await connectToDatabase();

        const plan = await getUserPlan();
        const limits = PLAN_LIMITS[plan];
        const billingPeriodStart = getCurrentBillingPeriodStart();

        const session = await VoiceSession.create({
            clerkId,
            bookId,
            startedAt: new Date(),
            billingPeriodStart,
            durationSeconds: 0,
        });

        return {
            success: true,
            sessionId: session._id.toString(),
            maxDurationMinutes: limits.maxDurationPerSession,
        }
    } catch (e) {
        console.error('Error creating voice session', e);
        return { success: false, error: 'Failed to create voice session.' }
    }
}

export const endVoiceSession = async (sessionId: string, durationSeconds: number): Promise<EndSessionResult> => {
    try {
        await connectToDatabase();

        const result = await VoiceSession.findByIdAndUpdate(sessionId, {
            endedAt: new Date(),
            durationSeconds,
        });

        if(!result) return { success: false, error: 'Voice session not found.' }

        return { success: true }
    } catch (e) {
        console.error('Error ending voice session', e);
        return { success: false, error: 'Failed to end voice session. Please try again later.' }
    }
}

export const cleanupFailedSessions = async (clerkId: string): Promise<void> => {
    try {
        await connectToDatabase();

        await VoiceSession.deleteMany({
            clerkId,
            endedAt: { $exists: false },
            durationSeconds: 0,
        });
    } catch (e) {
        console.error('Error cleaning up failed sessions', e);
    }
}
