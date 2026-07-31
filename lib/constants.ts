// Brand color - used in JS files where CSS variables aren't available
export const BRAND_COLOR = '#4F8CFF'; // Blue
export const BRAND_COLOR_HOVER = '#6AA2FF'; // Light blue

// File validation helpers
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const ACCEPTED_PDF_TYPES = ['application/pdf'];
export const ACCEPTED_EPUB_TYPES = ['application/epub+zip'];
export const ACCEPTED_TXT_TYPES = ['text/plain'];
export const ACCEPTED_BOOK_TYPES = [...ACCEPTED_PDF_TYPES, ...ACCEPTED_EPUB_TYPES, ...ACCEPTED_TXT_TYPES];
export const ACCEPTED_BOOK_EXTENSIONS = ['.pdf', '.epub', '.txt'];
export const BOOK_FILE_ACCEPT = ['application/pdf', '.pdf', 'application/epub+zip', '.epub', 'text/plain', '.txt'];
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Match book files by MIME type or extension (extensions cover OS/browser MIME quirks)
export function isAcceptedBookFile(file: { name: string; type: string }): boolean {
  if (ACCEPTED_BOOK_TYPES.includes(file.type)) return true;
  const lower = file.name.toLowerCase();
  return ACCEPTED_BOOK_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// Pre-configured VAPI assistant ID (hardcoded for this app)
export const ASSISTANT_ID = process.env.NEXT_PUBLIC_ASSISTANT_ID!;

// 11Labs Voice IDs - Optimized for conversational AI
// Voices selected for natural, engaging book conversations
export const voiceOptions = {
    // Male voices
    dave: { id: 'CYw3kZ02Hs0563khs1Fj', name: 'Dave', description: 'Young male, British-Essex, casual & conversational' },
    daniel: { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'Middle-aged male, British, authoritative but warm' },
    chris: { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris', description: 'Male, casual & easy-going' },
    // Female voices
    rachel: { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Young female, American, calm & clear' },
    sarah: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Young female, American, soft & approachable' },
};

// Voice categories for the selector UI
export const voiceCategories = {
    male: ['dave', 'daniel', 'chris'],
    female: ['rachel', 'sarah'],
};

// Default voice
export const DEFAULT_VOICE = 'rachel';

// ElevenLabs voice settings optimized for conversational AI
export const VOICE_SETTINGS = {
    stability: 0.45, // Lower for more emotional, dynamic delivery (0.30-0.50 is natural)
    similarityBoost: 0.75, // Enhances clarity without distortion
    style: 0, // Keep at 0 for conversational AI (higher = more latency, less stable)
    useSpeakerBoost: true, // Improves voice quality
    speed: 1.0, // Natural conversation speed
};

// VAPI configuration for natural conversation
// NOTE: These settings should be configured in the VAPI Dashboard for the assistant
// They are kept here for reference and documentation purposes
export const VAPI_DASHBOARD_CONFIG = {
    // Turn-taking settings
    startSpeakingPlan: {
        smartEndpointingEnabled: true,
        waitSeconds: 0.4,
    },
    stopSpeakingPlan: {
        numWords: 2,
        voiceSeconds: 0.2,
        backoffSeconds: 1.0,
    },
    // Timing settings
    silenceTimeoutSeconds: 30,
    responseDelaySeconds: 0.4,
    llmRequestDelaySeconds: 0.1,
    // Conversation features
    backgroundDenoisingEnabled: true,
    backchannelingEnabled: true,
    fillerInjectionEnabled: false,
};

// Clerk appearance overrides - Premium Dark Style
export const CLERK_AUTH_APPEARANCE_OVERRIDE = {
    rootBox: 'mx-auto',
    card: 'shadow-none border-none rounded-xl bg-transparent',
    headerTitle: '!text-2xl font-bold text-[var(--text-primary)]',
    headerSubtitle: '!mt-3 !text-sm text-[var(--text-secondary)]',
    socialButtonsBlockButton:
        '!border border-[var(--border-subtle)] hover:bg-[var(--accent-light)] transition-all h-12 text-lg !rounded-xl shadow-[var(--shadow-soft-sm)]',
    socialButtonsBlockButtonText: 'font-medium !text-[var(--text-primary)] !text-lg',
    formButtonPrimary:
        'bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-medium !border-0 shadow-[var(--shadow-soft)] normal-case !h-12 !text-lg !rounded-xl',
    formFieldInput:
        '!border !border-[var(--border-subtle)] !rounded-xl focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] !h-12 !min-h-12 !text-lg !bg-[var(--bg-card)] shadow-[var(--shadow-soft-sm)]',
    formFieldLabel: 'text-[var(--text-primary)] font-medium text-lg',
    footerActionLink: 'text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] text-base font-medium',
};


