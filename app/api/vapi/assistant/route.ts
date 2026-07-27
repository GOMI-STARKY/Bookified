import {NextResponse} from "next/server";

const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;
const NEXT_PUBLIC_ASSISTANT_ID = process.env.NEXT_PUBLIC_ASSISTANT_ID;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';

const VAPI_BASE_URL = 'https://api.vapi.ai';

async function fetchAssistant(assistantId: string): Promise<Record<string, unknown> | null> {
    if (!VAPI_PRIVATE_KEY) return null;
    try {
        const res = await fetch(`${VAPI_BASE_URL}/assistant/${assistantId}`, {
            headers: { 'Authorization': `Bearer ${VAPI_PRIVATE_KEY}` },
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

async function createAssistant(): Promise<string | null> {
    if (!VAPI_PRIVATE_KEY) return null;
    if (!BASE_URL) {
        console.error('NEXT_PUBLIC_BASE_URL not set — cannot create Vapi assistant with tool webhook URL');
        return null;
    }

    try {
        const res = await fetch(`${VAPI_BASE_URL}/assistant`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: 'Bookified Assistant',
                firstMessage: "Hello! I'm your book assistant. Ask me anything about the book you've uploaded.",
                model: {
                    provider: 'openai',
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a knowledgeable book assistant for the app Bookified. You help users discuss, analyze, and understand books they've uploaded.

When a user asks about specific content in a book, use the searchBook tool to find relevant passages. Always reference specific parts of the book when answering.

Be conversational, warm, and insightful. Help users explore themes, characters, plot points, and key ideas from their books.

If a user asks about something not in the book, gently let them know and suggest what you CAN help with based on the book's content.`,
                        },
                    ],
                    temperature: 0.7,
                    maxTokens: 1024,
                },
                voice: {
                    provider: '11labs',
                    voiceId: '21m00Tcm4TlvDq8ikWAM',
                    model: 'eleven_turbo_v2_5',
                    stability: 0.45,
                    similarityBoost: 0.75,
                    style: 0,
                    useSpeakerBoost: true,
                },
                toolCalls: [
                    {
                        type: 'function',
                        function: {
                            name: 'searchBook',
                            description: 'Search for specific content, passages, or information within the uploaded book. Use this when the user asks about specific topics, quotes, characters, or events mentioned in the book.',
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
                            url: `${BASE_URL}/api/vapi/search-book`,
                        },
                    },
                ],
                silenceTimeoutSeconds: 30,
                responseDelaySeconds: 0.4,
                llmRequestDelaySeconds: 0.1,
                backgroundDenoisingEnabled: true,
                backchannelingEnabled: true,
                fillerInjectionEnabled: false,
            }),
        });

        if (!res.ok) {
            const error = await res.text();
            console.error('Failed to create Vapi assistant:', error);
            return null;
        }

        const data = await res.json();
        return data.id;
    } catch (e) {
        console.error('Error creating Vapi assistant:', e);
        return null;
    }
}

export async function GET() {
    try {
        if (NEXT_PUBLIC_ASSISTANT_ID && VAPI_PRIVATE_KEY) {
            const existing = await fetchAssistant(NEXT_PUBLIC_ASSISTANT_ID);
            if (existing) {
                return NextResponse.json({
                    assistantId: NEXT_PUBLIC_ASSISTANT_ID,
                    source: 'existing',
                });
            }
        }

        if (VAPI_PRIVATE_KEY) {
            const newId = await createAssistant();
            if (newId) {
                return NextResponse.json({
                    assistantId: newId,
                    source: 'created',
                });
            }
        }

        return NextResponse.json({
            assistantId: NEXT_PUBLIC_ASSISTANT_ID || null,
            source: 'fallback',
        });
    } catch (e) {
        console.error('Assistant setup error:', e);
        return NextResponse.json({
            assistantId: NEXT_PUBLIC_ASSISTANT_ID || null,
            source: 'error',
        });
    }
}
