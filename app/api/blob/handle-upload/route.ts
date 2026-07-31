import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: HandleUploadBody = await request.json();

    console.log("Blob handle-upload: generating token for user", userId);

    const result = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: [
            "application/pdf",
            "application/epub+zip",
            "text/plain",
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/webp",
            "image/gif",
          ],
          maximumSizeInBytes: 50 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("Blob handleUpload error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload handler failed" },
      { status: 400 }
    );
  }
}
