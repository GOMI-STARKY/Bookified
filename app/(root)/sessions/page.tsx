import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Clock, MessageSquare } from "lucide-react";

import { getVoiceSessions } from "@/lib/actions/session.actions";

const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
};

const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};

export default async function SessionsPage() {
    const { userId } = await auth();

    if (!userId) {
        redirect("/sign-in");
    }

    const result = await getVoiceSessions(userId);

    if (!result.success) {
        return (
            <div className="container wrapper py-10">
                <p className="text-muted-foreground">Failed to load session history.</p>
            </div>
        );
    }

    const sessions = (result.data ?? []) as Array<{
        _id: string;
        startedAt: string;
        durationSeconds: number;
        bookId?: { title: string; slug: string; coverURL?: string } | null;
    }>;

    return (
        <div className="container wrapper py-10">
            <div className="flex flex-col items-center text-center mb-10">
                <h1 className="page-title-xl">Session History</h1>
                <p className="text-muted-foreground max-w-2xl">
                    Your past voice conversations with your books.
                </p>
            </div>

            {sessions.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <MessageSquare className="mx-auto mb-4 opacity-40" size={40} />
                    <p>No sessions yet. Start a voice conversation from any book to see it here.</p>
                </div>
            ) : (
                <div className="max-w-3xl mx-auto space-y-3">
                    {sessions.map((session) => {
                        const book = session.bookId;

                        return (
                            <div
                                key={session._id}
                                className="border rounded-xl p-4 flex items-center gap-4"
                            >
                                {book?.coverURL ? (
                                    <Image
                                        src={book.coverURL}
                                        alt={book.title || "Book"}
                                        width={48}
                                        height={64}
                                        className="rounded-md object-cover"
                                    />
                                ) : (
                                    <div className="w-12 h-16 rounded-md bg-[var(--bg-secondary)] shrink-0" />
                                )}

                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate">
                                        {book ? (
                                            <Link
                                                href={`/books/${book.slug}`}
                                                className="hover:underline text-[var(--text-primary)] hover:text-[var(--color-brand)]"
                                            >
                                                {book.title}
                                            </Link>
                                        ) : (
                                            "Deleted book"
                                        )}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {formatDate(session.startedAt)}
                                    </p>
                                </div>

                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                                    <Clock size={14} />
                                    {formatDuration(session.durationSeconds)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
