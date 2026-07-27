'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Upload, ImageIcon } from 'lucide-react';
import { UploadSchema } from '@/lib/zod';
import { BookUploadFormValues } from '@/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ACCEPTED_PDF_TYPES, ACCEPTED_IMAGE_TYPES } from '@/lib/constants';
import FileUploader from './FileUploader';
import VoiceSelector from './VoiceSelector';
import LoadingOverlay from './LoadingOverlay';
import {useAuth} from "@clerk/nextjs";
import { toast } from 'sonner';
import {checkBookExists, createBook, saveBookSegments} from "@/lib/actions/book.actions";
import {useRouter} from "next/navigation";
import {parsePDFFile} from "@/lib/utils";
import {upload as blobUpload} from "@vercel/blob/client";

async function uploadFile(file: File): Promise<{ url: string; pathname: string }> {
    const blob = await blobUpload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/blob/handle-upload',
    });
    return { url: blob.url, pathname: blob.pathname };
}

const UploadForm = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [currentStep, setCurrentStep] = useState('');
    const [completedSteps, setCompletedSteps] = useState<string[]>([]);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const { userId } = useAuth();
    const router = useRouter()

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const advanceStep = useCallback((stepId: string) => {
        setCompletedSteps((prev) => [...prev, stepId]);
    }, []);

    const form = useForm<BookUploadFormValues>({
        resolver: zodResolver(UploadSchema),
        defaultValues: {
            title: '',
            author: '',
            persona: '',
            pdfFile: undefined,
            coverImage: undefined,
        },
    });

    const onSubmit = async (data: BookUploadFormValues) => {
        if(!userId) {
           return toast.error("Please login to upload books");
        }

        setIsSubmitting(true);
        setCompletedSteps([]);
        setUploadError(null);

        try {
            const existsCheck = await checkBookExists(data.title);

            if(existsCheck.exists && existsCheck.book) {
                toast.info("Book with same title already exists.");
                form.reset()
                router.push(`/books/${existsCheck.book.slug}`)
                return;
            }

            const fileTitle = data.title.replace(/\s+/g, '-').toLowerCase();
            const pdfFile = data.pdfFile;

            // Step 1: Parse PDF
            setCurrentStep('parsing');
            let parsedPDF;
            try {
                parsedPDF = await parsePDFFile(pdfFile);
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Failed to parse PDF file';
                setUploadError(msg);
                toast.error(msg);
                return;
            }
            advanceStep('parsing');

            if(parsedPDF.content.length === 0) {
                const msg = "No readable text found in this PDF. It may be a scanned image — please try a different file.";
                setUploadError(msg);
                toast.error(msg);
                return;
            }

            // Step 2: Upload PDF file
            setCurrentStep('uploading-file');
            let uploadedPdf;
            try {
                uploadedPdf = await uploadFile(pdfFile);
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Failed to upload PDF file';
                setUploadError(msg);
                toast.error(msg);
                return;
            }
            advanceStep('uploading-file');

            // Step 3: Upload cover
            setCurrentStep('uploading-cover');
            let coverUrl: string;

            try {
                if(data.coverImage) {
                    const uploadedCover = await uploadFile(data.coverImage);
                    coverUrl = uploadedCover.url;
                } else {
                    const response = await fetch(parsedPDF.cover);
                    const blob = await response.blob();
                    const coverFile = new File([blob], `${fileTitle}_cover.png`, { type: 'image/png' });
                    const uploadedCover = await uploadFile(coverFile);
                    coverUrl = uploadedCover.url;
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Failed to upload cover image';
                setUploadError(msg);
                toast.error(msg);
                return;
            }
            advanceStep('uploading-cover');

            // Step 4: Create book in DB
            setCurrentStep('saving-book');
            const book = await createBook({
                clerkId: userId,
                title: data.title,
                author: data.author,
                persona: data.persona,
                fileURL: uploadedPdf.url,
                fileBlobKey: uploadedPdf.pathname,
                coverURL: coverUrl,
                fileSize: pdfFile.size,
            });

            if(!book.success) {
                const errObj = book.error as unknown;
                let msg = "Failed to save book to database. Please try again.";
                if (typeof errObj === 'string' && errObj) {
                    msg = errObj;
                } else if (errObj && typeof errObj === 'object' && 'message' in errObj) {
                    msg = String((errObj as { message: unknown }).message);
                }
                setUploadError(msg);
                toast.error(msg);
                if (book.isBillingError) {
                    router.push("/subscriptions");
                }
                return;
            }

            if(book.alreadyExists) {
                toast.info("Book with same title already exists.");
                form.reset()
                router.push(`/books/${book.data.slug}`)
                return;
            }
            advanceStep('saving-book');

            // Step 5: Save segments
            setCurrentStep('saving-segments');
            const segments = await saveBookSegments(book.data._id, userId, parsedPDF.content);

            if(!segments.success) {
                let msg = "Book was created but segments could not be saved. Your book may still work.";
                if (typeof segments.error === 'string' && segments.error) {
                    msg = `Segments error: ${segments.error}`;
                }
                setUploadError(msg);
                toast.error(msg);
                return;
            }
            advanceStep('saving-segments');

            toast.success("Book uploaded successfully!");
            form.reset();
            router.push('/');
        } catch (error) {
            console.error('Upload flow error:', error);
            const msg = error instanceof Error ? error.message : "An unexpected error occurred. Please try again.";
            setUploadError(msg);
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isMounted) return null;

    return (
        <>
            {isSubmitting && (
                <LoadingOverlay
                    currentStep={currentStep}
                    completedSteps={completedSteps}
                    error={uploadError}
                />
            )}

            <div className="new-book-wrapper">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        {/* 1. PDF File Upload */}
                        <FileUploader
                            control={form.control}
                            name="pdfFile"
                            label="Book PDF File"
                            acceptTypes={ACCEPTED_PDF_TYPES}
                            icon={Upload}
                            placeholder="Click to upload PDF"
                            hint="PDF file (max 50MB)"
                            disabled={isSubmitting}
                        />

                        {/* 2. Cover Image Upload */}
                        <FileUploader
                            control={form.control}
                            name="coverImage"
                            label="Cover Image (Optional)"
                            acceptTypes={ACCEPTED_IMAGE_TYPES}
                            icon={ImageIcon}
                            placeholder="Click to upload cover image"
                            hint="Leave empty to auto-generate from PDF"
                            disabled={isSubmitting}
                        />

                        {/* 3. Title Input */}
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="form-label">Title</FormLabel>
                                    <FormControl>
                                        <Input
                                            className="form-input"
                                            placeholder="ex: Rich Dad Poor Dad"
                                            {...field}
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* 4. Author Input */}
                        <FormField
                            control={form.control}
                            name="author"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="form-label">Author Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            className="form-input"
                                            placeholder="ex: Robert Kiyosaki"
                                            {...field}
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* 5. Voice Selector */}
                        <FormField
                            control={form.control}
                            name="persona"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="form-label">Choose Assistant Voice</FormLabel>
                                    <FormControl>
                                        <VoiceSelector
                                            value={field.value}
                                            onChange={field.onChange}
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* 6. Submit Button */}
                        <Button type="submit" className="form-btn" disabled={isSubmitting}>
                            Begin Synthesis
                        </Button>
                    </form>
                </Form>
            </div>
        </>
    );
};

export default UploadForm;
