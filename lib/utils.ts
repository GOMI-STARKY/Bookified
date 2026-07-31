import { TextSegment } from '@/types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DEFAULT_VOICE, voiceOptions } from './constants';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Serialize Mongoose documents to plain JSON objects (strips ObjectId, Date, etc.)
export const serializeData = <T>(data: T): T => JSON.parse(JSON.stringify(data));

// Auto generate slug
export function generateSlug(text: string): string {
  return text
      .replace(/\.[^/.]+$/, '') // Remove file extension (.pdf, .txt, etc.)
      .toLowerCase() // Convert to lowercase
      .trim() // Remove whitespace from both ends
      .replace(/[^\w\s-]/g, '') // Remove special characters (keep letters, numbers, spaces, hyphens)
      .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

// Escape regex special characters to prevent ReDoS attacks
export const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Splits text content into segments for MongoDB storage and search
export const splitIntoSegments = (
    text: string,
    segmentSize: number = 800, // Maximum words per segment (larger = fewer DB writes, faster upload)
    overlapSize: number = 80, // Words to overlap between segments for context
): TextSegment[] => {
  // Validate parameters to prevent infinite loops
  if (segmentSize <= 0) {
    throw new Error('segmentSize must be greater than 0');
  }
  if (overlapSize < 0 || overlapSize >= segmentSize) {
    throw new Error('overlapSize must be >= 0 and < segmentSize');
  }

  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const segments: TextSegment[] = [];

  let segmentIndex = 0;
  let startIndex = 0;

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + segmentSize, words.length);
    const segmentWords = words.slice(startIndex, endIndex);
    const segmentText = segmentWords.join(' ');

    segments.push({
      text: segmentText,
      segmentIndex,
      wordCount: segmentWords.length,
    });

    segmentIndex++;

    if (endIndex >= words.length) break;
    startIndex = endIndex - overlapSize;
  }

  return segments;
};

// Get voice data by persona key or voice ID
export const getVoice = (persona?: string) => {
  if (!persona) return voiceOptions[DEFAULT_VOICE];

  // Find by voice ID
  const voiceEntry = Object.values(voiceOptions).find((v) => v.id === persona);
  if (voiceEntry) return voiceEntry;

  // Find by key
  const voiceByKey = voiceOptions[persona as keyof typeof voiceOptions];
  if (voiceByKey) return voiceByKey;

  // Default fallback
  return voiceOptions[DEFAULT_VOICE];
};

// Format duration in seconds to MM:SS format
export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Book file type detection (by MIME or extension)
export type BookFileType = 'pdf' | 'epub' | 'txt' | 'unknown';

export const getBookFileType = (file: File): BookFileType => {
  const lower = file.name.toLowerCase();
  if (file.type === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
  if (file.type === 'application/epub+zip' || lower.endsWith('.epub')) return 'epub';
  if (file.type === 'text/plain' || lower.endsWith('.txt')) return 'txt';
  return 'unknown';
};

// Generate a branded placeholder cover when a book has no extractable cover
function generatePlaceholderCover(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 800);
    gradient.addColorStop(0, '#4f8cff');
    gradient.addColorStop(1, '#2f6bed');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 800);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Book Cover', 300, 400);
  }
  return canvas.toDataURL('image/png');
}

export async function parsePDFFile(file: File) {
  const pdfjsLib = await import('pdfjs-dist');

  if (typeof window !== 'undefined') {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
      ).toString();
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }
  }

  const arrayBuffer = await file.arrayBuffer();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pdfDocument: any;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      disableFontFace: true,
    });
    pdfDocument = await loadingTask.promise;
  } catch (e) {
    throw new Error(`Cannot open this PDF. It may be encrypted or damaged. ${(e as Error).message}`);
  }

  let coverDataURL = '';
  try {
    const firstPage = await pdfDocument.getPage(1);
    const viewport = firstPage.getViewport({ scale: 2 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');

    if (context) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (firstPage as any).render({
        canvasContext: context,
        viewport,
        canvas,
      }).promise;

      coverDataURL = canvas.toDataURL('image/png');
    }
  } catch (e) {
    console.warn('Could not render cover page, using blank cover:', e);
    coverDataURL = generatePlaceholderCover();
  }

  let fullText = '';
  const numPages = pdfDocument.numPages;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
          .filter((item: Record<string, unknown>) => 'str' in item)
          .map((item: Record<string, unknown>) => String(item.str ?? ''))
          .join(' ');
      fullText += pageText + '\n';
    } catch (e) {
      console.warn(`Could not extract text from page ${pageNum}:`, e);
    }
  }

  await pdfDocument.destroy();

  const trimmedText = fullText.trim();
  if (!trimmedText) {
    throw new Error('This PDF has no extractable text. It may be a scanned image or have an unsupported format. Please try a different PDF.');
  }

  const segments = splitIntoSegments(trimmedText);

  return {
    content: segments,
    cover: coverDataURL,
  };
}

