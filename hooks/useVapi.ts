'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Vapi from '@vapi-ai/web';
import { useAuth } from '@clerk/nextjs';

import { useSubscription } from '@/hooks/useSubscription';
import { PLANS } from '@/lib/subscription-constants';
import { DEFAULT_VOICE, VOICE_SETTINGS } from '@/lib/constants';
import { getVoice } from '@/lib/utils';
import { IBook, Messages } from '@/types';
import { checkSessionLimit, createVoiceSession, endVoiceSession } from '@/lib/actions/session.actions';
import { getBookContent } from '@/lib/actions/book.actions';

export function useLatestRef<T>(value: T) {
    const ref = useRef(value);
    useEffect(() => { ref.current = value; }, [value]);
    return ref;
}

const VAPI_API_KEY = process.env.NEXT_PUBLIC_VAPI_API_KEY;
const TIMER_INTERVAL_MS = 1000;
const SECONDS_PER_MINUTE = 60;

let vapi: InstanceType<typeof Vapi>;
function getVapi() {
    if (!vapi) {
        if (!VAPI_API_KEY) {
            throw new Error('NEXT_PUBLIC_VAPI_API_KEY environment variable is not set');
        }
        vapi = new Vapi(VAPI_API_KEY);
    }
    return vapi;
}

export type CallStatus = 'idle' | 'connecting' | 'starting' | 'listening' | 'thinking' | 'speaking';

