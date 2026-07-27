import {NextResponse} from "next/server";
import {auth} from "@clerk/nextjs/server";
import {MAX_FILE_SIZE} from "@/lib/constants";
import {mkdir, writeFile} from "fs/promises";
import path from "path";

export async function POST(request: Request): Promise<NextResponse> {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'You must be signed in to upload files.' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided in the request.' }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB.` }, { status: 400 });
        }

        if (file.size === 0) {
            return NextResponse.json({ error: 'File is empty.' }, { status: 400 });
        }

        const filename = `${userId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        // Try Vercel Blob first (for production)
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            try {
                const { put } = await import("@vercel/blob");
                const blob = await put(`books/${filename}`, file, { access: 'public' });
                return NextResponse.json({ url: blob.url, pathname: blob.pathname });
            } catch (blobError) {
                console.error('Vercel Blob upload failed:', blobError);
                // Fall through to filesystem if Blob fails
            }
        }

        // Filesystem fallback (local dev)
        try {
            const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
            await mkdir(uploadsDir, { recursive: true });
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const filePath = path.join(uploadsDir, filename);
            await writeFile(filePath, buffer);
            return NextResponse.json({ url: `/uploads/${filename}`, pathname: filename });
        } catch (fsError) {
            console.error('Filesystem upload failed:', fsError);
            return NextResponse.json({
                error: 'File upload failed. Please check your storage configuration.'
            }, { status: 500 });
        }
    } catch (e) {
        console.error('Upload error:', e);
        const message = e instanceof Error ? e.message : 'Unknown upload error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