// Parse an EPUB file: unzip it, follow container.xml -> OPF -> spine, extract chapter text
export async function parseEpubFile(file: File): Promise<{ content: TextSegment[]; cover: string }> {
  if (typeof window === 'undefined') {
    throw new Error('EPUB parsing is only supported in the browser.');
  }

  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file.arrayBuffer());

  const containerEntry = zip.file('META-INF/container.xml');
  if (!containerEntry) {
    throw new Error('Invalid EPUB: missing META-INF/container.xml');
  }
  const containerDoc = new DOMParser().parseFromString(
    await containerEntry.async('string'),
    'application/xml',
  );
  const rootfilePath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
  if (!rootfilePath) {
    throw new Error('Invalid EPUB: no rootfile found in container.xml');
  }

  const opfEntry = zip.file(rootfilePath);
  if (!opfEntry) {
    throw new Error('Invalid EPUB: cannot read the package document');
  }
  const opfDoc = new DOMParser().parseFromString(await opfEntry.async('string'), 'application/xml');

  const baseDir = rootfilePath.includes('/')
    ? rootfilePath.slice(0, rootfilePath.lastIndexOf('/'))
    : '';
  const resolvePath = (href: string): string => {
    const joined = baseDir ? `${baseDir}/${href}` : href;
    return joined.replace(/\/{2,}/g, '/');
  };

  const manifest = new Map<string, { href: string; mediaType: string; properties?: string }>();
  opfDoc.querySelectorAll('manifest > item').forEach((item) => {
    const id = item.getAttribute('id');
    if (!id) return;
    manifest.set(id, {
      href: item.getAttribute('href') ?? '',
      mediaType: item.getAttribute('media-type') ?? '',
      properties: item.getAttribute('properties') ?? undefined,
    });
  });

  // Resolve the cover image: <meta name="cover"> or an item with cover-image property
  let coverDataURL = '';
  const coverMeta = opfDoc.querySelector('metadata > meta[name="cover"]');
  const coverId = coverMeta?.getAttribute('content') ?? '';
  if (coverId || [...manifest.values()].some((item) => item.properties?.includes('cover-image'))) {
    let coverItem = manifest.get(coverId);
    if (!coverItem) {
      coverItem = [...manifest.values()].find((item) => item.properties?.includes('cover-image'));
    }
    if (coverItem) {
      const entry = zip.file(resolvePath(coverItem.href));
      if (entry) {
        try {
          const blob = await entry.async('blob');
          coverDataURL = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
          });
        } catch {
          coverDataURL = '';
        }
      }
    }
  }
  if (!coverDataURL) {
    coverDataURL = generatePlaceholderCover();
  }

  // Reading order comes from the spine
  const spineOrder: string[] = [];
  opfDoc.querySelectorAll('spine > itemref').forEach((ref) => {
    const idref = ref.getAttribute('idref');
    if (idref) spineOrder.push(idref);
  });

  let fullText = '';
  for (const id of spineOrder) {
    const item = manifest.get(id);
    if (!item) continue;
    if (!item.mediaType.includes('html')) continue;

    const entry = zip.file(resolvePath(item.href));
    if (!entry) continue;

    const html = await entry.async('string');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, nav, head').forEach((el) => el.remove());
    const text = (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text) fullText += text + '\n';
  }

  const trimmedText = fullText.trim();
  if (!trimmedText) {
    throw new Error('This EPUB has no readable text. It may be image-based. Please try a different file.');
  }

  return {
    content: splitIntoSegments(trimmedText),
    cover: coverDataURL,
  };
}

// Parse a plain text book
export async function parseTxtFile(file: File): Promise<{ content: TextSegment[]; cover: string }> {
  const text = await file.text();
  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error('This TXT file is empty. Please try a different file.');
  }
  return {
    content: splitIntoSegments(trimmedText),
    cover: generatePlaceholderCover(),
  };
}

// Dispatch to the right parser based on file type
export async function parseBookFile(file: File): Promise<{ content: TextSegment[]; cover: string }> {
  const type = getBookFileType(file);
  if (type === 'epub') return parseEpubFile(file);
  if (type === 'txt') return parseTxtFile(file);
  return parsePDFFile(file);
}