export function useVapi(book: IBook) {
    const { userId } = useAuth();
    const { plan, limits } = useSubscription();

    const [status, setStatus] = useState<CallStatus>('idle');
    const [messages, setMessages] = useState<Messages[]>([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [currentUserMessage, setCurrentUserMessage] = useState('');
    const [duration, setDuration] = useState(0);
    const [limitError, setLimitError] = useState<string | null>(null);
    const [isBillingError, setIsBillingError] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const isStoppingRef = useRef(false);
    const pendingSessionRef = useRef<{ userId: string; bookId: string } | null>(null);

    const maxDurationSeconds = limits?.maxDurationPerSession ? limits.maxDurationPerSession * 60 : (15 * 60);
    const maxDurationRef = useLatestRef(maxDurationSeconds);
    const durationRef = useLatestRef(duration);
    const voice = book.persona || DEFAULT_VOICE;

    useEffect(() => {
        const instance = getVapi();

        const handlers = {
            'call-start': async () => {
                isStoppingRef.current = false;
                setStatus('starting');
                setCurrentMessage('');
                setCurrentUserMessage('');

                if (pendingSessionRef.current) {
                    try {
                        const result = await createVoiceSession(
                            pendingSessionRef.current.userId,
                            pendingSessionRef.current.bookId,
                        );
                        sessionIdRef.current = result.sessionId || null;
                    } catch (err) {
                        console.error('Failed to create voice session:', err);
                    }
                    pendingSessionRef.current = null;
                }

                startTimeRef.current = Date.now();
                setDuration(0);
                timerRef.current = setInterval(() => {
                    if (startTimeRef.current) {
                        const newDuration = Math.floor((Date.now() - startTimeRef.current) / TIMER_INTERVAL_MS);
                        setDuration(newDuration);
                        if (newDuration >= maxDurationRef.current) {
                            getVapi().stop();
                            setLimitError(
                                `Session time limit (${Math.floor(maxDurationRef.current / SECONDS_PER_MINUTE)} minutes) reached.`,
                            );
                        }
                    }
                }, TIMER_INTERVAL_MS);
            },

            'call-end': () => {
                setStatus('idle');
                setCurrentMessage('');
                setCurrentUserMessage('');

                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }

                if (sessionIdRef.current) {
                    endVoiceSession(sessionIdRef.current, durationRef.current).catch((err) =>
                        console.error('Failed to end voice session:', err),
                    );
                    sessionIdRef.current = null;
                }

                startTimeRef.current = null;
            },

            'speech-start': () => {
                if (!isStoppingRef.current) setStatus('speaking');
            },
            'speech-end': () => {
                if (!isStoppingRef.current) setStatus('listening');
            },

            message: (message: { type: string; role: string; transcriptType: string; transcript: string }) => {
                if (message.type !== 'transcript') return;

                if (message.role === 'user' && message.transcriptType === 'final') {
                    if (!isStoppingRef.current) setStatus('thinking');
                    setCurrentUserMessage('');
                }

                if (message.role === 'user' && message.transcriptType === 'partial') {
                    setCurrentUserMessage(message.transcript);
                    return;
                }

                if (message.role === 'assistant' && message.transcriptType === 'partial') {
                    setCurrentMessage(message.transcript);
                    return;
                }

                if (message.transcriptType === 'final') {
                    if (message.role === 'assistant') setCurrentMessage('');
                    if (message.role === 'user') setCurrentUserMessage('');

                    setMessages((prev) => {
                        const isDupe = prev.some(
                            (m) => m.role === message.role && m.content === message.transcript,
                        );
                        return isDupe ? prev : [...prev, { role: message.role, content: message.transcript }];
                    });
                }
            },

            error: (error: Error | Record<string, unknown>) => {
                const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
                console.error('Vapi error:', errorMsg, error);

                setStatus('idle');
                setCurrentMessage('');
                setCurrentUserMessage('');
                pendingSessionRef.current = null;

                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }

                if (sessionIdRef.current) {
                    endVoiceSession(sessionIdRef.current, durationRef.current).catch(() => {});
                    sessionIdRef.current = null;
                }

                if (errorMsg.includes('timeout') || errorMsg.includes('silence')) {
                    setLimitError('Session ended due to inactivity. Click the mic to start again.');
                } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
                    setLimitError('Connection lost. Please check your internet and try again.');
                } else if (errorMsg === '{}' || errorMsg === '') {
                    setLimitError('Failed to connect. Please check your API key and try again.');
                } else {
                    setLimitError(`Session ended: ${errorMsg}`);
                }

                startTimeRef.current = null;
            },
        };

        const eventNames = Object.keys(handlers) as Array<keyof typeof handlers>;
        eventNames.forEach((event) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (instance as any).on(event, handlers[event]);
        });

        return () => {
            if (sessionIdRef.current) {
                instance.stop();
                endVoiceSession(sessionIdRef.current, durationRef.current).catch(() => {});
                sessionIdRef.current = null;
            }
            pendingSessionRef.current = null;
            eventNames.forEach((event) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (instance as any).off(event, handlers[event]);
            });
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const start = useCallback(async () => {
        if (!userId) {
            setLimitError('Please sign in to start a voice session.');
            return;
        }

        setLimitError(null);
        setIsBillingError(false);
        setStatus('connecting');

        try {
            const limitCheck = await checkSessionLimit(userId);
            if (!limitCheck.allowed) {
                setLimitError(limitCheck.error || 'Session limit reached.');
                setIsBillingError(!!limitCheck.isBillingError);
                setStatus('idle');
                return;
            }

            pendingSessionRef.current = { userId, bookId: book._id };

            const isPaid = plan === PLANS.STANDARD || plan === PLANS.PRO;

            const contentResult = await getBookContent(book._id, 100);
            const bookContent = contentResult.success && contentResult.content
                ? contentResult.content
                : 'No book content available.';

            const toolCalls = isPaid ? [
                {
                    type: 'function' as const,
                    function: {
                        name: 'searchBook',
                        description: 'Search for specific content, passages, or information anywhere within the uploaded book. Use this when the user asks about topics, quotes, characters, or events that are not covered in the provided book content.',
                        parameters: {
                            type: 'object',
                            properties: {
                                bookId: {
                                    type: 'string',
                                    description: 'The ID of the book to search in',
                                },
                                query: {
                                    type: 'string',
                                    description: 'The search query - what content to find in the book',
                                },
                            },
                            required: ['bookId', 'query'],
                        },
                    },
                    server: {
                        url: `${typeof window !== 'undefined' ? window.location.origin : ''}/api/vapi/search-book`,
                    },
                },
            ] : undefined;

            const contentLabel = isPaid
                ? `Here is the opening of the book. The user may ask about any part of it — including sections beyond this opening.`
                : `Here is part of the book content (the free 100-page preview).`;

            const systemPrompt = `You are a knowledgeable book assistant for the app Bookified. You are discussing the book "${book.title}" by ${book.author}.

${contentLabel}

--- BOOK CONTENT ---
${bookContent}
--- END OF BOOK CONTENT ---

Instructions:
- Use the book content above to answer the user's questions accurately
- Reference specific passages, pages, and quotes from the book when possible
- Be conversational, warm, and insightful
- Help the user explore themes, characters, plot points, and key ideas
- Keep responses concise and natural for voice conversation (2-4 sentences max)
- Never fabricate quotes or passages - only reference what's in the book content above
${isPaid
    ? `- If the user asks about something not covered in the content above, use the searchBook tool to look it up in the rest of the book. The book ID to pass to searchBook is "${book._id}".`
    : `- If the user asks about something not covered in the free preview, let them know it is only available on a paid plan.`}`;

            await getVapi().start({
                firstMessage: `Hey, good to meet you! I've read "${book.title}" by ${book.author} and I'm ready to discuss it. What would you like to talk about?`,
                model: {
                    provider: 'openai',
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                    ],
                    temperature: 0.7,
                    maxTokens: 1024,
                },
                voice: {
                    provider: '11labs' as const,
                    voiceId: getVoice(voice).id,
                    model: 'eleven_turbo_v2_5' as const,
                    stability: VOICE_SETTINGS.stability,
                    similarityBoost: VOICE_SETTINGS.similarityBoost,
                    style: VOICE_SETTINGS.style,
                    useSpeakerBoost: VOICE_SETTINGS.useSpeakerBoost,
                },
                ...(toolCalls ? { toolCalls } : {}),
            });
        } catch (err) {
            console.error('Failed to start call:', err);
            setStatus('idle');
            setLimitError('Failed to start voice session. Please try again.');
        }
    }, [book._id, book.title, book.author, voice, userId, plan]);

    const stop = useCallback(() => {
        isStoppingRef.current = true;
        getVapi().stop();
    }, []);

    const clearError = useCallback(() => {
        setLimitError(null);
        setIsBillingError(false);
    }, []);

    const isActive =
        status === 'starting' ||
        status === 'listening' ||
        status === 'thinking' ||
        status === 'speaking';

    return {
        status,
        isActive,
        messages,
        currentMessage,
        currentUserMessage,
        duration,
        start,
        stop,
        limitError,
        isBillingError,
        maxDurationSeconds,
        clearError,
    };
}

export default useVapi;
